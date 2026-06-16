import React from "react";
import { fmt } from "../services/api";
import ProductAvatar from "./ProductAvatar";

export default function ProductCard({ product, availableStock, onClick }) {
  const stockToDisplay = availableStock !== undefined ? availableStock : product.stock;

  return (
    <div className="product-card" onClick={() => onClick(product)}>
      <div className="product-card-header">
        <span className="product-card-title">{product.name}</span>
        {/* Compact Product Avatar */}
        <ProductAvatar name={product.name} size={28} />
      </div>

      <div className="product-card-price">{fmt(product.selling_price)}</div>
      <div className="product-card-category">{product.category}</div>

      <div className={stockToDisplay <= 10 ? "text-danger" : "text-success"} style={{ fontSize: "0.75rem", fontWeight: "600" }}>
        {stockToDisplay === 0 ? "Out of stock" : `${stockToDisplay} in stock`}
      </div>

      <div className="product-card-barcode" style={{ marginTop: "4px" }}>
        {product.barcode ? (
          <span className="badge badge-success" style={{ fontSize: "9px", padding: "3px 8px" }}>Barcode ✓</span>
        ) : (
          <span className="badge badge-warning" style={{ fontSize: "9px", padding: "3px 8px" }}>No Barcode</span>
        )}
      </div>
    </div>
  );
}