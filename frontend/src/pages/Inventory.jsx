import React from "react";
import { Package, Plus, Edit2, Trash2 } from "lucide-react";
import { fmt } from "../services/api";

export default function Inventory({ filteredProducts, editingProduct, setEditingProduct, saveProduct, deleteProduct }) {
  return (
    <div className="fade-in">
      <div className="page-header">
        <h2 className="page-title">Products</h2>
        <button className="btn btn-primary" onClick={() => setEditingProduct({})}>
          <Plus size={18} /> Add Product
        </button>
      </div>

      {editingProduct && (
        <div className="card" style={{ marginBottom: "24px" }}>
          <div className="card-header">
            <h3 className="card-title">{editingProduct.id ? "Edit Product" : "New Product"}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditingProduct(null)}>Cancel</button>
          </div>
          <div className="card-body">
            <form onSubmit={saveProduct}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Product Name</label>
                  <input className="form-input" required name="name" defaultValue={editingProduct.name || ""} />
                </div>
                <div className="form-group">
                  <label className="form-label">Barcode</label>
                  <input className="form-input" name="barcode" defaultValue={editingProduct.barcode || ""} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input className="form-input" required name="category" defaultValue={editingProduct.category || ""} />
                </div>
                <div className="form-group">
                  <label className="form-label">Stock Quantity</label>
                  <input className="form-input" required type="number" min="0" name="stock" defaultValue={editingProduct.stock || ""} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Cost Price (₹)</label>
                  <input className="form-input" required type="number" min="0" step="0.01" name="cost_price" defaultValue={editingProduct.cost_price || ""} />
                </div>
                <div className="form-group">
                  <label className="form-label">Selling Price (₹)</label>
                  <input className="form-input" required type="number" min="0" step="0.01" name="selling_price" defaultValue={editingProduct.selling_price || ""} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingProduct(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        {filteredProducts.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Product Info</th>
                  <th>Category</th>
                  <th>Cost</th>
                  <th>Price</th>
                  <th>Status / Stock</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="td-product">
                        <div className="product-icon"><Package size={20} /></div>
                        <div className="product-details">
                          <strong>{product.name}</strong>
                          <small>{product.barcode || "No Barcode"}</small>
                        </div>
                      </div>
                    </td>
                    <td>{product.category}</td>
                    <td>{fmt(product.cost_price)}</td>
                    <td><strong>{fmt(product.selling_price)}</strong></td>
                    <td>
                      <span className={`badge ${product.stock === 0 ? "badge-danger" : product.stock <= 10 ? "badge-warning" : "badge-success"}`}>
                        {product.stock} in stock
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingProduct(product)}><Edit2 size={16} /></button>
                        <button className="btn btn-ghost btn-sm text-danger" onClick={() => deleteProduct(product.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state-v2">
            <div className="empty-state-v2-icon"><Package size={48} /></div>
            <h3 className="empty-state-v2-title">No products yet</h3>
            <p className="empty-state-v2-desc">Add your first product to get started.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setEditingProduct({})}>Add Product</button>
          </div>
        )}
      </div>
    </div>
  );
}
