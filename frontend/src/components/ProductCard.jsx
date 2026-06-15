import React from "react";
import { fmt } from "../services/api";

// Generate a consistent color from a string
const THUMB_COLORS = [
  "#1e3a8a","#065f46","#7c3aed","#b45309","#0e7490","#be123c",
  "#0369a1","#166534","#6d28d9","#92400e","#0f766e","#9f1239",
];
function thumbColor(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return THUMB_COLORS[h % THUMB_COLORS.length];
}
function thumbInitials(name = "") {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function ProductCard({ product, availableStock, onClick }) {
  const stockToDisplay = availableStock !== undefined ? availableStock : product.stock;
  const color = thumbColor(product.name);

  return (
    <div className="product-card" onClick={() => onClick(product)}>
      <div className="product-card-header">
        <span className="product-card-title">{product.name}</span>
        {/* Product thumbnail from initials */}
        <div style={{
          width: 34, height: 34, borderRadius: "10px",
          background: color, display: "flex", alignItems: "center",
          justifyContent: "center", color: "#fff",
          fontWeight: 700, fontSize: "0.8125rem", flexShrink: 0,
          letterSpacing: "0.03em",
        }}>
          {thumbInitials(product.name)}
        </div>
      </div>

      <div className="product-card-price">{fmt(product.selling_price)}</div>
      <div className="product-card-category">{product.category}</div>

      <div className={stockToDisplay <= 10 ? "text-danger" : "text-success"} style={{ fontSize: "0.8125rem" }}>
        {stockToDisplay === 0 ? "Out of stock" : `${stockToDisplay} in stock`}
      </div>

      <div className="product-card-barcode" style={{ marginTop: "8px" }}>
        {product.barcode ? (
          <span className="badge badge-success" style={{ fontSize: "10px" }}>Barcode ✓</span>
        ) : (
          <span className="badge badge-warning" style={{ fontSize: "10px" }}>No Barcode</span>
        )}
      </div>
    </div>
  );
}