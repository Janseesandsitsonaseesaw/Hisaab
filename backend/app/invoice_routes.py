"""
invoice_routes.py — Invoice OCR extraction endpoint for Hisaab POS
Drop this file into backend/app/ and register it in main.py.

Registration (add to main.py):
    from app.invoice_routes import router as invoice_router
    app.include_router(invoice_router)
"""

import os
import base64
import json
import httpx
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Header, Query
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/invoice", tags=["invoice"])

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
INVOICE_MODEL = "google/gemini-2.5-flash"  # Vision-capable model

EXTRACTION_PROMPT = """Analyze this supplier invoice image.
Extract all inventory items with their details.

Rules:
- Return ONLY valid JSON. No explanation. No markdown. No backticks.
- Normalize product names into short inventory-friendly names (e.g., "Amul Butter 500g", "Surf Excel 1kg").
- If quantity is unclear, set quantity to null.
- Identify the category for each product. Use common Indian retail categories like: "Fruits & Vegetables", "Dairy & Eggs", "Grains & Pulses", "Snacks & Beverages", "Spices & Condiments", "Personal Care", "Household", "Cooking Oil", "Bakery", "Frozen Foods", "Other".
- Extract the cost price (purchase price per unit) from the invoice if visible. Look for columns like "Rate", "Price", "MRP", "Unit Price", etc.
- If selling price is visible (like MRP), extract it. If not visible, estimate selling price as cost_price * 1.2 (20% markup). If cost price is also not visible, set both to null.
- Ignore totals, taxes, invoice numbers, addresses, and other metadata.
- Focus only on products, quantities, categories, and prices.

Return format:
[
  {
    "product": "Product Name",
    "quantity": 0,
    "category": "Category Name",
    "cost_price": 0.00,
    "selling_price": 0.00
  }
]"""


class InvoiceItem(BaseModel):
    product: str
    quantity: Optional[int]
    category: Optional[str] = None
    cost_price: Optional[float] = None
    selling_price: Optional[float] = None


class ExtractionResult(BaseModel):
    items: list[InvoiceItem]
    raw_response: str
    model_used: str


async def call_openrouter_with_image(image_b64: str, media_type: str) -> str:
    """Send image to OpenRouter vision model and return raw text response."""
    if not OPENROUTER_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is not set in environment variables.",
        )

    payload = {
        "model": INVOICE_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{media_type};base64,{image_b64}"
                        },
                    },
                    {
                        "type": "text",
                        "text": EXTRACTION_PROMPT,
                    },
                ],
            }
        ],
        "max_tokens": 4000,
        "temperature": 0,  # Deterministic for structured extraction
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://hisaab.app",
        "X-Title": "Hisaab POS Invoice Extractor",
    }

    # Retry up to 3 times on transient errors
    last_error = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    OPENROUTER_BASE_URL, json=payload, headers=headers
                )
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as e:
            last_error = e
            if e.response.status_code in (400, 401, 403):
                break  # Don't retry auth/bad-request errors
        except (httpx.RequestError, KeyError) as e:
            last_error = e

    raise HTTPException(
        status_code=502,
        detail=f"OpenRouter API error after retries: {last_error}",
    )


def parse_items(raw: str) -> list[InvoiceItem]:
    """Parse the model's JSON response into a list of InvoiceItems."""
    # Strip markdown fences if model added them despite instructions
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        cleaned = "\n".join(
            line for line in lines if not line.startswith("```")
        ).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Model returned non-JSON output: {e}. Raw: {raw[:300]}",
        )

    if not isinstance(data, list):
        raise HTTPException(
            status_code=422,
            detail="Model returned JSON but not an array. Unexpected format.",
        )

    items = []
    for entry in data:
        if not isinstance(entry, dict) or "product" not in entry:
            continue
        cost = entry.get("cost_price")
        sell = entry.get("selling_price")
        try:
            cost = float(cost) if cost is not None else None
        except (ValueError, TypeError):
            cost = None
        try:
            sell = float(sell) if sell is not None else None
        except (ValueError, TypeError):
            sell = None
        items.append(
            InvoiceItem(
                product=str(entry["product"]).strip(),
                quantity=entry.get("quantity"),
                category=str(entry.get("category", "")).strip() or None,
                cost_price=cost,
                selling_price=sell,
            )
        )

    return items


def get_user_id_dep(authorization: Optional[str] = Header(default=None), token: Optional[str] = Query(default=None)) -> str:
    from app.main import get_current_user_id
    return get_current_user_id(authorization, token)


@router.post("/extract", response_model=ExtractionResult)
async def extract_invoice(file: UploadFile = File(...), user_id: str = Depends(get_user_id_dep)):
    """
    Upload a supplier invoice image (JPEG/PNG/PDF screenshot).
    Returns extracted products + quantities as structured JSON.

    This endpoint ONLY extracts — it does NOT modify inventory.
    The frontend confirmation step handles the actual stock update via POST /purchases.
    """
    allowed_types = {
        "image/jpeg": "image/jpeg",
        "image/jpg": "image/jpeg",
        "image/png": "image/png",
        "image/webp": "image/webp",
    }

    content_type = file.content_type or "image/jpeg"
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Please upload JPEG, PNG, or WebP.",
        )

    media_type = allowed_types[content_type]

    raw_bytes = await file.read()
    if len(raw_bytes) > 20 * 1024 * 1024:  # 20 MB limit
        raise HTTPException(status_code=400, detail="File too large. Max 20MB.")

    image_b64 = base64.b64encode(raw_bytes).decode("utf-8")

    raw_response = await call_openrouter_with_image(image_b64, media_type)
    items = parse_items(raw_response)

    if not items:
        raise HTTPException(
            status_code=422,
            detail="No products could be extracted from this invoice. Please check the image quality.",
        )

    return ExtractionResult(
        items=items,
        raw_response=raw_response,
        model_used=INVOICE_MODEL,
    )