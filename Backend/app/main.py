import logging
import os
import re
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pwdlib import PasswordHash
from pymongo import ASCENDING, MongoClient
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
    {"_id": "midnight-library", "title": "The Midnight Library", "author": "Matt Haig", "category": "Fiction", "price": 16.99, "isbn": "9780525559474", "badge": "Bestseller", "color": "#d9d4c8"},
    {"_id": "educated", "title": "Educated", "author": "Tara Westover", "category": "Memoir", "price": 18.50, "isbn": "9780399590504", "badge": "Reader favorite", "color": "#d4c5a9"},
    {"_id": "atomic-habits", "title": "Atomic Habits", "author": "James Clear", "category": "Self-growth", "price": 21.00, "isbn": "9780735211292", "badge": "Bestseller", "color": "#d9e0db"},
    {"_id": "normal-people", "title": "Normal People", "author": "Sally Rooney", "category": "Fiction", "price": 15.25, "isbn": "9781984822178", "badge": "", "color": "#d5d9d9"},
    {"_id": "sapiens", "title": "Sapiens", "author": "Yuval Noah Harari", "category": "History", "price": 19.99, "isbn": "9780062316097", "badge": "", "color": "#e5d7c6"},
    {"_id": "little-life", "title": "A Little Life", "author": "Hanya Yanagihara", "category": "Fiction", "price": 17.75, "isbn": "9780804172707", "badge": "", "color": "#d9d7e2"},
    {"_id": "design-everyday", "title": "The Design of Everyday Things", "author": "Don Norman", "category": "Design", "price": 24.00, "isbn": "9780465050659", "badge": "Staff pick", "color": "#e7d8c8"},
    {"_id": "fourth-wing", "title": "Fourth Wing", "author": "Rebecca Yarros", "category": "Fantasy", "price": 22.50, "isbn": "9781649374042", "badge": "Trending", "color": "#d7c9bd"},
]


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    name: str
    email: EmailStr


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


def collection(db: Any, name: str) -> Collection:
    return db[name]


def public_user(user: dict[str, Any]) -> UserResponse:
    return UserResponse(name=user["name"], email=user["email"])


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
            collection(db, "carts").create_index([("user_email", ASCENDING)], unique=True)
            collection(db, "orders").create_index([("user_email", ASCENDING), ("created_at", ASCENDING)])
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
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found. Please sign in again.")
    return user


CurrentUser = Annotated[dict[str, Any], Depends(current_user)]


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
    email = str(payload.email).lower()
    user = collection(get_database(), "users").find_one({"email": email})
    if user is None or not password_hasher.verify(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect.")
    return AuthResponse(access_token=create_access_token(email), user=public_user(user))


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
    shipping = 0 if subtotal == 0 or subtotal >= 40 else 4.95
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
def checkout(payload: CheckoutRequest, user: CurrentUser):
    db = get_database()
    cart = get_cart_snapshot(db, user["email"])
    if not cart["items"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Your cart is empty.")
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
        "created_at": datetime.now(timezone.utc),
    }
    result = collection(db, "orders").insert_one(order)
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
            "created_at": order["created_at"],
        }
        for order in orders
    ]
