import React, { useState } from "react";
import { Truck, Plus, FileText, Camera, AlertCircle, CheckCircle2, Trash2, X } from "lucide-react";
import { fmt, api, safeNum } from "../services/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Purchases({ filteredPurchases, editingPurchase, setEditingPurchase, savePurchase, products, refresh, showNotice }) {

  const [showModal, setShowModal]     = useState(false);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [items, setItems]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [dragOver, setDragOver]       = useState(false);
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState({});
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const selectedCount = Object.values(selectedPurchaseIds).filter(Boolean).length;

  function togglePurchaseSelect(id) {
    setSelectedPurchaseIds(cur => ({ ...cur, [id]: !cur[id] }));
  }

  function toggleSelectAll() {
    const allSelected = filteredPurchases.every(p => selectedPurchaseIds[p.id]);
    if (allSelected) {
      setSelectedPurchaseIds({});
    } else {
      const next = {};
      filteredPurchases.forEach(p => { next[p.id] = true; });
      setSelectedPurchaseIds(next);
    }
  }

  async function executeBulkDeletePurchases() {
    const ids = Object.keys(selectedPurchaseIds).filter(id => selectedPurchaseIds[id]);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      await api("/purchases/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      showNotice(`${ids.length} purchase${ids.length > 1 ? "s" : ""} deleted`, "success");
      setSelectedPurchaseIds({});
      setShowBulkDeleteModal(false);
      await refresh();
    } catch (err) {
      showNotice(err.message, "error");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function deletePurchase(id) {
    if (!window.confirm("Are you sure you want to delete this purchase history? The stocked quantity will be reverted.")) return;
    try {
      await api(`/purchases/${id}`, { method: "DELETE" });
      showNotice("Purchase history deleted", "success");
      await refresh();
    } catch (err) {
      showNotice(err.message, "error");
    }
  }

  function matchInvoiceProduct(name) {
    const normalized = name.trim().toLowerCase();
    const exact = products.find((p) => p.name.trim().toLowerCase() === normalized);
    if (exact) return { product: exact, confidence: "exact" };

    const tokens = normalized.split(/\s+/).filter((token) => token.length > 2);
    const scored = products
      .map((product) => {
        const productName = product.name.toLowerCase();
        const score = tokens.reduce((total, token) => total + (productName.includes(token) ? 1 : 0), 0);
        return { product, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored[0] ? { product: scored[0].product, confidence: "suggested" } : { product: null, confidence: "none" };
  }

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
        const match = matchInvoiceProduct(item.product);
        // Auto-set new product form for unmatched items, pre-filling AI-extracted data
        if (match.confidence === "none") {
          return {
            product: item.product,
            quantity: item.quantity ?? 1,
            matchedProductId: "__new__",
            confidence: "none",
            costPrice: item.cost_price ?? "",
            enabled: true,
            newProduct: {
              name: item.product,
              category: item.category || "",
              cost_price: item.cost_price ?? "",
              selling_price: item.selling_price ?? "",
            },
          };
        }
        return {
          product: item.product,
          quantity: item.quantity ?? 1,
          matchedProductId: match.product?.id || "",
          confidence: match.confidence,
          costPrice: item.cost_price ?? match.product?.cost_price ?? "",
          enabled: true,
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
    if (!item.enabled) return false;
    if (item.matchedProductId === "__new__") {
      const np = item.newProduct || {};
      return !!(np.name?.trim()) && item.quantity > 0 && np.cost_price !== "" && np.cost_price !== null && np.cost_price !== undefined && np.selling_price !== "" && np.selling_price !== null && np.selling_price !== undefined;
    }
    return !!item.matchedProductId && item.quantity > 0 && item.costPrice !== "" && item.costPrice !== null && item.costPrice !== undefined && safeNum(item.costPrice) >= 0;
  }

  async function confirmItems() {
    const valid = items.filter(i => i.enabled && isReady(i));
    if (valid.length === 0) { showNotice("No valid items to save", "error"); return; }
    setLoading(true);
    let successCount = 0;
    try {
      for (const item of valid) {
        let productId = item.matchedProductId;
        let costPrice = Number(item.costPrice);
        if (productId === "__new__") {
          const np = item.newProduct;
          const created = await api("/products", {
            method: "POST",
            body: JSON.stringify({
              name: np.name.trim(),
              barcode: null,
              category: (np.category || "Other").trim(),
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
        successCount++;
      }
      showNotice(`${successCount} item(s) restocked from invoice`, "success");
      setShowModal(false); setItems([]); setInvoiceFile(null);
      await refresh();
    } catch (err) {
      showNotice(err.message || "Failed to process items", "error");
      if (successCount > 0) {
        showNotice(`${successCount} item(s) were saved before the error`, "success");
        await refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2 className="page-title">Purchases</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          {selectedCount > 0 && (
            <button className="btn btn-danger" onClick={() => setShowBulkDeleteModal(true)}>
              <Trash2 size={18} /> Delete Selected ({selectedCount})
            </button>
          )}
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
                    <p style={{ margin: 0, fontWeight: 600, color: "var(--text-primary)" }}>
                      {items.length} item(s) extracted - review matches
                    </p>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setInvoiceFile(null); setItems([]); }}>↩ Re-upload</button>
                  </div>
                  {items.some((item) => item.matchedProductId === "__new__") && (
                    <div className="invoice-review-alert">
                      <AlertCircle size={16} />
                      <span>
                        {items.filter((i) => i.matchedProductId === "__new__").length} item(s) not found in inventory — they will be <strong>created as new products</strong>. Fill in category, cost price, and selling price before confirming.
                      </span>
                    </div>
                  )}
                  <div className="table-container" style={{ borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                    <table className="table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: "40px" }}>
                            <input type="checkbox" className="label-checkbox"
                              checked={items.every(i => i.enabled)}
                              onChange={(e) => { const u = items.map(i => ({ ...i, enabled: e.target.checked })); setItems(u); }}
                            />
                          </th>
                          <th>Extracted Product</th>
                          <th>Match to Inventory</th>
                          <th style={{ width: "90px" }}>Qty</th>
                          <th style={{ width: "120px" }}>Cost</th>
                          <th style={{ width: "48px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} style={{ opacity: item.enabled ? 1 : 0.45, transition: "opacity 0.2s" }}>
                            <td>
                              <input type="checkbox" className="label-checkbox"
                                checked={!!item.enabled}
                                onChange={(e) => { const u = [...items]; u[idx] = { ...u[idx], enabled: e.target.checked }; setItems(u); }}
                              />
                            </td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontWeight: 500, fontSize: "0.875rem" }}>{item.product}</span>
                                {item.confidence === "exact" && <span style={{ fontSize: "0.7rem", color: "#059669", fontWeight: 600 }}>✓ Exact match</span>}
                                {item.confidence === "suggested" && <span style={{ fontSize: "0.7rem", color: "#d97706", fontWeight: 600 }}>~ Suggested match</span>}
                                {item.confidence === "none" && item.matchedProductId === "__new__" && <span style={{ fontSize: "0.7rem", color: "var(--brand-primary)", fontWeight: 600 }}>✦ Auto-creating new product</span>}
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
                                    const matched = products.find((p) => p.id === v);
                                    u[idx] = { ...u[idx], matchedProductId: v, costPrice: matched?.cost_price ?? u[idx].costPrice };
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
                              {item.matchedProductId === "__new__" ? (
                                <span className="badge badge-neutral">From new</span>
                              ) : (
                                <input className="form-input" type="number" min="0" step="0.01" style={{ fontSize: "0.875rem", padding: "6px 10px" }} value={item.costPrice ?? ""}
                                  onChange={(e) => { const u = [...items]; u[idx] = { ...u[idx], costPrice: e.target.value }; setItems(u); }} />
                              )}
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
                    <span>{items.filter(i => i.enabled && isReady(i)).length} of {items.filter(i => i.enabled).length} checked items ready · {items.filter((i) => i.enabled && i.matchedProductId === "__new__").length} new product(s) will be created</span>
                    <span style={{ color: "var(--text-tertiary)", fontSize: "0.75rem" }}>Unchecked items will be skipped</span>
                  </div>
                  <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                    <button className="btn btn-primary" style={{ flex: 2 }} onClick={confirmItems} disabled={items.filter(i => i.enabled && isReady(i)).length === 0}>
                      {items.filter(i => i.enabled).every(isReady) ? <CheckCircle2 size={16} /> : <Truck size={16} />}
                      Confirm & Restock {items.filter(i => i.enabled && isReady(i)).length} Item(s)
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
                <tr>
                  <th style={{ width: "40px" }}>
                    <input type="checkbox" className="label-checkbox"
                      checked={filteredPurchases.length > 0 && filteredPurchases.every(p => selectedPurchaseIds[p.id])}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Product</th><th>Supplier</th><th>Qty</th><th>Cost/Unit</th><th>Total</th><th>Date</th><th style={{ width: "48px" }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>
                      <input type="checkbox" className="label-checkbox"
                        checked={!!selectedPurchaseIds[purchase.id]}
                        onChange={() => togglePurchaseSelect(purchase.id)}
                      />
                    </td>
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
                    <td>
                      <button className="btn btn-ghost btn-sm" style={{ color: "var(--text-danger)", padding: "4px 8px" }} onClick={() => deletePurchase(purchase.id)}>
                        <Trash2 size={16} />
                      </button>
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

      {/* Bulk Delete Purchases Modal */}
      {showBulkDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowBulkDeleteModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title text-danger">Delete Purchase History</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowBulkDeleteModal(false)}><X size={16} /></button>
            </div>
            <div className="card-body">
              <p>Are you sure you want to delete <strong>{selectedCount}</strong> selected purchase{selectedCount > 1 ? "s" : ""}?</p>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>The stocked quantities will be reverted. This action cannot be undone.</p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
                <button className="btn btn-secondary" onClick={() => setShowBulkDeleteModal(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={executeBulkDeletePurchases} disabled={bulkDeleting}>
                  {bulkDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}