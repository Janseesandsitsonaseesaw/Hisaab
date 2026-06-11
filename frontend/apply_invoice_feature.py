"""
apply_invoice_feature.py
Run this from the repo root:  python apply_invoice_feature.py

What it does
────────────
1. Adds invoice-related state variables to the Purchases tab.
2. Adds the invoiceUpload handler (multipart POST to /invoice/extract).
3. Injects an "Import from Invoice" button next to "Record Purchase".
4. Injects the full InvoiceUploadModal component (drag-drop upload, OCR loader,
   review + edit table, confirm to save).
5. Writes the InvoiceUploadModal before the closing </> of the return.

Nothing outside the Purchases tab is modified.
"""

MAIN_JSX = "src/main.jsx"

with open(MAIN_JSX, "r") as f:
    content = f.read()

# ─── 1. ADD STATE VARIABLES ───────────────────────────────────────────────────
state_search = "  const [editingPurchase,  setEditingPurchase]  = useState(null);"
state_replace = state_search + """
  const [showInvoiceModal,  setShowInvoiceModal]  = useState(false);
  const [invoiceFile,       setInvoiceFile]       = useState(null);
  const [invoiceItems,      setInvoiceItems]      = useState([]);   // [{product, quantity, matchedProductId, matched}]
  const [invoiceLoading,    setInvoiceLoading]    = useState(false);
  const [invoiceDragOver,   setInvoiceDragOver]   = useState(false);
  const [invoiceRawResp,    setInvoiceRawResp]    = useState("");"""
content = content.replace(state_search, state_replace)

# ─── 2. ADD HANDLER FUNCTIONS ─────────────────────────────────────────────────
handler_search = "  async function savePurchase(e) {"
handler_replace = """  // ── Invoice upload helpers ────────────────────────────────────────────────
  async function uploadInvoiceFile(file) {
    if (!file) return;
    setInvoiceFile(file);
    setInvoiceLoading(true);
    setInvoiceItems([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch(`${API_URL}/invoice/extract`, {
        method: "POST",
        body: formData,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: "Extraction failed" }));
        throw new Error(err.detail || "Extraction failed");
      }
      const data = await resp.json();
      setInvoiceRawResp(data.raw_response);

      // Auto-match each extracted product against existing inventory
      const enriched = (data.items || []).map((item) => {
        const exact = products.find(
          (p) => p.name.trim().toLowerCase() === item.product.trim().toLowerCase()
        );
        const fuzzy = exact
          ? null
          : products.find((p) =>
              p.name.toLowerCase().includes(item.product.toLowerCase().split(" ")[0])
            );
        return {
          product: item.product,
          quantity: item.quantity ?? 1,
          matchedProductId: exact?.id || fuzzy?.id || "",
          confidence: exact ? "exact" : fuzzy ? "fuzzy" : "none",
        };
      });
      setInvoiceItems(enriched);
    } catch (err) {
      showNotice(err.message || "Invoice extraction failed", "error");
      setShowInvoiceModal(false);
    } finally {
      setInvoiceLoading(false);
    }
  }

  function handleInvoiceDrop(e) {
    e.preventDefault();
    setInvoiceDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) uploadInvoiceFile(file);
  }

  async function confirmInvoiceItems() {
    const valid = invoiceItems.filter((i) => i.matchedProductId && i.quantity > 0);
    if (valid.length === 0) {
      showNotice("No valid items to save — match products first", "error");
      return;
    }
    try {
      for (const item of valid) {
        await api("/purchases", {
          method: "POST",
          body: JSON.stringify({
            product_id: item.matchedProductId,
            supplier_name: "Invoice Import",
            quantity: Number(item.quantity),
            cost_price: 0,
          }),
        });
      }
      showNotice(`${valid.length} item(s) restocked from invoice`, "success");
      setShowInvoiceModal(false);
      setInvoiceItems([]);
      setInvoiceFile(null);
      await refresh();
    } catch (err) {
      showNotice(err.message, "error");
    }
  }

  """ + handler_search
content = content.replace(handler_search, handler_replace)

# ─── 3. ADD "IMPORT FROM INVOICE" BUTTON to purchases page header ─────────────
purchases_btn_search = """                <button className="btn btn-primary" onClick={() => setEditingPurchase({})}>
                  <Plus size={18} /> Record Purchase
                </button>"""
purchases_btn_replace = """                <div style={{ display: "flex", gap: "10px" }}>
                  <button className="btn btn-secondary" onClick={() => { setShowInvoiceModal(true); setInvoiceFile(null); setInvoiceItems([]); }}>
                    <FileText size={18} /> Import from Invoice
                  </button>
                  <button className="btn btn-primary" onClick={() => setEditingPurchase({})}>
                    <Plus size={18} /> Record Purchase
                  </button>
                </div>"""
content = content.replace(purchases_btn_search, purchases_btn_replace)

# ─── 4. INJECT INVOICE MODAL just before closing </> of purchases tab ─────────
modal_injection_search = """              <div className="card">
                {filteredPurchases.length > 0 ? ("""
modal_injection_replace = """              {/* ── Invoice Upload Modal ───────────────────────────────────────── */}
              {showInvoiceModal && (
                <div
                  style={{
                    position: "fixed", inset: 0, zIndex: 1000,
                    background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "16px",
                  }}
                  onClick={(e) => { if (e.target === e.currentTarget) setShowInvoiceModal(false); }}
                >
                  <div
                    style={{
                      background: "var(--bg-primary)", borderRadius: "16px",
                      width: "100%", maxWidth: "700px", maxHeight: "90vh",
                      overflow: "hidden", display: "flex", flexDirection: "column",
                      boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
                    }}
                  >
                    {/* Modal header */}
                    <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)" }}>
                          Import from Invoice
                        </h3>
                        <p style={{ margin: "4px 0 0", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                          Upload a supplier invoice image — AI will extract products automatically.
                        </p>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowInvoiceModal(false)}
                        style={{ fontSize: "1.25rem", lineHeight: 1, padding: "4px 10px" }}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Modal body */}
                    <div style={{ padding: "20px 24px 24px", overflowY: "auto", flex: 1 }}>

                      {/* Drag-and-drop zone — only shown before file chosen */}
                      {!invoiceFile && !invoiceLoading && (
                        <div
                          onDragOver={(e) => { e.preventDefault(); setInvoiceDragOver(true); }}
                          onDragLeave={() => setInvoiceDragOver(false)}
                          onDrop={handleInvoiceDrop}
                          onClick={() => document.getElementById("invoice-file-input").click()}
                          style={{
                            border: `2px dashed ${invoiceDragOver ? "var(--brand-primary)" : "var(--border-color)"}`,
                            borderRadius: "12px",
                            padding: "48px 24px",
                            textAlign: "center",
                            cursor: "pointer",
                            background: invoiceDragOver ? "var(--bg-secondary)" : "transparent",
                            transition: "all 0.2s",
                          }}
                        >
                          <FileText
                            size={44}
                            style={{ color: invoiceDragOver ? "var(--brand-primary)" : "var(--text-tertiary)", marginBottom: "12px" }}
                          />
                          <p style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--text-primary)" }}>
                            Drag &amp; drop invoice here
                          </p>
                          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                            or click to browse — JPEG, PNG, or WebP supported
                          </p>
                        </div>
                      )}
                      <input
                        id="invoice-file-input"
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadInvoiceFile(f);
                          e.target.value = "";
                        }}
                      />

                      {/* OCR loading state */}
                      {invoiceLoading && (
                        <div style={{ textAlign: "center", padding: "48px 24px" }}>
                          <div
                            style={{
                              width: "52px", height: "52px", margin: "0 auto 16px",
                              borderRadius: "50%",
                              border: "4px solid var(--border-color)",
                              borderTop: "4px solid var(--brand-primary)",
                              animation: "spin 0.8s linear infinite",
                            }}
                          />
                          <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--text-primary)" }}>
                            Reading invoice…
                          </p>
                          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                            Gemini is extracting products and quantities
                          </p>
                        </div>
                      )}

                      {/* Review table */}
                      {!invoiceLoading && invoiceItems.length > 0 && (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                            <p style={{ margin: 0, fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9375rem" }}>
                              {invoiceItems.length} item{invoiceItems.length !== 1 ? "s" : ""} extracted — review &amp; confirm
                            </p>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => { setInvoiceFile(null); setInvoiceItems([]); }}
                              style={{ fontSize: "0.75rem" }}
                            >
                              ↩ Re-upload
                            </button>
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
                                {invoiceItems.map((item, idx) => (
                                  <tr key={idx}>
                                    <td>
                                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                        <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                                          {item.product}
                                        </span>
                                        {item.confidence === "exact" && (
                                          <span style={{ fontSize: "0.7rem", color: "#059669", fontWeight: 600 }}>✓ Exact match</span>
                                        )}
                                        {item.confidence === "fuzzy" && (
                                          <span style={{ fontSize: "0.7rem", color: "#d97706", fontWeight: 600 }}>~ Suggested match</span>
                                        )}
                                        {item.confidence === "none" && (
                                          <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>Select manually ↓</span>
                                        )}
                                      </div>
                                    </td>
                                    <td>
                                      <select
                                        className="form-input"
                                        style={{ fontSize: "0.8125rem", padding: "6px 10px" }}
                                        value={item.matchedProductId}
                                        onChange={(e) => {
                                          const updated = [...invoiceItems];
                                          updated[idx] = { ...updated[idx], matchedProductId: e.target.value };
                                          setInvoiceItems(updated);
                                        }}
                                      >
                                        <option value="">— skip this item —</option>
                                        {products.map((p) => (
                                          <option key={p.id} value={p.id}>
                                            {p.name} (stock: {p.stock})
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td>
                                      <input
                                        className="form-input"
                                        type="number"
                                        min="1"
                                        style={{ fontSize: "0.875rem", padding: "6px 10px", textAlign: "center" }}
                                        value={item.quantity ?? ""}
                                        onChange={(e) => {
                                          const updated = [...invoiceItems];
                                          updated[idx] = { ...updated[idx], quantity: Number(e.target.value) };
                                          setInvoiceItems(updated);
                                        }}
                                      />
                                    </td>
                                    <td>
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        style={{ color: "var(--text-tertiary)", padding: "4px 8px" }}
                                        onClick={() => setInvoiceItems(invoiceItems.filter((_, i) => i !== idx))}
                                        title="Remove row"
                                      >
                                        ✕
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Summary bar */}
                          <div style={{
                            marginTop: "16px", padding: "12px 16px",
                            background: "var(--bg-secondary)", borderRadius: "10px",
                            fontSize: "0.8125rem", color: "var(--text-secondary)",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                          }}>
                            <span>
                              {invoiceItems.filter((i) => i.matchedProductId).length} of {invoiceItems.length} items will update inventory
                            </span>
                            <span style={{ color: "var(--text-tertiary)", fontSize: "0.75rem" }}>
                              Unmatched items will be skipped
                            </span>
                          </div>

                          {/* Action buttons */}
                          <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                            <button
                              className="btn btn-secondary"
                              style={{ flex: 1 }}
                              onClick={() => setShowInvoiceModal(false)}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn btn-primary"
                              style={{ flex: 2 }}
                              onClick={confirmInvoiceItems}
                              disabled={invoiceItems.filter((i) => i.matchedProductId && i.quantity > 0).length === 0}
                            >
                              <Truck size={16} style={{ marginRight: "6px" }} />
                              Confirm &amp; Restock {invoiceItems.filter((i) => i.matchedProductId && i.quantity > 0).length} Item
                              {invoiceItems.filter((i) => i.matchedProductId && i.quantity > 0).length !== 1 ? "s" : ""}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="card">
                {filteredPurchases.length > 0 ? ("""
content = content.replace(modal_injection_search, modal_injection_replace)

# ─── 5. Add spin keyframe to existing CSS if not already present ───────────────
# Inject into the <style> block in index.html (handled separately) OR
# add a tiny inline style. We'll add it to the JSX style tag if one exists,
# otherwise rely on a global CSS patch below.

spin_search = "export default function App() {"
spin_replace = """// Invoice spinner keyframe is injected via a <style> tag once on mount
// (see useEffect below, appended to existing component)

export default function App() {"""
content = content.replace(spin_search, spin_replace, 1)

# Inject the keyframe useEffect near the top of existing useEffect chain
keyframe_search = "  useEffect(() => {"
keyframe_replace = """  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {"""
content = content.replace(keyframe_search, keyframe_replace, 1)

with open(MAIN_JSX, "w") as f:
    f.write(content)

print("✅  Invoice feature patched into main.jsx")
print()
print("Next steps:")
print("  1. Copy backend/invoice_routes.py into backend/app/")
print("  2. Register it in main.py:  from app.invoice_routes import router as invoice_router")
print("                              app.include_router(invoice_router)")
print("  3. Set OPENROUTER_API_KEY in your .env / environment")
print("  4. pip install httpx  (if not already installed)")
print("  5. Restart backend: uvicorn app.main:app --reload")
print("  6. Restart frontend: npm run dev")