import React, { useState } from "react";
import { Truck, Plus, FileText, Camera } from "lucide-react";
import { fmt, api } from "../services/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Purchases({ filteredPurchases, editingPurchase, setEditingPurchase, savePurchase, products, refresh, showNotice }) {

  const [showModal, setShowModal]     = useState(false);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [items, setItems]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [dragOver, setDragOver]       = useState(false);

  async function uploadInvoice(file) {
    setInvoiceFile(file);
    setLoading(true);
    setItems([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch(`${API_URL}/invoice/extract`, { method: "POST", body: formData });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: "Extraction failed" }));
        throw new Error(err.detail || "Extraction failed");
      }
      const data = await resp.json();
      const enriched = (data.items || []).map((item) => {
        const exact = products.find(p => p.name.trim().toLowerCase() === item.product.trim().toLowerCase());
        const fuzzy = exact ? null : products.find(p => p.name.toLowerCase().includes(item.product.toLowerCase().split(" ")[0]));
        return {
          product: item.product,
          quantity: item.quantity ?? 1,
          matchedProductId: exact?.id || fuzzy?.id || "",
          confidence: exact ? "exact" : fuzzy ? "fuzzy" : "none",
        };
      });
      setItems(enriched);
    } catch (err) {
      showNotice(err.message || "Invoice extraction failed", "error");
      setShowModal(false);
    } finally {
      setLoading(false);
    }
  }

  function isReady(item) {
    if (item.matchedProductId === "__new__") {
      const np = item.newProduct || {};
      return !!(np.name?.trim() && np.category?.trim() && np.cost_price !== "" && np.selling_price !== "") && item.quantity > 0;
    }
    return !!item.matchedProductId && item.quantity > 0;
  }

  async function confirmItems() {
    const valid = items.filter(isReady);
    if (valid.length === 0) { showNotice("No valid items to save", "error"); return; }
    try {
      for (const item of valid) {
        let productId = item.matchedProductId;
        let costPrice = 0;
        if (productId === "__new__") {
          const np = item.newProduct;
          const created = await api("/products", {
            method: "POST",
            body: JSON.stringify({
              name: np.name.trim(),
              barcode: null,
              category: np.category.trim(),
              cost_price: Number(np.cost_price),
              selling_price: Number(np.selling_price),
              stock: 0,
            }),
          });
          productId = created.id;
          costPrice = Number(np.cost_price);
        }
        await api("/purchases", {
          method: "POST",
          body: JSON.stringify({ product_id: productId, supplier_name: "Invoice Import", quantity: Number(item.quantity), cost_price: costPrice }),
        });
      }
      showNotice(`${valid.length} item(s) restocked from invoice`, "success");
      setShowModal(false); setItems([]); setInvoiceFile(null);
      await refresh();
    } catch (err) { showNotice(err.message, "error"); }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2 className="page-title">Purchases</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn btn-secondary" onClick={() => { setShowModal(true); setInvoiceFile(null); setItems([]); }}>
            <FileText size={18} /> Import from Invoice
          </button>
          <button className="btn btn-primary" onClick={() => setEditingPurchase({})}>
            <Plus size={18} /> Record Purchase
          </button>
        </div>
      </div>

      {/* Invoice Modal */}
      {showModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div style={{ background: "var(--bg-primary)", borderRadius: "16px", width: "100%", maxWidth: "700px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.35)" }}>
            <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)" }}>Import from Invoice</h3>
                <p style={{ margin: "4px 0 0", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>Upload a supplier invoice — AI extracts products automatically.</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)} style={{ fontSize: "1.25rem", padding: "4px 10px" }}>✕</button>
            </div>

            <div style={{ padding: "20px 24px 24px", overflowY: "auto", flex: 1 }}>

              {/* Drop zone */}
              {!invoiceFile && !loading && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer?.files?.[0]; if (f) uploadInvoice(f); }}
                  onClick={() => document.getElementById("inv-file-input").click()}
                  style={{ border: `2px dashed ${dragOver ? "var(--brand-primary)" : "var(--border-color)"}`, borderRadius: "12px", padding: "48px 24px", textAlign: "center", cursor: "pointer", background: dragOver ? "var(--bg-secondary)" : "transparent", transition: "all 0.2s" }}
                >
                  <FileText size={44} style={{ color: dragOver ? "var(--brand-primary)" : "var(--text-tertiary)", marginBottom: "12px" }} />
                  <p style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--text-primary)" }}>Drag & drop invoice here</p>
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>or click to browse — JPEG, PNG, WebP</p>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => { e.stopPropagation(); document.getElementById("inv-camera-input").click(); }}
                    style={{ marginTop: "16px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <Camera size={16} /> Take Photo
                  </button>
                </div>
              )}
              <input id="inv-file-input" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadInvoice(f); e.target.value = ""; }} />
              <input id="inv-camera-input" type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadInvoice(f); e.target.value = ""; }} />

              {/* Loader */}
              {loading && (
                <div style={{ textAlign: "center", padding: "48px 24px" }}>
                  <div style={{ width: "52px", height: "52px", margin: "0 auto 16px", borderRadius: "50%", border: "4px solid var(--border-color)", borderTop: "4px solid var(--brand-primary)", animation: "spin 0.8s linear infinite" }} />
                  <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--text-primary)" }}>Reading invoice…</p>
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>Gemini is extracting products and quantities</p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {/* Review table */}
              {!loading && items.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <p style={{ margin: 0, fontWeight: 600, color: "var(--text-primary)" }}>{items.length} item(s) extracted — review & confirm</p>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setInvoiceFile(null); setItems([]); }}>↩ Re-upload</button>
                  </div>
                  <div className="table-container" style={{ borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                    <table className="table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Extracted Product</th>
                          <th>Match to Inventory</th>
                          <th style={{ width: "90px" }}>Qty</th>
                          <th style={{ width: "48px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontWeight: 500, fontSize: "0.875rem" }}>{item.product}</span>
                                {item.confidence === "exact" && <span style={{ fontSize: "0.7rem", color: "#059669", fontWeight: 600 }}>✓ Exact match</span>}
                                {item.confidence === "fuzzy" && <span style={{ fontSize: "0.7rem", color: "#d97706", fontWeight: 600 }}>~ Suggested</span>}
                                {item.confidence === "none"  && <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>Select manually ↓</span>}
                              </div>
                            </td>
                            <td>
                              <select className="form-input" style={{ fontSize: "0.8125rem", padding: "6px 10px" }} value={item.matchedProductId}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const u = [...items];
                                  if (v === "__new__") {
                                    u[idx] = {
                                      ...u[idx],
                                      matchedProductId: "__new__",
                                      newProduct: u[idx].newProduct || { name: u[idx].product, category: "", cost_price: "", selling_price: "" },
                                    };
                                  } else {
                                    u[idx] = { ...u[idx], matchedProductId: v };
                                  }
                                  setItems(u);
                                }}>
                                <option value="">— skip —</option>
                                <option value="__new__">+ Create new product</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>)}
                              </select>
                              {item.matchedProductId === "__new__" && (
                                <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                                  <input className="form-input" placeholder="Product name" style={{ fontSize: "0.8125rem", padding: "6px 10px" }}
                                    value={item.newProduct?.name ?? ""}
                                    onChange={(e) => { const u = [...items]; u[idx] = { ...u[idx], newProduct: { ...u[idx].newProduct, name: e.target.value } }; setItems(u); }} />
                                  <input className="form-input" placeholder="Category" style={{ fontSize: "0.8125rem", padding: "6px 10px" }}
                                    value={item.newProduct?.category ?? ""}
                                    onChange={(e) => { const u = [...items]; u[idx] = { ...u[idx], newProduct: { ...u[idx].newProduct, category: e.target.value } }; setItems(u); }} />
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <input className="form-input" type="number" min="0" step="0.01" placeholder="Cost price" style={{ fontSize: "0.8125rem", padding: "6px 10px" }}
                                      value={item.newProduct?.cost_price ?? ""}
                                      onChange={(e) => { const u = [...items]; u[idx] = { ...u[idx], newProduct: { ...u[idx].newProduct, cost_price: e.target.value } }; setItems(u); }} />
                                    <input className="form-input" type="number" min="0" step="0.01" placeholder="Selling price" style={{ fontSize: "0.8125rem", padding: "6px 10px" }}
                                      value={item.newProduct?.selling_price ?? ""}
                                      onChange={(e) => { const u = [...items]; u[idx] = { ...u[idx], newProduct: { ...u[idx].newProduct, selling_price: e.target.value } }; setItems(u); }} />
                                  </div>
                                </div>
                              )}
                            </td>
                            <td>
                              <input className="form-input" type="number" min="1" style={{ fontSize: "0.875rem", padding: "6px 10px", textAlign: "center" }} value={item.quantity ?? ""}
                                onChange={(e) => { const u = [...items]; u[idx] = { ...u[idx], quantity: Number(e.target.value) }; setItems(u); }} />
                            </td>
                            <td>
                              <button className="btn btn-ghost btn-sm" style={{ color: "var(--text-tertiary)", padding: "4px 8px" }} onClick={() => setItems(items.filter((_, i) => i !== idx))}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: "16px", padding: "12px 16px", background: "var(--bg-secondary)", borderRadius: "10px", fontSize: "0.8125rem", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
                    <span>{items.filter(isReady).length} of {items.length} items will update inventory</span>
                    <span style={{ color: "var(--text-tertiary)", fontSize: "0.75rem" }}>Unmatched or incomplete items will be skipped</span>
                  </div>
                  <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                    <button className="btn btn-primary" style={{ flex: 2 }} onClick={confirmItems} disabled={items.filter(isReady).length === 0}>
                      <Truck size={16} style={{ marginRight: "6px" }} />
                      Confirm & Restock {items.filter(isReady).length} Item(s)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editingPurchase && (
        <div className="card" style={{ marginBottom: "24px" }}>
          <div className="card-header">
            <h3 className="card-title">Record Stock Purchase</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditingPurchase(null)}>Cancel</button>
          </div>
          <div className="card-body">
            <form onSubmit={savePurchase}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Product</label>
                  <select className="form-input" required name="product_id">
                    <option value="">Select a product…</option>
                    {products.map((p) => (<option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Supplier Name</label>
                  <input className="form-input" required name="supplier_name" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input className="form-input" required type="number" min="1" name="quantity" />
                </div>
                <div className="form-group">
                  <label className="form-label">Cost Price (₹ per unit)</label>
                  <input className="form-input" required type="number" min="0" step="0.01" name="cost_price" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Purchase Date</label>
                  <input className="form-input" type="date" name="purchase_date" />
                </div>
                <div className="form-group" style={{ display: "flex", alignItems: "flex-end" }}>
                  <div style={{ display: "flex", gap: "12px", width: "100%" }}>
                    <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingPurchase(null)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Purchase</button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        {filteredPurchases.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Product</th><th>Supplier</th><th>Qty</th><th>Cost/Unit</th><th>Total</th><th>Date</th></tr>
              </thead>
              <tbody>
                {filteredPurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>
                      <div className="td-product">
                        <div className="product-icon"><Truck size={20} /></div>
                        <div className="product-details"><strong>{purchase.product_name}</strong></div>
                      </div>
                    </td>
                    <td>{purchase.supplier_name}</td>
                    <td><span className="badge badge-neutral">{purchase.quantity} units</span></td>
                    <td>{fmt(purchase.cost_price)}</td>
                    <td><strong>{fmt(purchase.total_cost)}</strong></td>
                    <td>
                      <div className="product-details">
                        <strong>{new Date(purchase.created_at).toLocaleDateString("en-IN")}</strong>
                        <small>{new Date(purchase.created_at).toLocaleTimeString("en-IN")}</small>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state-v2">
            <div className="empty-state-v2-icon"><Truck size={48} /></div>
            <h3 className="empty-state-v2-title">No purchases yet</h3>
            <p className="empty-state-v2-desc">Record your first stock purchase to track restocking.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setEditingPurchase({})}>Record Purchase</button>
          </div>
        )}
      </div>
    </div>
  );
}
