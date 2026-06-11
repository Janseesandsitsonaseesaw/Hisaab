from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Optional
from uuid import uuid4
import json

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from pydantic import BaseModel, Field
from app.invoice_routes import router as invoice_router


DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_FILE = DATA_DIR / "smartpos.json"
LOW_STOCK_THRESHOLD = 10
lock = Lock()


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


class ProductIn(BaseModel):
    name: str = Field(min_length=1)
    barcode: Optional[str] = None
    category: str = Field(min_length=1)
    cost_price: float = Field(ge=0)
    selling_price: float = Field(ge=0)
    stock: int = Field(ge=0)


class Product(ProductIn):
    id: str


class CartItemIn(BaseModel):
    product_id: str
    quantity: int = Field(gt=0)


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
    created_at: str


class UdhaarEntryIn(BaseModel):
    customer_id: str
    sale_id: Optional[str] = None
    amount: float = Field(gt=0)
    type: str  # 'credit' or 'payment'
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


def seed_data() -> dict:
    return {
        "users": [],
        "store": {
            "store_name": "Shree Kirana Mart",
            "owner_name": "Amit Sharma",
            "phone": "9876543210",
            "store_category": "Kirana Store",
        },
        "products": [
            {
                "id": str(uuid4()),
                "name": "Aashirvaad Atta 5kg",
                "barcode": "8901725123456",
                "category": "Grocery",
                "cost_price": 205,
                "selling_price": 245,
                "stock": 24,
            },
            {
                "id": str(uuid4()),
                "name": "Amul Taaza Milk 1L",
                "barcode": "8901262011013",
                "category": "Dairy",
                "cost_price": 58,
                "selling_price": 66,
                "stock": 42,
            },
            {
                "id": str(uuid4()),
                "name": "Classmate Notebook 172 pages",
                "barcode": "8902519001123",
                "category": "Stationery",
                "cost_price": 48,
                "selling_price": 65,
                "stock": 16,
            },
            {
                "id": str(uuid4()),
                "name": "Parle-G Family Pack",
                "barcode": "8901719100012",
                "category": "Snacks",
                "cost_price": 42,
                "selling_price": 50,
                "stock": 9,
            },
            {
                "id": str(uuid4()),
                "name": "Tata Salt 1kg",
                "barcode": "8904043901015",
                "category": "Grocery",
                "cost_price": 22,
                "selling_price": 28,
                "stock": 33,
            },
        ],
        "sales": [],
        "customers": [],
        "udhaar": [],
        "purchases": [],
    }


def ensure_data_file() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        write_data(seed_data())


def read_data() -> dict:
    ensure_data_file()
    with lock:
        data = json.loads(DATA_FILE.read_text())
        data.setdefault("customers", [])
        data.setdefault("udhaar", [])
        data.setdefault("purchases", [])
        return data


def write_data(data: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with lock:
        DATA_FILE.write_text(json.dumps(data, indent=2))


def public_user(user: dict) -> dict:
    return {"id": user["id"], "name": user["name"], "email": user["email"]}


def sale_totals(items: list[dict]) -> tuple[float, float]:
    total = sum(item["selling_price"] * item["quantity"] for item in items)
    profit = sum((item["selling_price"] - item["cost_price"]) * item["quantity"] for item in items)
    return total, profit


def parse_date(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


app = FastAPI(title="SmartPOS API", version="1.0.0")
app.include_router(invoice_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/auth/register")
def register(payload: UserIn) -> dict:
    data = read_data()
    if any(user["email"].lower() == payload.email.lower() for user in data["users"]):
        raise HTTPException(status_code=409, detail="Email already registered")
    user = payload.model_dump()
    user["id"] = str(uuid4())
    data["users"].append(user)
    write_data(data)
    return {"user": public_user(user)}


@app.post("/auth/login")
def login(payload: LoginIn) -> dict:
    data = read_data()
    for user in data["users"]:
        if user["email"].lower() == payload.email.lower() and user["password"] == payload.password:
            return {"user": public_user(user)}
    raise HTTPException(status_code=401, detail="Invalid email or password")


@app.get("/store")
def get_store() -> dict:
    return read_data()["store"]


@app.put("/store")
def update_store(profile: StoreProfile) -> dict:
    data = read_data()
    data["store"] = profile.model_dump()
    write_data(data)
    return data["store"]


@app.get("/products", response_model=list[Product])
def list_products(q: str = Query(default="")) -> list[dict]:
    products = read_data()["products"]
    if not q:
        return products
    query = q.lower()
    return [
        product
        for product in products
        if query in f"{product['name']} {product.get('barcode') or ''} {product['category']}".lower()
    ]


@app.post("/products", response_model=Product)
def create_product(payload: ProductIn) -> dict:
    if payload.selling_price < payload.cost_price:
        raise HTTPException(status_code=400, detail="Selling price cannot be below cost price")
    data = read_data()
    product = {"id": str(uuid4()), **payload.model_dump()}
    data["products"].append(product)
    write_data(data)
    return product


@app.put("/products/{product_id}", response_model=Product)
def update_product(product_id: str, payload: ProductIn) -> dict:
    if payload.selling_price < payload.cost_price:
        raise HTTPException(status_code=400, detail="Selling price cannot be below cost price")
    data = read_data()
    for index, product in enumerate(data["products"]):
        if product["id"] == product_id:
            data["products"][index] = {"id": product_id, **payload.model_dump()}
            write_data(data)
            return data["products"][index]
    raise HTTPException(status_code=404, detail="Product not found")


@app.delete("/products/{product_id}")
def delete_product(product_id: str) -> dict:
    data = read_data()
    before = len(data["products"])
    data["products"] = [product for product in data["products"] if product["id"] != product_id]
    if len(data["products"]) == before:
        raise HTTPException(status_code=404, detail="Product not found")
    write_data(data)
    return {"deleted": True}


@app.post("/sales", response_model=Sale)
def complete_sale(cart: list[CartItemIn], customer_id: Optional[str] = Query(default=None)) -> dict:
    if not cart:
        raise HTTPException(status_code=400, detail="Cart is empty")

    data = read_data()
    products_by_id = {product["id"]: product for product in data["products"]}
    sale_items = []

    for line in cart:
        product = products_by_id.get(line.product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        if product["stock"] < line.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {product['name']}")
        sale_items.append(
            {
                "product_id": product["id"],
                "name": product["name"],
                "cost_price": product["cost_price"],
                "selling_price": product["selling_price"],
                "quantity": line.quantity,
            }
        )

    for item in sale_items:
        products_by_id[item["product_id"]]["stock"] -= item["quantity"]

    total, profit = sale_totals(sale_items)
    sale = {
        "id": str(uuid4()),
        "bill_number": f"BILL-{len(data['sales']) + 1:05d}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "customer_id": customer_id,
        "items": sale_items,
        "total_amount": total,
        "total_profit": profit,
    }
    data["sales"].append(sale)
    write_data(data)
    return sale


@app.get("/sales", response_model=list[Sale])
def list_sales(q: str = Query(default="")) -> list[dict]:
    sales = read_data()["sales"]
    if not q:
        return sorted(sales, key=lambda sale: sale["created_at"], reverse=True)
    query = q.lower()
    filtered = [
        sale
        for sale in sales
        if query
        in f"{sale['bill_number']} {sale['created_at']} {' '.join(item['name'] for item in sale['items'])}".lower()
    ]
    return sorted(filtered, key=lambda sale: sale["created_at"], reverse=True)


@app.get("/dashboard")
def dashboard() -> dict:
    data = read_data()
    now = datetime.now(timezone.utc)
    today = now.date()
    week_start = now - timedelta(days=now.weekday())
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    metrics = {
        "today_sales": 0,
        "weekly_sales": 0,
        "monthly_sales": 0,
        "today_profit": 0,
        "weekly_profit": 0,
        "monthly_profit": 0,
        "total_products": len(data["products"]),
        "low_stock_products": [product for product in data["products"] if product["stock"] <= LOW_STOCK_THRESHOLD],
        "top_selling_products": [],
        "total_udhaar_outstanding": 0,
        "total_customers": len(data.get("customers", [])),
        "recent_purchases": [],
        "recent_udhaar": [],
    }
    sold_counts: dict[str, dict] = {}

    for sale in data["sales"]:
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
            current = sold_counts.setdefault(item["product_id"], {"name": item["name"], "quantity": 0})
            current["quantity"] += item["quantity"]

    metrics["top_selling_products"] = sorted(sold_counts.values(), key=lambda item: item["quantity"], reverse=True)[:5]
    
    # Udhaar logic
    udhaar_balances = {}
    for entry in data.get("udhaar", []):
        cid = entry["customer_id"]
        if cid not in udhaar_balances:
            udhaar_balances[cid] = 0
        if entry["type"] == "credit":
            udhaar_balances[cid] += entry["amount"]
        else:
            udhaar_balances[cid] -= entry["amount"]
            
    metrics["total_udhaar_outstanding"] = sum(bal for bal in udhaar_balances.values() if bal > 0)
    
    # Recent purchases
    sorted_purchases = sorted(data.get("purchases", []), key=lambda p: p["created_at"], reverse=True)[:5]
    metrics["recent_purchases"] = sorted_purchases
    
    # Recent udhaar
    sorted_udhaar = sorted(data.get("udhaar", []), key=lambda u: u["created_at"], reverse=True)[:5]
    for u in sorted_udhaar:
        customer = next((c for c in data.get("customers", []) if c["id"] == u["customer_id"]), None)
        u["customer_name"] = customer["name"] if customer else "Unknown"
    metrics["recent_udhaar"] = sorted_udhaar

    return metrics


@app.get("/customers")
def list_customers(q: str = Query(default="")) -> list[dict]:
    customers = read_data().get("customers", [])
    if not q:
        return customers
    query = q.lower()
    return [c for c in customers if query in f"{c['name']} {c['phone']} {c.get('email', '')}".lower()]

@app.post("/customers")
def create_customer(payload: CustomerIn) -> dict:
    data = read_data()
    customer = {"id": str(uuid4()), "created_at": datetime.now(timezone.utc).isoformat(), **payload.model_dump()}
    data["customers"].append(customer)
    write_data(data)
    return customer

@app.get("/customers/{customer_id}")
def get_customer(customer_id: str) -> dict:
    data = read_data()
    customer = next((c for c in data.get("customers", []) if c["id"] == customer_id), None)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    udhaar_entries = [u for u in data.get("udhaar", []) if u["customer_id"] == customer_id]
    total_credit = sum(u["amount"] for u in udhaar_entries if u["type"] == "credit")
    total_paid = sum(u["amount"] for u in udhaar_entries if u["type"] == "payment")
    outstanding = total_credit - total_paid
    
    return {**customer, "total_credit": total_credit, "total_paid": total_paid, "outstanding_balance": outstanding}

@app.put("/customers/{customer_id}")
def update_customer(customer_id: str, payload: CustomerIn) -> dict:
    data = read_data()
    for index, customer in enumerate(data.get("customers", [])):
        if customer["id"] == customer_id:
            data["customers"][index] = {"id": customer_id, "created_at": customer["created_at"], **payload.model_dump()}
            write_data(data)
            return data["customers"][index]
    raise HTTPException(status_code=404, detail="Customer not found")

@app.delete("/customers/{customer_id}")
def delete_customer(customer_id: str) -> dict:
    data = read_data()
    udhaar_entries = [u for u in data.get("udhaar", []) if u["customer_id"] == customer_id]
    total_credit = sum(u["amount"] for u in udhaar_entries if u["type"] == "credit")
    total_paid = sum(u["amount"] for u in udhaar_entries if u["type"] == "payment")
    if total_credit - total_paid > 0:
        raise HTTPException(status_code=400, detail="Cannot delete customer with outstanding udhaar balance")
    
    before = len(data.get("customers", []))
    data["customers"] = [c for c in data.get("customers", []) if c["id"] != customer_id]
    if len(data["customers"]) == before:
        raise HTTPException(status_code=404, detail="Customer not found")
    write_data(data)
    return {"deleted": True}

@app.get("/customers/{customer_id}/udhaar")
def list_customer_udhaar(customer_id: str) -> list[dict]:
    data = read_data()
    entries = [u for u in data.get("udhaar", []) if u["customer_id"] == customer_id]
    return sorted(entries, key=lambda u: u["created_at"], reverse=True)

@app.post("/udhaar")
def create_udhaar(payload: UdhaarEntryIn) -> dict:
    if payload.type not in ("credit", "payment"):
        raise HTTPException(status_code=400, detail="Type must be credit or payment")
        
    data = read_data()
    customer = next((c for c in data.get("customers", []) if c["id"] == payload.customer_id), None)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    if payload.type == "payment":
        udhaar_entries = [u for u in data.get("udhaar", []) if u["customer_id"] == payload.customer_id]
        total_credit = sum(u["amount"] for u in udhaar_entries if u["type"] == "credit")
        total_paid = sum(u["amount"] for u in udhaar_entries if u["type"] == "payment")
        if payload.amount > (total_credit - total_paid):
            raise HTTPException(status_code=400, detail="Payment amount exceeds outstanding balance")
            
    entry = {"id": str(uuid4()), "created_at": datetime.now(timezone.utc).isoformat(), **payload.model_dump()}
    data["udhaar"].append(entry)
    write_data(data)
    return entry

@app.post("/purchases")
def create_purchase(payload: PurchaseIn) -> dict:
    data = read_data()
    product = next((p for p in data["products"] if p["id"] == payload.product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    total_cost = payload.quantity * payload.cost_price
    purchase_date = payload.purchase_date or datetime.now(timezone.utc).isoformat()
    
    purchase = {
        "id": str(uuid4()),
        "created_at": purchase_date,
        "product_name": product["name"],
        "total_cost": total_cost,
        **payload.model_dump()
    }
    
    product["stock"] += payload.quantity
    data["purchases"].append(purchase)
    write_data(data)
    return purchase

@app.get("/purchases")
def list_purchases(q: str = Query(default="")) -> list[dict]:
    purchases = read_data().get("purchases", [])
    if not q:
        return sorted(purchases, key=lambda p: p["created_at"], reverse=True)
    query = q.lower()
    return sorted(
        [p for p in purchases if query in f"{p['product_name']} {p['supplier_name']}".lower()],
        key=lambda p: p["created_at"],
        reverse=True
    )
    
@app.get("/invoices/{sale_id}/pdf")
def generate_invoice_pdf(sale_id: str):
    data = read_data()
    sale = next((s for s in data["sales"] if s["id"] == sale_id), None)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
        
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
    elements = []
    
    styles = getSampleStyleSheet()
    title_style = styles["Heading1"]
    normal_style = styles["Normal"]
    
    store = data["store"]
    elements.append(Paragraph(store["store_name"], title_style))
    elements.append(Paragraph(f"Category: {store['store_category']} | Phone: {store['phone']}", normal_style))
    elements.append(Spacer(1, 10*mm))
    
    elements.append(Paragraph(f"Bill Number: {sale['bill_number']}", normal_style))
    date_str = parse_date(sale["created_at"]).strftime("%Y-%m-%d %H:%M")
    elements.append(Paragraph(f"Date: {date_str}", normal_style))
    
    if sale.get("customer_id"):
        customer = next((c for c in data.get("customers", []) if c["id"] == sale["customer_id"]), None)
        if customer:
            elements.append(Spacer(1, 5*mm))
            elements.append(Paragraph(f"Customer: {customer['name']} | Phone: {customer['phone']}", normal_style))
            
    elements.append(Spacer(1, 10*mm))
    
    table_data = [["Item Name", "Qty", "Unit Price", "Total"]]
    for item in sale["items"]:
        table_data.append([
            item["name"],
            str(item["quantity"]),
            f"Rs. {item['selling_price']:.2f}",
            f"Rs. {(item['selling_price'] * item['quantity']):.2f}"
        ])
        
    table_data.append(["", "", "Grand Total:", f"Rs. {sale['total_amount']:.2f}"])
    
    table = Table(table_data, colWidths=[80*mm, 20*mm, 30*mm, 30*mm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTNAME', (2, -1), (3, -1), 'Helvetica-Bold')
    ]))
    
    elements.append(table)
    doc.build(elements)
    
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={sale['bill_number']}.pdf"}
    )
