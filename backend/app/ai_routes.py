"""
ai_routes.py — AI Business Advisor endpoint for Hisaab POS
"""

import os
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Header, Query
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client
from gotrue.errors import AuthApiError

load_dotenv()

router = APIRouter(prefix="/ai", tags=["ai"])

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
AI_MODEL = "openai/gpt-4o-mini"
LOW_STOCK_THRESHOLD = 10

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_current_user_id(
    authorization: Optional[str] = Header(default=None),
    token: Optional[str] = Query(default=None),
) -> str:
    jwt_token = None
    if authorization and authorization.startswith("Bearer "):
        jwt_token = authorization.split(" ")[1]
    elif token:
        jwt_token = token
        
    if not jwt_token:
        raise HTTPException(status_code=401, detail="Unauthorized: Authentication token missing")
    
    try:
        user_resp = supabase.auth.get_user(jwt_token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")
        return user_resp.user.id
    except AuthApiError as e:
        raise HTTPException(status_code=401, detail=f"Unauthorized: {str(e)}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=401, detail=f"Unauthorized: {str(e)}")


def parse_date(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    answer: str


def build_store_context(user_id: str) -> str:
    products = (
        supabase.table("products")
        .select("id,name,barcode,category,cost_price,selling_price,stock,unit,variable_price")
        .eq("user_id", user_id)
        .execute()
        .data or []
    )

    sales = (
        supabase.table("sales")
        .select("id,bill_number,created_at,customer_id,payment_method,items,total_amount,total_profit")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(500)
        .execute()
        .data or []
    )

    customers = {
        c["id"]: c
        for c in (
            supabase.table("customers")
            .select("id,name,phone,email,address,outstanding_balance")
            .eq("user_id", user_id)
            .execute()
            .data or []
        )
    }

    udhaar = (
        supabase.table("udhaar")
        .select("id,created_at,customer_id,sale_id,amount,paid,paid_at")
        .eq("user_id", user_id)
        .execute()
        .data or []
    )

    store = (
        supabase.table("store")
        .select("id,store_name,owner_name,phone,store_category,gst_number,business_address,receipt_prefix,receipt_footer,theme_color")
        .eq("user_id", user_id)
        .execute()
        .data or [{}]
    )[0]

    now = datetime.now(timezone.utc)
    today = now.date()

    low_stock = [p for p in products if p["stock"] <= LOW_STOCK_THRESHOLD]

    # Compute daily sales velocity per product
    sold_counts: dict[str, dict] = {}
    first_sale_date: dict[str, datetime] = {}
    today_sales_total = 0.0
    today_profit_total = 0.0
    today_orders = 0

    for sale in sales:
        sale_date = parse_date(sale["created_at"])
        if sale_date.date() == today:
            today_sales_total += sale["total_amount"] or 0.0
            today_profit_total += sale["total_profit"] or 0.0
            today_orders += 1
        for item in sale.get("items", []):
            pid = item.get("product_id")
            if not pid:
                continue
            entry = sold_counts.setdefault(pid, {"name": item.get("name", "Unknown"), "quantity": 0, "revenue": 0.0})
            entry["quantity"] += item.get("quantity", 0)
            entry["revenue"] += item.get("selling_price", 0) * item.get("quantity", 0)
            if pid not in first_sale_date or sale_date < first_sale_date[pid]:
                first_sale_date[pid] = sale_date

    # Low stock lines with velocity estimate
    low_stock_lines = []
    for p in sorted(low_stock, key=lambda p: p["stock"])[:10]:
        pid = p["id"]
        velocity_str = ""
        if pid in sold_counts and pid in first_sale_date:
            days_tracked = max(1, (now - first_sale_date[pid]).days + 1)
            daily_velocity = sold_counts[pid]["quantity"] / days_tracked
            if daily_velocity > 0:
                days_left = p["stock"] / daily_velocity
                velocity_str = f", ~{daily_velocity:.1f} units/day sold, est. {days_left:.0f} days left"
        low_stock_lines.append(
            f"- {p['name']}: {p['stock']} units left (category: {p['category']}{velocity_str})"
        )

    top_products = sorted(sold_counts.values(), key=lambda x: x["quantity"], reverse=True)[:5]
    top_lines = [
        f"- {p['name']}: {p['quantity']} units sold, revenue Rs {p['revenue']:.0f}"
        for p in top_products
    ]

    # Udhaar: every row is a credit entry; sum unpaid amounts per customer
    balances: dict[str, float] = {}
    for entry in udhaar:
        if not entry.get("paid", False):
            cid = entry["customer_id"]
            if cid:
                balances[cid] = balances.get(cid, 0.0) + (entry["amount"] or 0.0)

    outstanding = sorted(
        [(cid, bal) for cid, bal in balances.items() if bal > 0],
        key=lambda x: x[1],
        reverse=True
    )[:10]
    udhaar_lines = [
        f"- {customers.get(cid, {}).get('name', 'Unknown')}: Rs {bal:.0f} outstanding"
        for cid, bal in outstanding
    ]

    return "\n".join([
        f"STORE: {store.get('store_name', 'Store')}",
        "",
        "LOW STOCK / RESTOCK NEEDED (with sales velocity where available):",
        "\n".join(low_stock_lines) if low_stock_lines else "- All products are sufficiently stocked.",
        "",
        "TOP SELLING PRODUCTS (all-time):",
        "\n".join(top_lines) if top_lines else "- No sales recorded yet.",
        "",
        "CUSTOMERS WITH HIGHEST UDHAAR (CREDIT OUTSTANDING):",
        "\n".join(udhaar_lines) if udhaar_lines else "- No outstanding udhaar.",
        "",
        "TODAY'S SALES SUMMARY:",
        f"- Orders: {today_orders}",
        f"- Total revenue: Rs {today_sales_total:.0f}",
        f"- Total profit: Rs {today_profit_total:.0f}",
        "",
        f"TOTAL PRODUCTS IN CATALOG: {len(products)}",
        f"TOTAL CUSTOMERS: {len(customers)}",
    ])


SYSTEM_PROMPT_TEMPLATE = """You are Hisaab AI, a friendly business advisor built into a small retail store's point-of-sale dashboard.
Answer the owner's question using ONLY the store data provided below. Be concise (2-5 sentences or a short list), practical, and use Rs for currency.
If the data doesn't contain the answer, say so honestly.

STORE DATA:
{store_data}"""


@router.post("/ask", response_model=AskResponse)
async def ask_ai(payload: AskRequest, user_id: str = Depends(get_current_user_id)) -> dict:
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not set in environment variables.")

    store_data = build_store_context(user_id)
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(store_data=store_data)

    request_payload = {
        "model": AI_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
        "max_tokens": 500,
        "temperature": 0.4,
    }
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://hisaab.app",
        "X-Title": "Hisaab POS AI Advisor",
    }

    last_error = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(OPENROUTER_BASE_URL, json=request_payload, headers=headers)
                resp.raise_for_status()
                answer = resp.json()["choices"][0]["message"]["content"]
                return {"answer": answer.strip()}
        except httpx.HTTPStatusError as e:
            last_error = e
            if e.response.status_code in (400, 401, 403):
                break
        except (httpx.RequestError, KeyError) as e:
            last_error = e

    raise HTTPException(status_code=502, detail=f"AI service error after retries: {last_error}")