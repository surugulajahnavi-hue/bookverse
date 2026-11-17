import logging
import os
import re
import smtplib
import ssl
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Annotated, Any

from dotenv import load_dotenv
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pwdlib import PasswordHash
from pymongo import ASCENDING, MongoClient, ReturnDocument
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError, PyMongoError

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("bookverse")

JWT_ALGORITHM = "HS256"
password_hasher = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)
mongo_client: MongoClient | None = None

SEED_BOOKS = [
    {"_id": "midnight-library", "title": "The Midnight Library", "author": "Matt Haig", "category": "Fiction", "price": 16.99, "isbn": "9780525559474", "badge": "Bestseller", "color": "#d9d4c8", "stock": 12, "minimum_stock_level": 5},
    {"_id": "educated", "title": "Educated", "author": "Tara Westover", "category": "Memoir", "price": 18.50, "isbn": "9780399590504", "badge": "Reader favorite", "color": "#d4c5a9", "stock": 4, "minimum_stock_level": 5},
    {"_id": "atomic-habits", "title": "Atomic Habits", "author": "James Clear", "category": "Self-growth", "price": 21.00, "isbn": "9780735211292", "badge": "Bestseller", "color": "#d9e0db", "stock": 2, "minimum_stock_level": 5},
    {"_id": "normal-people", "title": "Normal People", "author": "Sally Rooney", "category": "Fiction", "price": 15.25, "isbn": "9781984822178", "badge": "", "color": "#d5d9d9", "stock": 18, "minimum_stock_level": 5},
    {"_id": "sapiens", "title": "Sapiens", "author": "Yuval Noah Harari", "category": "History", "price": 19.99, "isbn": "9780062316097", "badge": "", "color": "#e5d7c6", "stock": 3, "minimum_stock_level": 5},
    {"_id": "little-life", "title": "A Little Life", "author": "Hanya Yanagihara", "category": "Fiction", "price": 17.75, "isbn": "9780804172707", "badge": "", "color": "#d9d7e2", "stock": 7, "minimum_stock_level": 5},
    {"_id": "design-everyday", "title": "The Design of Everyday Things", "author": "Don Norman", "category": "Design", "price": 24.00, "isbn": "9780465050659", "badge": "Staff pick", "color": "#e7d8c8", "stock": 5, "minimum_stock_level": 5},
    {"_id": "fourth-wing", "title": "Fourth Wing", "author": "Rebecca Yarros", "category": "Fantasy", "price": 22.50, "isbn": "9781649374042", "badge": "Trending", "color": "#d7c9bd", "stock": 1, "minimum_stock_level": 5},
]


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    name: str
    email: EmailStr
    role: str = "customer"
    username: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class CartItemInput(BaseModel):
    book_id: str = Field(min_length=1, max_length=100)
    quantity: int = Field(ge=1, le=99)


class CartUpdate(BaseModel):
    items: list[CartItemInput] = Field(max_length=100)


class AddCartItem(BaseModel):
    quantity: int = Field(default=1, ge=1, le=99)


class CheckoutRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    address: str = Field(min_length=5, max_length=200)
    city: str = Field(min_length=2, max_length=100)
    postal_code: str = Field(min_length=2, max_length=20)


class StockUpdate(BaseModel):
    stock: int = Field(ge=0, le=1_000_000)


class AdminBookInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    author: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=60)
    price: float = Field(gt=0, le=1_000_000)
    isbn: str = Field(min_length=1, max_length=32)
    badge: str = Field(default="", max_length=40)
    color: str = Field(default="#e8e1d6", pattern=r"^#[0-9a-fA-F]{6}$")
    stock: int = Field(ge=0, le=1_000_000)
    minimum_stock_level: int = Field(ge=0, le=1_000_000)


class AdminUserUpdate(BaseModel):
    role: str = Field(pattern=r"^(customer|store_manager|admin)$")
    active: bool


class OrderStatusUpdate(BaseModel):
    status: str = Field(pattern=r"^(placed|processing|shipped|fulfilled|cancelled)$")


class SiteSettingsUpdate(BaseModel):
    announcement: str = Field(min_length=1, max_length=180)
    free_shipping_threshold: float = Field(ge=0, le=1_000_000)
    minimum_stock_level: int = Field(ge=0, le=1_000_000)


class BookResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(validation_alias="_id")
    title: str
    author: str
    category: str
    price: float
    isbn: str
    badge: str = ""
    color: str = "#e8e1d6"


def get_database():
    uri = os.getenv("MONGODB_URI", "").strip()
    if not uri or "<username>" in uri or "<password>" in uri:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB is not configured. Set MONGODB_URI in the backend environment.",
        )
    global mongo_client
    if mongo_client is None:
        mongo_client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    return mongo_client[os.getenv("MONGODB_DB", "bookverse")]


def get_site_settings(db: Any) -> dict[str, Any]:
    saved = collection(db, "settings").find_one({"_id": "site"}) or {}
    return {
        "announcement": saved.get("announcement", "A little something for your next chapter — free shipping over $40"),
        "free_shipping_threshold": saved.get("free_shipping_threshold", 40),
        "minimum_stock_level": saved.get("minimum_stock_level", 5),
    }


def collection(db: Any, name: str) -> Collection:
    return db[name]


def public_user(user: dict[str, Any]) -> UserResponse:
    email = str(user["email"]).lower()
    admins = configured_emails("ADMIN_EMAILS")
    bootstrap_admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    if bootstrap_admin_email:
        admins.add(bootstrap_admin_email)
    managers = configured_emails("STORE_MANAGER_EMAILS")
    role = "admin" if email in admins else "store_manager" if email in managers else user.get("role", "customer")
    return UserResponse(name=user["name"], email=email, role=role, username=user.get("username"))


def configured_emails(setting: str) -> set[str]:
    return {
        email.strip().lower()
        for email in os.getenv(setting, "").split(",")
        if email.strip()
    }


def alert_recipients() -> list[str]:
    admins = configured_emails("ADMIN_EMAILS")
    bootstrap_admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    if bootstrap_admin_email:
        admins.add(bootstrap_admin_email)
    return sorted(admins | configured_emails("STORE_MANAGER_EMAILS"))


def send_low_stock_notification(alert_id: Any | None, book_title: str, available_quantity: int, minimum_stock_level: int) -> None:
    recipients = alert_recipients()
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    from_email = os.getenv("SMTP_FROM_EMAIL", "").strip()
    if not recipients or not smtp_host or not from_email:
        logger.error(
            "Low-stock alert for %s (quantity %s) was not emailed: configure ADMIN_EMAILS, "
            "STORE_MANAGER_EMAILS, SMTP_HOST, and SMTP_FROM_EMAIL.",
            book_title,
            available_quantity,
        )
        if alert_id is not None:
            collection(get_database(), "low_stock_alerts").update_one(
                {"_id": alert_id},
                {"$set": {"notification_status": "not_configured"}},
            )
        return

    try:
        message = EmailMessage()
        message["Subject"] = f"Low stock alert: {book_title.replace(chr(10), ' ').replace(chr(13), ' ')}"
        message["From"] = from_email
        message["To"] = ", ".join(recipients)
        message.set_content(
            f"Low stock alert\n\n"
            f"Product: {book_title}\n"
            f"Available quantity: {available_quantity}\n"
            f"Minimum stock level: {minimum_stock_level}\n\n"
            "Please restock this product."
        )
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_username = os.getenv("SMTP_USERNAME", "").strip()
        smtp_password = os.getenv("SMTP_PASSWORD", "")
        use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() == "true"
        use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
        if use_ssl:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10, context=ssl.create_default_context()) as server:
                if smtp_username:
                    server.login(smtp_username, smtp_password)
                refused = server.send_message(message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                if use_tls:
                    server.starttls(context=ssl.create_default_context())
                if smtp_username:
                    server.login(smtp_username, smtp_password)
                refused = server.send_message(message)
        if refused:
            raise smtplib.SMTPRecipientsRefused(refused)
    except (OSError, ValueError, smtplib.SMTPException):
        logger.exception("Could not send low-stock notification for %s.", book_title)
        if alert_id is not None:
            collection(get_database(), "low_stock_alerts").update_one(
                {"_id": alert_id},
                {"$set": {"notification_status": "failed"}},
            )
        return
    if alert_id is not None:
        collection(get_database(), "low_stock_alerts").update_one(
            {"_id": alert_id},
            {"$set": {"notification_status": "sent", "sent_at": datetime.now(timezone.utc)}},
        )


def record_low_stock_alert(db: Any, book: dict[str, Any], available_quantity: int) -> Any:
    alert = {
        "book_id": book["_id"],
        "book_title": book["title"],
        "available_quantity": available_quantity,
        "minimum_stock_level": book["minimum_stock_level"],
        "recipients": alert_recipients(),
        "notification_status": "pending",
        "triggered_at": datetime.now(timezone.utc),
    }
    return collection(db, "low_stock_alerts").insert_one(alert).inserted_id


def restore_reserved_stock(db: Any, reserved_items: list[tuple[str, int]]) -> None:
    for book_id, quantity in reversed(reserved_items):
        try:
            collection(db, "books").update_one({"_id": book_id}, {"$inc": {"stock": quantity}})
        except PyMongoError:
            logger.exception("Could not restore stock for book %s after checkout failed.", book_id)


def create_access_token(email: str) -> str:
    secret = os.getenv("JWT_SECRET", "")
    if len(secret) < 32 or secret == "replace-this-with-a-long-random-secret":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT_SECRET must be set to a random secret of at least 32 characters.",
        )
    expires = datetime.now(timezone.utc) + timedelta(
        minutes=int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
    )
    return jwt.encode({"sub": email, "exp": expires}, secret, algorithm=JWT_ALGORITHM)


def seed_database(db: Any) -> None:
    books = collection(db, "books")
    for book in SEED_BOOKS:
        books.update_one({"_id": book["_id"]}, {"$setOnInsert": book}, upsert=True)
        books.update_one(
            {"_id": book["_id"], "stock": {"$exists": False}},
            {"$set": {"stock": book["stock"]}},
        )
        books.update_one(
            {"_id": book["_id"], "minimum_stock_level": {"$exists": False}},
            {"$set": {"minimum_stock_level": book["minimum_stock_level"]}},
        )

    admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    admin_username = os.getenv("ADMIN_USERNAME", "").strip()
    admin_password = os.getenv("ADMIN_PASSWORD", "")
    admin_settings = (admin_email, admin_username, admin_password)
    if any(admin_settings) and not all(admin_settings):
        raise RuntimeError("Set ADMIN_EMAIL, ADMIN_USERNAME, and ADMIN_PASSWORD together to create the initial admin account.")
    if admin_email:
        if len(admin_password) < 12:
            raise RuntimeError("ADMIN_PASSWORD must be at least 12 characters.")
        if not re.fullmatch(r"[a-zA-Z0-9._-]{3,32}", admin_username):
            raise RuntimeError("ADMIN_USERNAME must be 3-32 characters using letters, numbers, dots, underscores, or hyphens.")
        collection(db, "users").update_one(
            {"email": admin_email},
            {
                "$setOnInsert": {
                    "name": admin_username,
                    "username": admin_username.lower(),
                    "email": admin_email,
                    "password_hash": password_hasher.hash(admin_password),
                    "role": "admin",
                    "active": True,
                    "created_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )

    demo_email = os.getenv("DEMO_USER_EMAIL", "").strip().lower()
    demo_password = os.getenv("DEMO_USER_PASSWORD", "")
    if os.getenv("ENVIRONMENT", "development").lower() != "production" and demo_email and demo_password:
        collection(db, "users").update_one(
            {"email": demo_email},
            {
                "$setOnInsert": {
                    "name": "BookVerse Reader",
                    "email": demo_email,
                    "password_hash": password_hasher.hash(demo_password),
                    "role": "customer",
                    "active": True,
                    "created_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    uri = os.getenv("MONGODB_URI", "").strip()
    if uri and "<username>" not in uri and "<password>" not in uri:
        try:
            db = get_database()
            db.command("ping")
            collection(db, "users").create_index([("email", ASCENDING)], unique=True)
            collection(db, "users").create_index([("username", ASCENDING)], unique=True, sparse=True)
            collection(db, "carts").create_index([("user_email", ASCENDING)], unique=True)
            collection(db, "orders").create_index([("user_email", ASCENDING), ("created_at", ASCENDING)])
            collection(db, "low_stock_alerts").create_index([("book_id", ASCENDING), ("triggered_at", ASCENDING)])
            seed_database(db)
            logger.info("Connected to MongoDB and initialized BookVerse data.")
        except PyMongoError:
            logger.exception("Could not connect to MongoDB during startup.")
            raise
    else:
        logger.warning("MONGODB_URI is not configured; database-backed API routes will return 503.")
    yield
    if mongo_client is not None:
        mongo_client.close()


app = FastAPI(
    title="BookVerse API",
    description="Authentication, catalogue, cart, and checkout API for BookVerse.",
    version="1.0.0",
    lifespan=lifespan,
)

frontend_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://127.0.0.1:5500,http://localhost:5500",
    ).split(",")
    if origin.strip()
]
deployed_frontend_origin = "https://bookverse-frontend-6c7yw291v-surugulajahnavi-hue.vercel.app"
deployed_frontend_origins = [
    deployed_frontend_origin,
    "https://bookverse-frontend-alpha.vercel.app",
]
for origin in deployed_frontend_origins:
    if origin not in frontend_origins:
        frontend_origins.append(origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(PyMongoError)
async def mongo_error_handler(_: Request, exc: PyMongoError):
    logger.exception("MongoDB request failed.", exc_info=exc)
    return Response(
        content='{"detail":"Database operation failed. Check the MongoDB connection and try again."}',
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        media_type="application/json",
    )


def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to continue.")
    secret = os.getenv("JWT_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="JWT_SECRET is not configured.")
    try:
        payload = jwt.decode(credentials.credentials, secret, algorithms=[JWT_ALGORITHM])
        email = payload.get("sub")
        if not isinstance(email, str):
            raise JWTError("Token subject is missing.")
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Your session expired. Please sign in again.") from exc

    user = collection(get_database(), "users").find_one({"email": email})
    if user is None or user.get("active", True) is False:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found. Please sign in again.")
    return user


CurrentUser = Annotated[dict[str, Any], Depends(current_user)]


def admin_or_manager(user: CurrentUser) -> dict[str, Any]:
    if public_user(user).role not in {"admin", "store_manager"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or store manager access is required.")
    return user


AdminOrManager = Annotated[dict[str, Any], Depends(admin_or_manager)]


def admin_user(user: CurrentUser) -> dict[str, Any]:
    if public_user(user).role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access is required.")
    return user


AdminUser = Annotated[dict[str, Any], Depends(admin_user)]


@app.get("/api/health")
def health():
    db = get_database()
    db.command("ping")
    return {"status": "ok", "database": "connected"}


@app.post("/api/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest):
    db = get_database()
    user = {
        "name": payload.name.strip(),
        "email": str(payload.email).lower(),
        "password_hash": password_hasher.hash(payload.password),
        "created_at": datetime.now(timezone.utc),
    }
    access_token = create_access_token(user["email"])
    try:
        collection(db, "users").insert_one(user)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.") from exc
    return AuthResponse(
        access_token=access_token,
        user=public_user(user),
    )


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    identifier = payload.email.strip().lower()
    users = collection(get_database(), "users")
    user = users.find_one({"email": identifier}) or users.find_one({"username": identifier})
    if user is None or user.get("active", True) is False or not password_hasher.verify(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect.")
    return AuthResponse(access_token=create_access_token(str(user["email"]).lower()), user=public_user(user))


@app.get("/api/auth/me", response_model=UserResponse)
def me(user: CurrentUser):
    return public_user(user)


@app.get("/api/books", response_model=list[BookResponse])
def list_books(
    _: CurrentUser,
    q: str | None = Query(default=None, max_length=100),
    category: str | None = Query(default=None, max_length=60),
):
    filters: dict[str, Any] = {}
    if category:
        filters["category"] = category
    if q and q.strip():
        term = re.escape(q.strip())
        filters["$or"] = [
            {"title": {"$regex": term, "$options": "i"}},
            {"author": {"$regex": term, "$options": "i"}},
            {"category": {"$regex": term, "$options": "i"}},
        ]
    return list(collection(get_database(), "books").find(filters).sort("title", ASCENDING))


@app.get("/api/books/categories", response_model=list[str])
def list_categories(_: CurrentUser):
    return sorted(collection(get_database(), "books").distinct("category"))


@app.get("/api/site-settings")
def read_site_settings():
    return get_site_settings(get_database())


@app.get("/api/admin/books")
def admin_list_books(_: AdminUser):
    return list(collection(get_database(), "books").find().sort("title", ASCENDING))


@app.post("/api/admin/books", status_code=status.HTTP_201_CREATED)
def admin_create_book(payload: AdminBookInput, _: AdminUser):
    db = get_database()
    book = payload.model_dump()
    base_id = re.sub(r"[^a-z0-9]+", "-", payload.title.lower()).strip("-") or "book"
    book_id = base_id
    while collection(db, "books").find_one({"_id": book_id}):
        book_id = f"{base_id}-{uuid.uuid4().hex[:8]}"
    book["_id"] = book_id
    collection(db, "books").insert_one(book)
    return {"id": book_id, **payload.model_dump()}


@app.put("/api/admin/books/{book_id}")
def admin_update_book(book_id: str, payload: AdminBookInput, _: AdminUser, background_tasks: BackgroundTasks):
    db = get_database()
    books = collection(db, "books")
    previous = books.find_one_and_update(
        {"_id": book_id},
        {"$set": payload.model_dump()},
        return_document=ReturnDocument.BEFORE,
    )
    if previous is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.")
    if previous.get("stock", 0) >= previous.get("minimum_stock_level", 0) and payload.stock < payload.minimum_stock_level:
        try:
            alert_id = record_low_stock_alert(db, {"_id": book_id, **payload.model_dump()}, payload.stock)
        except PyMongoError:
            logger.exception("Could not record the low-stock alert for %s.", payload.title)
            alert_id = None
        background_tasks.add_task(send_low_stock_notification, alert_id, payload.title, payload.stock, payload.minimum_stock_level)
    return {"id": book_id, **payload.model_dump()}


@app.delete("/api/admin/books/{book_id}")
def admin_delete_book(book_id: str, _: AdminUser):
    db = get_database()
    books = collection(db, "books")
    result = books.delete_one({"_id": book_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.")
    collection(db, "carts").update_many({}, {"$pull": {"items": {"book_id": book_id}}})
    return {"id": book_id, "status": "deleted"}


@app.get("/api/admin/users")
def admin_list_users(_: AdminUser):
    return [
        {
            "name": user["name"],
            "username": user.get("username"),
            "email": user["email"],
            "role": public_user(user).role,
            "active": user.get("active", True),
            "created_at": user.get("created_at"),
        }
        for user in collection(get_database(), "users").find().sort("email", ASCENDING)
    ]


@app.put("/api/admin/users/{email}")
def admin_update_user(email: EmailStr, payload: AdminUserUpdate, _: AdminUser):
    db = get_database()
    email_value = str(email).lower()
    existing_user = collection(db, "users").find_one({"email": email_value})
    if existing_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if email_value == str(_.get("email", "")).lower() and (payload.role != "admin" or not payload.active):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot remove your own admin access.")
    configured_admins = configured_emails("ADMIN_EMAILS")
    bootstrap_admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    if bootstrap_admin_email:
        configured_admins.add(bootstrap_admin_email)
    if email_value in configured_admins and (payload.role != "admin" or not payload.active):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The configured bootstrap admin must remain an admin.")
    if public_user(existing_user).role == "admin" and (payload.role != "admin" or not payload.active):
        admins = [
            user for user in collection(db, "users").find()
            if public_user(user).role == "admin" and user.get("active", True)
        ]
        if len(admins) <= 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The last active admin cannot be demoted or disabled.")
    result = collection(db, "users").update_one(
        {"email": email_value},
        {"$set": {"role": payload.role, "active": payload.active}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return {"email": email_value, "role": payload.role, "active": payload.active}


@app.get("/api/admin/orders")
def admin_list_orders(_: AdminUser):
    return [
        {
            "order_id": str(order["_id"]),
            "customer": order["customer"],
            "items": order["items"],
            "subtotal": order["subtotal"],
            "shipping": order["shipping"],
            "total": order["total"],
            "status": order.get("status", "placed"),
            "created_at": order["created_at"],
        }
        for order in collection(get_database(), "orders").find().sort("created_at", -1)
    ]


@app.put("/api/admin/orders/{order_id}/status")
def admin_update_order_status(order_id: str, payload: OrderStatusUpdate, _: AdminUser):
    try:
        object_id = ObjectId(order_id)
    except InvalidId as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.") from exc
    result = collection(get_database(), "orders").update_one(
        {"_id": object_id},
        {"$set": {"status": payload.status}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    return {"order_id": order_id, "status": payload.status}


@app.put("/api/admin/site-settings")
def admin_update_site_settings(payload: SiteSettingsUpdate, _: AdminUser):
    settings = payload.model_dump()
    collection(get_database(), "settings").update_one({"_id": "site"}, {"$set": settings}, upsert=True)
    return settings


@app.get("/api/admin/low-stock")
def list_low_stock_products(_: AdminOrManager):
    db = get_database()
    low_stock_books = list(
        collection(db, "books").find(
            {"$expr": {"$lt": ["$stock", "$minimum_stock_level"]}},
            {"title": 1, "stock": 1, "minimum_stock_level": 1},
        ).sort("title", ASCENDING)
    )
    book_ids = [book["_id"] for book in low_stock_books]
    latest_alerts: dict[str, dict[str, Any]] = {}
    for alert in collection(db, "low_stock_alerts").find({"book_id": {"$in": book_ids}}).sort("triggered_at", -1):
        latest_alerts.setdefault(alert["book_id"], alert)
    return [
        {
            "id": book["_id"],
            "title": book["title"],
            "stock": book["stock"],
            "minimum_stock_level": book["minimum_stock_level"],
            "last_alert_at": latest_alerts.get(book["_id"], {}).get("triggered_at"),
            "notification_status": latest_alerts.get(book["_id"], {}).get("notification_status"),
            "notification_recipients": latest_alerts.get(book["_id"], {}).get("recipients", []),
        }
        for book in low_stock_books
    ]


@app.put("/api/admin/books/{book_id}/stock")
def update_book_stock(book_id: str, payload: StockUpdate, _user: AdminOrManager, background_tasks: BackgroundTasks):
    db = get_database()
    book = collection(db, "books").find_one_and_update(
        {"_id": book_id},
        {"$set": {"stock": payload.stock}},
        return_document=ReturnDocument.BEFORE,
    )
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.")
    minimum_stock_level = book["minimum_stock_level"]
    if book["stock"] >= minimum_stock_level and payload.stock < minimum_stock_level:
        updated_book = {**book, "minimum_stock_level": minimum_stock_level}
        try:
            alert_id = record_low_stock_alert(db, updated_book, payload.stock)
        except PyMongoError:
            logger.exception("Could not record the low-stock alert for %s.", book["title"])
            alert_id = None
        background_tasks.add_task(
            send_low_stock_notification,
            alert_id,
            book["title"],
            payload.stock,
            minimum_stock_level,
        )
    return {
        "id": book_id,
        "stock": payload.stock,
        "minimum_stock_level": minimum_stock_level,
        "status": "low_stock" if payload.stock < minimum_stock_level else "in_stock",
    }


def get_cart_snapshot(db: Any, email: str) -> dict[str, Any]:
    saved = collection(db, "carts").find_one({"user_email": email}) or {"items": []}
    ids = [item["book_id"] for item in saved.get("items", [])]
    book_by_id = {book["_id"]: book for book in collection(db, "books").find({"_id": {"$in": ids}})}
    items = []
    subtotal = 0.0
    for item in saved.get("items", []):
        book = book_by_id.get(item["book_id"])
        if book is None:
            continue
        quantity = item["quantity"]
        line_total = round(book["price"] * quantity, 2)
        subtotal += line_total
        items.append({**BookResponse.model_validate(book).model_dump(), "quantity": quantity, "line_total": line_total})
    subtotal = round(subtotal, 2)
    shipping = 0 if subtotal == 0 or subtotal >= get_site_settings(db)["free_shipping_threshold"] else 4.95
    return {
        "items": items,
        "count": sum(item["quantity"] for item in items),
        "subtotal": subtotal,
        "shipping": shipping,
        "total": round(subtotal + shipping, 2),
    }


@app.get("/api/cart")
def read_cart(user: CurrentUser):
    return get_cart_snapshot(get_database(), user["email"])


@app.put("/api/cart")
def replace_cart(payload: CartUpdate, user: CurrentUser):
    db = get_database()
    merged: dict[str, int] = {}
    for item in payload.items:
        merged[item.book_id] = merged.get(item.book_id, 0) + item.quantity
        if merged[item.book_id] > 99:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A book quantity cannot exceed 99.")
    book_ids = list(merged)
    found = {book["_id"] for book in collection(db, "books").find({"_id": {"$in": book_ids}}, {"_id": 1})}
    missing = set(book_ids) - found
    if missing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Book not found: {', '.join(sorted(missing))}")
    collection(db, "carts").replace_one(
        {"user_email": user["email"]},
        {"user_email": user["email"], "items": [{"book_id": book_id, "quantity": quantity} for book_id, quantity in merged.items()]},
        upsert=True,
    )
    return get_cart_snapshot(db, user["email"])


@app.post("/api/cart/items/{book_id}")
def add_cart_item(book_id: str, payload: AddCartItem, user: CurrentUser):
    db = get_database()
    if collection(db, "books").find_one({"_id": book_id}) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.")
    cart = collection(db, "carts").find_one({"user_email": user["email"]}) or {"items": []}
    items = {item["book_id"]: item["quantity"] for item in cart.get("items", [])}
    quantity = items.get(book_id, 0) + payload.quantity
    if quantity > 99:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A book quantity cannot exceed 99.")
    items[book_id] = quantity
    collection(db, "carts").replace_one(
        {"user_email": user["email"]},
        {"user_email": user["email"], "items": [{"book_id": key, "quantity": value} for key, value in items.items()]},
        upsert=True,
    )
    return get_cart_snapshot(db, user["email"])


@app.delete("/api/cart/items/{book_id}")
def remove_cart_item(book_id: str, user: CurrentUser):
    db = get_database()
    collection(db, "carts").update_one(
        {"user_email": user["email"]},
        {"$pull": {"items": {"book_id": book_id}}},
    )
    return get_cart_snapshot(db, user["email"])


@app.post("/api/orders", status_code=status.HTTP_201_CREATED)
def checkout(payload: CheckoutRequest, user: CurrentUser, background_tasks: BackgroundTasks):
    db = get_database()
    cart = get_cart_snapshot(db, user["email"])
    if not cart["items"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Your cart is empty.")
    books = collection(db, "books")
    reserved_items: list[tuple[str, int]] = []
    alerts: list[tuple[Any, dict[str, Any], int]] = []
    try:
        for item in cart["items"]:
            book = books.find_one_and_update(
                {"_id": item["id"], "stock": {"$gte": item["quantity"]}},
                {"$inc": {"stock": -item["quantity"]}},
                return_document=ReturnDocument.BEFORE,
            )
            if book is None:
                current_book = books.find_one({"_id": item["id"]})
                if current_book is None:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="A book in your cart is no longer available.")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Not enough stock for {current_book['title']}. Available quantity: {current_book.get('stock', 0)}.",
                )
            reserved_items.append((item["id"], item["quantity"]))
            new_stock = book["stock"] - item["quantity"]
            if book["stock"] >= book["minimum_stock_level"] and new_stock < book["minimum_stock_level"]:
                alerts.append((item["id"], book, new_stock))
    except HTTPException:
        restore_reserved_stock(db, reserved_items)
        raise
    except PyMongoError:
        restore_reserved_stock(db, reserved_items)
        raise

    order = {
        "user_email": user["email"],
        "customer": {
            "name": payload.name.strip(),
            "email": str(payload.email).lower(),
            "address": payload.address.strip(),
            "city": payload.city.strip(),
            "postal_code": payload.postal_code.strip(),
        },
        "items": cart["items"],
        "subtotal": cart["subtotal"],
        "shipping": cart["shipping"],
        "total": cart["total"],
        "status": "placed",
        "created_at": datetime.now(timezone.utc),
    }
    try:
        result = collection(db, "orders").insert_one(order)
    except PyMongoError:
        restore_reserved_stock(db, reserved_items)
        raise
    for _, book, new_stock in alerts:
        try:
            alert_id = record_low_stock_alert(db, book, new_stock)
        except PyMongoError:
            logger.exception("Could not record the low-stock alert for %s.", book["title"])
            alert_id = None
        background_tasks.add_task(
            send_low_stock_notification,
            alert_id,
            book["title"],
            new_stock,
            book["minimum_stock_level"],
        )
    collection(db, "carts").update_one({"user_email": user["email"]}, {"$set": {"items": []}})
    return {"order_id": str(result.inserted_id), "total": order["total"], "status": "placed"}


@app.get("/api/orders")
def list_orders(user: CurrentUser):
    orders = collection(get_database(), "orders").find({"user_email": user["email"]}).sort("created_at", -1)
    return [
        {
            "order_id": str(order["_id"]),
            "items": order["items"],
            "subtotal": order["subtotal"],
            "shipping": order["shipping"],
            "total": order["total"],
            "status": order.get("status", "placed"),
            "created_at": order["created_at"],
        }
        for order in orders
    ]
