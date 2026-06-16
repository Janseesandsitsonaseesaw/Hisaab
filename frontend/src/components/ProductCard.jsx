import React from "react";
import { fmt } from "../services/api";
import ProductAvatar from "./ProductAvatar";

export default function ProductCard({ product, availableStock, onClick }) {
  const stockToDisplay = availableStock !== undefined ? availableStock : product.stock;

  return (
    <div className="product-card" onClick={() => onClick(product)}>
      <div className="product-card-header">
        <span className="product-card-title">{product.name}</span>
        {/* Reusable Product Avatar */}
        <ProductAvatar name={product.name} size={34} />
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