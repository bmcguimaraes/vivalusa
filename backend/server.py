from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
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

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Object Storage ───
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "vivalusa"
storage_key = None

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = http_requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = http_requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = http_requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

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
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

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
    zip_code: str

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
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
        return {"message": "Token refreshed"}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

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
@api_router.post("/shipping/calculate")
async def calculate_shipping(req: ShippingRequest):
    store_zip = os.environ.get("STORE_ZIP", "10001")
    try:
        user_zip = int(req.zip_code[:5])
        store_zip_int = int(store_zip[:5])
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid zip code")
    distance_factor = abs(user_zip - store_zip_int)
    if distance_factor < 500:
        shipping_cost = 5.99
        estimate = "2-3 business days"
    elif distance_factor < 5000:
        shipping_cost = 9.99
        estimate = "4-6 business days"
    elif distance_factor < 50000:
        shipping_cost = 14.99
        estimate = "5-8 business days"
    else:
        shipping_cost = 19.99
        estimate = "7-12 business days"
    return {"shipping_cost": shipping_cost, "estimate": estimate, "zip_code": req.zip_code}

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

# ─── CHECKOUT / STRIPE ───
@api_router.post("/checkout/session")
async def create_checkout_session(req: CheckoutRequest, request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse

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

    # Calculate shipping
    shipping_cost = 0.0
    if req.shipping_address.get("zip_code"):
        store_zip = os.environ.get("STORE_ZIP", "10001")
        try:
            user_zip = int(req.shipping_address["zip_code"][:5])
            store_zip_int = int(store_zip[:5])
            distance_factor = abs(user_zip - store_zip_int)
            if distance_factor < 500:
                shipping_cost = 5.99
            elif distance_factor < 5000:
                shipping_cost = 9.99
            elif distance_factor < 50000:
                shipping_cost = 14.99
            else:
                shipping_cost = 19.99
        except ValueError:
            shipping_cost = 9.99

    final_total = round(total + shipping_cost, 2)

    origin_url = req.origin_url.rstrip("/")
    success_url = f"{origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/cart"

    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    metadata = {
        "user_id": user["_id"] if user else "guest",
        "user_email": user["email"] if user else (req.guest_email or ""),
        "discount": str(discount),
        "shipping": str(shipping_cost),
    }

    checkout_request = CheckoutSessionRequest(
        amount=final_total,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata
    )
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)

    # Create payment transaction record
    transaction = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
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

    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    status = await stripe_checkout.get_checkout_status(session_id)

    # Update transaction
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if tx and tx.get("payment_status") != "paid":
        new_status = "completed" if status.payment_status == "paid" else ("expired" if status.status == "expired" else tx.get("status", "initiated"))
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": status.payment_status, "status": new_status}}
        )
        if status.payment_status == "paid" and tx.get("status") != "completed":
            # Create order record
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

    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    body = await request.body()
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, request.headers.get("Stripe-Signature"))
        if webhook_response.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {"payment_status": "paid", "status": "completed"}}
            )
        return {"status": "processed"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}

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
    admin_password = os.environ.get("ADMIN_PASSWORD", "VivaLusa2024!")
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
    await db.products.create_index("category")
    await db.products.create_index("id", unique=True)
    await db.payment_transactions.create_index("session_id")
    await db.orders.create_index("user_id")
    await db.files.create_index("storage_path")
    await seed_admin()
    await seed_products()
    # Init object storage
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    # Write test credentials
    creds_dir = Path("/app/memory")
    creds_dir.mkdir(exist_ok=True)
    creds_file = creds_dir / "test_credentials.md"
    creds_file.write_text(
        f"# Test Credentials\n\n"
        f"## Admin\n- Email: {os.environ.get('ADMIN_EMAIL', 'admin@vivalusa.com')}\n"
        f"- Password: {os.environ.get('ADMIN_PASSWORD', 'VivaLusa2024!')}\n- Role: admin\n\n"
        f"## Auth Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n"
        f"- POST /api/auth/logout\n- GET /api/auth/me\n- POST /api/auth/refresh\n"
    )

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
