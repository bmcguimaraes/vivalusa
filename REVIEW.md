# Vivalusa — Full Codebase Review

> **Audit date**: 2026-04-20  
> **Scope**: Full codebase — frontend (React SPA), backend (FastAPI), config, dependencies  
> **Auditor**: Claude Code (claude-sonnet-4-6)  
> **Status**: Phase 1 complete — awaiting owner approval before any changes

---

## 🚨 Critical Flags (Read First)

| # | Issue | Location | Risk |
|---|-------|----------|------|
| 1 | **Default admin password hardcoded in source** | `backend/server.py:879` | 🔴 Critical |
| 2 | **Auth cookies use `secure=False`** — tokens sent over plain HTTP | `backend/server.py:139-141` | 🔴 Critical |
| 3 | **CORS defaults to `*` with `allow_credentials=True`** — browsers reject this combo; CORS is effectively broken | `backend/server.py:932-938` | 🔴 Critical |
| 4 | **No deployment infrastructure** — no Dockerfile, CI/CD, or deploy config exists | repo root | 🔴 Blocks deploy |
| 5 | **PayPal frontend is 0% implemented** — backend done, users cannot pay with PayPal | `frontend/src/pages/Checkout.js` | 🔴 Critical |

---

## Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React (Create React App + Craco) | 19.0.0 |
| Backend | FastAPI (Python) | 0.110.1 |
| Package manager (FE) | Yarn | 1.22 |
| Package manager (BE) | Pip | — |
| Database | MongoDB (async via Motor) | Motor 3.3.1 |
| ORM | Motor (no traditional ORM; Pydantic schemas) | — |
| Auth | JWT (HS256) + HttpOnly cookies | PyJWT 2.12.1 |
| Password hashing | bcrypt | 4.1.3 |
| Payments — Stripe | Stripe Checkout (hosted page) | stripe 15.0.1 |
| Payments — PayPal | Backend: paypalrestsdk; Frontend: **not wired** | 1.13.3 |
| UI | Shadcn UI + Radix UI + Tailwind CSS | TW 3.4.17 |
| Image storage | Emergent Object Storage (external API) | — |
| Currency rates | Frankfurter API (ECB live rates) | — |
| Analytics | PostHog (hardcoded key in `index.html`) | — |
| Node version | **Not pinned** (no `.nvmrc` / `engines` field) | — |
| Python version | **Not pinned** (no `runtime.txt` / `.python-version`) | — |
| Testing | pytest (backend); no frontend tests | — |

The backend is a **monolithic single file** (`backend/server.py`, 943 lines) containing all routes, auth logic, payment integrations, image handling, seed data, and startup events.

---

## Folder Structure

```
vivalusa/
├── frontend/
│   ├── src/
│   │   ├── App.js               # Router + context providers
│   │   ├── pages/               # Home, Shop, ProductDetail, Checkout,
│   │   │                        #   PaymentSuccess, Orders, Admin
│   │   ├── components/          # Navbar, AuthModal, CartDrawer,
│   │   │                        #   ProductCard, ProductRow, CurrencySelector
│   │   │   └── ui/              # 40+ Shadcn/Radix components
│   │   ├── contexts/            # AuthContext, CartContext, CurrencyContext
│   │   ├── lib/                 # Utilities
│   │   └── hooks/               # Custom React hooks
│   ├── public/index.html        # Entry point (PostHog injected here)
│   ├── package.json             # 58 FE dependencies
│   ├── craco.config.js          # Webpack overrides
│   ├── tailwind.config.js
│   └── components.json          # Shadcn config
│
├── backend/
│   ├── server.py                # Monolithic FastAPI app (943 lines)
│   └── requirements.txt         # 126 Python packages
│
├── tests/
│   └── __init__.py              # Empty
├── backend_test.py              # Integration test suite (20 KB)
├── test_reports/                # Test output
├── memory/
│   └── PRD.md                   # Product requirements
└── design_guidelines.json       # Brand colors and fonts
```

---

## Environment Variables

All references found across the codebase:

### Backend (`backend/server.py`)

| Variable | Required | Default (if any) | Domain |
|----------|----------|-----------------|--------|
| `MONGO_URL` | **Yes** | — | Database |
| `DB_NAME` | **Yes** | — | Database |
| `JWT_SECRET` | **Yes** | — | Auth |
| `ADMIN_EMAIL` | No | `admin@vivalusa.com` | Auth/Seed |
| `ADMIN_PASSWORD` | No | `VivaLusa2024!` ⚠️ | Auth/Seed |
| `STRIPE_API_KEY` | **Yes** | — | Stripe |
| `PAYPAL_CLIENT_ID` | If PayPal enabled | — | PayPal |
| `PAYPAL_SECRET` | If PayPal enabled | — | PayPal |
| `PAYPAL_MODE` | No | (live if omitted) | PayPal |
| `EMERGENT_LLM_KEY` | **Yes** | — | Image storage |
| `CORS_ORIGINS` | No | `*` ⚠️ | CORS |

### Frontend (`src/**/*.js`)

| Variable | Required | Notes |
|----------|----------|-------|
| `REACT_APP_BACKEND_URL` | **Yes** | Base URL for all API calls |
| `ENABLE_HEALTH_CHECK` | No | Dev convenience only |
| `NODE_ENV` | Auto | Set by build tooling |

**No `.env` files are committed to the repo** — good practice observed.

---

## What's Working

Features that are fully implemented end-to-end (UI + API + DB):

| Feature | Notes |
|---------|-------|
| **Product catalog** | Browse, filter by category, search, sort |
| **Product detail page** | Full view, add to cart |
| **Shopping cart** | Add/remove/quantity; persisted to localStorage |
| **User auth** | Register, login, logout, JWT refresh, brute-force lockout |
| **Stripe checkout** | Session creation → hosted Stripe page → webhook → order created |
| **Shipping calculation** | Country-based flat rates, 32 European countries |
| **Member discount** | 5% off for authenticated users at checkout |
| **Multi-currency display** | 15 currencies, live ECB rates, localStorage persistence |
| **Order history** | User views their orders; admin views all orders |
| **Admin panel** | Product CRUD, image upload, sales analytics, stock alerts |
| **Image upload** | Type validation (JPEG/PNG/WebP/GIF), size cap (5 MB), stored remotely |
| **Brute-force protection** | Login: 5 attempts → 15-minute lockout (per IP + email) |

---

## What's Missing or Broken

### P0 — Must Fix Before Launch

| # | Issue | Details |
|---|-------|---------|
| 1 | **PayPal checkout frontend** | Backend endpoints exist and work. `@paypal/react-paypal-js` is installed but never imported. Checkout UI only shows Stripe. Users cannot pay with PayPal. |
| 2 | **Auth cookies not production-safe** | `secure=False` on JWT cookies (`server.py:139-141`). Over HTTPS in production, browsers will still send the cookie, but this should be `True` to prevent HTTP leakage. |
| 3 | **CORS misconfiguration** | `allow_origins="*"` + `allow_credentials=True` is rejected by browsers per the CORS spec. This is effectively broken in production. |
| 4 | **No deployment infrastructure** | No Dockerfile, no `docker-compose.yml`, no CI/CD pipelines, no platform config (Vercel/Railway/Fly). Cannot deploy today. |

### P1 — Before First Real Customer

| # | Issue | Details |
|---|-------|---------|
| 5 | **No order confirmation emails** | No email service integrated. Orders created silently — customers receive nothing. |
| 6 | **No rate limiting on register, checkout, upload** | Login is protected; the rest are unguarded. Checkout endpoint has no card-testing protection. |
| 7 | **No security headers** | CSP, HSTS, X-Frame-Options, X-Content-Type-Options all missing. |
| 8 | **No error monitoring** | No Sentry or equivalent. Exceptions logged to stdout only; no alerting. |
| 9 | **Hardcoded default admin password** | `"VivaLusa2024!"` in source (`server.py:879`). If `ADMIN_PASSWORD` env var is missing, this is the live admin credential. |

### P2 — Backlog

| # | Issue | Details |
|---|-------|---------|
| 10 | **No refund endpoint** | Refunds must be processed manually in the Stripe dashboard. |
| 11 | **Referral discount system** | PRD mentions 10% off for referrer + referred. Not started. |
| 12 | **No customer reviews/ratings** | No schema, no UI, no endpoints. |
| 13 | **No wishlist** | Not started. |
| 14 | **Analytics charts unused** | `recharts` is installed but never imported. Admin analytics are raw numbers only. |
| 15 | **Cart not persisted to DB** | Cart lives only in localStorage. Refreshing another device loses it. |
| 16 | **No inventory email alerts** | Admin sees low-stock in dashboard but receives no notifications. |
| 17 | **Node/Python versions unpinned** | No `.nvmrc`, no `engines` field, no `runtime.txt`. |

---

## Security Issues

### 🔴 Critical

| Issue | Location | Detail |
|-------|----------|--------|
| **Hardcoded admin password** | `server.py:879` | `os.environ.get("ADMIN_PASSWORD", "VivaLusa2024!")` — if env var absent at first boot, seed function creates admin with this literal password. It is committed to version history. |
| **`secure=False` on auth cookies** | `server.py:139-141` | Access and refresh tokens will be transmitted over HTTP. Must be `True` in production. |
| **CORS `*` + credentials** | `server.py:932-938` | The CORS spec forbids this combination; browsers silently drop credentialed cross-origin requests. The intended origins must be explicit. |

### 🟠 High

| Issue | Location | Detail |
|-------|----------|--------|
| **No CSRF tokens** | All POST/PUT/DELETE endpoints | `SameSite=Lax` provides partial mitigation for modern browsers, but explicit CSRF tokens are required for defense in depth. |
| **No security headers** | FastAPI app (no middleware) | CSP, HSTS (`Strict-Transport-Security`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` — none configured. |
| **Missing rate limits** | Register, checkout, upload endpoints | Login is throttled (5 attempts). Everything else is unlimited, including the checkout endpoint, which can be abused for automated card testing. |
| **PostHog key in `index.html`** | `frontend/public/index.html:148` | Client-side analytics keys are normally public by design, but confirm this is intentional and the key scope is analytics-only. |

### 🟡 Medium

| Issue | Location | Detail |
|-------|----------|--------|
| **No Sentry / error monitoring** | Entire app | Exceptions reach the console only. No alerting, no stack traces in production. |
| **Admin route client-guard only** | `frontend/src/components/Navbar.js:71` | `/admin` link is hidden for non-admins in the navbar, but the route itself renders if navigated to directly. Server-side endpoints enforce role correctly, so the practical risk is low — but a dedicated `<ProtectedRoute>` component would be cleaner. |
| **No Node/Python version pins** | Repo root | Dependency resolution can differ across environments. |

### 🟢 Low / Good Practice Observed

| Check | Result |
|-------|--------|
| Password hashing | bcrypt with `gensalt()` — correct |
| JWT storage | HttpOnly cookies — not accessible to JS |
| JWT expiry | Access 60 min, Refresh 7 days — reasonable |
| NoSQL injection | Motor uses dict-based queries — not injectable |
| XSS | No `dangerouslySetInnerHTML`; React escapes all text output |
| File upload type check | Whitelist: JPEG, PNG, WebP, GIF; 5 MB cap |
| File upload storage | External (Emergent), not served from the app server |
| No `.env` files committed | Confirmed — no secrets in git history |

---

## Payment Integration Status

### Stripe

| Aspect | Status | Notes |
|--------|--------|-------|
| **Flow type** | Stripe-hosted Checkout page (redirect) | Simpler than Elements but less UI control |
| **Session creation** | ✅ Complete | `POST /api/checkout/session` (`server.py:499-582`) |
| **Price validation** | ✅ Server-validated | Prices re-fetched from DB — client cannot tamper |
| **Member discount** | ✅ Applied server-side | 5% discount calculated in backend |
| **Shipping** | ✅ Applied server-side | Country-based rates added to Stripe session |
| **Webhook handler** | ✅ Present | `POST /api/webhook/stripe` (`server.py:628-646`) |
| **Webhook signature** | ✅ Verified | Delegated to `emergentintegrations` library |
| **Idempotency** | ✅ Implemented | Transaction checked before order creation (`server.py:603`) |
| **Order state driver** | ✅ Webhook-driven | Order created on webhook, not on client redirect |
| **Test vs live** | ⚠️ Env-var-only | Key assumed correct for environment; no explicit mode flag |
| **Webhook URL in dev** | ⚠️ Risk | Constructed from `request.base_url`; needs Stripe CLI forwarding in dev |
| **Refund flow** | ❌ Not implemented | Manual via Stripe dashboard only |

**Keys still needed from you:**
- `STRIPE_API_KEY` — test key (for staging) and live key (for production)
- Stripe webhook signing secret (generated when you register the webhook endpoint URL in the Stripe dashboard) — not currently used by the code (signature check is in the `emergentintegrations` library, needs to know if it reads its own env var or yours)

### PayPal

| Aspect | Status | Notes |
|--------|--------|-------|
| **Backend — order creation** | ✅ Complete | `POST /api/paypal/create-order` (`server.py:672-751`) |
| **Backend — order capture** | ✅ Complete | `POST /api/paypal/capture-order/{id}` (`server.py:753-783`) |
| **Backend — client ID endpoint** | ✅ Complete | `GET /api/paypal/client-id` |
| **Frontend — PayPal button** | ❌ Not started | `@paypal/react-paypal-js` installed but never imported |
| **Frontend — approval redirect** | ❌ Not started | No route for PayPal return URL |
| **Frontend — capture call** | ❌ Not started | No call to capture endpoint |
| **Order fulfillment parity** | ✅ Same path as Stripe | Capture endpoint creates order the same way |
| **Sandbox vs live** | ⚠️ Defaults to live | `PAYPAL_MODE=sandbox` must be set explicitly to use sandbox |

**Keys still needed from you:**
- `PAYPAL_CLIENT_ID` and `PAYPAL_SECRET` — sandbox credentials (for testing) and live credentials (for production)

---

### Do You Need PayPal?

**Short answer: probably not, but it depends on your customer mix.**

**Context:**
- Your customers are likely in Portugal, where Stripe is the dominant checkout provider.
- Stripe supports all major Portuguese payment methods: Visa, Mastercard, MB WAY (via Stripe's MB WAY integration), Multibanco (popular in Portugal), SEPA Direct Debit.
- PayPal has ~10-12% checkout usage in Portugal vs ~60-70% for card/Stripe.

**Arguments for dropping PayPal:**
- Stripe covers the large majority of Portuguese shoppers.
- PayPal fees are higher (3.49% + fixed fee vs Stripe's 1.4-2.9% for EU cards).
- You'd maintain two integrations, two reconciliation processes, and two sets of credentials.
- PayPal disputes/chargebacks are notoriously more seller-unfriendly for small businesses.
- The backend integration is already done, but the frontend work still needs to happen.

**Arguments for keeping it:**
- ~10-15% of buyers trust PayPal more, especially older demographics and international buyers.
- It adds no risk once implemented — it just runs in parallel.
- The backend is already written; only the frontend button remains.

**Recommendation:** Finish the PayPal frontend integration (it's a small amount of work since the backend is done), launch with both, then drop it in 3-6 months if PayPal orders are negligible. The marginal cost of keeping it running is low once the button is wired up.

---

## Deployment Readiness Checklist

### Blocks Deploy Today (Must Fix First)

- [ ] No Dockerfile or `docker-compose.yml`
- [ ] No platform config (Vercel, Railway, Fly, etc.)
- [ ] No CI/CD pipeline
- [ ] CORS is misconfigured (`*` + credentials)
- [ ] Auth cookies use `secure=False`
- [ ] Default admin password hardcoded in source
- [ ] No error monitoring (Sentry)
- [ ] No security headers (CSP, HSTS, etc.)
- [ ] `REACT_APP_BACKEND_URL` must be set to production API URL before build
- [ ] Python and Node versions not pinned

### Should Fix Before First Real Customer

- [ ] Order confirmation emails (no email service integrated)
- [ ] Rate limiting on checkout endpoint (card testing risk)
- [ ] Stripe webhook signing secret properly configured end-to-end
- [ ] PayPal frontend implemented (if keeping PayPal)

### Nice to Have Before Launch

- [ ] Database backup strategy
- [ ] Log aggregation (not just stdout)
- [ ] CDN for product images (currently proxied through API)
- [ ] Refund endpoint

---

## Recommended Improvements

Ranked by **impact ÷ effort**:

| Priority | Improvement | Impact | Effort | Notes |
|----------|------------|--------|--------|-------|
| 1 | Fix CORS config | 🔴 High | Low | One-line change, blocks all credentialed cross-origin requests now |
| 2 | Set `secure=True` on cookies | 🔴 High | Trivial | One-line change |
| 3 | Remove hardcoded admin password | 🔴 High | Trivial | Delete the default, require env var |
| 4 | Add security headers middleware | 🟠 High | Low | ~10 lines of FastAPI middleware |
| 5 | Create Dockerfile + docker-compose | 🔴 High | Medium | Unblocks all deployment options |
| 6 | Add Sentry (BE + FE) | 🟠 High | Low | One SDK install + DSN env var each |
| 7 | Implement PayPal checkout button | 🟠 High | Low | Backend done; ~60 lines of React |
| 8 | Order confirmation email | 🟠 High | Medium | Resend or SendGrid; ~100 lines |
| 9 | Rate limit checkout + register | 🟠 High | Low | `slowapi` for FastAPI; 5 lines per route |
| 10 | Pin Node + Python versions | 🟡 Medium | Trivial | `.nvmrc` + `runtime.txt` |
| 11 | Remove unused AI/ML dependencies | 🟡 Medium | Low | Reduces Docker image by ~500 MB |
| 12 | Add CSRF tokens | 🟡 Medium | Medium | Double-submit cookie pattern |
| 13 | Persist cart to DB for logged-in users | 🟡 Medium | Medium | Better UX across devices |
| 14 | Refund endpoint | 🟡 Medium | Low | ~30 lines; links to Stripe refund API |
| 15 | Email analytics charts (`recharts`) | 🟢 Low | Low | `recharts` already installed |
| 16 | TypeScript migration | 🟢 Low | High | Not worth the disruption mid-project |

---

## Appendix: Unused Dependencies

### Frontend (safe to remove)

| Package | Reason |
|---------|--------|
| `@paypal/react-paypal-js` | Installed but not imported (will be used once PayPal frontend is built) |
| `embla-carousel-react` | Carousel library — not used anywhere |
| `react-resizable-panels` | Panel resize — not used |
| `cra-template` | CRA scaffold artifact |

### Backend (safe to remove after confirming)

| Package | Reason |
|---------|--------|
| `openai` | Not called anywhere |
| `google-genai` / `google-generativeai` | Not called anywhere |
| `litellm` | LLM orchestration — not called |
| `huggingface_hub` | Not called |
| `pandas` | Not used in analytics |
| `pillow` | Not used for image processing (only type check, no manipulation) |
| `passlib` | bcrypt used directly; passlib not called |
| `python-jose` | JWT handled by PyJWT; python-jose not called |

---

*Read-only audit — no files were modified. Awaiting owner approval before Phase 2 or any changes.*
