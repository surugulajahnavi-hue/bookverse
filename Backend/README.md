# BookVerse backend

FastAPI REST API with MongoDB persistence. Run the frontend over HTTP (not by opening the HTML files as `file://`) so browser requests to the API work.

## Local setup

1. Install Python 3.10 or later.
2. From `Backend`, create and activate a virtual environment:

   ```powershell
   py -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   Copy-Item .env.example .env
   ```

3. Edit `.env`: set `MONGODB_URI` to your MongoDB Atlas connection string and set `JWT_SECRET` to a random value of at least 32 characters. URL-encode reserved characters in the database password (for example, `@` and `#`). Keep `.env` private; it is ignored by Git.
4. Start the API from `Backend`:

   ```powershell
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

5. In another terminal, serve `Frontend`:

   ```powershell
   py -m http.server 5500 --directory ..\Frontend
   ```

6. Open `http://127.0.0.1:5500`. The development demo account is seeded when its credentials are present in `.env`. Use the credentials shown on the login page.

Interactive API documentation is available at `http://127.0.0.1:8000/docs`; `GET /api/health` checks the MongoDB connection.

## API endpoints

- `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/books`, `GET /api/books/categories`
- `GET /api/site-settings`
- Admin-only book CRUD: `GET/POST /api/admin/books`, `PUT/DELETE /api/admin/books/{book_id}`
- Admin-only users: `GET /api/admin/users`, `PUT /api/admin/users/{email}` (role and active access)
- Admin-only orders/settings: `GET /api/admin/orders`, `PUT /api/admin/orders/{order_id}/status`, `PUT /api/admin/site-settings`
- Admin/store-manager inventory: `GET /api/admin/low-stock`, `PUT /api/admin/books/{book_id}/stock`
- `GET /api/cart`, `PUT /api/cart`, `POST /api/cart/items/{book_id}`, `DELETE /api/cart/items/{book_id}`
- `POST /api/orders`, `GET /api/orders`

Authenticated routes require `Authorization: Bearer <access_token>`. Book prices and order totals are calculated by the API, not trusted from the browser.

## Low-stock alerts

Each book has `stock` and `minimum_stock_level` inventory fields. Checkout reserves each product with an atomic stock update and rejects orders that exceed availability. When stock crosses from at/above the minimum to below it, BookVerse records an alert and sends an email to configured admins and store managers. Existing seeded books are migrated with initial inventory values; several seed books start below the minimum to demonstrate the dashboard.

### Initial admin account

Set `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in the private `Backend/.env` (or deployment secret settings) before starting the API. On first startup, BookVerse creates the account with an Argon2-hashed password; it never replaces the password for an existing account. Use a unique password with at least 12 characters and an admin username 3-32 characters long. Sign in at `login.html` with the email or username and that password. Never commit `.env` or send the password in chat.

Set `ADMIN_EMAILS` and `STORE_MANAGER_EMAILS` to comma-separated account email addresses for additional admins and managers. These trusted server-side settings assign initial roles; users cannot grant themselves a role during signup. The initial `ADMIN_EMAIL` is automatically treated as an admin. Configure SMTP with `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM_EMAIL`, and, if required by the mail server, `SMTP_USERNAME` and `SMTP_PASSWORD`. By default the backend uses STARTTLS (`SMTP_USE_TLS=true`); use `SMTP_USE_SSL=true` for implicit TLS instead. Keep mail credentials in the backend environment, never in the frontend.

Open `admin.html` to manage books, user roles and access, orders, stock, and storefront announcement/shipping settings. Store managers can view low-stock products and update inventory. A missing or failed SMTP configuration is logged and shown as notification status on the dashboard; the stock alert remains visible so it can still be handled manually.

## Render deployment

Deploy the backend as a Render **Web Service** with `Backend` as its Root Directory:

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Add environment variables: `MONGODB_URI`, `MONGODB_DB=bookverse`, a strong random `JWT_SECRET`, `ENVIRONMENT=production`, `FRONTEND_ORIGINS` set to the exact deployed frontend origin, admin/manager email lists, and SMTP settings for email alerts; optionally `JWT_EXPIRE_MINUTES`.
- Do not set `DEMO_USER_EMAIL` or `DEMO_USER_PASSWORD` in production.

Deploy `Frontend` separately as a Render **Static Site**, using `Frontend` as its Publish Directory. Update `Frontend/config.js` so `apiBaseUrl` points to the deployed API plus `/api`, for example `https://your-service.onrender.com/api`. Remove `demoLogin` from that file before publishing. The frontend is static, so its API URL is public configuration, not a secret.

The demo API uses bearer tokens in browser local storage and is a starting point for integration. Before a production launch, add rate limiting, email verification/password recovery, stricter security monitoring, and a payment provider; do not collect or store card details in this app.
