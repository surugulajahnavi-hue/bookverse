# BookVerse project guide

## Project layout

```text
online book store/
├── Frontend/                 # Static HTML, CSS, JavaScript
│   ├── index.html
│   ├── login.html
│   ├── signup.html
│   ├── books.html
│   ├── search.html
│   ├── cart.html
│   ├── checkout.html
│   ├── logout.html
│   ├── styles.css
│   ├── app.js
│   └── config.js             # Public API URL; never put secrets here
├── Backend/                  # FastAPI + MongoDB API
│   ├── app/main.py
│   ├── requirements.txt
│   ├── .env                  # Private local settings, ignored by Git
│   └── .env.example          # Safe template; no real credentials
├── Documentation/
│   └── README.md
└── .gitignore
```

`Frontend/styles.css` controls site layout, responsive behavior, and theme. `Frontend/app.js` renders pages, handles forms, and calls the JSON API. `Frontend/config.js` points the browser to the API. `Backend/app/main.py` validates requests, authenticates users, reads/writes MongoDB, and computes cart/order totals. The `assets/` directory is only needed if files are kept in an `assets` subfolder; the current HTML references the CSS and JavaScript files directly from `Frontend`.

## Frontend and backend communication

The browser sends JSON requests to `apiBaseUrl` in `Frontend/config.js`. It selects `http://127.0.0.1:8000/api` when the frontend is hosted on localhost/127.0.0.1 and `https://bookverse-2yw0.onrender.com/api` otherwise. Successful login/signup returns a bearer token. The frontend keeps the token in browser local storage and sends it as `Authorization: Bearer ...` to protected routes. The API hashes passwords and stores users, carts, books, and orders in MongoDB. Book prices and order totals are calculated by the API.

## Start locally on Windows PowerShell

### Configure MongoDB and JWT

Open `Backend/.env` locally. Set:

- `MONGODB_URI` to the Atlas connection URI. Use the Atlas database user's password and percent-encode reserved characters in that password.
- `MONGODB_DB=bookverse`
- `JWT_SECRET` to a private random string of at least 32 characters.
- `FRONTEND_ORIGINS=http://127.0.0.1:8765,http://localhost:8765`

Do not paste `.env` values into chat or commit `.env`. If a real password has been exposed, rotate it in MongoDB Atlas. `Backend/.env.example` is a template and must not contain credentials.

### Run the backend

Open the first terminal:

```powershell
Set-Location "C:\Users\HI\Desktop\online book store\Backend"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Create/install dependencies if necessary:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Check `http://127.0.0.1:8000/api/health`. A successful response resembles:

```json
{"status":"ok","database":"connected"}
```

Interactive API reference: `http://127.0.0.1:8000/docs`.

### Run the frontend

Port 5500 may be occupied by another local program. Use a second terminal and port 8765:

```powershell
Set-Location "C:\Users\HI\Desktop\online book store"
py -m http.server 8765 --directory Frontend
```

Open `http://127.0.0.1:8765`. Keep both terminal windows open while testing. Don't open HTML via `file://`; the browser must load it over HTTP for API requests and CORS.

Local development demo credentials can be set in `Backend/.env`. Do not put demo credentials in `Frontend/config.js`; anything in frontend configuration is public. Do not set demo-user environment variables in production.

## API endpoints

All paths below are prefixed with `/api`. Routes marked **auth** need the bearer token from login/signup.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Check API and MongoDB connectivity |
| POST | `/auth/signup` | Create account and return a token |
| POST | `/auth/login` | Verify credentials and return a token |
| GET | `/auth/me` | **auth** Return current account |
| GET | `/books` | **auth** List/search/filter catalogue (`q`, `category`) |
| GET | `/books/categories` | **auth** List categories |
| GET | `/cart` | **auth** Read cart and server-calculated totals |
| PUT | `/cart` | **auth** Replace cart contents |
| POST | `/cart/items/{book_id}` | **auth** Add quantity of a book |
| DELETE | `/cart/items/{book_id}` | **auth** Remove a book |
| POST | `/orders` | **auth** Place an order and clear cart |
| GET | `/orders` | **auth** List account's orders |

## Render deployment

Deploy the backend and frontend as separate services.

### Backend Web Service

- Root Directory: `Backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Render environment variables:
  - `ENVIRONMENT=production`
  - `MONGODB_URI` (set as a Render secret; use the rotated Atlas credential)
  - `MONGODB_DB=bookverse`
  - `JWT_SECRET` (unique random secret, at least 32 characters)
  - `JWT_EXPIRE_MINUTES=60`
  - `FRONTEND_ORIGINS=https://<your-frontend-domain>` (comma-separated if multiple domains)
- Do not configure `DEMO_USER_EMAIL` or `DEMO_USER_PASSWORD` in production.
- Configure Atlas Network Access so the backend service can connect.

### Frontend Static Site

- Root/Publish Directory: `Frontend`
- Build command: none
- Publish directory: `.`
- Set `Frontend/config.js` `apiBaseUrl` to `https://<your-backend-service>.onrender.com/api`.
- Set backend `FRONTEND_ORIGINS` to the exact HTTPS frontend origin, then restart/redeploy the backend.

The current frontend deployment is `https://bookverse-frontend-alpha.vercel.app`. Add that exact origin to Render's `FRONTEND_ORIGINS` environment variable (alongside any other active frontend origins). CORS changes in source code take effect only after the backend service is redeployed.

Frontend config is public in the browser; it must never contain MongoDB credentials or the JWT signing secret.

## Troubleshooting

- `uvicorn is not recognized`: run `.\.venv\Scripts\python.exe -m uvicorn ...` from `Backend`.
- `InvalidURI`: ensure the URI has no `<db_password>` placeholder; percent-encode reserved characters in the password.
- `MongoServerSelectionTimeoutError`: check Atlas Network Access, cluster status, DNS, and credentials.
- Browser CORS error: add the exact frontend origin (scheme, host, port) to `FRONTEND_ORIGINS`, then restart the backend.
- `Failed to fetch`: ensure both servers are running and `Frontend/config.js` points to the correct API URL.
- Port in use: choose an unused port and add its frontend origin to `FRONTEND_ORIGINS`.

## Production checklist

This is a backend starter, not a fully hardened commerce system. Add rate limiting, email verification, password reset, order status/fulfillment, payment-provider integration, monitoring, and a production token storage strategy before launch. Never collect or store card details directly in this application.
