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
- `GET /api/cart`, `PUT /api/cart`, `POST /api/cart/items/{book_id}`, `DELETE /api/cart/items/{book_id}`
- `POST /api/orders`, `GET /api/orders`

Authenticated routes require `Authorization: Bearer <access_token>`. Book prices and order totals are calculated by the API, not trusted from the browser.

## Render deployment

Deploy the backend as a Render **Web Service** with `Backend` as its Root Directory:

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Add environment variables: `MONGODB_URI`, `MONGODB_DB=bookverse`, a strong random `JWT_SECRET`, `ENVIRONMENT=production`, `FRONTEND_ORIGINS` set to the exact deployed frontend origin, and optionally `JWT_EXPIRE_MINUTES`.
- Do not set `DEMO_USER_EMAIL` or `DEMO_USER_PASSWORD` in production.

Deploy `Frontend` separately as a Render **Static Site**, using `Frontend` as its Publish Directory. Update `Frontend/config.js` so `apiBaseUrl` points to the deployed API plus `/api`, for example `https://your-service.onrender.com/api`. Remove `demoLogin` from that file before publishing. The frontend is static, so its API URL is public configuration, not a secret.

The demo API uses bearer tokens in browser local storage and is a starting point for integration. Before a production launch, add rate limiting, email verification/password recovery, stricter security monitoring, and a payment provider; do not collect or store card details in this app.
