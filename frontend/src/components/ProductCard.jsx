import React from "react";
import { Package } from "lucide-react";
import { fmt } from "../services/api";
import Barcode from "./Barcode";

export default function ProductCard({ product, onClick }) {
  return (
    <div className="product-card" onClick={() => onClick(product)}>
      <div className="product-card-header">
        <span className="product-card-title">{product.name}</span>
        <div className="product-icon" style={{ width: 32, height: 32, flexShrink: 0 }}><Package size={16} /></div>
      </div>

      <div className="product-card-price">{fmt(product.selling_price)}</div>

      <div className="product-card-category">{product.category}</div>

      <div className={product.stock <= 10 ? "text-danger" : "text-success"} style={{ fontSize: "0.8125rem" }}>
        {product.stock} in stock
      </div>

      <div className="product-card-barcode">
        {product.barcode ? <Barcode value={product.barcode} /> : "\u00A0"}
      </div>
    </div>
  );
}
