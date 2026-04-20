from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import secrets
from bson import ObjectId
import requests as http_requests
import time
import pyotp
import qrcode
import io
import base64
import hashlib

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "0"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
        if IS_PRODUCTION:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)

api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

IS_PRODUCTION = os.environ.get("ENVIRONMENT", "development").lower() == "production"

# ─── Object Storage (Cloudflare R2 / S3-compatible) ───
import boto3 as _boto3

APP_NAME = "vivalusa"
BUCKET = os.environ.get("S3_BUCKET", "vivalusa-images")
_s3_client = None

def _get_s3():
    global _s3_client
    if not _s3_client:
        _s3_client = _boto3.client(
            "s3",
            endpoint_url=os.environ.get("S3_ENDPOINT_URL"),
            aws_access_key_id=os.environ["S3_ACCESS_KEY"],
            aws_secret_access_key=os.environ["S3_SECRET_KEY"],
            region_name=os.environ.get("S3_REGION", "auto"),
        )
    return _s3_client

def put_object(path: str, data: bytes, content_type: str) -> dict:
    _get_s3().put_object(Bucket=BUCKET, Key=path, Body=data, ContentType=content_type)
    return {"path": path}

def get_object(path: str):
    obj = _get_s3().get_object(Bucket=BUCKET, Key=path)
    return obj["Body"].read(), obj["ContentType"]

# ─── Currency Exchange ───
_exchange_cache = {"rates": {}, "timestamp": 0}

async def get_exchange_rates():
    now = time.time()
    if _exchange_cache["rates"] and (now - _exchange_cache["timestamp"]) < 3600:
        return _exchange_cache["rates"]
    try:
        resp = http_requests.get("https://api.frankfurter.dev/v1/latest?base=EUR", timeout=10)
        resp.raise_for_status()
        data = resp.json()
        rates = data.get("rates", {})
        rates["EUR"] = 1.0
        _exchange_cache["rates"] = rates
        _exchange_cache["timestamp"] = now
        return rates
    except Exception as e:
        logger.error(f"Exchange rate fetch failed: {e}")
        if _exchange_cache["rates"]:
            return _exchange_cache["rates"]
        return {"EUR": 1.0, "USD": 1.08, "GBP": 0.86}

# ─── Password Helpers ───
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=IS_PRODUCTION, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=IS_PRODUCTION, samesite="lax", max_age=604800, path="/")

# ─── Pydantic Models ───
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    currency: str = "EUR"
    category: str
    image_url: str
    stock: int = 100
    featured: bool = False

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    stock: Optional[int] = None
    featured: Optional[bool] = None

class ShippingRequest(BaseModel):
    country: str
    zip_code: str = ""

class CheckoutRequest(BaseModel):
    items: List[Dict]
    shipping_address: Dict
    origin_url: str
    guest_email: Optional[str] = None

class OrderItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int
    image_url: str

# ─── AUTH ROUTES ───
@api_router.post("/auth/register")
async def register(req: RegisterRequest, response: Response):
    email = req.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "name": req.name,
        "email": email,
        "password_hash": hash_password(req.password),
        "role": "customer",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)
    return {"id": user_id, "name": req.name, "email": email, "role": "customer"}

@api_router.post("/auth/login")
async def login(req: LoginRequest, response: Response, request: Request):
    email = req.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    # Brute force check
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempt and attempt.get("count", 0) >= 5:
        lockout_until = attempt.get("lockout_until")
        if lockout_until and datetime.now(timezone.utc) < datetime.fromisoformat(lockout_until):
            raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"lockout_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}},
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"identifier": identifier})

    # 2FA check for admin users with TOTP enabled
    if user.get("role") == "admin" and user.get("totp_enabled"):
        skip_2fa = False
        trust_cookie = request.cookies.get("vl_2fa_trust")
        if trust_cookie:
            trust_hash = hashlib.sha256(trust_cookie.encode()).hexdigest()
            trusted = await db.totp_trusted_sessions.find_one({
                "user_id": ObjectId(str(user["_id"])),
                "session_token_hash": trust_hash
            })
            if trusted:
                skip_2fa = True
        if not skip_2fa:
            pending_payload = {
                "sub": str(user["_id"]), "email": email,
                "type": "2fa_pending",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=5)
            }
            pending_token = jwt.encode(pending_payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)
            response.set_cookie(key="2fa_pending", value=pending_token, httponly=True,
                                secure=IS_PRODUCTION, samesite="lax", max_age=300, path="/")
            return {"requires_2fa": True}

    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)
    return {"id": user_id, "name": user["name"], "email": email, "role": user.get("role", "customer")}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user_id = str(user["_id"])
        access_token = create_access_token(user_id, user["email"])
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=IS_PRODUCTION, samesite="lax", max_age=3600, path="/")
        return {"message": "Token refreshed"}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ─── ADMIN 2FA ───
class TotpCodeRequest(BaseModel):
    code: str

@api_router.post("/admin/2fa/setup")
async def totp_setup(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    secret = pyotp.random_base32()
    codes_plain = [secrets.token_urlsafe(6).upper() for _ in range(8)]
    codes_hashed = [hash_password(c) for c in codes_plain]
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"totp_secret": secret, "totp_enabled": False, "totp_backup_codes": codes_hashed}}
    )
    totp_uri = pyotp.TOTP(secret).provisioning_uri(name=user["email"], issuer_name="VivaLusa")
    img = qrcode.make(totp_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_png = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    return {"qr_png": qr_png, "manual_key": secret, "backup_codes": codes_plain}

@api_router.post("/admin/2fa/confirm")
async def totp_confirm(req: TotpCodeRequest, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    secret = user.get("totp_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="2FA setup not started — call /admin/2fa/setup first")
    if not pyotp.TOTP(secret).verify(req.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"totp_enabled": True, "totp_verified_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True}

@api_router.post("/admin/2fa/verify")
async def totp_verify(req: TotpCodeRequest, request: Request, response: Response):
    token = request.cookies.get("2fa_pending")
    if not token:
        raise HTTPException(status_code=401, detail="No pending 2FA session")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "2fa_pending":
            raise HTTPException(status_code=401, detail="Invalid pending token")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Pending session expired — log in again")

    secret = user.get("totp_secret")
    valid = bool(secret and pyotp.TOTP(secret).verify(req.code, valid_window=1))
    if not valid:
        for i, hashed_code in enumerate(user.get("totp_backup_codes", [])):
            if verify_password(req.code, hashed_code):
                remaining = [c for j, c in enumerate(user["totp_backup_codes"]) if j != i]
                await db.users.update_one(
                    {"_id": user["_id"]}, {"$set": {"totp_backup_codes": remaining}}
                )
                valid = True
                break
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid TOTP code or backup code")

    response.delete_cookie("2fa_pending", path="/")
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, user["email"])
    refresh_token_val = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token_val)

    trust_token = secrets.token_hex(32)
    trust_hash = hashlib.sha256(trust_token.encode()).hexdigest()
    ip = request.client.host if request.client else "unknown"
    await db.totp_trusted_sessions.insert_one({
        "user_id": ObjectId(user_id),
        "session_token_hash": trust_hash,
        "user_agent": request.headers.get("User-Agent", ""),
        "ip": ip,
        "verified_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30)
    })
    response.set_cookie(key="vl_2fa_trust", value=trust_token, httponly=True,
                        secure=IS_PRODUCTION, samesite="lax", max_age=2592000, path="/")
    return {"id": user_id, "name": user.get("name"), "email": user["email"], "role": user.get("role", "admin")}

@api_router.post("/admin/2fa/backup-codes/regenerate")
async def totp_regen_backup(req: TotpCodeRequest, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if not user.get("totp_enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled")
    if not pyotp.TOTP(user["totp_secret"]).verify(req.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid TOTP code")
    codes_plain = [secrets.token_urlsafe(6).upper() for _ in range(8)]
    codes_hashed = [hash_password(c) for c in codes_plain]
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": {"totp_backup_codes": codes_hashed}})
    return {"backup_codes": codes_plain}

@api_router.get("/admin/2fa/status")
async def totp_status(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return {"enabled": bool(user.get("totp_enabled")), "has_backup_codes": len(user.get("totp_backup_codes", [])) > 0}

@api_router.post("/admin/2fa/disable")
async def totp_disable(req: TotpCodeRequest, request: Request, response: Response):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if not user.get("totp_enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled")
    if not pyotp.TOTP(user["totp_secret"]).verify(req.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid TOTP code")
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"totp_enabled": False, "totp_secret": None, "totp_backup_codes": []}}
    )
    await db.totp_trusted_sessions.delete_many({"user_id": ObjectId(user["_id"])})
    response.delete_cookie("vl_2fa_trust", path="/")
    return {"success": True}

# ─── PRODUCT ROUTES ───
@api_router.get("/products")
async def get_products():
    products = await db.products.find({}, {"_id": 0}).to_list(200)
    return products

@api_router.get("/products/categories")
async def get_categories():
    categories = await db.products.distinct("category")
    return categories

@api_router.get("/products/category/{category}")
async def get_products_by_category(category: str):
    products = await db.products.find({"category": category}, {"_id": 0}).to_list(100)
    return products

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

# ─── ADMIN PRODUCT ROUTES ───
@api_router.post("/admin/products")
async def create_product(product: ProductCreate, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    product_doc = product.model_dump()
    product_doc["id"] = str(uuid.uuid4())
    product_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.products.insert_one(product_doc)
    product_doc.pop("_id", None)
    return product_doc

@api_router.put("/admin/products/{product_id}")
async def update_product(product_id: str, product: ProductUpdate, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    update_data = {k: v for k, v in product.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.products.update_one({"id": product_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return updated

@api_router.delete("/admin/products/{product_id}")
async def delete_product(product_id: str, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

# ─── SHIPPING CALCULATOR ───
# Shipping from Sanguedo, Portugal (4505-609)
SHIPPING_ZONES = {
    "portugal": {"cost": 3.99, "estimate": "1-2 business days", "zone": "Domestic"},
    "spain": {"cost": 6.99, "estimate": "2-4 business days", "zone": "Iberian"},
    "france": {"cost": 9.99, "estimate": "3-5 business days", "zone": "Western EU"},
    "germany": {"cost": 9.99, "estimate": "3-5 business days", "zone": "Western EU"},
    "italy": {"cost": 9.99, "estimate": "3-5 business days", "zone": "Western EU"},
    "netherlands": {"cost": 9.99, "estimate": "3-5 business days", "zone": "Western EU"},
    "belgium": {"cost": 9.99, "estimate": "3-5 business days", "zone": "Western EU"},
    "luxembourg": {"cost": 9.99, "estimate": "3-5 business days", "zone": "Western EU"},
    "austria": {"cost": 9.99, "estimate": "3-5 business days", "zone": "Western EU"},
    "switzerland": {"cost": 11.99, "estimate": "4-6 business days", "zone": "Western EU"},
    "ireland": {"cost": 12.99, "estimate": "4-7 business days", "zone": "Atlantic"},
    "united kingdom": {"cost": 14.99, "estimate": "5-8 business days", "zone": "UK"},
    "uk": {"cost": 14.99, "estimate": "5-8 business days", "zone": "UK"},
    "denmark": {"cost": 12.99, "estimate": "4-7 business days", "zone": "Northern EU"},
    "sweden": {"cost": 12.99, "estimate": "4-7 business days", "zone": "Northern EU"},
    "norway": {"cost": 14.99, "estimate": "5-8 business days", "zone": "Northern EU"},
    "finland": {"cost": 12.99, "estimate": "4-7 business days", "zone": "Northern EU"},
    "poland": {"cost": 12.99, "estimate": "4-7 business days", "zone": "Eastern EU"},
    "czech republic": {"cost": 12.99, "estimate": "4-7 business days", "zone": "Eastern EU"},
    "czechia": {"cost": 12.99, "estimate": "4-7 business days", "zone": "Eastern EU"},
    "hungary": {"cost": 12.99, "estimate": "4-7 business days", "zone": "Eastern EU"},
    "romania": {"cost": 12.99, "estimate": "5-8 business days", "zone": "Eastern EU"},
    "bulgaria": {"cost": 12.99, "estimate": "5-8 business days", "zone": "Eastern EU"},
    "croatia": {"cost": 12.99, "estimate": "4-7 business days", "zone": "Eastern EU"},
    "slovenia": {"cost": 12.99, "estimate": "4-7 business days", "zone": "Eastern EU"},
    "slovakia": {"cost": 12.99, "estimate": "4-7 business days", "zone": "Eastern EU"},
    "greece": {"cost": 12.99, "estimate": "5-8 business days", "zone": "Southern EU"},
    "malta": {"cost": 12.99, "estimate": "5-8 business days", "zone": "Southern EU"},
    "cyprus": {"cost": 14.99, "estimate": "6-10 business days", "zone": "Southern EU"},
    "estonia": {"cost": 12.99, "estimate": "5-8 business days", "zone": "Baltic"},
    "latvia": {"cost": 12.99, "estimate": "5-8 business days", "zone": "Baltic"},
    "lithuania": {"cost": 12.99, "estimate": "5-8 business days", "zone": "Baltic"},
    "iceland": {"cost": 16.99, "estimate": "7-12 business days", "zone": "Nordic"},
}

EUROPEAN_COUNTRIES = list(SHIPPING_ZONES.keys())

@api_router.post("/shipping/calculate")
async def calculate_shipping(req: ShippingRequest):
    country = req.country.lower().strip()
    zone = SHIPPING_ZONES.get(country)
    if not zone:
        raise HTTPException(status_code=400, detail=f"We currently only ship within Europe. '{req.country}' is not in our delivery area.")
    return {
        "shipping_cost": zone["cost"],
        "estimate": zone["estimate"],
        "zone": zone["zone"],
        "country": req.country,
        "zip_code": req.zip_code
    }

@api_router.get("/shipping/countries")
async def get_shipping_countries():
    countries = []
    seen = set()
    for name, info in SHIPPING_ZONES.items():
        display = name.title()
        if display == "Uk":
            display = "United Kingdom"
        if display == "Czechia":
            continue
        if display.lower() in seen:
            continue
        seen.add(display.lower())
        countries.append({"value": name, "label": display, "zone": info["zone"], "cost": info["cost"]})
    countries.sort(key=lambda c: c["label"])
    return countries

# ─── IMAGE UPLOAD ───
@api_router.post("/upload/image")
async def upload_image(request: Request, file: UploadFile = File(...)):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only image files (JPEG, PNG, WebP, GIF) allowed")

    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    path = f"{APP_NAME}/products/{uuid.uuid4()}.{ext}"

    try:
        result = put_object(path, data, file.content_type or "image/png")
        await db.files.insert_one({
            "id": str(uuid.uuid4()),
            "storage_path": result["path"],
            "original_filename": file.filename,
            "content_type": file.content_type,
            "size": result.get("size", len(data)),
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"path": result["path"], "url": f"/api/files/{result['path']}"}
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail="Upload failed")

@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        data, content_type = get_object(path)
        return Response(content=data, media_type=record.get("content_type", content_type))
    except Exception as e:
        logger.error(f"File serve failed: {e}")
        raise HTTPException(status_code=404, detail="File not found")

# ─── CURRENCY ───
@api_router.get("/currency/rates")
async def currency_rates():
    rates = await get_exchange_rates()
    return {"base": "EUR", "rates": rates}

# ─── ADMIN ANALYTICS ───
@api_router.get("/admin/analytics")
async def get_analytics(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Total products and stock
    products = await db.products.find({}, {"_id": 0, "id": 1, "name": 1, "stock": 1, "price": 1, "category": 1}).to_list(500)
    total_stock = sum(p.get("stock", 0) for p in products)
    low_stock = [p for p in products if p.get("stock", 0) < 20]

    # Orders and revenue
    orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    total_revenue = sum(o.get("total", 0) for o in orders)
    total_orders = len(orders)

    # Revenue by category from order items
    category_revenue = {}
    for order in orders:
        for item in order.get("items", []):
            cat = item.get("category", "Unknown")
            category_revenue[cat] = category_revenue.get(cat, 0) + (item.get("price", 0) * item.get("quantity", 1))

    # Recent orders (last 10)
    recent_orders = sorted(orders, key=lambda o: o.get("created_at", ""), reverse=True)[:10]

    # Stock by category
    category_stock = {}
    for p in products:
        cat = p.get("category", "Unknown")
        category_stock[cat] = category_stock.get(cat, 0) + p.get("stock", 0)

    return {
        "total_products": len(products),
        "total_stock": total_stock,
        "low_stock_items": low_stock,
        "total_orders": total_orders,
        "total_revenue": round(total_revenue, 2),
        "category_revenue": category_revenue,
        "category_stock": category_stock,
        "recent_orders": recent_orders
    }

# ─── Email & Order Helpers ───
async def _get_user_email(user_id: Optional[str]) -> Optional[str]:
    if not user_id or user_id == "guest":
        return None
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1})
        return user.get("email") if user else None
    except Exception:
        return None

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

# ─── CHECKOUT / STRIPE ───
@api_router.post("/checkout/session")
async def create_checkout_session(req: CheckoutRequest, request: Request):
    import stripe as stripe_lib
    stripe_lib.api_key = os.environ.get("STRIPE_API_KEY")

    user = await get_optional_user(request)

    # Validate items and calculate total from DB prices (prevent price manipulation)
    cart_items = []
    total = 0.0
    for item in req.items:
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=400, detail=f"Product {item['product_id']} not found")
        qty = int(item.get("quantity", 1))
        cart_items.append({
            "product_id": product["id"],
            "name": product["name"],
            "price": product["price"],
            "quantity": qty,
            "image_url": product.get("image_url", "")
        })
        total += product["price"] * qty

    # 5% discount for logged-in users
    discount = 0.0
    if user:
        discount = round(total * 0.05, 2)
        total = round(total - discount, 2)

    # Calculate shipping based on country
    shipping_cost = 0.0
    country = req.shipping_address.get("country", "").lower().strip()
    zone_info = SHIPPING_ZONES.get(country)
    if zone_info:
        shipping_cost = zone_info["cost"]
    else:
        shipping_cost = 14.99  # Default for unknown European countries

    final_total = round(total + shipping_cost, 2)

    origin_url = req.origin_url.rstrip("/")
    success_url = f"{origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/cart"

    metadata = {
        "user_id": user["_id"] if user else "guest",
        "user_email": user["email"] if user else (req.guest_email or ""),
        "discount": str(discount),
        "shipping": str(shipping_cost),
    }

    session = stripe_lib.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "eur",
                "unit_amount": int(final_total * 100),
                "product_data": {"name": "VivaLusa Order"},
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )

    # Create payment transaction record
    transaction = {
        "id": str(uuid.uuid4()),
        "session_id": session.id,
        "user_id": user["_id"] if user else None,
        "guest_email": req.guest_email if not user else None,
        "items": cart_items,
        "subtotal": round(total + discount, 2),
        "discount": discount,
        "shipping_cost": shipping_cost,
        "total": final_total,
        "shipping_address": req.shipping_address,
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payment_transactions.insert_one(transaction)

    return {"url": session.url, "session_id": session.id}

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, request: Request):
    import stripe as stripe_lib
    stripe_lib.api_key = os.environ.get("STRIPE_API_KEY")
    session = stripe_lib.checkout.Session.retrieve(session_id)

    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if tx and tx.get("payment_status") != "paid":
        new_status = "completed" if session.payment_status == "paid" else ("expired" if session.status == "expired" else tx.get("status", "initiated"))
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": session.payment_status, "status": new_status}}
        )
        if session.payment_status == "paid" and tx.get("status") != "completed":
            order_doc = {
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "user_id": tx.get("user_id"),
                "guest_email": tx.get("guest_email"),
                "items": tx.get("items", []),
                "subtotal": tx.get("subtotal", 0),
                "discount": tx.get("discount", 0),
                "shipping_cost": tx.get("shipping_cost", 0),
                "total": tx.get("total", 0),
                "shipping_address": tx.get("shipping_address", {}),
                "status": "confirmed",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.orders.insert_one(order_doc)
            email = tx.get("guest_email") or await _get_user_email(tx.get("user_id"))
            if email:
                send_order_confirmation(order_doc, email)

    return {
        "status": session.status,
        "payment_status": session.payment_status,
        "amount_total": session.amount_total,
        "currency": session.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    import stripe as stripe_lib
    body = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    try:
        event = stripe_lib.Webhook.construct_event(body, sig_header, webhook_secret)
        if event["type"] == "checkout.session.completed":
            stripe_session = event["data"]["object"]
            if stripe_session.get("payment_status") == "paid":
                session_id = stripe_session["id"]
                tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
                if tx and tx.get("payment_status") != "paid":
                    await db.payment_transactions.update_one(
                        {"session_id": session_id},
                        {"$set": {"payment_status": "paid", "status": "completed"}}
                    )
                    if tx.get("status") != "completed":
                        order_doc = {
                            "id": str(uuid.uuid4()),
                            "session_id": session_id,
                            "user_id": tx.get("user_id"),
                            "guest_email": tx.get("guest_email"),
                            "items": tx.get("items", []),
                            "subtotal": tx.get("subtotal", 0),
                            "discount": tx.get("discount", 0),
                            "shipping_cost": tx.get("shipping_cost", 0),
                            "total": tx.get("total", 0),
                            "shipping_address": tx.get("shipping_address", {}),
                            "status": "confirmed",
                            "created_at": datetime.now(timezone.utc).isoformat()
                        }
                        await db.orders.insert_one(order_doc)
                        email = tx.get("guest_email") or await _get_user_email(tx.get("user_id"))
                        if email:
                            send_order_confirmation(order_doc, email)
        return {"status": "processed"}
    except stripe_lib.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=400, detail="Webhook processing error")

# ─── PAYPAL ───
PAYPAL_BASE = "https://api-m.sandbox.paypal.com" if os.environ.get("PAYPAL_MODE") == "sandbox" else "https://api-m.paypal.com"

async def get_paypal_token():
    client_id = os.environ.get("PAYPAL_CLIENT_ID")
    secret = os.environ.get("PAYPAL_SECRET")
    if not client_id or not secret:
        raise HTTPException(status_code=500, detail="PayPal not configured")
    resp = http_requests.post(
        f"{PAYPAL_BASE}/v1/oauth2/token",
        headers={"Accept": "application/json"},
        data={"grant_type": "client_credentials"},
        auth=(client_id, secret),
        timeout=15
    )
    resp.raise_for_status()
    return resp.json()["access_token"]

class PayPalCheckoutRequest(BaseModel):
    items: List[Dict]
    shipping_address: Dict
    origin_url: str
    guest_email: Optional[str] = None

@api_router.post("/paypal/create-order")
async def paypal_create_order(req: PayPalCheckoutRequest, request: Request):
    user = await get_optional_user(request)

    # Validate items and calculate total from DB (prevent price manipulation)
    cart_items = []
    total = 0.0
    for item in req.items:
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=400, detail=f"Product {item['product_id']} not found")
        qty = int(item.get("quantity", 1))
        cart_items.append({
            "product_id": product["id"], "name": product["name"],
            "price": product["price"], "quantity": qty, "image_url": product.get("image_url", "")
        })
        total += product["price"] * qty

    discount = 0.0
    if user:
        discount = round(total * 0.05, 2)
        total = round(total - discount, 2)

    # Shipping
    country = req.shipping_address.get("country", "").lower().strip()
    zone_info = SHIPPING_ZONES.get(country, {"cost": 14.99})
    shipping_cost = zone_info["cost"]
    final_total = round(total + shipping_cost, 2)

    token = await get_paypal_token()
    order_body = {
        "intent": "CAPTURE",
        "purchase_units": [{
            "amount": {
                "currency_code": "EUR",
                "value": f"{final_total:.2f}",
                "breakdown": {
                    "item_total": {"currency_code": "EUR", "value": f"{round(total, 2):.2f}"},
                    "shipping": {"currency_code": "EUR", "value": f"{shipping_cost:.2f}"}
                }
            }
        }],
        "application_context": {
            "return_url": f"{req.origin_url}/payment/success?paypal=true",
            "cancel_url": f"{req.origin_url}/cart",
            "brand_name": "VivaLusa",
            "shipping_preference": "NO_SHIPPING"
        }
    }

    resp = http_requests.post(
        f"{PAYPAL_BASE}/v2/checkout/orders",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=order_body, timeout=15
    )
    resp.raise_for_status()
    paypal_order = resp.json()

    # Save transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "session_id": paypal_order["id"],
        "payment_method": "paypal",
        "user_id": user["_id"] if user else None,
        "guest_email": req.guest_email if not user else None,
        "items": cart_items,
        "subtotal": round(total + discount, 2),
        "discount": discount,
        "shipping_cost": shipping_cost,
        "total": final_total,
        "shipping_address": req.shipping_address,
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payment_transactions.insert_one(transaction)

    # Find the approval URL
    approve_url = next((l["href"] for l in paypal_order.get("links", []) if l["rel"] == "approve"), None)
    return {"order_id": paypal_order["id"], "approve_url": approve_url}

@api_router.post("/paypal/capture-order/{order_id}")
async def paypal_capture_order(order_id: str, request: Request):
    token = await get_paypal_token()
    resp = http_requests.post(
        f"{PAYPAL_BASE}/v2/checkout/orders/{order_id}/capture",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=15
    )
    resp.raise_for_status()
    capture = resp.json()

    status = capture.get("status", "")
    if status == "COMPLETED":
        tx = await db.payment_transactions.find_one({"session_id": order_id}, {"_id": 0})
        if tx and tx.get("payment_status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": order_id},
                {"$set": {"payment_status": "paid", "status": "completed"}}
            )
            order_doc = {
                "id": str(uuid.uuid4()), "session_id": order_id,
                "user_id": tx.get("user_id"), "guest_email": tx.get("guest_email"),
                "items": tx.get("items", []), "subtotal": tx.get("subtotal", 0),
                "discount": tx.get("discount", 0), "shipping_cost": tx.get("shipping_cost", 0),
                "total": tx.get("total", 0), "shipping_address": tx.get("shipping_address", {}),
                "payment_method": "paypal", "status": "confirmed",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.orders.insert_one(order_doc)
            email = tx.get("guest_email") or await _get_user_email(tx.get("user_id"))
            if email:
                send_order_confirmation(order_doc, email)

    return {"status": status, "order_id": order_id}

@api_router.get("/paypal/client-id")
async def get_paypal_client_id():
    client_id = os.environ.get("PAYPAL_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="PayPal not configured")
    return {"client_id": client_id}

# ─── ORDERS ───
@api_router.get("/orders")
async def get_orders(request: Request):
    user = await get_current_user(request)
    orders = await db.orders.find({"user_id": user["_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders

@api_router.get("/admin/orders")
async def get_all_orders(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders

# ─── REFUND ───
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
    if order.get("payment_method") == "paypal":
        raise HTTPException(status_code=400, detail="PayPal refunds must be processed via PayPal dashboard")

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

# ─── SEED DATA ───
SEED_PRODUCTS = [
    {
        "id": "prod-001",
        "name": "Radiance Gold Serum",
        "description": "A luxurious 24K gold-infused face serum that delivers deep hydration and a luminous glow. Enriched with hyaluronic acid and vitamin C for visibly brighter, firmer skin.",
        "price": 89.00,
        "category": "Skincare",
        "image_url": "https://images.unsplash.com/photo-1765053534710-2409e33e65b4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjBza2luY2FyZSUyMHNlcnVtJTIwZGFyayUyMGJhY2tncm91bmR8ZW58MHx8fHwxNzc2MzQzNjU1fDA&ixlib=rb-4.1.0&q=85",
        "stock": 50,
        "featured": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": "prod-002",
        "name": "Noir Velvet Lipstick",
        "description": "An ultra-pigmented matte lipstick with a velvety smooth finish. Long-lasting wear with a deep, sultry burgundy shade that complements every skin tone.",
        "price": 42.00,
        "category": "Makeup",
        "image_url": "https://images.unsplash.com/photo-1590785069862-343f908422d7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTJ8MHwxfHNlYXJjaHwzfHxsdXh1cnklMjBsaXBzdGljayUyMGNvc21ldGljcyUyMGRhcmslMjBiYWNrZ3JvdW5kfGVufDB8fHx8MTc3NjM0MzY2MXww&ixlib=rb-4.1.0&q=85",
        "stock": 120,
        "featured": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": "prod-003",
        "name": "Essence de Lusa",
        "description": "A captivating signature fragrance blending warm amber, jasmine, and sandalwood. Inspired by golden Portuguese sunsets, this eau de parfum lingers beautifully all day.",
        "price": 125.00,
        "category": "Fragrance",
        "image_url": "https://images.unsplash.com/photo-1774682060992-46c7e9f2e50b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHw0fHxsdXh1cnklMjBjb3NtZXRpYyUyMHByb2R1Y3QlMjBkYXJrJTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3NzYzNDM0OTR8MA&ixlib=rb-4.1.0&q=85",
        "stock": 35,
        "featured": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": "prod-004",
        "name": "Midnight Eye Palette",
        "description": "12 richly pigmented eyeshadow shades from shimmering golds to deep smoky blacks. Buildable, blendable, and designed for dramatic evening looks.",
        "price": 58.00,
        "category": "Makeup",
        "image_url": "https://static.prod-images.emergentagent.com/jobs/a578c59c-55b8-40a0-b078-ec23d806778b/images/c55838c1ac0813ef7c6837a40e93a2c7c82d59810c8cd6fde36227eab2e17856.png",
        "stock": 80,
        "featured": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": "prod-005",
        "name": "Golden Hour Moisturizer",
        "description": "A rich, nourishing moisturizer infused with argan oil and shea butter. Delivers 72-hour hydration with a subtle golden shimmer for a dewy, radiant finish.",
        "price": 65.00,
        "category": "Skincare",
        "image_url": "https://images.unsplash.com/photo-1775255487971-af15499994b1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBza2luY2FyZSUyMHNlcnVtJTIwZGFyayUyMGJhY2tncm91bmR8ZW58MHx8fHwxNzc2MzQzNjU1fDA&ixlib=rb-4.1.0&q=85",
        "stock": 65,
        "featured": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": "prod-006",
        "name": "Lusitano Cologne",
        "description": "A fresh, invigorating cologne with notes of bergamot, sea salt, and cedarwood. The perfect everyday scent that transitions seamlessly from day to night.",
        "price": 95.00,
        "category": "Fragrance",
        "image_url": "https://images.unsplash.com/photo-1774682060971-7b0b07c1d47f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjBjb3NtZXRpYyUyMHByb2R1Y3QlMjBkYXJrJTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3NzYzNDM0OTR8MA&ixlib=rb-4.1.0&q=85",
        "stock": 45,
        "featured": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
]

async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@vivalusa.com")
    admin_password = os.environ.get("ADMIN_PASSWORD")
    if not admin_password:
        raise RuntimeError(
            "ADMIN_PASSWORD env var is required. "
            "Set a strong password (min 16 chars) before starting the server."
        )
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

async def seed_products():
    count = await db.products.count_documents({})
    if count == 0:
        for p in SEED_PRODUCTS:
            await db.products.insert_one(p)
        logger.info(f"Seeded {len(SEED_PRODUCTS)} products")

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.totp_trusted_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.totp_trusted_sessions.create_index("user_id")
    await db.totp_trusted_sessions.create_index("session_token_hash")
    await db.products.create_index("category")
    await db.products.create_index("id", unique=True)
    await db.payment_transactions.create_index("session_id")
    await db.orders.create_index("user_id")
    await db.files.create_index("storage_path")
    await seed_admin()
    await seed_products()

app.include_router(api_router)

_cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
if not _cors_origins:
    raise RuntimeError(
        "CORS_ORIGINS env var is required. "
        "Example: CORS_ORIGINS=https://vivalusa.com"
    )
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Cookie"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
