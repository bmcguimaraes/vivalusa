# Vivalusa — Implementation Plan (v2)

> **Status**: Awaiting owner approval — no code has been changed  
> **Date**: 2026-04-20  
> **Changes from v1**: 12 bugs/additions fixed (see changelog at bottom)

---

## Answers to Pre-Plan Questions

### Q1 — What is `emergentintegrations` and can it be replaced?

**What it is**

`emergentintegrations` (v0.1.0) is a proprietary wrapper library from the Emergent Agent platform where this project was originally built. It is not on PyPI and cannot be installed outside that platform. Source is not in the repo.

From the call signatures in `server.py`, it wraps three Stripe operations:

| Library call | What it does underneath |
|---|---|
| `StripeCheckout(api_key, webhook_url)` | Initialises Stripe client; `webhook_url` is likely for dynamic webhook registration on the Emergent platform — not portable |
| `stripe_checkout.create_checkout_session(req)` | Wraps `stripe.checkout.Session.create()` |
| `stripe_checkout.get_checkout_status(session_id)` | Wraps `stripe.checkout.Session.retrieve()` |
| `stripe_checkout.handle_webhook(body, sig_header)` | Wraps `stripe.Webhook.construct_event()` — which env var it reads the signing secret from is unknown without source access |

**Critical**: if you deploy outside the Emergent platform, this package will not install. Stripe checkout breaks on day one.

**Replace with native Stripe?** Yes. The `stripe` package (v15.0.1) is already in `requirements.txt`. Full diffs are in Part D2. New env var needed: `STRIPE_WEBHOOK_SECRET` (from Stripe dashboard → Webhooks).

---

**Emergent Object Storage — can it be swapped for S3/R2?**

The object storage does NOT use `emergentintegrations`. It is raw HTTP calls to `https://integrations.emergentagent.com/objstore/api/v1/storage` authenticated via `EMERGENT_LLM_KEY` (`server.py:37-68`).

Replacing with boto3 (S3-compatible, works with Cloudflare R2):

```python
# New env vars: S3_ENDPOINT_URL (R2 only), S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_REGION
import boto3

_s3 = None
def _get_s3():
    global _s3
    if not _s3:
        _s3 = boto3.client(
            "s3",
            endpoint_url=os.environ.get("S3_ENDPOINT_URL"),  # omit for AWS; required for R2
            aws_access_key_id=os.environ["S3_ACCESS_KEY"],
            aws_secret_access_key=os.environ["S3_SECRET_KEY"],
            region_name=os.environ.get("S3_REGION", "auto"),
        )
    return _s3

BUCKET = os.environ.get("S3_BUCKET", "vivalusa-images")

def put_object(path: str, data: bytes, content_type: str) -> dict:
    _get_s3().put_object(Bucket=BUCKET, Key=path, Body=data, ContentType=content_type)
    return {"path": path}

def get_object(path: str):
    obj = _get_s3().get_object(Bucket=BUCKET, Key=path)
    return obj["Body"].read(), obj["ContentType"]
```

**Recommendation: Cloudflare R2.** Zero egress fees, EU datacenter available, S3-compatible, generous free tier. The path structure (`vivalusa/products/uuid.ext`) maps directly to R2 object keys.

---

### Q2 — Where is `VivaLusa2024!` referenced?

Three places — two in source, one in the test suite:

| File | Line | Context |
|------|------|---------|
| `backend/server.py:879` | Default fallback: `os.environ.get("ADMIN_PASSWORD", "VivaLusa2024!")` |
| `backend/server.py:925` | **Writes the password to `/app/memory/test_credentials.md` on every startup** |
| `backend_test.py:104` | Hardcoded test credential |

**Line 925 is a new finding worse than what REVIEW.md reported.** Every startup, the app writes plaintext admin email + password to `/app/memory/test_credentials.md`. Even if you set `ADMIN_PASSWORD` to a strong secret via env var, it lands in a plaintext file on the container filesystem. This block must be deleted.

**No other credentials are hardcoded** near those lines.

**On `test_credentials.md` in the repo:**
- `memory/test_credentials.md` is listed explicitly in `.gitignore` (confirmed)
- The file has never been committed to git (git log shows no history for that path)
- The `memory/` directory in the repo contains only `PRD.md`, which is committed
- The path `/app/memory/` in the server code is the container runtime path, separate from the repo `memory/` folder

See A3 for the full action list.

---

### Q3 — Packages in `requirements.txt` not imported in the code

`requirements.txt` is a full `pip freeze` output. Below I separate top-level removals from transitives.

**Remove these top-level packages — they are unused and pull in large trees:**

| Package | Saved size | Reason |
|---------|-----------|--------|
| `openai` | ~50 MB | Not imported anywhere |
| `litellm` | ~30 MB | Not imported anywhere |
| `google-genai` / `google-generativeai` | ~40 MB | Not imported anywhere |
| `huggingface_hub` | ~30 MB | Not imported anywhere |
| `pandas` | ~25 MB | Not imported anywhere |
| `pillow` | ~15 MB | Installed, never called |
| `paypalrestsdk` | ~5 MB | PayPal done via raw `requests`; SDK never imported |
| `passlib` | ~2 MB | `bcrypt` used directly; `passlib` never imported |
| `python-jose` | ~3 MB | `PyJWT` used; `python-jose` never imported |
| `jq` | ~5 MB | Not imported |
| `rich` | ~5 MB | Not imported |
| `typer` | ~2 MB | Not imported |
| `tiktoken` | ~5 MB | OpenAI tokenizer; not used |
| `tokenizers` | ~10 MB | HuggingFace tokenizer; not used |
| `tqdm` | ~1 MB | Not imported |
| `PyYAML` | ~2 MB | Not imported |
| `s5cmd` | ~1 MB | Not imported |
| `numpy` | ~20 MB | Only pulled in by pandas/AI; not directly used |

**Keep `boto3` / `botocore` / `s3transfer`** — they will be needed for the R2 migration (Part D / Q1 above). They are already in `requirements.txt`; they stay in `requirements.in`.

**Estimated Docker image reduction: ~250–350 MB.**

---

### Q4 — PayPal frontend: any new credentials needed?

No. The frontend calls `GET /api/paypal/client-id` at runtime. `@paypal/react-paypal-js` uses that client ID to load the SDK and render the button. The only credentials needed are the ones already listed: `PAYPAL_CLIENT_ID` and `PAYPAL_SECRET`.

You will need separate sandbox credentials (for testing) and live credentials (for production). Same env var names, different values per environment.

---

### Q13 — USD vs EUR vs match-display-currency for Stripe

The current code charges in `"usd"` — this is wrong for a Portugal-based shop.

**Option 1: Always charge in EUR (recommended)**

```python
# In create_checkout_session — currency is hardcoded to EUR
session = stripe_lib.checkout.Session.create(
    line_items=[{
        "price_data": {
            "currency": "eur",
            "unit_amount": int(final_total * 100),   # cents
            "product_data": {"name": "VivaLusa Order"},
        },
        "quantity": 1,
    }],
    mode="payment",
    ...
)
```

What changes: the `checkout_request = CheckoutSessionRequest(currency="usd", ...)` line becomes the `stripe_lib.checkout.Session.create(...)` call with `"eur"` hardcoded. No changes to `CheckoutRequest` model or frontend.

**Option 2: Match display currency**

```python
# CheckoutRequest model gains a currency field:
class CheckoutRequest(BaseModel):
    items: List[Dict]
    shipping_address: Dict
    origin_url: str
    guest_email: Optional[str] = None
    currency: str = "EUR"   # NEW: frontend sends selected currency

# In create_checkout_session, lock the rate server-side at checkout time:
rates = await get_exchange_rates()
currency = req.currency.upper()
rate = rates.get(currency, 1.0)
amount_in_currency = round(final_total * rate, 2)

# Zero-decimal currencies (JPY, KRW, etc.) don't use cents:
ZERO_DECIMAL = {"BIF","CLP","GNF","JPY","KMF","KRW","MGA","PYG","RWF","UGX","VND","VUV","XAF","XOF","XPF"}
unit_amount = int(amount_in_currency) if currency in ZERO_DECIMAL else int(amount_in_currency * 100)

session = stripe_lib.checkout.Session.create(
    line_items=[{
        "price_data": {
            "currency": currency.lower(),
            "unit_amount": unit_amount,
            "product_data": {"name": "VivaLusa Order"},
        },
        "quantity": 1,
    }],
    ...
)
```

**Recommendation: Option 1 (always EUR).**

For a Portuguese shop with primarily EU customers:
- 90%+ of customers are in EUR-zone; no conversion needed
- No Stripe currency conversion surcharge (1.5% on non-EUR charges, since your payout is EUR)
- Simpler refunds: refund amount is always in EUR
- Simpler accounting: one currency in your bank
- The multi-currency display in the UI remains valuable — customers see approximate prices in their local currency while browsing. The Stripe Checkout page already shows "charged in EUR" which is standard and expected in EU e-commerce

Option 2 makes sense only if you expand significantly to non-EUR markets (UK, US, etc.) and want to absorb the conversion fee in exchange for a smoother customer experience. Not worth the added complexity now.

---

---

## Part A — Quick Wins (under 1 hour)

> Execution order changed from v1: A1–A5 first → then D2 (removes `emergentintegrations`) → then A6 (finalises dep file) → then B (Docker, so dep file is final before image is built).

---

### A1 — Fix CORS

**Problem**: `allow_origins="*"` with `allow_credentials=True` is rejected by the CORS spec. Auth cookies never reach the API in production.

**Diff** (`backend/server.py:932-938`):

```diff
-app.add_middleware(
-    CORSMiddleware,
-    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
-    allow_credentials=True,
-    allow_methods=["*"],
-    allow_headers=["*"],
-)
+_cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
+if not _cors_origins:
+    raise RuntimeError(
+        "CORS_ORIGINS env var is required. "
+        "Example: CORS_ORIGINS=https://vivalusa.com"
+    )
+app.add_middleware(
+    CORSMiddleware,
+    allow_origins=_cors_origins,
+    allow_credentials=True,
+    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
+    allow_headers=["Content-Type", "Authorization", "Cookie"],
+)
```

**New env var required**: `CORS_ORIGINS=https://vivalusa.com`. App refuses to start without it.

---

### A2 — Fix auth cookie `secure` flag

**Problem**: `secure=False` in production; tokens sent over HTTP.

**Diff** — add after existing imports (`backend/server.py`):

```diff
+IS_PRODUCTION = os.environ.get("ENVIRONMENT", "development").lower() == "production"
```

**Diff** (`server.py:139-141` — `set_auth_cookies`):

```diff
 def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
-    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
-    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
+    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=IS_PRODUCTION, samesite="lax", max_age=3600, path="/")
+    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=IS_PRODUCTION, samesite="lax", max_age=604800, path="/")
```

**Diff** (`server.py:266` — inline cookie in `refresh_token` endpoint):

```diff
-        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
+        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=IS_PRODUCTION, samesite="lax", max_age=3600, path="/")
```

**New env var**: `ENVIRONMENT=production` (must be set in production deployment).

---

### A3 — Remove hardcoded admin password + credential file writer + fix test file

**Problem 1**: `ADMIN_PASSWORD` has a hardcoded fallback. If env var is missing, `"VivaLusa2024!"` is the live admin password.

**Problem 2** (startup writes plaintext password to disk): Lines 918–928 write admin email and password to `/app/memory/test_credentials.md` on every startup. The path is the container filesystem — not the repo `memory/` folder. This file has never been committed to git (`memory/test_credentials.md` is in `.gitignore` and git log shows no history). However, the file is still written to disk on every boot, meaning anyone with container/shell access can read your production admin password in plaintext.

**Files that exist to check before applying this diff** (your approval required):
- `/app/memory/test_credentials.md` — exists only inside a running container (path is `/app/memory/`, not repo `memory/`). If you have a running container, run: `docker exec <container> cat /app/memory/test_credentials.md` to confirm it contains live credentials, then delete it: `docker exec <container> rm /app/memory/test_credentials.md`.
- Repo `memory/` directory contains only `PRD.md` — nothing to delete there.

**Diff** (`backend/server.py:877-928`):

```diff
 async def seed_admin():
     admin_email = os.environ.get("ADMIN_EMAIL", "admin@vivalusa.com")
-    admin_password = os.environ.get("ADMIN_PASSWORD", "VivaLusa2024!")
+    admin_password = os.environ.get("ADMIN_PASSWORD")
+    if not admin_password:
+        raise RuntimeError(
+            "ADMIN_PASSWORD env var is required. "
+            "Set a strong password (min 16 chars) before starting the server."
+        )
     existing = await db.users.find_one({"email": admin_email})
     if existing is None:
         await db.users.insert_one({
             "email": admin_email,
             "password_hash": hash_password(admin_password),
             "name": "Admin",
             "role": "admin",
             "created_at": datetime.now(timezone.utc).isoformat()
         })
         logger.info(f"Admin seeded: {admin_email}")
     elif not verify_password(admin_password, existing["password_hash"]):
         await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
         logger.info("Admin password updated")

 @app.on_event("startup")
 async def startup():
     await db.users.create_index("email", unique=True)
     await db.login_attempts.create_index("identifier")
     await db.products.create_index("category")
     await db.products.create_index("id", unique=True)
     await db.payment_transactions.create_index("session_id")
     await db.orders.create_index("user_id")
     await db.files.create_index("storage_path")
     await seed_admin()
     await seed_products()
     try:
         init_storage()
         logger.info("Object storage initialized")
     except Exception as e:
         logger.error(f"Storage init failed: {e}")
-    # Write test credentials
-    creds_dir = Path("/app/memory")
-    creds_dir.mkdir(exist_ok=True)
-    creds_file = creds_dir / "test_credentials.md"
-    creds_file.write_text(
-        f"# Test Credentials\n\n"
-        f"## Admin\n- Email: {os.environ.get('ADMIN_EMAIL', 'admin@vivalusa.com')}\n"
-        f"- Password: {os.environ.get('ADMIN_PASSWORD', 'VivaLusa2024!')}\n- Role: admin\n\n"
-        f"## Auth Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n"
-        f"- POST /api/auth/logout\n- GET /api/auth/me\n- POST /api/auth/refresh\n"
-    )
```

**Diff** (`backend_test.py:102-105`):

```diff
         admin_data = {
             "email": "admin@vivalusa.com",
-            "password": "VivaLusa2024!"
+            "password": os.environ["ADMIN_PASSWORD"]
         }
```

Also add `import os` at the top of `backend_test.py` if not already present (it isn't — it imports only `requests`, `sys`, `json`, `datetime`).

**New env var required**: `ADMIN_PASSWORD`. App refuses to start without it.

---

### A4 — Security headers middleware

**Diff** — add after existing imports in `backend/server.py`:

```diff
+from starlette.middleware.base import BaseHTTPMiddleware
+
+class SecurityHeadersMiddleware(BaseHTTPMiddleware):
+    async def dispatch(self, request, call_next):
+        response = await call_next(request)
+        response.headers["X-Content-Type-Options"] = "nosniff"
+        response.headers["X-Frame-Options"] = "DENY"
+        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
+        response.headers["X-XSS-Protection"] = "0"
+        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
+        if IS_PRODUCTION:
+            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
+        return response
```

Add middleware registration immediately after `app = FastAPI()`:

```diff
 app = FastAPI()
+app.add_middleware(SecurityHeadersMiddleware)
 api_router = APIRouter(prefix="/api")
```

**Note**: `IS_PRODUCTION` must be defined before this class (see A2 diff). CSP for the React frontend belongs on the nginx/CDN layer, not the JSON API — see B2.

---

### A5 — Pin runtime versions

**File to create**: `frontend/.nvmrc`
```
22
```

**File to create**: `backend/.python-version`
```
3.12
```

---

### A6 — Delete unused dependencies

> Applied after D2 removes `emergentintegrations`, so the final dep files are clean before Docker is built.

**Frontend `frontend/package.json`** — remove from `dependencies`:

```diff
-    "cra-template": "1.2.0",
-    "embla-carousel-react": "^8.6.0",
-    "react-resizable-panels": "^3.0.1",
```

Keep: `@paypal/react-paypal-js` (Part D1), `recharts` (admin charts), `input-otp` (Part C 2FA input), `@emergentbase/visual-edits` (removed in Part F, not here).

**Backend** — replace `backend/requirements.txt` workflow with a proper `requirements.in`:

`backend/requirements.in` (direct deps only):

```
fastapi==0.110.1
uvicorn==0.25.0
motor==3.3.1
pymongo==4.5.0
pydantic[email]==2.12.5
PyJWT==2.12.1
bcrypt==4.1.3
requests==2.33.1
python-dotenv==1.2.2
python-multipart==0.0.24
stripe==15.0.1
httpx==0.28.1
boto3==1.42.86
pyotp==2.9.0
qrcode[pil]==7.4.2
resend==2.7.0
slowapi==0.1.9
sentry-sdk[fastapi]==2.23.0
```

`backend/requirements-dev.in`:
```
pytest==9.0.3
black==26.3.1
flake8==7.3.0
isort==8.0.1
mypy==1.20.0
```

Regenerate: `pip install pip-tools && pip-compile requirements.in -o requirements.txt`

**Note**: `emergentintegrations` is intentionally absent — it is removed in D2, which runs before A6.

---

---

## Part B — Deployment Infrastructure

### B1 — Dockerfile (backend)

```dockerfile
# backend/Dockerfile

# Stage 1: dependency builder
FROM python:3.12-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: runtime
FROM python:3.12-slim AS runtime
RUN useradd --create-home --shell /bin/bash appuser
WORKDIR /app
COPY --from=builder /install /usr/local
COPY server.py .
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/products')" || exit 1
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

### B2 — Frontend Dockerfile + nginx

The React SPA is a static build. No Node.js server needed in production.

The nginx config references `$REACT_APP_BACKEND_URL` in the CSP header. Because nginx does not substitute env vars in config files at runtime, we use the **nginx official image's template mechanism**: files placed at `/etc/nginx/templates/*.template` are processed with `envsubst` by the container entrypoint before nginx starts. This lets environment variables flow through correctly without a custom entrypoint script.

```dockerfile
# frontend/Dockerfile

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
RUN yarn build

FROM nginx:alpine AS runtime
COPY --from=builder /app/build /usr/share/nginx/html
# Template file — nginx entrypoint runs envsubst on it, writing to /etc/nginx/conf.d/default.conf
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
```

`frontend/nginx.conf.template` (note `${REACT_APP_BACKEND_URL}` — envsubst replaces this at container start):

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|svg|ico|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cdn.posthog.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://us.i.posthog.com https://api.frankfurter.dev ${REACT_APP_BACKEND_URL};" always;
}
```

### B3 — `docker-compose.yml` for local dev

```yaml
# docker-compose.yml (repo root)
version: "3.9"

services:
  mongo:
    image: mongo:7
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: vivalusa

  backend:
    build:
      context: ./backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    depends_on:
      mongo:
        condition: service_started
    env_file:
      - .env
    environment:
      MONGO_URL: mongodb://mongo:27017
      CORS_ORIGINS: http://localhost:3000
      ENVIRONMENT: development

  frontend:
    build:
      context: ./frontend
      args:
        REACT_APP_BACKEND_URL: http://localhost:8000
    restart: unless-stopped
    ports:
      - "3000:80"
    environment:
      REACT_APP_BACKEND_URL: http://localhost:8000
    depends_on:
      - backend

volumes:
  mongo_data:
```

Start: `docker compose up --build`

### B4 — Platform recommendation

**Recommended: Railway**

| Factor | Railway | Fly.io | Render | VPS |
|--------|---------|--------|--------|-----|
| EU data residency | ✅ EU West | ✅ CDG (Paris) | ✅ Frankfurt | ✅ any |
| Ops overhead | Very low | Medium | Low | High |
| MongoDB managed | ✅ Plugin | ❌ need Atlas | ✅ Plugin | ❌ |
| Cold starts | None | None | Yes (free tier) | None |
| Price (small shop) | ~€10–20/mo | ~€10–20/mo | ~€10–20/mo | ~€5–15/mo |

Why Railway: MongoDB plugin avoids Atlas setup, deploy from GitHub with no config file required (though `railway.toml` is easy to add), EU West region for GDPR, no cold starts unlike Render's free tier.

### B5 — GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    services:
      mongo:
        image: mongo:7
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongosh --eval 'db.runCommand({ping:1})'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r backend/requirements.txt
        working-directory: backend
      - run: python backend_test.py
        env:
          MONGO_URL: mongodb://localhost:27017
          DB_NAME: vivalusa_test
          JWT_SECRET: test-jwt-secret-ci
          ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD_TEST }}
          STRIPE_API_KEY: ${{ secrets.STRIPE_TEST_KEY }}
          EMERGENT_LLM_KEY: ${{ secrets.EMERGENT_LLM_KEY }}
          CORS_ORIGINS: http://localhost:3000
          ENVIRONMENT: development

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: frontend/.nvmrc
          cache: yarn
          cache-dependency-path: frontend/yarn.lock
      - run: yarn install --frozen-lockfile
        working-directory: frontend
      - run: yarn build
        working-directory: frontend
        env:
          REACT_APP_BACKEND_URL: https://api.vivalusa.com

  deploy:
    needs: [test-backend, test-frontend]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - uses: railwayapp/railway-deploy@v2
        with:
          railway-token: ${{ secrets.RAILWAY_TOKEN }}
          service: backend
```

### B6 — `.env.example`

```bash
# .env.example — copy to .env and fill in values
# Lines marked [REQUIRED] will crash the app at startup if missing.

# ── Database [REQUIRED] ────────────────────────────────────────────────────
MONGO_URL=mongodb://localhost:27017
DB_NAME=vivalusa

# ── Auth [REQUIRED] ────────────────────────────────────────────────────────
JWT_SECRET=                    # python -c "import secrets; print(secrets.token_hex(32))"
ADMIN_PASSWORD=                # Strong password, min 16 chars — no default exists

# ── Server [REQUIRED] ─────────────────────────────────────────────────────
CORS_ORIGINS=http://localhost:3000   # Production: https://vivalusa.com
ENVIRONMENT=development              # Production: production

# ── Stripe [REQUIRED] ─────────────────────────────────────────────────────
STRIPE_API_KEY=                # sk_test_... (test) or sk_live_... (production)
STRIPE_WEBHOOK_SECRET=         # whsec_... — from Stripe Dashboard → Webhooks

# ── Image Storage [REQUIRED until R2 migration] ────────────────────────────
EMERGENT_LLM_KEY=

# ── Image Storage [REQUIRED after R2 migration] ───────────────────────────
# S3_ENDPOINT_URL=https://xxx.r2.cloudflarestorage.com   # R2 only; omit for AWS S3
# S3_ACCESS_KEY=
# S3_SECRET_KEY=
# S3_BUCKET=vivalusa-images
# S3_REGION=auto

# ── PayPal [optional — required if PayPal enabled] ─────────────────────────
PAYPAL_CLIENT_ID=
PAYPAL_SECRET=
PAYPAL_MODE=sandbox            # Remove or change for live

# ── Email [optional — order confirmation emails won't send if missing] ─────
RESEND_API_KEY=

# ── Error Monitoring [optional] ───────────────────────────────────────────
SENTRY_DSN=

# ── Admin seed [optional] ─────────────────────────────────────────────────
ADMIN_EMAIL=admin@vivalusa.com

# ── Frontend build-time (set before yarn build or in Docker ARG) ──────────
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_SENTRY_DSN=
```

---

---

## Part C — Admin 2FA Design

> No code written until you approve this design.

### Schema changes

Add these fields to the `users` document (no separate collection for the core 2FA state):

```javascript
{
  // ... existing fields (name, email, password_hash, role, created_at) ...

  "totp_secret":      null,   // string | null — base32 TOTP secret
  "totp_enabled":     false,  // bool — true only after setup confirmed
  "totp_backup_codes": [],    // array of bcrypt-hashed strings, single-use, max 8
  "totp_verified_at": null,   // ISO datetime | null — last successful 2FA
}
```

**Trusted sessions — separate collection** (not on the user document, to avoid unbounded array growth):

```javascript
// Collection: totp_trusted_sessions
{
  "_id": ObjectId,
  "user_id": ObjectId,            // reference to users._id
  "session_token_hash": string,   // SHA-256 hex of the trust cookie value
  "user_agent": string,
  "ip": string,
  "verified_at": ISODate,
  "expires_at": ISODate           // TTL field — set to verified_at + 30 days
}
```

**Index** (add to startup event):
```python
await db.totp_trusted_sessions.create_index("expires_at", expireAfterSeconds=0)  # TTL
await db.totp_trusted_sessions.create_index("user_id")
await db.totp_trusted_sessions.create_index("session_token_hash")
```

The TTL index means MongoDB automatically deletes expired sessions — no cron job or cleanup code needed.

---

### New endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/admin/2fa/setup` | Admin JWT | Generate TOTP secret + backup codes (not yet active) |
| `POST` | `/api/admin/2fa/confirm` | Admin JWT | Verify first TOTP code → activate 2FA |
| `POST` | `/api/admin/2fa/verify` | `2fa_pending` cookie | Verify TOTP during login flow |
| `POST` | `/api/admin/2fa/backup-codes/regenerate` | Admin JWT + active 2FA | Regenerate 8 new backup codes |
| `POST` | `/api/admin/2fa/disable` | Admin JWT + TOTP | Disable 2FA (requires TOTP confirmation) |

---

### Libraries

Add to `requirements.in` (already included in A6 above):
```
pyotp==2.9.0
qrcode[pil]==7.4.2
```

---

### Login flow with 2FA

```
CURRENT:
  POST /api/auth/login
    → verify password
    → set access_token + refresh_token cookies
    → return user

NEW for admins with 2FA enabled:
  POST /api/auth/login
    → verify password
    → IF user.role == "admin" AND user.totp_enabled:
        → check 2fa_trust cookie: if present and hash in totp_trusted_sessions → skip 2FA
        → otherwise: issue short-lived 2fa_pending token (5 min, signed JWT, type="2fa_pending")
          set cookie: 2fa_pending (httponly, secure, samesite=lax, max_age=300)
          return: { "requires_2fa": true }   ← frontend routes to TOTP entry screen
    → ELSE (customer, or admin without 2FA):
        → set access_token + refresh_token as today
        → return user

  POST /api/admin/2fa/verify
    → read 2fa_pending cookie; verify not expired
    → verify TOTP code via pyotp.TOTP(secret).verify(code, valid_window=1)
      OR check backup code: hash input, compare to stored hashes, remove used hash
    → IF valid:
        → delete 2fa_pending cookie
        → issue access_token + refresh_token (full session)
        → generate trust token (secrets.token_hex(32))
        → insert into totp_trusted_sessions {user_id, sha256(token), user_agent, ip, expires_at=now+30d}
        → set vl_2fa_trust cookie (httponly, secure, samesite=lax, max_age=2592000)
        → return user object
    → IF invalid: return 401
```

---

### First-time setup UI flow

```
1. Admin: Settings → Security → "Enable Two-Factor Authentication"

2. POST /api/admin/2fa/setup
   → pyotp.random_base32() generates secret
   → secret stored in DB as totp_enabled=false (pending confirmation)
   → 8 backup codes generated (secrets.token_urlsafe(8).upper() each)
   → backup codes bcrypt-hashed and stored in totp_backup_codes
   → returns:
       qr_uri: "otpauth://totp/VivaLusa:admin@vivalusa.com?secret=XXX&issuer=VivaLusa"
       qr_png: "data:image/png;base64,<qrcode.make(qr_uri)>"
       manual_key: "JBSWY3DPEHPK3PXP"
       backup_codes: ["ABC12345", ...]   ← plaintext, shown ONCE only

3. UI shows:
   - QR code image
   - Manual key (copy-paste fallback)
   - Backup codes with Download/Copy — warning shown once
   - Input: "Enter the 6-digit code from your app to confirm"

4. POST /api/admin/2fa/confirm { "code": "123456" }
   → pyotp.TOTP(pending_secret).verify(code)
   → IF valid: set totp_enabled=true, return { "success": true }
   → IF invalid: 400 — user must retry (secret stays pending)

5. 2FA is now active. Next login requires TOTP.
```

---

### Backup codes

- **Count**: 8 codes per generation
- **Format**: `secrets.token_urlsafe(8).upper()` — URL-safe base64, uppercase
- **Storage**: each code bcrypt-hashed, stored in `totp_backup_codes` array
- **Display**: shown once at setup time; not stored in plaintext
- **Usage**: single-use; matching hash is removed from array after use
- **Regeneration**: `POST /api/admin/2fa/backup-codes/regenerate` — requires active TOTP verification, invalidates all existing codes

---

### Recovery process (admin loses device) — Railway

If an admin loses their authenticator and has no backup codes, run this via Railway shell:

```bash
# In your terminal — Railway CLI must be installed and logged in
railway run --service backend python - << 'EOF'
import asyncio, os, sys
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def disable_2fa(email: str):
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    user = await db.users.find_one({"email": email}, {"_id": 1})
    if not user:
        print(f"ERROR: No user found with email {email}")
        return

    await db.users.update_one(
        {"email": email},
        {"$set": {
            "totp_enabled": False,
            "totp_secret": None,
            "totp_backup_codes": [],
            "totp_verified_at": None,
        }}
    )
    await db.totp_trusted_sessions.delete_many({"user_id": user["_id"]})
    print(f"2FA disabled for {email}. All trusted sessions revoked.")
    client.close()

email = sys.argv[1] if len(sys.argv) > 1 else "admin@vivalusa.com"
asyncio.run(disable_2fa(email))
EOF
```

Usage: `railway run --service backend python - admin@vivalusa.com`

Railway automatically injects all environment variables (including `MONGO_URL`, `DB_NAME`) into the `railway run` context. No manual env setup needed.

---

---

## Part D — Payment Completion

### D1 — PayPal frontend implementation

**Files to touch:**
- `frontend/src/pages/Checkout.js` — add PayPal button alongside Stripe
- `frontend/src/pages/PaymentSuccess.js` — add PayPal capture branch

**Component structure:**

```
Checkout.js
  └── <PaymentSection>
        ├── [Pay with Card → Stripe] (existing)
        └── [PayPal button]           (new — @paypal/react-paypal-js)
```

**Approval flow:**

```
1. User fills shipping → clicks PayPal button
2. Frontend: POST /api/paypal/create-order → { order_id, approve_url }
3. Redirect to approve_url (PayPal hosted page)
4. User approves → PayPal redirects to:
   /payment/success?paypal=true&token=<ORDER_ID>&PayerID=<PAYER_ID>
5. PaymentSuccess.js reads token from URL
   → POST /api/paypal/capture-order/{token}
   → on COMPLETED status: show confirmation
   → on failure: show error with "Try with card" fallback
```

**PaymentSuccess.js change:**

```javascript
const isPayPal = searchParams.get("paypal") === "true";
const paypalToken = searchParams.get("token");

if (isPayPal && paypalToken) {
  const result = await axios.post(
    `${API}/api/paypal/capture-order/${paypalToken}`,
    {},
    { withCredentials: true }
  );
  if (result.data.status === "COMPLETED") {
    // show success state, clear cart
  } else {
    // show failure state
  }
} else {
  // existing Stripe polling logic
}
```

**Error handling:**
- Capture fails → show "Payment incomplete — try paying by card" with Stripe button
- User cancels on PayPal → lands on `/cart` (already set as cancel_url in backend)
- Capture timeout (>10s) → spinner with "Still processing…"

**Email confirmation**: after successful PayPal capture in the backend (`paypal_capture_order`, `server.py:753-783`), add:

```python
# After db.orders.insert_one(order_doc):
email = tx.get("guest_email") or await _get_user_email(tx.get("user_id"))
if email:
    send_order_confirmation(order_doc, email)
```

Where `_get_user_email` is a helper (defined once, shared by PayPal and Stripe handlers):

```python
async def _get_user_email(user_id: Optional[str]) -> Optional[str]:
    if not user_id or user_id == "guest":
        return None
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1})
        return user.get("email") if user else None
    except Exception:
        return None
```

---

### D2 — Replace `emergentintegrations` with native Stripe

> This runs before A6, so `emergentintegrations` is gone before the final dep file is written.

**New env var**: `STRIPE_WEBHOOK_SECRET` — from Stripe Dashboard → Developers → Webhooks → Add endpoint → copy signing secret (`whsec_...`).

**Diff — `create_checkout_session`** (`server.py:499-582`):

```diff
 @api_router.post("/checkout/session")
 async def create_checkout_session(req: CheckoutRequest, request: Request):
-    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse
+    import stripe as stripe_lib
+    stripe_lib.api_key = os.environ.get("STRIPE_API_KEY")

     # cart validation, discount, shipping — unchanged ...

     origin_url = req.origin_url.rstrip("/")
     success_url = f"{origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
     cancel_url = f"{origin_url}/cart"

-    api_key = os.environ.get("STRIPE_API_KEY")
-    host_url = str(request.base_url)
-    webhook_url = f"{host_url}api/webhook/stripe"
-    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
-
     metadata = {
         "user_id": user["_id"] if user else "guest",
         "user_email": user["email"] if user else (req.guest_email or ""),
         "discount": str(discount),
         "shipping": str(shipping_cost),
     }

-    checkout_request = CheckoutSessionRequest(
-        amount=final_total,
-        currency="usd",
-        success_url=success_url,
-        cancel_url=cancel_url,
-        metadata=metadata
+    session = stripe_lib.checkout.Session.create(
+        payment_method_types=["card"],
+        line_items=[{
+            "price_data": {
+                "currency": "eur",
+                "unit_amount": int(final_total * 100),
+                "product_data": {"name": "VivaLusa Order"},
+            },
+            "quantity": 1,
+        }],
+        mode="payment",
+        success_url=success_url,
+        cancel_url=cancel_url,
+        metadata=metadata,
     )
-    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)

     transaction = {
         ...
         "session_id": session.id,   # was session.session_id
         ...
     }
     await db.payment_transactions.insert_one(transaction)
-    return {"url": session.url, "session_id": session.session_id}
+    return {"url": session.url, "session_id": session.id}
```

**Diff — `get_checkout_status`** (`server.py:584-626`):

```diff
 @api_router.get("/checkout/status/{session_id}")
 async def get_checkout_status(session_id: str, request: Request):
-    from emergentintegrations.payments.stripe.checkout import StripeCheckout
-    api_key = os.environ.get("STRIPE_API_KEY")
-    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=...)
-    status = await stripe_checkout.get_checkout_status(session_id)
+    import stripe as stripe_lib
+    stripe_lib.api_key = os.environ.get("STRIPE_API_KEY")
+    session = stripe_lib.checkout.Session.retrieve(session_id)

     tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
     if tx and tx.get("payment_status") != "paid":
-        new_status = "completed" if status.payment_status == "paid" else (
-            "expired" if status.status == "expired" else tx.get("status", "initiated"))
+        new_status = "completed" if session.payment_status == "paid" else (
+            "expired" if session.status == "expired" else tx.get("status", "initiated"))
         await db.payment_transactions.update_one(
             {"session_id": session_id},
-            {"$set": {"payment_status": status.payment_status, "status": new_status}}
+            {"$set": {"payment_status": session.payment_status, "status": new_status}}
         )
-        if status.payment_status == "paid" and tx.get("status") != "completed":
+        if session.payment_status == "paid" and tx.get("status") != "completed":
             order_doc = {
                 "id": str(uuid.uuid4()),
                 "session_id": session_id,
                 ...  # unchanged
             }
             await db.orders.insert_one(order_doc)
+            email = tx.get("guest_email") or await _get_user_email(tx.get("user_id"))
+            if email:
+                send_order_confirmation(order_doc, email)

     return {
-        "status": status.status,
-        "payment_status": status.payment_status,
-        "amount_total": status.amount_total,
-        "currency": status.currency
+        "status": session.status,
+        "payment_status": session.payment_status,
+        "amount_total": session.amount_total,
+        "currency": session.currency
     }
```

**Diff — webhook handler** (`server.py:628-646`) — this diff also restores order creation, which the original `emergentintegrations` handler was missing (it only updated `payment_transactions`; orders were only created via polling). Moving order creation here makes the webhook the authoritative path:

```diff
 @api_router.post("/webhook/stripe")
 async def stripe_webhook(request: Request):
-    from emergentintegrations.payments.stripe.checkout import StripeCheckout
-    api_key = os.environ.get("STRIPE_API_KEY")
-    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=...)
     body = await request.body()
+    sig_header = request.headers.get("Stripe-Signature", "")
+    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
+    import stripe as stripe_lib
     try:
-        webhook_response = await stripe_checkout.handle_webhook(body, request.headers.get("Stripe-Signature"))
-        if webhook_response.payment_status == "paid":
-            await db.payment_transactions.update_one(
-                {"session_id": webhook_response.session_id},
-                {"$set": {"payment_status": "paid", "status": "completed"}}
-            )
-        return {"status": "processed"}
+        event = stripe_lib.Webhook.construct_event(body, sig_header, webhook_secret)
+        if event["type"] == "checkout.session.completed":
+            stripe_session = event["data"]["object"]
+            if stripe_session.get("payment_status") == "paid":
+                session_id = stripe_session["id"]
+                tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
+                if tx and tx.get("payment_status") != "paid":
+                    await db.payment_transactions.update_one(
+                        {"session_id": session_id},
+                        {"$set": {"payment_status": "paid", "status": "completed"}}
+                    )
+                    if tx.get("status") != "completed":
+                        order_doc = {
+                            "id": str(uuid.uuid4()),
+                            "session_id": session_id,
+                            "user_id": tx.get("user_id"),
+                            "guest_email": tx.get("guest_email"),
+                            "items": tx.get("items", []),
+                            "subtotal": tx.get("subtotal", 0),
+                            "discount": tx.get("discount", 0),
+                            "shipping_cost": tx.get("shipping_cost", 0),
+                            "total": tx.get("total", 0),
+                            "shipping_address": tx.get("shipping_address", {}),
+                            "status": "confirmed",
+                            "created_at": datetime.now(timezone.utc).isoformat()
+                        }
+                        await db.orders.insert_one(order_doc)
+                        email = tx.get("guest_email") or await _get_user_email(tx.get("user_id"))
+                        if email:
+                            send_order_confirmation(order_doc, email)
+        return {"status": "processed"}
+    except stripe_lib.error.SignatureVerificationError:
+        raise HTTPException(status_code=400, detail="Invalid webhook signature")
     except Exception as e:
         logger.error(f"Webhook error: {e}")
-        return {"status": "error"}
+        raise HTTPException(status_code=400, detail="Webhook processing error")
```

**Note on idempotency**: `get_checkout_status` (polling) also creates orders. The `tx.get("status") != "completed"` check prevents duplicates — whichever arrives first (webhook or poll) creates the order; the other is a no-op.

**Configuring the webhook in Stripe Dashboard:**
1. Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://your-api-domain.com/api/webhook/stripe`
3. Events to select: `checkout.session.completed`
4. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` in env

**Testing locally with Stripe CLI:**
```bash
# Install: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:8000/api/webhook/stripe
# Stripe CLI prints a local signing secret — use it as STRIPE_WEBHOOK_SECRET in .env
stripe trigger checkout.session.completed
```

---

### D3 — Refund endpoint (admin-only)

```python
class RefundRequest(BaseModel):
    reason: Optional[str] = "requested_by_customer"

@api_router.post("/admin/orders/{order_id}/refund")
async def refund_order(order_id: str, req: RefundRequest, request: Request):
    import stripe as stripe_lib
    stripe_lib.api_key = os.environ.get("STRIPE_API_KEY")
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") == "refunded":
        raise HTTPException(status_code=400, detail="Order already refunded")

    stripe_session = stripe_lib.checkout.Session.retrieve(order["session_id"])
    refund = stripe_lib.Refund.create(
        payment_intent=stripe_session.payment_intent,
        reason=req.reason,
    )

    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "refunded",
            "refund_id": refund.id,
            "refunded_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"refund_id": refund.id, "status": refund.status, "amount": refund.amount}
```

---

---

## Part E — Pre-launch Essentials

### E1 — Sentry

**Backend** (`requirements.in` already includes `sentry-sdk[fastapi]`):

```python
# Add to server.py after imports
import sentry_sdk
if os.environ.get("SENTRY_DSN"):
    sentry_sdk.init(
        dsn=os.environ["SENTRY_DSN"],
        traces_sample_rate=0.1,
        environment=os.environ.get("ENVIRONMENT", "development"),
    )
```

**Frontend**:
```bash
yarn add @sentry/react
```
```javascript
// frontend/src/index.js
import * as Sentry from "@sentry/react";
if (process.env.REACT_APP_SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.REACT_APP_SENTRY_DSN,
        environment: process.env.NODE_ENV,
        tracesSampleRate: 0.1,
    });
}
```

---

### E2 — Order confirmation email (Resend)

**Provider recommendation:**

| Provider | EU servers | GDPR | Free tier | Price/1k emails | Verdict |
|----------|-----------|------|-----------|----------------|---------|
| **Resend** | ✅ | ✅ | 100/day, 3k/mo | €1.00 | **Recommended** |
| Postmark | ✅ | ✅ | None | €1.50 | Good alternative |
| SendGrid | ⚠️ US parent | ⚠️ DPA needed | 100/day | €0.80 | More complex |
| Brevo | ✅ France | ✅ | 300/day | €0.80 | Good EU option |

**Recommendation: Resend.** EU infrastructure, simple API (one call), GDPR-friendly, cheapest for low volume.

**DNS records to add to `vivalusa.com`** (exact values for SPF/DKIM are partially generated by Resend per-account; DMARC and format are standard):

**Step 1** — verify your domain in the Resend dashboard (resend.com → Domains → Add Domain → enter `vivalusa.com`). Resend will show you the exact DKIM value to copy. Steps 2–5 use those values.

**Step 2 — SPF record** (if you have no existing SPF, create it; if you do, merge the include):
```
Type:  TXT
Name:  @  (or vivalusa.com, depending on your registrar)
Value: v=spf1 include:_spf.resend.com ~all
```
If you already have an SPF record (e.g. from Google Workspace), merge it:
```
v=spf1 include:_spf.google.com include:_spf.resend.com ~all
```

**Step 3 — DKIM record** (value provided by Resend after domain verification):
```
Type:  TXT
Name:  resend._domainkey.vivalusa.com
Value: (paste the value shown in Resend dashboard — unique per account)
```

**Step 4 — DMARC record**:
```
Type:  TXT
Name:  _dmarc.vivalusa.com
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@vivalusa.com; pct=100
```
Use `p=none` initially if you want to monitor before enforcing. Change to `p=quarantine` after confirming Resend sends land in inbox.

**Step 5 — Return-Path / bounce tracking (optional but recommended)**:
```
Type:  MX
Name:  bounces.vivalusa.com
Value: (provided by Resend)
Priority: 10
```

**DNS propagation**: 10 minutes to 48 hours. Resend dashboard shows a green checkmark when each record is verified.

**Implementation** (`requirements.in` already includes `resend`):

```python
# Add to server.py

def send_order_confirmation(order: dict, email: str):
    resend_key = os.environ.get("RESEND_API_KEY")
    if not resend_key:
        logger.warning("RESEND_API_KEY not set — skipping order confirmation email")
        return
    import resend as resend_client
    resend_client.api_key = resend_key
    items_html = "".join(
        f"<li>{item['name']} × {item['quantity']} — €{item['price'] * item['quantity']:.2f}</li>"
        for item in order.get("items", [])
    )
    try:
        resend_client.Emails.send({
            "from": "VivaLusa <orders@vivalusa.com>",
            "to": email,
            "subject": f"Your VivaLusa order #{order['id'][:8].upper()} is confirmed",
            "html": f"""
                <h2>Thank you for your order!</h2>
                <p>Order reference: <strong>#{order['id'][:8].upper()}</strong></p>
                <ul>{items_html}</ul>
                <p>Subtotal: €{order.get('subtotal', 0):.2f}</p>
                <p>Shipping: €{order.get('shipping_cost', 0):.2f}</p>
                <p><strong>Total: €{order.get('total', 0):.2f}</strong></p>
                <p>We'll be in touch when your order ships.</p>
                <p>— The VivaLusa team</p>
            """,
        })
    except Exception as e:
        logger.error(f"Order confirmation email failed: {e}")
```

`send_order_confirmation` is called in three places (already shown in diffs above):
- Stripe webhook handler — after `db.orders.insert_one(order_doc)`
- Stripe `get_checkout_status` polling path — after `db.orders.insert_one(order_doc)`
- PayPal `capture_order` — after `db.orders.insert_one(order_doc)`

---

### E3 — Rate limiting

```python
# requirements.in already includes slowapi

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Decorate vulnerable endpoints:
@api_router.post("/auth/register")
@limiter.limit("5/minute")
async def register(req: RegisterRequest, response: Response, request: Request):
    ...

@api_router.post("/checkout/session")
@limiter.limit("10/minute")
async def create_checkout_session(req: CheckoutRequest, request: Request):
    ...

@api_router.post("/upload/image")
@limiter.limit("20/minute")
async def upload_image(request: Request, file: UploadFile = File(...)):
    ...
```

---

### E4 — Structured JSON logging

```python
# Replace current basicConfig

import json

class JSONFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            **({"exc_info": self.formatException(record.exc_info)} if record.exc_info else {}),
        })

_handler = logging.StreamHandler()
_handler.setFormatter(JSONFormatter())
logging.basicConfig(level=logging.INFO, handlers=[_handler], force=True)
```

---

---

## Part F — Emergent Attribution Sweep

> Complete list of every "emergent" reference in the codebase (case-insensitive, excluding `.md` docs and git history). Awaiting your approval on each category before removal.

**Search results** (`grep -ri "emergent" --include="*.js" --include="*.json" --include="*.py" --include="*.html"`):

### Category 1 — Remove immediately (Emergent platform scaffolding, no business value)

| File | Line | Content | Action |
|------|------|---------|--------|
| `frontend/public/index.html:7` | `<meta name="description" content="A product of emergent.sh" />` | Replace with real description |
| `frontend/public/index.html:24` | `<title>Emergent \| Fullstack App</title>` | Replace with `<title>VivaLusa</title>` |
| `frontend/public/index.html:26` | `<script src="https://assets.emergent.sh/scripts/emergent-main.js"></script>` | Delete entirely |
| `frontend/public/index.html:42-84` | Full "Made with Emergent" badge (floating bottom-right widget) | Delete entirely |
| `frontend/package.json:79` | `"@emergentbase/visual-edits": "https://assets.emergent.sh/npm/..."` | Remove from dependencies |
| `frontend/craco.config.js:87-92` | `require("@emergentbase/visual-edits/craco")` block | Remove the try/catch block |

### Category 2 — Replace with your own assets (Emergent CDN image URLs)

These URLs point to the Emergent platform's CDN. If that service goes away, images break.

| File | Line | URL | Action |
|------|------|-----|--------|
| `frontend/src/components/Navbar.js:16` | `LOGO_URL = "https://static.prod-images.emergentagent.com/jobs/a578c59c.../8a1f...png"` | Replace with your own logo |
| `frontend/src/pages/Home.js:10` | `HERO_BG = "https://static.prod-images.emergentagent.com/jobs/a578c59c.../7d35...png"` | Replace with your own hero image |
| `backend/server.py:848` | Seed product `prod-004` image URL on emergentagent.com | Replace with a stable URL or upload to R2 |
| `design_guidelines.json:50,55,60,65` | Four branding/logo image URLs on emergentagent.com CDN | Replace if this file is used; otherwise low priority |

**You need to provide**: your own logo image and hero background image before these lines are changed.

### Category 3 — Replaced by other plan parts (do not touch separately)

| File | Lines | Reason |
|------|-------|--------|
| `backend/requirements.txt:21` | `emergentintegrations==0.1.0` | Removed in D2 |
| `backend/server.py:37-46` | `STORAGE_URL`, `EMERGENT_KEY`, `init_storage` HTTP calls | Replaced in R2 migration |
| `backend/server.py:501, 586, 630` | `from emergentintegrations.payments.stripe...` | Removed in D2 |

### Category 4 — Leave as-is (legitimate references)

| File | Content | Reason |
|------|---------|--------|
| `backend/server.py:38` | `EMERGENT_LLM_KEY` env var name | Still needed until R2 migration lands |
| `backend_test.py:13` | Default base URL `https://beauty-checkout-12.preview.emergentagent.com` | Test file; replace with `localhost:8000` or env var |
| `.gitconfig:2-3` | `email = github@emergent.sh`, `name = emergent-agent-e1` | Git author for existing commits — not code to fix |

---

---

## Execution Order

```
A1 — Fix CORS
A2 — Fix cookie secure flag
A3 — Remove hardcoded password + credential file writer + fix backend_test.py
A4 — Security headers middleware
A5 — Pin Node/Python versions
  ↓
D2 — Replace emergentintegrations with native Stripe
  (emergentintegrations is now gone from the codebase)
  ↓
A6 — Delete unused dependencies + write requirements.in
  (dep file is now final and clean — safe to build Docker image)
  ↓
F  — Emergent attribution sweep (Categories 1 + 2)
  ↓
B  — Dockerfile + docker-compose + GitHub Actions + .env.example
  (Docker build uses the clean dep file from A6)
  ↓
D1 — PayPal frontend button
D3 — Refund endpoint
  ↓
C  — 2FA: schema → endpoints → UI
  ↓
E  — Sentry + email + rate limiting + structured logging
```

---

## Changelog from v1

| # | Change |
|---|--------|
| 1 | D2 webhook diff: restored order creation + email send (webhook is now the authoritative path) |
| 2 | B5 GitHub Actions: added `services: mongo:` block with healthcheck |
| 3 | B2 nginx: replaced literal `REACT_APP_BACKEND_URL` in CSP with nginx template mechanism (`/etc/nginx/templates/`) using envsubst |
| 4 | Execution order: A1–A5 → D2 → A6 → F → B → D1/D3 → C → E |
| 5 | C: `totp_trusted_sessions` moved to separate collection with TTL index |
| 6 | Added Part F: Emergent attribution sweep with full grep results |
| 7 | A3: added test_credentials.md filesystem check + `.gitignore` / git log findings |
| 8 | A3: added `backend_test.py:104` fix (read from env, not hardcoded) |
| 9 | E2: added full DNS record setup (SPF, DKIM, DMARC, bounce MX) |
| 10 | D1 + D2: explicitly wired `send_order_confirmation()` into all three order creation paths; added `_get_user_email()` helper |
| 11 | C: recovery script rewritten for Railway (`railway run --service backend python -`) |
| 12 | Q3: boto3 kept in requirements.in for R2 migration |
| 13 | Q13: answered USD vs EUR vs multi-currency; recommended always-EUR with reasoning |

---

*No code has been changed. Reply with which parts you approve and I'll start with the execution order above.*
