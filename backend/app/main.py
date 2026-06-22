from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4
import io
import os

from fastapi import FastAPI, HTTPException, Query, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from supabase import create_client, Client
from gotrue.errors import AuthApiError
from collections import defaultdict
import time
from app.invoice_routes import router as invoice_router
from app.ai_routes import router as ai_router

load_dotenv()

# Simple in-memory rate limiters tracking client IPs
login_attempts = defaultdict(list)
signup_attempts = defaultdict(list)

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

def check_rate_limit(ip: str, attempts_dict: dict, max_attempts: int, period: int = 60):
    now = time.time()
    attempts_dict[ip] = [t for t in attempts_dict[ip] if now - t < period]
    if len(attempts_dict[ip]) >= max_attempts:
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests. Maximum {max_attempts} attempts per minute."
        )
    attempts_dict[ip].append(now)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_current_user_id(
    authorization: Optional[str] = Header(default=None),
) -> str:
    jwt_token = None
    if authorization and authorization.startswith("Bearer "):
        jwt_token = authorization.split(" ")[1]
        
    if not jwt_token:
        raise HTTPException(status_code=401, detail="Unauthorized: Authentication token missing")
    
    try:
        user_resp = supabase.auth.get_user(jwt_token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")
        
        user_id = user_resp.user.id
        
        # Self-healing: Ensure user profile and store exist in public schema
        email = user_resp.user.email
        name = user_resp.user.user_metadata.get("name") or user_resp.user.user_metadata.get("full_name") or email.split("@")[0]
        
        existing = supabase.table("users").select("id").eq("id", user_id).execute().data
        if not existing:
            supabase.table("users").insert({
                "id": user_id,
                "name": name,
                "email": email,
                "password": "SUPABASE_MANAGED"
            }).execute()
            
        return user_id
    except AuthApiError as e:
        raise HTTPException(status_code=401, detail=f"Unauthorized: {str(e)}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=401, detail=f"Unauthorized: {str(e)}")

LOW_STOCK_THRESHOLD = 10


# ── Models ────────────────────────────────────────────────────────────────────

class UserIn(BaseModel):
    name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=4)


class LoginIn(BaseModel):
    email: str
    password: str


class StoreProfile(BaseModel):
    store_name: str = Field(min_length=1)
    owner_name: str = Field(min_length=1)
    phone: str = Field(min_length=6)
    store_category: str = Field(min_length=1)
    gst_number: Optional[str] = None
    business_address: Optional[str] = None
    receipt_prefix: Optional[str] = None
    receipt_footer: Optional[str] = None
    logo_data_url: Optional[str] = None
    theme_color: Optional[str] = None
    extra_categories: Optional[list[str]] = None
    upi_id: Optional[str] = None


class ProductIn(BaseModel):
    name: str = Field(min_length=1)
    barcode: Optional[str] = None
    category: str = Field(min_length=1)
    cost_price: float = Field(ge=0)
    selling_price: float = Field(ge=0)
    stock: int = Field(ge=0)
    unit: Optional[str] = "Piece"
    variable_price: bool = False


class Product(ProductIn):
    id: str


class CartItemIn(BaseModel):
    product_id: str
    quantity: int = Field(gt=0)
    override_price: Optional[float] = None


class SaleItem(BaseModel):
    product_id: str
    name: str
    cost_price: float
    selling_price: float
    quantity: int


class Sale(BaseModel):
    id: str
    bill_number: str
    created_at: str
    customer_id: Optional[str] = None
    payment_method: str = "Cash"
    items: list[SaleItem]
    total_amount: float
    total_profit: float


class CustomerIn(BaseModel):
    name: str = Field(min_length=1)
    phone: str = Field(min_length=6)
    email: Optional[str] = None
    address: Optional[str] = None


class Customer(CustomerIn):
    id: str


class UdhaarEntryIn(BaseModel):
    customer_id: str
    sale_id: Optional[str] = None
    amount: float = Field(gt=0)
    type: str
    note: Optional[str] = None


class UdhaarEntry(UdhaarEntryIn):
    id: str
    created_at: str


class PurchaseIn(BaseModel):
    product_id: str
    supplier_name: str = Field(min_length=1)
    quantity: int = Field(gt=0)
    cost_price: float = Field(ge=0)
    purchase_date: Optional[str] = None


class Purchase(PurchaseIn):
    id: str
    product_name: str
    total_cost: float
    created_at: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def sale_totals(items: list[dict]) -> tuple[float, float]:
    total = sum(item["selling_price"] * item["quantity"] for item in items)
    profit = sum((item["selling_price"] - item["cost_price"]) * item["quantity"] for item in items)
    return total, profit


def parse_date(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def customer_udhaar_summary(customer_id: str, user_id: str) -> dict:
    entries = supabase.table("udhaar").select("*").eq("customer_id", customer_id).eq("user_id", user_id).execute().data or []
    total_credit = sum(u["amount"] for u in entries if not u.get("paid"))
    total_paid = sum(u["amount"] for u in entries if u.get("paid"))
    return {
        "total_credit": total_credit,
        "total_paid": total_paid,
        "outstanding_balance": total_credit - total_paid,
    }


def public_user(user: dict) -> dict:
    return {"id": user["id"], "name": user["name"], "email": user["email"]}


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="SmartPOS API", version="2.0.0")
app.include_router(invoice_router)
app.include_router(ai_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173","https://hisaab-omega.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/auth/register")
def register(payload: UserIn, request: Request, ip: str = Depends(get_client_ip)) -> dict:
    check_rate_limit(ip, signup_attempts, max_attempts=3)
    try:
        res = supabase.auth.sign_up({
            "email": payload.email.lower(),
            "password": payload.password,
            "options": {
                "data": {
                    "name": payload.name
                }
            }
        })
        if not res or not res.user:
            raise HTTPException(status_code=400, detail="Registration failed via Supabase")
        
        user_id = res.user.id
        user = {"id": user_id, "name": payload.name, "email": payload.email.lower(), "password": "SUPABASE_MANAGED"}
        
        # Insert profile into our database
        supabase.table("users").insert(user).execute()
        
        return {"user": user, "session": res.session.model_dump() if res.session else None}
    except AuthApiError as e:
        if "already exists" in str(e).lower() or "unique" in str(e).lower() or "23505" in str(e):
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        if "already exists" in str(e).lower() or "unique" in str(e).lower() or "23505" in str(e):
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        raise HTTPException(status_code=400, detail=f"Registration failed: {str(e)}")


@app.post("/auth/login")
def login(payload: LoginIn, request: Request, ip: str = Depends(get_client_ip)) -> dict:
    check_rate_limit(ip, login_attempts, max_attempts=5)
    try:
        res = supabase.auth.sign_in_with_password({
            "email": payload.email.lower(),
            "password": payload.password
        })
        if not res or not res.user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
            
        user = {
            "id": res.user.id, 
            "name": res.user.user_metadata.get("name") or res.user.user_metadata.get("full_name") or payload.email.split("@")[0], 
            "email": res.user.email
        }
        return {"user": user, "session": res.session.model_dump() if res.session else None}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid email or password")


# ── Store ─────────────────────────────────────────────────────────────────────

import json

def unpack_store_fields(store: dict) -> dict:
    footer = store.get("receipt_footer") or ""
    upi_id = None
    extra_categories = []
    removed_categories = []
    
    # Extract UPI ID
    if "---UPI_ID:" in footer:
        parts = footer.split("---UPI_ID:")
        footer = parts[0]
        upi_id = parts[1].split("---")[0].strip()
        
    # Extract extra_categories
    if "---EXTRA_CATEGORIES:" in footer:
        parts = footer.split("---EXTRA_CATEGORIES:")
        footer = parts[0]
        try:
            extra_categories = json.loads(parts[1].split("---")[0].strip())
        except Exception:
            pass
            
    # Extract removed_categories
    if "---REMOVED_CATEGORIES:" in footer:
        parts = footer.split("---REMOVED_CATEGORIES:")
        footer = parts[0]
        try:
            removed_categories = json.loads(parts[1].split("---")[0].strip())
        except Exception:
            pass

    store["receipt_footer"] = footer.strip()
    store["upi_id"] = upi_id
    store["extra_categories"] = extra_categories
    store["removed_categories"] = removed_categories
    return store

def pack_store_fields(data: dict) -> dict:
    upi_id = data.pop("upi_id", None)
    extra_cats = data.pop("extra_categories", None)
    removed_cats = data.pop("removed_categories", None)
    
    # Strip any existing markers from footer
    footer = data.get("receipt_footer") or ""
    for marker in ["---UPI_ID:", "---EXTRA_CATEGORIES:", "---REMOVED_CATEGORIES:"]:
        if marker in footer:
            footer = footer.split(marker)[0]
            
    footer = footer.strip()
    
    if upi_id:
        footer += f"\n\n---UPI_ID:{upi_id}---"
    if extra_cats is not None:
        footer += f"\n\n---EXTRA_CATEGORIES:{json.dumps(extra_cats)}---"
    if removed_cats is not None:
        footer += f"\n\n---REMOVED_CATEGORIES:{json.dumps(removed_cats)}---"
        
    data["receipt_footer"] = footer.strip()
    return data


@app.get("/store")
def get_store(user_id: str = Depends(get_current_user_id)) -> dict:
    rows = supabase.table("store").select("*").eq("user_id", user_id).execute().data or []
    if not rows:
        return {}
    return unpack_store_fields(rows[0])


@app.put("/store")
def update_store(profile: StoreProfile, user_id: str = Depends(get_current_user_id)) -> dict:
    rows = supabase.table("store").select("id").eq("user_id", user_id).execute().data or []
    data = {**profile.model_dump(), "user_id": user_id}
    if rows:
        data["id"] = rows[0]["id"]
    else:
        import random
        data["id"] = random.randint(2, 2000000000)
    packed = pack_store_fields(data)
    res = supabase.table("store").upsert(packed).execute()
    return unpack_store_fields(res.data[0])


class CategoriesIn(BaseModel):
    categories: list[str]
    removed_categories: list[str] = []


@app.put("/store/categories")
def update_categories(payload: CategoriesIn, user_id: str = Depends(get_current_user_id)) -> dict:
    rows = supabase.table("store").select("*").eq("user_id", user_id).execute().data or []
    existing = rows[0] if rows else {"user_id": user_id}
    unpacked = unpack_store_fields(existing)
    
    cleaned = []
    seen = set()
    for c in payload.categories:
        c = c.strip()
        if c and c.lower() not in seen:
            seen.add(c.lower())
            cleaned.append(c)
            
    unpacked["extra_categories"] = cleaned
    unpacked["removed_categories"] = payload.removed_categories
    unpacked["user_id"] = user_id
    if rows:
        unpacked["id"] = rows[0]["id"]
    
    packed = pack_store_fields(unpacked)
    res = supabase.table("store").upsert(packed).execute()
    return unpack_store_fields(res.data[0])


# ── Products ──────────────────────────────────────────────────────────────────

@app.get("/products", response_model=list[Product])
def list_products(q: str = Query(default=""), user_id: str = Depends(get_current_user_id)) -> list[dict]:
    rows = supabase.table("products").select("*").eq("user_id", user_id).execute().data or []
    if not q:
        return rows
    query = q.lower()
    return [p for p in rows if query in f"{p['name']} {p.get('barcode') or ''} {p['category']}".lower()]


def assert_barcode_unique(barcode: Optional[str], user_id: str, exclude_id: Optional[str] = None) -> None:
    if not barcode:
        return
    rows = supabase.table("products").select("id, barcode").eq("user_id", user_id).execute().data or []
    for p in rows:
        if p.get("barcode") == barcode and p["id"] != exclude_id:
            raise HTTPException(status_code=409, detail="A product with this barcode already exists")


def find_existing_product(name: str, user_id: str, barcode: Optional[str] = None) -> Optional[dict]:
    rows = supabase.table("products").select("*").eq("user_id", user_id).execute().data or []
    if barcode:
        for p in rows:
            if p.get("barcode") and p["barcode"] == barcode:
                return p
    name_norm = name.strip().lower()
    for p in rows:
        if p["name"].strip().lower() == name_norm:
            return p
    return None


@app.post("/products", response_model=Product)
def create_product(payload: ProductIn, user_id: str = Depends(get_current_user_id)) -> dict:
    if payload.selling_price < payload.cost_price:
        raise HTTPException(status_code=400, detail="Selling price cannot be below cost price")
    assert_barcode_unique(payload.barcode, user_id)

    existing = find_existing_product(payload.name, user_id, payload.barcode)
    if existing:
        new_stock = existing["stock"] + payload.stock
        update_fields = {
            "stock": new_stock,
            "category": payload.category,
            "cost_price": payload.cost_price,
            "selling_price": payload.selling_price,
            "unit": payload.unit,
            "variable_price": payload.variable_price,
        }
        if payload.barcode and not existing.get("barcode"):
            update_fields["barcode"] = payload.barcode
        supabase.table("products").update(update_fields).eq("id", existing["id"]).eq("user_id", user_id).execute()
        return {**existing, **update_fields}

    product = {"id": str(uuid4()), "user_id": user_id, **payload.model_dump()}
    supabase.table("products").insert(product).execute()
    return product


@app.put("/products/{product_id}", response_model=Product)
def update_product(product_id: str, payload: ProductIn, user_id: str = Depends(get_current_user_id)) -> dict:
    if payload.selling_price < payload.cost_price:
        raise HTTPException(status_code=400, detail="Selling price cannot be below cost price")
    existing = supabase.table("products").select("id").eq("id", product_id).eq("user_id", user_id).execute().data
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    assert_barcode_unique(payload.barcode, user_id, exclude_id=product_id)
    
    name_match = find_existing_product(payload.name, user_id)
    if name_match and name_match["id"] != product_id:
        raise HTTPException(status_code=409, detail="Another product with this name already exists")
        
    updated = {"id": product_id, "user_id": user_id, **payload.model_dump()}
    supabase.table("products").update(updated).eq("id", product_id).eq("user_id", user_id).execute()
    return updated


@app.delete("/products/{product_id}")
def delete_product(product_id: str, user_id: str = Depends(get_current_user_id)) -> dict:
    existing = supabase.table("products").select("id").eq("id", product_id).eq("user_id", user_id).execute().data
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    try:
        supabase.table("purchases").delete().eq("product_id", product_id).eq("user_id", user_id).execute()
    except Exception:
        pass
    try:
        supabase.table("products").delete().eq("id", product_id).eq("user_id", user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete product: {str(e)}")
    return {"deleted": True}


@app.post("/products/{product_id}/barcode", response_model=Product)
def regenerate_barcode(product_id: str, user_id: str = Depends(get_current_user_id)) -> dict:
    rows = supabase.table("products").select("*").eq("id", product_id).eq("user_id", user_id).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Product not found")
    all_barcodes = {p.get("barcode") for p in (supabase.table("products").select("barcode").eq("user_id", user_id).execute().data or [])}
    while True:
        candidate = "".join(str(uuid4().int)[i] for i in range(12))
        if candidate not in all_barcodes:
            break
    supabase.table("products").update({"barcode": candidate}).eq("id", product_id).eq("user_id", user_id).execute()
    return {**rows[0], "barcode": candidate}


class AssignBarcodeIn(BaseModel):
    barcode: str = Field(min_length=1)
    force: bool = False


@app.post("/products/{product_id}/assign-barcode", response_model=Product)
def assign_barcode(product_id: str, payload: AssignBarcodeIn, user_id: str = Depends(get_current_user_id)) -> dict:
    rows = supabase.table("products").select("*").eq("id", product_id).eq("user_id", user_id).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Product not found")
    product = rows[0]
    if product.get("barcode") and not payload.force:
        raise HTTPException(status_code=409, detail="Product already has a barcode assigned")
    assert_barcode_unique(payload.barcode, user_id, exclude_id=product_id)
    supabase.table("products").update({"barcode": payload.barcode}).eq("id", product_id).eq("user_id", user_id).execute()
    return {**product, "barcode": payload.barcode}


# ── Sales ─────────────────────────────────────────────────────────────────────

@app.post("/sales", response_model=Sale)
def complete_sale(
    cart: list[CartItemIn],
    customer_id: Optional[str] = Query(default=None),
    payment_method: str = Query(default="Cash"),
    user_id: str = Depends(get_current_user_id)
) -> dict:
    if not cart:
        raise HTTPException(status_code=400, detail="Cart is empty")

    payment_lookup = {"cash": "Cash", "upi": "UPI", "card": "Card", "udhaar": "Udhaar"}
    normalized_payment = payment_lookup.get(payment_method.strip().lower())
    if not normalized_payment:
        raise HTTPException(status_code=400, detail="Unsupported payment method")
    if normalized_payment == "Udhaar" and not customer_id:
        raise HTTPException(status_code=400, detail="Select a customer for udhaar sales")

    if customer_id:
        cust = supabase.table("customers").select("id").eq("id", customer_id).eq("user_id", user_id).execute().data
        if not cust:
            raise HTTPException(status_code=404, detail="Customer not found")

    product_ids = [line.product_id for line in cart]
    all_products = supabase.table("products").select("*").in_("id", product_ids).eq("user_id", user_id).execute().data or []
    products_by_id = {p["id"]: p for p in all_products}

    sale_items = []
    for line in cart:
        product = products_by_id.get(line.product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        if product["stock"] < line.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {product['name']}")
        sale_items.append({
            "product_id": product["id"],
            "name": product["name"],
            "cost_price": product["cost_price"],
            "selling_price": line.override_price if (line.override_price is not None and line.override_price >= 0) else product["selling_price"],
            "quantity": line.quantity,
        })

    # Deduct stock
    for item in sale_items:
        new_stock = products_by_id[item["product_id"]]["stock"] - item["quantity"]
        supabase.table("products").update({"stock": new_stock}).eq("id", item["product_id"]).eq("user_id", user_id).execute()

    # User-specific Bill number
    sale_count = len(supabase.table("sales").select("id").eq("user_id", user_id).execute().data or [])
    total, profit = sale_totals(sale_items)
    sale = {
        "id": str(uuid4()),
        "user_id": user_id,
        "bill_number": f"BILL-{sale_count + 1:05d}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "customer_id": customer_id,
        "payment_method": normalized_payment,
        "items": sale_items,
        "total_amount": total,
        "total_profit": profit,
    }
    supabase.table("sales").insert(sale).execute()

    if normalized_payment == "Udhaar":
        supabase.table("udhaar").insert({
            "id": str(uuid4()),
            "user_id": user_id,
            "created_at": sale["created_at"],
            "customer_id": customer_id,
            "sale_id": sale["id"],
            "amount": total,
            "paid": False,
        }).execute()

    return sale


@app.get("/sales", response_model=list[Sale])
def list_sales(q: str = Query(default=""), user_id: str = Depends(get_current_user_id)) -> list[dict]:
    sales = supabase.table("sales").select("*").eq("user_id", user_id).order("created_at", desc=True).execute().data or []
    if not q:
        return sales
    query = q.lower()
    return [
        s for s in sales
        if query in f"{s['bill_number']} {s['created_at']} {' '.join(i['name'] for i in s['items'])}".lower()
    ]


# ── Dashboard ─────────────────────────────────────────────────────────────────

@app.get("/dashboard")
def dashboard(user_id: str = Depends(get_current_user_id)) -> dict:
    now = datetime.now(timezone.utc)
    today = now.date()
    week_start = now - timedelta(days=now.weekday())
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    products = supabase.table("products").select("*").eq("user_id", user_id).execute().data or []
    sales = supabase.table("sales").select("*").eq("user_id", user_id).execute().data or []
    customers = supabase.table("customers").select("*").eq("user_id", user_id).execute().data or []
    udhaar = supabase.table("udhaar").select("*").eq("user_id", user_id).execute().data or []
    purchases = supabase.table("purchases").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(5).execute().data or []

    metrics = {
        "today_sales": 0, "weekly_sales": 0, "monthly_sales": 0,
        "today_profit": 0, "weekly_profit": 0, "monthly_profit": 0,
        "total_products": len(products),
        "low_stock_products": [p for p in products if p["stock"] <= LOW_STOCK_THRESHOLD],
        "top_selling_products": [],
        "total_udhaar_outstanding": 0,
        "total_customers": len(customers),
        "recent_purchases": purchases,
        "recent_udhaar": [],
    }

    sold_counts: dict[str, dict] = {}
    for sale in sales:
        sale_date = parse_date(sale["created_at"])
        if sale_date.date() == today:
            metrics["today_sales"] += sale["total_amount"]
            metrics["today_profit"] += sale["total_profit"]
        if sale_date >= week_start:
            metrics["weekly_sales"] += sale["total_amount"]
            metrics["weekly_profit"] += sale["total_profit"]
        if sale_date >= month_start:
            metrics["monthly_sales"] += sale["total_amount"]
            metrics["monthly_profit"] += sale["total_profit"]
        for item in sale["items"]:
            cur = sold_counts.setdefault(item["product_id"], {"name": item["name"], "quantity": 0})
            cur["quantity"] += item["quantity"]

    metrics["top_selling_products"] = sorted(sold_counts.values(), key=lambda x: x["quantity"], reverse=True)[:5]

    udhaar_balances: dict[str, float] = {}
    for entry in udhaar:
        cid = entry["customer_id"]
        udhaar_balances[cid] = udhaar_balances.get(cid, 0.0)
        if not entry.get("paid", False):
            udhaar_balances[cid] += entry["amount"]
        else:
            udhaar_balances[cid] -= entry["amount"]
    metrics["total_udhaar_outstanding"] = sum(b for b in udhaar_balances.values() if b > 0)

    customers_by_id = {c["id"]: c for c in customers}
    recent_db_udhaar = sorted(udhaar, key=lambda u: u["created_at"], reverse=True)[:5]
    
    # Map for frontend
    sale_ids = [u["sale_id"] for u in recent_db_udhaar if u.get("sale_id")]
    sales_map = {}
    if sale_ids:
        sales_data = supabase.table("sales").select("id", "bill_number").in_("id", sale_ids).execute().data or []
        sales_map = {s["id"]: s["bill_number"] for s in sales_data}
        
    recent_mapped = []
    for u in recent_db_udhaar:
        is_paid = u.get("paid", False)
        bill_num = sales_map.get(u.get("sale_id"))
        note = f"Sale {bill_num}" if bill_num else ("Payment" if is_paid else "Credit")
        c = customers_by_id.get(u["customer_id"])
        recent_mapped.append({
            "id": u["id"],
            "user_id": u["user_id"],
            "created_at": u["created_at"],
            "customer_id": u["customer_id"],
            "sale_id": u.get("sale_id"),
            "amount": u["amount"],
            "type": "payment" if is_paid else "credit",
            "note": note,
            "customer_name": c["name"] if c else "Unknown"
        })
    metrics["recent_udhaar"] = recent_mapped

    return metrics


# ── Customers ─────────────────────────────────────────────────────────────────

@app.get("/customers")
def list_customers(q: str = Query(default=""), user_id: str = Depends(get_current_user_id)) -> list[dict]:
    customers = supabase.table("customers").select("*").eq("user_id", user_id).execute().data or []
    result = [{**c, **customer_udhaar_summary(c["id"], user_id)} for c in customers]
    if not q:
        return result
    query = q.lower()
    return [c for c in result if query in f"{c['name']} {c['phone']} {c.get('email', '')}".lower()]


@app.post("/customers")
def create_customer(payload: CustomerIn, user_id: str = Depends(get_current_user_id)) -> dict:
    customer = {"id": str(uuid4()), "user_id": user_id, **payload.model_dump()}
    supabase.table("customers").insert(customer).execute()
    return customer


@app.get("/customers/{customer_id}")
def get_customer(customer_id: str, user_id: str = Depends(get_current_user_id)) -> dict:
    rows = supabase.table("customers").select("*").eq("id", customer_id).eq("user_id", user_id).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {**rows[0], **customer_udhaar_summary(customer_id, user_id)}


@app.put("/customers/{customer_id}")
def update_customer(customer_id: str, payload: CustomerIn, user_id: str = Depends(get_current_user_id)) -> dict:
    rows = supabase.table("customers").select("*").eq("id", customer_id).eq("user_id", user_id).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Customer not found")
    updated = {"id": customer_id, "user_id": user_id, **payload.model_dump()}
    res = supabase.table("customers").update(updated).eq("id", customer_id).eq("user_id", user_id).execute()
    return {**res.data[0], **customer_udhaar_summary(customer_id, user_id)}


@app.delete("/customers/{customer_id}")
def delete_customer(customer_id: str, user_id: str = Depends(get_current_user_id)) -> dict:
    rows = supabase.table("customers").select("*").eq("id", customer_id).eq("user_id", user_id).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Delete related udhaar entries and then the customer profile itself
    supabase.table("udhaar").delete().eq("customer_id", customer_id).eq("user_id", user_id).execute()
    supabase.table("customers").delete().eq("id", customer_id).eq("user_id", user_id).execute()
    return {"status": "success"}


@app.get("/customers/{customer_id}/udhaar")
def get_customer_udhaar(customer_id: str, user_id: str = Depends(get_current_user_id)) -> list[dict]:
    # Check if customer exists
    cust = supabase.table("customers").select("id").eq("id", customer_id).eq("user_id", user_id).execute().data
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    entries = supabase.table("udhaar").select("*").eq("customer_id", customer_id).eq("user_id", user_id).order("created_at", desc=True).execute().data or []
    
    # Map entries for frontend
    sale_ids = [e["sale_id"] for e in entries if e.get("sale_id")]
    sales_map = {}
    if sale_ids:
        sales_data = supabase.table("sales").select("id", "bill_number").in_("id", sale_ids).execute().data or []
        sales_map = {s["id"]: s["bill_number"] for s in sales_data}
        
    mapped_entries = []
    for e in entries:
        is_paid = e.get("paid", False)
        bill_num = sales_map.get(e.get("sale_id"))
        note = f"Sale {bill_num}" if bill_num else ("Payment" if is_paid else "Credit")
        mapped_entries.append({
            "id": e["id"],
            "user_id": e["user_id"],
            "created_at": e["created_at"],
            "customer_id": e["customer_id"],
            "sale_id": e.get("sale_id"),
            "amount": e["amount"],
            "type": "payment" if is_paid else "credit",
            "note": note
        })
    return mapped_entries

@app.post("/udhaar")
def create_udhaar(payload: UdhaarEntryIn, user_id: str = Depends(get_current_user_id)) -> dict:
    if payload.type not in ("credit", "payment"):
        raise HTTPException(status_code=400, detail="Type must be credit or payment")
    cust = supabase.table("customers").select("id").eq("id", payload.customer_id).eq("user_id", user_id).execute().data
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    if payload.type == "payment":
        outstanding = customer_udhaar_summary(payload.customer_id, user_id)["outstanding_balance"]
        if payload.amount > outstanding:
            raise HTTPException(status_code=400, detail="Payment amount exceeds outstanding balance")
            
    is_paid = (payload.type == "payment")
    entry_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    db_entry = {
        "id": entry_id,
        "user_id": user_id,
        "created_at": now,
        "customer_id": payload.customer_id,
        "sale_id": payload.sale_id,
        "amount": payload.amount,
        "paid": is_paid,
        "paid_at": now if is_paid else None
    }
    supabase.table("udhaar").insert(db_entry).execute()
    
    return {
        "id": entry_id,
        "user_id": user_id,
        "created_at": now,
        "customer_id": payload.customer_id,
        "sale_id": payload.sale_id,
        "amount": payload.amount,
        "type": payload.type,
        "note": payload.note or ("Payment" if is_paid else "Credit")
    }


# ── Purchases ─────────────────────────────────────────────────────────────────

@app.post("/purchases")
def create_purchase(payload: PurchaseIn, user_id: str = Depends(get_current_user_id)) -> dict:
    rows = supabase.table("products").select("*").eq("id", payload.product_id).eq("user_id", user_id).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Product not found")
    product = rows[0]
    total_cost = payload.quantity * payload.cost_price
    purchase_date = payload.purchase_date or datetime.now(timezone.utc).isoformat()
    purchase = {
        "id": str(uuid4()),
        "user_id": user_id,
        "created_at": purchase_date,
        "product_name": product["name"],
        "total_cost": total_cost,
        **payload.model_dump(),
    }
    supabase.table("purchases").insert(purchase).execute()
    supabase.table("products").update({"stock": product["stock"] + payload.quantity}).eq("id", payload.product_id).eq("user_id", user_id).execute()
    return purchase


@app.get("/purchases")
def list_purchases(q: str = Query(default=""), user_id: str = Depends(get_current_user_id)) -> list[dict]:
    purchases = supabase.table("purchases").select("*").eq("user_id", user_id).order("created_at", desc=True).execute().data or []
    if not q:
        return purchases
    query = q.lower()
    return [p for p in purchases if query in f"{p['product_name']} {p['supplier_name']}".lower()]


@app.delete("/purchases/{purchase_id}")
def delete_purchase(purchase_id: str, user_id: str = Depends(get_current_user_id)) -> dict:
    existing = supabase.table("purchases").select("*").eq("id", purchase_id).eq("user_id", user_id).execute().data
    if not existing:
        raise HTTPException(status_code=404, detail="Purchase not found")
    
    purchase = existing[0]
    product = supabase.table("products").select("stock").eq("id", purchase["product_id"]).eq("user_id", user_id).execute().data
    if product:
        new_stock = max(0, product[0]["stock"] - purchase["quantity"])
        supabase.table("products").update({"stock": new_stock}).eq("id", purchase["product_id"]).eq("user_id", user_id).execute()
        
    supabase.table("purchases").delete().eq("id", purchase_id).eq("user_id", user_id).execute()
    return {"deleted": True}


class BulkDeletePurchases(BaseModel):
    ids: list[str]


@app.post("/purchases/bulk-delete")
def bulk_delete_purchases(payload: BulkDeletePurchases, user_id: str = Depends(get_current_user_id)) -> dict:
    if not payload.ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    purchases = supabase.table("purchases").select("*").in_("id", payload.ids).eq("user_id", user_id).execute().data or []
    if not purchases:
        return {"deleted": 0}
    stock_changes: dict[str, int] = {}
    for p in purchases:
        pid = p["product_id"]
        stock_changes[pid] = stock_changes.get(pid, 0) + p["quantity"]
    for pid, qty in stock_changes.items():
        prod = supabase.table("products").select("stock").eq("id", pid).eq("user_id", user_id).execute().data
        if prod:
            new_stock = max(0, prod[0]["stock"] - qty)
            supabase.table("products").update({"stock": new_stock}).eq("id", pid).eq("user_id", user_id).execute()
    supabase.table("purchases").delete().in_("id", payload.ids).eq("user_id", user_id).execute()
    return {"deleted": len(purchases)}


# ── Invoice PDF ───────────────────────────────────────────────────────────────

@app.get("/invoices/{sale_id}/pdf")
def generate_invoice_pdf(sale_id: str, user_id: str = Depends(get_current_user_id)):
    rows = supabase.table("sales").select("*").eq("id", sale_id).eq("user_id", user_id).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Sale not found")
    sale = rows[0]

    store_rows = supabase.table("store").select("*").eq("user_id", user_id).execute().data or []
    store = unpack_store_fields(store_rows[0]) if store_rows else {}

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
    elements = []
    styles = getSampleStyleSheet()
    title_style = styles["Heading1"]
    normal_style = styles["Normal"]

    logo_element = None
    logo_data_url = store.get("logo_data_url")
    if logo_data_url and logo_data_url.startswith("data:image/"):
        try:
            from reportlab.platypus import Image
            import base64
            header, encoded = logo_data_url.split(",", 1)
            image_data = base64.b64decode(encoded)
            logo_element = Image(io.BytesIO(image_data), width=24*mm, height=24*mm)
        except Exception as e:
            print(f"Error loading logo: {e}")

    if not logo_element:
        try:
            from reportlab.graphics.shapes import Drawing, Polygon
            import math
            d = Drawing(24*mm, 24*mm)
            cx, cy = 12*mm, 12*mm
            r = 10*mm
            points = []
            for i in range(6):
                angle = math.radians(i * 60 - 30)
                points.extend([cx + r * math.cos(angle), cy + r * math.sin(angle)])
            d.add(Polygon(points, strokeColor=colors.HexColor("#3b82f6"), strokeWidth=2, fillColor=colors.HexColor("#eff6ff")))
            d.hAlign = "LEFT"
            logo_element = d
        except Exception as e:
            print(f"Error generating fallback logo: {e}")

    header_text_data = [
        [Paragraph(store.get("store_name", "Store"), title_style)],
        [Paragraph(f"Category: {store.get('store_category', '')} | Phone: {store.get('phone', '')}", normal_style)],
    ]
    header_text_table = Table(header_text_data, colWidths=[130*mm])
    header_text_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    header_table = Table([[logo_element, header_text_table]], colWidths=[30*mm, 140*mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 10*mm))

    elements.append(Paragraph(f"Bill Number: {sale['bill_number']}", normal_style))
    date_str = parse_date(sale["created_at"]).strftime("%Y-%m-%d %H:%M")
    elements.append(Paragraph(f"Date: {date_str}", normal_style))

    if sale.get("customer_id"):
        cust_rows = supabase.table("customers").select("*").eq("id", sale["customer_id"]).eq("user_id", user_id).execute().data or []
        if cust_rows:
            c = cust_rows[0]
            elements.append(Spacer(1, 5*mm))
            elements.append(Paragraph(f"Customer: {c['name']} | Phone: {c['phone']}", normal_style))

    elements.append(Spacer(1, 10*mm))

    table_data = [["Item Name", "Qty", "Unit Price", "Total"]]
    for item in sale["items"]:
        table_data.append([
            item["name"], str(item["quantity"]),
            f"Rs. {item['selling_price']:.2f}",
            f"Rs. {item['selling_price'] * item['quantity']:.2f}",
        ])
    table_data.append(["", "", "Grand Total:", f"Rs. {sale['total_amount']:.2f}"])

    table = Table(table_data, colWidths=[80*mm, 20*mm, 30*mm, 30*mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
        ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
        ("GRID", (0, 0), (-1, -1), 1, colors.black),
        ("FONTNAME", (2, -1), (3, -1), "Helvetica-Bold"),
    ]))
    elements.append(table)
    doc.build(elements)

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={sale['bill_number']}.pdf"}
    )