# SmartPOS

Cloud-based POS and inventory management MVP for small Indian retailers.

## Project Structure

- `backend/` - FastAPI API with JSON persistence for store setup, products, checkout, sales history, and dashboard analytics.
- `frontend/` - Vite React app for billing, inventory, dashboard, and sales history.

## Run Backend

```bash
cd backend
python3 -m uvicorn app.main:app --reload --port 8000
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the API at `http://localhost:8000`. Override with `VITE_API_URL` if needed.
