# VivaLusa — Credentials & External Setup Reference

> **IMPORTANT**: This file documents *what credentials you need and where to get them*.
> It does NOT contain actual secret values. Copy `env.example` to `.env` and fill in the real values there.

---

## 1. Credentials Already in Use (migrate to .env if not there yet)

| Key | Description | Where it's used |
|-----|-------------|-----------------|
| `MONGO_URL` | MongoDB connection string | Backend startup |
| `DB_NAME` | MongoDB database name | Backend startup |
| `JWT_SECRET` | HS256 signing key (32+ random hex chars) | All JWT tokens |
| `ADMIN_PASSWORD` | Admin user password (min 16 chars) | Seeded on startup |
| `STRIPE_API_KEY` | Stripe publishable key (`sk_test_...` or `sk_live_...`) | Checkout, refunds |
| `PAYPAL_CLIENT_ID` | PayPal REST app client ID | PayPal checkout button |
| `PAYPAL_SECRET` | PayPal REST app secret | PayPal token exchange |

Generate JWT_SECRET: `python -c "import secrets; print(secrets.token_hex(32))"`

---

## 2. New Credentials to Create

### Stripe Webhook Secret
1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://your-api-domain.com/api/webhook/stripe`
3. Events: `checkout.session.completed`
4. Copy the signing secret (`whsec_...`)
5. Set as `STRIPE_WEBHOOK_SECRET` in your `.env`

### Cloudflare R2 (Image Storage)
1. Cloudflare Dashboard → R2 → Create bucket → name: `vivalusa-images`
2. R2 → Manage R2 API Tokens → Create API token with Object Read & Write
3. Set `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET=vivalusa-images`
4. Set `S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com`
5. Set `S3_REGION=auto`
   - Note: enable public access on the bucket if you want direct image URLs (optional)

### Resend (Order Confirmation Email)
1. resend.com → Sign up / Log in → Domains → Add Domain → enter `vivalusa.com`
2. Resend will show DNS records to add (see DNS section below)
3. API Keys → Create API Key → set as `RESEND_API_KEY`

### Sentry (Error Monitoring) — optional
1. sentry.io → New Project → FastAPI → copy DSN → set as `SENTRY_DSN`
2. sentry.io → New Project → React → copy DSN → set as `REACT_APP_SENTRY_DSN`

### Railway (Deployment)
1. railway.app → New Project → Deploy from GitHub
2. Connect repo, set service: `backend`, root: `backend/`
3. Add MongoDB plugin (Railway marketplace)
4. Railway → Settings → Generate token → set as `RAILWAY_TOKEN` in GitHub Secrets
5. Set all env vars from `.env` in Railway → Variables

---

## 3. GitHub Actions Secrets

Add these in GitHub → Settings → Secrets and variables → Actions:

| Secret name | Value |
|-------------|-------|
| `ADMIN_PASSWORD_TEST` | A strong test password (different from production) |
| `STRIPE_TEST_KEY` | `sk_test_...` from Stripe Dashboard |
| `RAILWAY_TOKEN` | From Railway → Account Settings → Tokens |

---

## 4. DNS Records for `vivalusa.com`

Add these records at your domain registrar / DNS provider:

### SPF (Resend email authentication)
```
Type:  TXT
Name:  @
Value: v=spf1 include:_spf.resend.com ~all
```
*If you already have an SPF record, merge the include:*
`v=spf1 include:_spf.google.com include:_spf.resend.com ~all`

### DKIM (Resend — exact value from Resend dashboard)
```
Type:  TXT
Name:  resend._domainkey.vivalusa.com
Value: (paste value shown in Resend dashboard — unique per account)
```

### DMARC
```
Type:  TXT
Name:  _dmarc.vivalusa.com
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@vivalusa.com; pct=100
```
*Use p=none initially to monitor, then change to p=quarantine after confirming delivery*

### Bounce tracking (optional, from Resend dashboard)
```
Type:  MX
Name:  bounces.vivalusa.com
Value: (provided by Resend)
Priority: 10
```

---

## 5. Local Development Tools

| Tool | Install | Purpose |
|------|---------|---------|
| Stripe CLI | `brew install stripe/stripe-cli/stripe` | Local webhook forwarding |
| Railway CLI | `brew install railway` | Run scripts in production containers |
| pip-tools | `pip install pip-tools` | Regenerate pinned requirements.txt |

### Stripe CLI local webhook forwarding
```bash
stripe login
stripe listen --forward-to localhost:8000/api/webhook/stripe
# CLI prints a local signing secret — use it as STRIPE_WEBHOOK_SECRET in .env for dev
stripe trigger checkout.session.completed
```

### pip-compile (after editing requirements.in)
```bash
cd backend
pip-compile requirements.in -o requirements.txt
```

---

## 6. Stripe Test Cards

| Card number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |
| `4000 0000 0000 9995` | Insufficient funds (declined) |
| `4000 0000 0000 0002` | Card declined |

Use any future expiry date, any 3-digit CVC, any postal code.

---

## 7. 2FA Recovery (if admin loses authenticator device)

Run via Railway shell — no local setup needed:

```bash
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
        {"$set": {"totp_enabled": False, "totp_secret": None, "totp_backup_codes": [], "totp_verified_at": None}}
    )
    await db.totp_trusted_sessions.delete_many({"user_id": user["_id"]})
    print(f"2FA disabled for {email}. All trusted sessions revoked.")
    client.close()

email = sys.argv[1] if len(sys.argv) > 1 else "admin@vivalusa.com"
asyncio.run(disable_2fa(email))
EOF
```

Usage: `railway run --service backend python - admin@vivalusa.com`
