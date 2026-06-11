import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import {
  Hexagon, Plus, Receipt, History as HistoryIcon, Settings,
  Download, FileText, AlertCircle, CheckCircle2,
  Users, Truck, ChevronLeft, IndianRupee, Phone, Mail, MapPin,
} from "lucide-react";

import { api, fmt, safeNum, downloadInvoice, printInvoice } from "./services/api";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Billing from "./pages/Billing";
import Inventory from "./pages/Inventory";
import Customers from "./pages/Customers";
import Purchases from "./pages/Purchases";

/** Return 1–2 uppercase initials from a full name */
function getInitials(name = "") {
  return (name || "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [activeTab,        setActiveTab]        = useState("landing");
  const [chartTab,         setChartTab]         = useState("sales");
  const [store,            setStore]            = useState(null);
  const [products,         setProducts]         = useState([]);
  const [sales,            setSales]            = useState([]);
  const [dashboard,        setDashboard]        = useState(null);
  const [cart,             setCart]             = useState([]);
  const [productQuery,     setProductQuery]     = useState("");
  const [historyQuery,     setHistoryQuery]     = useState("");
  const [editingProduct,   setEditingProduct]   = useState(null);
  const [notice,           setNotice]           = useState(null);
  const [scannerOn,        setScannerOn]        = useState(false);
  const [isProfileOpen,    setIsProfileOpen]    = useState(false);
  const [isNotifOpen,      setIsNotifOpen]      = useState(false);
  const [isSidebarOpen,    setIsSidebarOpen]    = useState(false);
  const [customers,        setCustomers]        = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomer,  setEditingCustomer]  = useState(null);
  const [customerQuery,    setCustomerQuery]    = useState("");
  const [customerUdhaar,   setCustomerUdhaar]   = useState([]);
  const [purchases,        setPurchases]        = useState([]);
  const [editingPurchase,  setEditingPurchase]  = useState(null);
  const [purchaseQuery,    setPurchaseQuery]    = useState("");
  const [billCustomerId,   setBillCustomerId]   = useState("");
  const [udhaarForm,       setUdhaarForm]       = useState(null);

  const profileRef     = useRef(null);
  const notifRef       = useRef(null);
  const barcodeBuffer  = useRef("");
  const barcodeTimeout = useRef(null);

  async function refresh() {
    const [storeData, productData, salesData, dashboardData, customerData, purchaseData] = await Promise.all([
      api("/store"),
      api("/products"),
      api("/sales"),
      api("/dashboard"),
      api("/customers"),
      api("/purchases"),
    ]);
    setStore(storeData);
    setProducts(productData);
    setSales(salesData);
    setDashboard(dashboardData);
    setCustomers(customerData);
    setPurchases(purchaseData);
  }

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    refresh().catch((err) => showNotice(err.message, "error"));

    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setIsProfileOpen(false);
      if (notifRef.current   && !notifRef.current.contains(e.target))   setIsNotifOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if (activeTab !== "billing") return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;

      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        clearTimeout(barcodeTimeout.current);
        barcodeTimeout.current = setTimeout(() => { barcodeBuffer.current = ""; }, 50);
      } else if (e.key === "Enter" && barcodeBuffer.current) {
        const val = barcodeBuffer.current;
        barcodeBuffer.current = "";
        const found = products.find(p => p.barcode === val);
        if (found) {
          setCart((cur) => {
            const ex = cur.find((l) => l.product_id === found.id);
            if (ex) return cur.map((l) => l.product_id === found.id ? { ...l, quantity: Math.min(l.quantity + 1, found.stock) } : l);
            return [...cur, { product_id: found.id, quantity: 1 }];
          });
          showNotice(`Added ${found.name} to cart`);
        } else {
          showNotice(`Barcode ${val} not found`, "error");
        }
      }
    }
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [activeTab, products]);

  function showNotice(msg, type = "success") {
    setNotice({ message: msg, type });
    setTimeout(() => setNotice(null), 3000);
  }

  const filteredProducts = useMemo(() => {
    const q = productQuery.toLowerCase();
    return products.filter((p) =>
      `${p.name} ${p.barcode || ""} ${p.category}`.toLowerCase().includes(q),
    );
  }, [products, productQuery]);

  const filteredSales = useMemo(() => {
    const q = historyQuery.toLowerCase();
    return sales.filter((s) =>
      `${s.bill_number} ${s.created_at} ${s.items.map((i) => i.name).join(" ")}`.toLowerCase().includes(q),
    );
  }, [sales, historyQuery]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.toLowerCase();
    return customers.filter((c) =>
      `${c.name} ${c.phone} ${c.email || ""}`.toLowerCase().includes(q),
    );
  }, [customers, customerQuery]);

  const filteredPurchases = useMemo(() => {
    const q = purchaseQuery.toLowerCase();
    return purchases.filter((p) =>
      `${p.product_name} ${p.supplier_name}`.toLowerCase().includes(q),
    );
  }, [purchases, purchaseQuery]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function completeSale(doPrint = false) {
    if (cart.length === 0) return;
    try {
      const sale = await api(`/sales${billCustomerId ? `?customer_id=${billCustomerId}` : ""}`, {
        method: "POST",
        body: JSON.stringify(cart),
      });
      setCart([]);
      setBillCustomerId("");
      showNotice(`${sale.bill_number} generated for ${fmt(sale.total_amount)}`);
      if (doPrint) printInvoice(sale.id);
      await refresh();
    } catch (err) { showNotice(err.message, "error"); }
  }

  async function saveStore(e) {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const saved = await api("/store", { method: "PUT", body: JSON.stringify(payload) });
      setStore(saved);
      showNotice("Store profile saved successfully");
    } catch (err) { showNotice(err.message, "error"); }
  }

  async function saveProduct(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const raw  = Object.fromEntries(new FormData(form));
    const payload = {
      name: raw.name, barcode: raw.barcode || null, category: raw.category,
      cost_price: Number(raw.cost_price), selling_price: Number(raw.selling_price), stock: Number(raw.stock),
    };
    const path   = editingProduct ? `/products/${editingProduct.id}` : "/products";
    const method = editingProduct ? "PUT" : "POST";
    try {
      await api(path, { method, body: JSON.stringify(payload) });
      form.reset();
      setEditingProduct(null);
      showNotice("Product saved successfully");
      await refresh();
    } catch (err) { showNotice(err.message, "error"); }
  }

  async function deleteProduct(productId) {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await api(`/products/${productId}`, { method: "DELETE" });
      setCart((cur) => cur.filter((l) => l.product_id !== productId));
      showNotice("Product deleted");
      await refresh();
    } catch (err) { showNotice(err.message, "error"); }
  }

  async function saveCustomer(e) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const payload = { name: raw.name, phone: raw.phone, email: raw.email || null, address: raw.address || null };
    const path   = editingCustomer?.id ? `/customers/${editingCustomer.id}` : "/customers";
    const method = editingCustomer?.id ? "PUT" : "POST";
    try {
      await api(path, { method, body: JSON.stringify(payload) });
      e.currentTarget.reset();
      setEditingCustomer(null);
      showNotice("Customer saved successfully");
      await refresh();
    } catch (err) { showNotice(err.message, "error"); }
  }

  async function deleteCustomer(customerId) {
    if (!window.confirm("Are you sure you want to delete this customer?")) return;
    try {
      await api(`/customers/${customerId}`, { method: "DELETE" });
      showNotice("Customer deleted");
      setSelectedCustomer(null);
      await refresh();
    } catch (err) { showNotice(err.message, "error"); }
  }

  async function loadCustomerDetail(customerId) {
    try {
      const [detail, udhaar] = await Promise.all([
        api(`/customers/${customerId}`),
        api(`/customers/${customerId}/udhaar`),
      ]);
      setSelectedCustomer(detail);
      setCustomerUdhaar(udhaar);
    } catch (err) { showNotice(err.message, "error"); }
  }

  async function saveUdhaarEntry(e) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const payload = {
      customer_id: selectedCustomer.id,
      amount: Number(raw.amount),
      type: udhaarForm,
      note: raw.note || null,
    };
    try {
      await api("/udhaar", { method: "POST", body: JSON.stringify(payload) });
      setUdhaarForm(null);
      showNotice(`${udhaarForm === "credit" ? "Credit" : "Payment"} recorded`);
      await loadCustomerDetail(selectedCustomer.id);
      await refresh();
    } catch (err) { showNotice(err.message, "error"); }
  }

  async function savePurchase(e) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const payload = {
      product_id: raw.product_id,
      supplier_name: raw.supplier_name,
      quantity: Number(raw.quantity),
      cost_price: Number(raw.cost_price),
      purchase_date: raw.purchase_date || null,
    };
    try {
      await api("/purchases", { method: "POST", body: JSON.stringify(payload) });
      e.currentTarget.reset();
      setEditingPurchase(null);
      showNotice("Purchase recorded — stock updated");
      await refresh();
    } catch (err) { showNotice(err.message, "error"); }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (!store || !dashboard) {
    return (
      <main className="loading-screen">
        <div className="spinner" />
        <span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>Loading Hisaab…</span>
      </main>
    );
  }

  const lowStockList = dashboard.low_stock_products || [];

  // ── Landing page ─────────────────────────────────────────────────────────────
  if (activeTab === "landing") {
    return (
      <div className="landing-page">
        <header className="landing-header">
          <div className="brand">
            <div className="brand-icon"><Hexagon size={18} strokeWidth={3} /></div>
            <span>Hisaab</span>
          </div>
          <button className="btn btn-secondary" onClick={() => setActiveTab("dashboard")}>Try demo</button>
        </header>
        <main className="landing-main">
          <div className="landing-hero">
            <div className="hero-image-wrapper">
              <img src="/hero-box.png" alt="Inventory Box" width="280" style={{ mixBlendMode: "multiply" }} />
            </div>
            <h1 className="hero-title">The inventory platform that<br />scales your business</h1>
            <p className="hero-subtitle">
              Track stock, manage suppliers, automate reorders, and keep<br />
              your team aligned from one powerful command center.
            </p>
            <button className="btn btn-primary btn-lg try-demo-btn" onClick={() => setActiveTab("dashboard")}>
              Try demo &rarr;
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Main App Shell ────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        store={store}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        getInitials={getInitials}
        setSelectedCustomer={setSelectedCustomer}
      />

      <div className="main-wrapper">
        <Navbar
          store={store}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          productQuery={productQuery} setProductQuery={setProductQuery}
          historyQuery={historyQuery} setHistoryQuery={setHistoryQuery}
          customerQuery={customerQuery} setCustomerQuery={setCustomerQuery}
          purchaseQuery={purchaseQuery} setPurchaseQuery={setPurchaseQuery}
          lowStockList={lowStockList}
          isNotifOpen={isNotifOpen} setIsNotifOpen={setIsNotifOpen} notifRef={notifRef}
          isProfileOpen={isProfileOpen} setIsProfileOpen={setIsProfileOpen} profileRef={profileRef}
          setIsSidebarOpen={setIsSidebarOpen}
          getInitials={getInitials}
        />

        <main className="page-content">

          {activeTab === "dashboard" && (
            <Dashboard
              store={store}
              dashboard={dashboard}
              sales={sales}
              setActiveTab={setActiveTab}
              setEditingProduct={setEditingProduct}
              setEditingCustomer={setEditingCustomer}
              chartTab={chartTab}
              setChartTab={setChartTab}
            />
          )}

          {activeTab === "billing" && (
            <Billing
              products={products}
              filteredProducts={filteredProducts}
              cart={cart}
              setCart={setCart}
              customers={customers}
              billCustomerId={billCustomerId}
              setBillCustomerId={setBillCustomerId}
              productQuery={productQuery}
              setProductQuery={setProductQuery}
              scannerOn={scannerOn}
              setScannerOn={setScannerOn}
              showNotice={showNotice}
              completeSale={completeSale}
            />
          )}

          {activeTab === "products" && (
            <Inventory
              filteredProducts={filteredProducts}
              editingProduct={editingProduct}
              setEditingProduct={setEditingProduct}
              saveProduct={saveProduct}
              deleteProduct={deleteProduct}
            />
          )}

          {activeTab === "customers" && (
            <Customers
              filteredCustomers={filteredCustomers}
              editingCustomer={editingCustomer}
              setEditingCustomer={setEditingCustomer}
              saveCustomer={saveCustomer}
              deleteCustomer={deleteCustomer}
              loadCustomerDetail={loadCustomerDetail}
              selectedCustomer={selectedCustomer}
              setSelectedCustomer={setSelectedCustomer}
              customerUdhaar={customerUdhaar}
              udhaarForm={udhaarForm}
              setUdhaarForm={setUdhaarForm}
              saveUdhaarEntry={saveUdhaarEntry}
            />
          )}

          {activeTab === "purchases" && (
            <Purchases
              filteredPurchases={filteredPurchases}
              editingPurchase={editingPurchase}
              setEditingPurchase={setEditingPurchase}
              savePurchase={savePurchase}
              products={products}
              refresh={refresh}
              showNotice={showNotice}
            />
          )}

          {/* ── History ─────────────────────────────────────────── */}
          {activeTab === "history" && (
            <div className="fade-in">
              <div className="page-header">
                <h2 className="page-title">Transaction History</h2>
              </div>
              <div className="card">
                {filteredSales.length > 0 ? (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Transaction Info</th>
                          <th>Date &amp; Time</th>
                          <th>Items</th>
                          <th style={{ textAlign: "right" }}>Total Amount</th>
                          <th style={{ textAlign: "right" }}>Invoice</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSales.map((sale) => (
                          <tr key={sale.id}>
                            <td>
                              <div className="td-product">
                                <div className="product-icon"><Receipt size={20} /></div>
                                <div className="product-details">
                                  <strong>{sale.bill_number}</strong>
                                  <small style={{ color: "var(--success)" }}>✓ Success</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="product-details">
                                <strong>{new Date(sale.created_at).toLocaleDateString("en-IN")}</strong>
                                <small>{new Date(sale.created_at).toLocaleTimeString("en-IN")}</small>
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-neutral">{sale.items.length} items</span>
                              <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                {sale.items.slice(0, 2).map((i) => `${i.name} x${i.quantity}`).join(", ")}
                                {sale.items.length > 2 && " …"}
                              </div>
                            </td>
                            <td style={{ textAlign: "right", fontSize: "1.0625rem", fontWeight: "600" }}>
                              {fmt(sale.total_amount)}
                            </td>
                            <td>
                              <div className="invoice-actions" style={{ justifyContent: "flex-end" }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => downloadInvoice(sale.id, sale.bill_number)} title="Download PDF">
                                  <Download size={14} /> PDF
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => printInvoice(sale.id)} title="Print">
                                  <FileText size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state-v2">
                    <div className="empty-state-v2-icon"><HistoryIcon size={48} /></div>
                    <h3 className="empty-state-v2-title">No transactions yet</h3>
                    <p className="empty-state-v2-desc">Start billing to see your transaction history here.</p>
                    <button className="btn btn-primary btn-sm" onClick={() => setActiveTab("billing")}>Start Billing</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Settings ─────────────────────────────────────────── */}
          {activeTab === "settings" && (
            <div className="fade-in settings-container">
              <div className="page-header">
                <h2 className="page-title">Store Settings</h2>
              </div>
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Store Profile</h3>
                </div>
                <div className="card-body">
                  <form onSubmit={saveStore}>
                    <div className="form-group">
                      <label className="form-label">Store Name</label>
                      <input className="form-input" required name="store_name" defaultValue={store.store_name} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Owner Name</label>
                      <input className="form-input" required name="owner_name" defaultValue={store.owner_name} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <input className="form-input" required name="phone" defaultValue={store.phone} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Store Category</label>
                      <select className="form-input" required name="store_category" defaultValue={store.store_category}>
                        <option>Kirana Store</option>
                        <option>Stationery Shop</option>
                        <option>General Retail</option>
                        <option>Pharmacy</option>
                        <option>Supermarket</option>
                        <option>Electronics</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div style={{ marginTop: "24px" }}>
                      <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%" }}>
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Toast */}
      {notice && (
        <div className="toast-container">
          <div className={`toast ${notice.type === "error" ? "toast-error" : ""}`}>
            {notice.type === "success"
              ? <CheckCircle2 size={20} style={{ color: "var(--success)", flexShrink: 0 }} />
              : <AlertCircle  size={20} style={{ color: "var(--danger)",  flexShrink: 0 }} />
            }
            <div>
              <strong style={{ display: "block", fontSize: "0.875rem" }}>
                {notice.type === "success" ? "Success" : "Error"}
              </strong>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{notice.message}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
