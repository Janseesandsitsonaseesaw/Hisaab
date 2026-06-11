import React, { useRef } from "react";
import {
  Search, X, Camera, Receipt, FileText, Minus, Plus, ShoppingCart,
} from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/library";
import ProductCard from "../components/ProductCard";
import { fmt, safeNum } from "../services/api";

export default function Billing({
  products, filteredProducts,
  cart, setCart,
  customers,
  billCustomerId, setBillCustomerId,
  productQuery, setProductQuery,
  scannerOn, setScannerOn,
  showNotice,
  completeSale,
}) {
  const videoRef    = useRef(null);
  const zxingReader = useRef(null);

  const cartLines = cart
    .map((line) => ({ ...line, product: products.find((p) => p.id === line.product_id) }))
    .filter((line) => line.product);

  const cartTotals = cartLines.reduce(
    (tot, line) => {
      tot.items  += line.quantity;
      tot.amount += safeNum(line.product.selling_price) * line.quantity;
      tot.profit += (safeNum(line.product.selling_price) - safeNum(line.product.cost_price)) * line.quantity;
      return tot;
    },
    { items: 0, amount: 0, profit: 0 },
  );

  function addToCart(product) {
    if (product.stock <= 0) { showNotice("Product out of stock!", "error"); return; }
    setCart((cur) => {
      const ex = cur.find((l) => l.product_id === product.id);
      if (ex) return cur.map((l) => l.product_id === product.id ? { ...l, quantity: Math.min(l.quantity + 1, product.stock) } : l);
      return [...cur, { product_id: product.id, quantity: 1 }];
    });
  }

  function updateCart(productId, delta) {
    const product = products.find((p) => p.id === productId);
    setCart((cur) =>
      cur
        .map((l) => l.product_id === productId ? { ...l, quantity: Math.max(0, Math.min(l.quantity + delta, product?.stock || 0)) } : l)
        .filter((l) => l.quantity > 0),
    );
  }

  async function toggleScanner() {
    if (scannerOn) { stopScanner(); return; }
    try {
      setScannerOn(true);
      setTimeout(async () => {
        if (!zxingReader.current) {
          zxingReader.current = new BrowserMultiFormatReader();
        }
        const videoElement = videoRef.current;
        if (!videoElement) return;
        try {
          await zxingReader.current.decodeFromVideoDevice(undefined, videoElement, (result, err) => {
            if (result) {
              setProductQuery(result.getText());
              stopScanner();
            }
            if (err && err.name !== "NotFoundException") console.error(err);
          });
        } catch (err) {
          showNotice(`Camera error: ${err.message}`, "error");
          stopScanner();
        }
      }, 100);
    } catch (err) {
      showNotice(`Init error: ${err.message}`, "error");
      stopScanner();
    }
  }

  function stopScanner() {
    if (zxingReader.current) zxingReader.current.reset();
    setScannerOn(false);
  }

  return (
    <div className="billing-layout fade-in">
      <div className="billing-main">
        <div className="page-header" style={{ marginBottom: "16px" }}>
          <h2 className="page-title">New Order</h2>
          <button className={`btn ${scannerOn ? "btn-danger" : "btn-secondary"}`} onClick={toggleScanner}>
            {scannerOn ? <X size={18} /> : <Camera size={18} />}
            {scannerOn ? "Cancel" : "Scan Barcode"}
          </button>
        </div>

        <div className="billing-search-bar">
          <Search size={18} className="billing-search-icon" />
          <input
            className="billing-search-input"
            placeholder="Search by name, barcode, or category…"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && productQuery) {
                const q = productQuery.toLowerCase();
                const found = products.find(p => p.barcode === productQuery || p.name.toLowerCase() === q);
                if (found) { addToCart(found); setProductQuery(""); }
                else if (filteredProducts.length === 1) { addToCart(filteredProducts[0]); setProductQuery(""); }
              }
            }}
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

        {filteredProducts.length > 0 ? (
          <div className="product-grid">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onClick={addToCart} />
            ))}
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

      {/* Cart sidebar */}
      <div className="cart-sidebar">
        <div className="cart-header">
          <span className="cart-title">Current Bill</span>
          <span className="badge badge-neutral">{cartTotals.items} Items</span>
        </div>

        <div className="customer-selector">
          <label>Link to Customer (Optional)</label>
          <select value={billCustomerId} onChange={(e) => setBillCustomerId(e.target.value)}>
            <option value="">Walk-in Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
            ))}
          </select>
        </div>

        <div className="cart-items">
          {cartLines.length > 0 ? (
            cartLines.map((line) => (
              <div className="cart-item" key={line.product_id}>
                <div className="cart-item-info">
                  <strong>{line.product.name}</strong>
                  <small>{fmt(line.product.selling_price)} each</small>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                  <div className="cart-item-total">{fmt(safeNum(line.product.selling_price) * line.quantity)}</div>
                  <div className="qty-control">
                    <button className="qty-btn" onClick={(e) => { e.stopPropagation(); updateCart(line.product_id, -1); }}><Minus size={14} /></button>
                    <span className="qty-value">{line.quantity}</span>
                    <button className="qty-btn" onClick={(e) => { e.stopPropagation(); updateCart(line.product_id, 1); }}><Plus size={14} /></button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="cart-empty-state">
              <div className="cart-empty-icon"><ShoppingCart size={36} /></div>
              <strong>Cart is empty</strong>
              <p>Tap any product card to add it to this bill</p>
            </div>
          )}
        </div>

        <div className="cart-footer">
          <div className="summary-row"><span>Subtotal</span><span>{fmt(cartTotals.amount)}</span></div>
          <div className="summary-row"><span>Tax</span><span>—</span></div>
          <div className="summary-total"><span>Total</span><span>{fmt(cartTotals.amount)}</span></div>
          <div className="cart-actions">
            <button className="btn btn-secondary" onClick={() => setCart([])} disabled={cart.length === 0}>Clear</button>
            <button className="btn btn-secondary" onClick={() => completeSale(true)} disabled={cart.length === 0}>
              <FileText size={18} /> Print
            </button>
            <button className="btn btn-generate-bill" onClick={() => completeSale(false)} disabled={cart.length === 0}>
              <Receipt size={18} /> Generate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
