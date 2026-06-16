import React, { useRef, useState, useEffect } from "react";
import {
  Search, X, Camera, Receipt, FileText, Minus, Plus, ShoppingCart,
  CreditCard, Smartphone, Wallet, MessageCircle, Link2, Zap, Trash2
} from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/library";
import ProductCard from "../components/ProductCard";
import { fmt, safeNum } from "../services/api";
import { playBarcodeSound } from "../services/audio";

export default function Billing({
  products, filteredProducts,
  cart, setCart,
  customers,
  billCustomerId, setBillCustomerId,
  productQuery, setProductQuery,
  scannerOn, setScannerOn,
  showNotice,
  paymentMethod, setPaymentMethod,
  lastSale,
  completeSale,
  shareReceipt,
  api,
  refresh,
  addProductToCart,
  startCreateProductWithBarcode,
  store,
}) {
  const videoRef    = useRef(null);
  const zxingReader = useRef(null);
  const barcodeInputRef = useRef(null);
  const [unmatchedBarcode, setUnmatchedBarcode] = useState(null);
  const [showUpiModal, setShowUpiModal] = useState(null);

  const handleCheckout = (doPrint = false) => {
    if (paymentMethod === "UPI") {
      if (!store?.upi_id) {
        showNotice("Please set your UPI ID in Store Settings first", "error");
        return;
      }
      setShowUpiModal({ doPrint });
    } else {
      completeSale(doPrint);
    }
  };
  const [barcodeAction, setBarcodeAction] = useState(null); // null | "link"
  const [linkChoice, setLinkChoice] = useState("");
  const [linking, setLinking] = useState(false);

  const cartLines = cart
    .map((line) => ({ ...line, product: products.find((p) => p.id === line.product_id) }))
    .filter((line) => line.product);

  const cartTotals = cartLines.reduce(
    (tot, line) => {
      const price = line.override_price != null ? line.override_price : safeNum(line.product.selling_price);
      tot.items  += line.quantity;
      tot.amount += price * line.quantity;
      tot.profit += (price - safeNum(line.product.cost_price)) * line.quantity;
      return tot;
    },
    { items: 0, amount: 0, profit: 0 },
  );
  const selectedCustomer = customers.find((c) => c.id === billCustomerId);
  const needsCustomer = paymentMethod === "Udhaar";

  function addToCart(product) {
    addProductToCart(product);
  }

  function updateCart(productId, delta) {
    const product = products.find((p) => p.id === productId);
    setCart((cur) =>
      cur
        .map((l) => l.product_id === productId ? { ...l, quantity: Math.max(0, Math.min(l.quantity + delta, product?.stock || 0)) } : l)
        .filter((l) => l.quantity > 0),
    );
  }

  function handleBarcodeDetected(code) {
    const found = products.find((p) => p.barcode === code);
    const soundEnabled = store?.enable_scanner_sounds !== false;
    if (found) {
      if (soundEnabled) playBarcodeSound("success");
      addToCart(found);
      setProductQuery("");
      showNotice(`${found.name} added to cart`);
    } else {
      if (soundEnabled) playBarcodeSound("error");
      setUnmatchedBarcode(code);
      setBarcodeAction(null);
      setLinkChoice("");
      setProductQuery("");
    }
  }

  async function linkBarcodeToProduct() {
    if (!unmatchedBarcode || !linkChoice) return;
    setLinking(true);
    try {
      const updated = await api(`/products/${linkChoice}/assign-barcode`, {
        method: "POST",
        body: JSON.stringify({ barcode: unmatchedBarcode, force: true }),
      });
      showNotice(`Barcode linked to ${updated.name}`);
      await refresh();
      addToCart(updated);
      setUnmatchedBarcode(null);
      setBarcodeAction(null);
      setLinkChoice("");
    } catch (err) {
      showNotice(err.message, "error");
    } finally {
      setLinking(false);
    }
  }

  async function toggleScanner() {
    if (scannerOn) { stopScanner(); return; }
    try {
      setScannerOn(true);
      setTimeout(async () => {
        if (!zxingReader.current) zxingReader.current = new BrowserMultiFormatReader();
        const videoElement = videoRef.current;
        if (!videoElement) return;
        try {
          await zxingReader.current.decodeFromVideoDevice(undefined, videoElement, (result, err) => {
            if (result) { handleBarcodeDetected(result.getText()); stopScanner(); }
            if (err && err.name !== "NotFoundException") console.error(err);
          });
        } catch (err) { showNotice(`Camera error: ${err.message}`, "error"); stopScanner(); }
      }, 100);
    } catch (err) { showNotice(`Init error: ${err.message}`, "error"); stopScanner(); }
  }

  function stopScanner() {
    if (zxingReader.current) zxingReader.current.reset();
    setScannerOn(false);
  }

  // Quick checkout: Enter on search adds first match
  function handleSearchKey(e) {
    if (e.key === "Enter" && productQuery) {
      const q = productQuery.toLowerCase();
      const soundEnabled = store?.enable_scanner_sounds !== false;
      const found = products.find(p => p.barcode === productQuery || p.name.toLowerCase() === q);
      if (found) { 
        if (soundEnabled) playBarcodeSound("success");
        addToCart(found); setProductQuery(""); return; 
      }
      if (filteredProducts.length === 1) { 
        if (soundEnabled) playBarcodeSound("success");
        addToCart(filteredProducts[0]); setProductQuery(""); return; 
      }
      if (/^\d{6,}$/.test(productQuery)) { handleBarcodeDetected(productQuery); }
      else {
        if (soundEnabled) playBarcodeSound("error");
        showNotice("No matching product found", "error");
      }
    }
  }

  return (
    <div className="billing-layout fade-in">
      <div className="billing-main">
        <div className="page-header" style={{ marginBottom: "14px" }}>
          <h2 className="page-title">New Order</h2>
          <button className={`btn ${scannerOn ? "btn-danger" : "btn-secondary"}`} onClick={toggleScanner}>
            {scannerOn ? <X size={18} /> : <Camera size={18} />}
            {scannerOn ? "Cancel Scan" : "Scan Barcode"}
          </button>
        </div>

        {/* Quick info bar */}
        <div className="billing-quick-bar">
          <span className="billing-quick-badge">
            <Zap size={13} /> Press Enter to add top result
          </span>
          <span className="billing-quick-badge">
            <Camera size={13} /> Barcode auto-adds product
          </span>
        </div>

        <div className="billing-search-bar">
          <Search size={18} className="billing-search-icon" />
          <input
            ref={barcodeInputRef}
            className="billing-search-input"
            placeholder="Search by name, barcode, or category… (Enter to add)"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            onKeyDown={handleSearchKey}
            autoFocus
          />
          {productQuery && (
            <button className="billing-search-clear" onClick={() => setProductQuery("")}><X size={16} /></button>
          )}
        </div>

        {scannerOn && (
          <div className="scanner-container">
            <video ref={videoRef} className="scanner-video" muted playsInline />
            <div className="scanner-overlay" />
          </div>
        )}

        {unmatchedBarcode && (
          <div className="modal-overlay" onClick={() => { setUnmatchedBarcode(null); setBarcodeAction(null); }}>
            <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
              <div className="card-header">
                <h3 className="card-title">New Barcode Scanned</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => { setUnmatchedBarcode(null); setBarcodeAction(null); }}><X size={16} /></button>
              </div>
              <div className="card-body">
                <p style={{ marginBottom: "12px", fontSize: "13px", color: "var(--text-secondary)" }}>
                  Barcode <strong>{unmatchedBarcode}</strong> isn't linked to any product yet.
                </p>

                {barcodeAction !== "link" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <button className="btn btn-secondary" style={{ justifyContent: "flex-start" }} onClick={() => setBarcodeAction("link")}>
                      <Link2 size={16} /> Link Existing Product
                    </button>
                    <button className="btn btn-secondary" style={{ justifyContent: "flex-start" }} onClick={() => { startCreateProductWithBarcode(unmatchedBarcode); setUnmatchedBarcode(null); setBarcodeAction(null); }}>
                      <Plus size={16} /> Create New Product
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">Link to Product</label>
                      <select className="form-input" value={linkChoice} onChange={(e) => setLinkChoice(e.target.value)}>
                        <option value="">Select product…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                        ))}
                      </select>
                      <small className="field-hint">Saved permanently for future scans, and added to the cart.</small>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                      <button className="btn btn-secondary" onClick={() => setBarcodeAction(null)}>Back</button>
                      <button className="btn btn-primary" onClick={linkBarcodeToProduct} disabled={!linkChoice || linking}>
                        <Link2 size={16} /> {linking ? "Linking…" : "Link & Add to Cart"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {filteredProducts.length > 0 ? (
          <div className="product-grid">
            {filteredProducts.map((product) => {
              const inCart = cart.find(c => c.product_id === product.id)?.quantity || 0;
              const availableStock = Math.max(0, product.stock - inCart);
              return (
                <ProductCard key={product.id} product={product} availableStock={availableStock} onClick={addToCart} />
              );
            })}
          </div>
        ) : (
          <div className="empty-state-v2">
            <div className="empty-state-v2-icon"><Search size={40} /></div>
            <h3 className="empty-state-v2-title">No products found</h3>
            <p className="empty-state-v2-desc">{productQuery ? `No results for "${productQuery}"` : "Your catalog is empty."}</p>
            {productQuery
              ? <button className="btn btn-primary btn-sm" onClick={() => setProductQuery("")}>Clear search</button>
              : null
            }
          </div>
        )}
      </div>

      {/* Sticky Cart sidebar */}
      <div className="cart-sidebar">
        <div className="cart-header">
          <span className="cart-title">Current Bill</span>
          <span className="badge badge-neutral">{cartTotals.items} Items</span>
        </div>

        <div className="customer-selector">
          <label>{needsCustomer ? "Customer for Udhaar" : "Link to Customer (Optional)"}</label>
          <select value={billCustomerId} onChange={(e) => setBillCustomerId(e.target.value)}>
            <option value="">Walk-in Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
            ))}
          </select>
          {needsCustomer && !billCustomerId && (
            <small className="field-hint field-hint-danger">Udhaar bills must be linked to a customer.</small>
          )}
          {selectedCustomer && (
            <small className="field-hint">Current due: {fmt(selectedCustomer.outstanding_balance || 0)}</small>
          )}
        </div>

        <div className="payment-selector">
          <label>Payment Method</label>
          <div className="payment-options">
            {[
              ["Cash", Wallet],
              ["UPI", Smartphone],
              ["Card", CreditCard],
              ["Udhaar", Receipt],
            ].map(([method, Icon]) => (
              <button
                key={method}
                type="button"
                className={`payment-option ${paymentMethod === method ? "active" : ""}`}
                onClick={() => setPaymentMethod(method)}
              >
                <Icon size={15} />
                <span>{method}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="cart-items">
          {cartLines.length > 0 ? (
            cartLines.map((line) => {
              const displayPrice = line.override_price != null ? line.override_price : safeNum(line.product.selling_price);
              return (
                <div className="cart-item" key={line.product_id}>
                  <div className="cart-item-info">
                    <strong>{line.product.name}</strong>
                    {line.product.variable_price ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>₹</span>
                        <input
                          type="number" min="0" step="0.01" value={displayPrice}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setCart((cur) => cur.map((l) => l.product_id === line.product_id ? { ...l, override_price: isNaN(val) ? 0 : val } : l));
                          }}
                          style={{ width: "80px", padding: "2px 6px", fontSize: "13px", border: "1px solid rgba(30,58,138,0.5)", borderRadius: "6px", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                        />
                        <span style={{ fontSize: "11px", color: "#60a5fa", fontWeight: 600 }}>each</span>
                      </div>
                    ) : (
                      <small>{fmt(line.product.selling_price)} each</small>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                    <div className="cart-item-total">{fmt(displayPrice * line.quantity)}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        style={{ padding: "4px", color: "var(--danger)", height: "auto" }}
                        onClick={(e) => { e.stopPropagation(); updateCart(line.product_id, -line.quantity); }}
                        title="Remove item"
                      >
                        <Trash2 size={16} />
                      </button>
                      {/* Large Quantity Controls */}
                      <div className="qty-control">
                        <button className="qty-btn" onClick={(e) => { e.stopPropagation(); updateCart(line.product_id, -1); }}>
                          <Minus size={16} />
                        </button>
                        <span className="qty-value">{line.quantity}</span>
                        <button className="qty-btn" onClick={(e) => { e.stopPropagation(); updateCart(line.product_id, 1); }}>
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="cart-empty-state">
              <div className="cart-empty-icon"><ShoppingCart size={36} /></div>
              <strong>Cart is empty</strong>
              <p>Tap any product card or scan a barcode to add items</p>
            </div>
          )}
        </div>

        <div className="cart-footer">
          <div className="summary-row"><span>Subtotal</span><span>{fmt(cartTotals.amount)}</span></div>
          <div className="summary-row"><span>Payment</span><span>{paymentMethod}</span></div>
          <div className="summary-row"><span>Tax</span><span>—</span></div>
          <div className="summary-total"><span>Total</span><span>{fmt(cartTotals.amount)}</span></div>
          {lastSale && (
            <div className="last-sale-card">
              <div>
                <strong>{lastSale.bill_number}</strong>
                <small>{fmt(lastSale.total_amount)} ready to share</small>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => shareReceipt(lastSale)}>
                <MessageCircle size={15} /> WhatsApp
              </button>
            </div>
          )}
          {/* Quick Checkout actions */}
          <div className="cart-actions">
            <button className="btn btn-secondary" onClick={() => setCart([])} disabled={cart.length === 0}>Clear</button>
            <button className="btn btn-secondary" onClick={() => handleCheckout(true)} disabled={cart.length === 0 || (needsCustomer && !billCustomerId)}>
              <FileText size={18} /> Print
            </button>
            <button className="btn btn-generate-bill" onClick={() => handleCheckout(false)} disabled={cart.length === 0 || (needsCustomer && !billCustomerId)}>
              <Receipt size={18} /> Checkout
            </button>
          </div>
        </div>
      </div>

      {showUpiModal && (() => {
        const upiLink = `upi://pay?pa=${encodeURIComponent(store.upi_id)}&pn=${encodeURIComponent(store.store_name || "Store")}&am=${cartTotals.amount.toFixed(2)}&cu=INR`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`;
        return (
          <div className="modal-overlay" onClick={() => setShowUpiModal(null)}>
            <div className="modal-panel" style={{ maxWidth: "380px" }} onClick={(e) => e.stopPropagation()}>
              <div className="card-header" style={{ borderBottom: "1px solid var(--border-color)", padding: "16px 20px" }}>
                <h3 className="card-title">UPI QR Payment</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowUpiModal(null)}>
                  <X size={16} />
                </button>
              </div>
              <div className="card-body" style={{ padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                <div style={{ padding: "16px", background: "#ffffff", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                  <img src={qrUrl} alt="UPI QR Code" style={{ width: "200px", height: "200px", display: "block" }} />
                </div>
                <div style={{ textAlign: "center", width: "100%" }}>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>
                    ₹{cartTotals.amount.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", wordBreak: "break-all" }}>
                    UPI ID: {store.upi_id}
                  </div>
                </div>
                <div style={{ display: "flex", width: "100%", gap: "10px", marginTop: "8px" }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowUpiModal(null)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, backgroundColor: "var(--success)", borderColor: "var(--success)" }}
                    onClick={() => {
                      completeSale(showUpiModal.doPrint);
                      setShowUpiModal(null);
                    }}
                  >
                    Payment Received
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}