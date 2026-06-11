import re

with open("/Users/jansidoshi/POS/frontend/src/main.jsx", "r") as f:
    content = f.read()

# 1. Imports
content = content.replace(
    "} from \"lucide-react\";",
    "  Users, Truck, FileText, Download, ChevronLeft, IndianRupee, Phone, Mail, MapPin,\n} from \"lucide-react\";"
)

# 2. State
state_search = '  const [isSidebarOpen,  setIsSidebarOpen]  = useState(false);'
state_replace = state_search + '''

  const [customers,        setCustomers]        = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomer,  setEditingCustomer]  = useState(null);
  const [customerQuery,    setCustomerQuery]    = useState("");
  const [customerUdhaar,   setCustomerUdhaar]   = useState([]);
  const [purchases,        setPurchases]        = useState([]);
  const [editingPurchase,  setEditingPurchase]  = useState(null);
  const [purchaseQuery,    setPurchaseQuery]    = useState("");
  const [billCustomerId,   setBillCustomerId]   = useState("");
  const [udhaarForm,       setUdhaarForm]       = useState(null);'''
content = content.replace(state_search, state_replace)

# 3. Refresh
refresh_search = '''  async function refresh() {
    const [storeData, productData, salesData, dashboardData] = await Promise.all([
      api("/store"),
      api("/products"),
      api("/sales"),
      api("/dashboard"),
    ]);
    setStore(storeData);
    setProducts(productData);
    setSales(salesData);
    setDashboard(dashboardData);
  }'''
refresh_replace = '''  async function refresh() {
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
  }'''
content = content.replace(refresh_search, refresh_replace)

# 4. Filter lists
filter_search = '''  const filteredSales = useMemo(() => {
    const q = historyQuery.toLowerCase();
    return sales.filter((s) =>
      `${s.bill_number} ${s.created_at} ${s.items.map((i) => i.name).join(" ")}`.toLowerCase().includes(q),
    );
  }, [sales, historyQuery]);'''
filter_replace = filter_search + '''

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
  }, [purchases, purchaseQuery]);'''
content = content.replace(filter_search, filter_replace)

# 5. completeSale
complete_sale_search = '''  async function completeSale() {
    if (cart.length === 0) return;
    try {
      const sale = await api("/sales", { method: "POST", body: JSON.stringify(cart) });
      setCart([]);
      showNotice(`${sale.bill_number} generated for ${fmt(sale.total_amount)}`, "success");
      await refresh();
    } catch (err) { showNotice(err.message, "error"); }
  }'''
complete_sale_replace = '''  async function completeSale() {
    if (cart.length === 0) return;
    try {
      const sale = await api(`/sales${billCustomerId ? `?customer_id=${billCustomerId}` : ""}`, { method: "POST", body: JSON.stringify(cart) });
      setCart([]);
      setBillCustomerId("");
      showNotice(`${sale.bill_number} generated for ${fmt(sale.total_amount)}`, "success");
      await refresh();
    } catch (err) { showNotice(err.message, "error"); }
  }'''
content = content.replace(complete_sale_search, complete_sale_replace)

# 6. Helpers
helpers_search = '  async function toggleScanner() {'
helpers_replace = '''  async function saveCustomer(e) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const payload = { name: raw.name, phone: raw.phone, email: raw.email || null, address: raw.address || null };
    const path = editingCustomer?.id ? `/customers/${editingCustomer.id}` : "/customers";
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

  async function downloadInvoice(saleId, billNumber) {
    try {
      const response = await fetch(`${API_URL}/invoices/${saleId}/pdf`);
      if (!response.ok) throw new Error("Failed to generate invoice");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${billNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showNotice(`Invoice ${billNumber} downloaded`);
    } catch (err) { showNotice(err.message, "error"); }
  }

  function printInvoice(saleId) {
    const url = `${API_URL}/invoices/${saleId}/pdf`;
    const win = window.open(url, "_blank");
    if (win) win.print();
  }

  async function toggleScanner() {'''
content = content.replace(helpers_search, helpers_replace)

# 7. Sidebar
sidebar_search = '''          <NavItem icon={Package}         label="Products"  isActive={activeTab === "products"}  onClick={() => { setActiveTab("products");  setIsSidebarOpen(false); }} />

          <NavItem icon={HistoryIcon}     label="History"   isActive={activeTab === "history"}   onClick={() => { setActiveTab("history");   setIsSidebarOpen(false); }} />'''
sidebar_replace = '''          <NavItem icon={Package}         label="Products"  isActive={activeTab === "products"}  onClick={() => { setActiveTab("products");  setIsSidebarOpen(false); }} />
          <NavItem icon={Users}           label="Customers" isActive={activeTab === "customers"} onClick={() => { setActiveTab("customers"); setSelectedCustomer(null); setIsSidebarOpen(false); }} />
          <NavItem icon={Truck}           label="Purchases" isActive={activeTab === "purchases"} onClick={() => { setActiveTab("purchases"); setIsSidebarOpen(false); }} />
          <NavItem icon={HistoryIcon}     label="History"   isActive={activeTab === "history"}   onClick={() => { setActiveTab("history");   setIsSidebarOpen(false); }} />'''
content = content.replace(sidebar_search, sidebar_replace)

# 8. Navbar search
nav_search = '''              value={
                activeTab === "billing" || activeTab === "products"
                  ? productQuery
                  : activeTab === "history" ? historyQuery : ""
              }
              onChange={(e) => {
                const v = e.target.value;
                if (activeTab === "history") setHistoryQuery(v); else setProductQuery(v);
              }}'''
nav_replace = '''              value={
                activeTab === "billing" || activeTab === "products"
                  ? productQuery
                  : activeTab === "history" ? historyQuery
                  : activeTab === "customers" ? customerQuery
                  : activeTab === "purchases" ? purchaseQuery
                  : ""
              }
              onChange={(e) => {
                const v = e.target.value;
                if (activeTab === "history") setHistoryQuery(v);
                else if (activeTab === "customers") setCustomerQuery(v);
                else if (activeTab === "purchases") setPurchaseQuery(v);
                else setProductQuery(v);
              }}'''
content = content.replace(nav_search, nav_replace)

# 9. Dashboard widgets
dash_search = '''                  <div className="card border-warning">'''
dash_replace = '''                  {/* Recent Purchases */}
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">Recent Purchases</h3>
                      <Truck size={16} color="var(--text-tertiary)" />
                    </div>
                    <div className="card-body">
                      {(dashboard.recent_purchases || []).length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          {(dashboard.recent_purchases || []).slice(0, 4).map((p) => (
                            <div className="purchase-item" key={p.id}>
                              <div className="purchase-icon"><Truck size={15} /></div>
                              <div className="purchase-info">
                                <strong>{p.product_name}</strong>
                                <small>{p.supplier_name} · {p.quantity} units</small>
                              </div>
                              <div className="purchase-cost">{fmt(p.total_cost)}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state" style={{ padding: "24px 0" }}>
                          <Truck size={28} style={{ color: "var(--text-tertiary)", marginBottom: "8px" }} />
                          <span className="empty-text" style={{ fontSize: "0.8125rem" }}>No purchases yet</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recent Udhaar Activity */}
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">Recent Udhaar</h3>
                      <IndianRupee size={16} color="var(--text-tertiary)" />
                    </div>
                    <div className="card-body">
                      {(dashboard.recent_udhaar || []).length > 0 ? (
                        <div className="activity-feed">
                          {(dashboard.recent_udhaar || []).slice(0, 4).map((u) => {
                            const isCredit = u.type === "credit";
                            return (
                              <div className="activity-item" key={u.id}>
                                <div className="activity-icon" style={{ background: isCredit ? "var(--warning-soft)" : "var(--success-soft)", color: isCredit ? "#d97706" : "#059669" }}>
                                  {isCredit ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                                </div>
                                <div className="activity-content">
                                  <div className="activity-title">{u.customer_name}: {isCredit ? "Credit" : "Payment"} {fmt(u.amount)}</div>
                                  <div className="activity-time">{new Date(u.created_at).toLocaleDateString("en-IN")}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="empty-state" style={{ padding: "24px 0" }}>
                          <IndianRupee size={28} style={{ color: "var(--text-tertiary)", marginBottom: "8px" }} />
                          <span className="empty-text" style={{ fontSize: "0.8125rem" }}>No udhaar activity</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card border-warning">'''
content = content.replace(dash_search, dash_replace)

# 10. KPI Dashboard replacement
kpi_search = '''                <KpiCard
                  title="Outstanding Udhaar" icon={Wallet}
                  value={fmt(4500)}
                  trend="down" trendValue="5 customers" colorClass="kpi-icon-warning"
                  sub="Collection pending"
                />'''
kpi_replace = '''                <KpiCard
                  title="Outstanding Udhaar" icon={Wallet}
                  value={fmt(safeNum(dashboard.total_udhaar_outstanding))}
                  trend={safeNum(dashboard.total_udhaar_outstanding) > 0 ? "down" : "neutral"}
                  trendValue={`${safeNum(dashboard.total_customers)} customers`}
                  colorClass="kpi-icon-warning"
                  sub="Collection pending"
                />'''
content = content.replace(kpi_search, kpi_replace)

# Quick actions replace
qac_search = '''                        <button className="action-btn" onClick={() => showNotice("Customer feature coming soon")}>
                          <UserPlus size={22} color="var(--brand-primary)" /> Add Customer
                        </button>'''
qac_replace = '''                        <button className="action-btn" onClick={() => { setEditingCustomer({}); setActiveTab("customers"); }}>
                          <UserPlus size={22} color="var(--brand-primary)" /> Add Customer
                        </button>'''
content = content.replace(qac_search, qac_replace)

# 11. Cart sidebar customer selector
cart_search = '''                <div className="cart-header">
                  <span className="cart-title">Current Bill</span>
                  <span className="badge badge-neutral">{cartTotals.items} Items</span>
                </div>

                <div className="cart-items">'''
cart_replace = '''                <div className="cart-header">
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

                <div className="cart-items">'''
content = content.replace(cart_search, cart_replace)

# 12. History table PDF buttons
hist_th_search = '''                          <th>Items</th>
                          <th style={{ textAlign: "right" }}>Total Amount</th>
                        </tr>'''
hist_th_replace = '''                          <th>Items</th>
                          <th style={{ textAlign: "right" }}>Total Amount</th>
                          <th style={{ textAlign: "right" }}>Invoice</th>
                        </tr>'''
content = content.replace(hist_th_search, hist_th_replace)

hist_td_search = '''                            <td style={{ textAlign: "right", fontSize: "1.0625rem", fontWeight: "600" }}>
                              {fmt(sale.total_amount)}
                            </td>
                          </tr>'''
hist_td_replace = '''                            <td style={{ textAlign: "right", fontSize: "1.0625rem", fontWeight: "600" }}>
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
                          </tr>'''
content = content.replace(hist_td_search, hist_td_replace)

# 13 & 14. Customers and Purchases pages
pages_search = '''          {/* ================================================================
              HISTORY
          ================================================================ */}'''
pages_replace = '''          {/* ================================================================
              CUSTOMERS
          ================================================================ */}
          {activeTab === "customers" && (
            <div className="fade-in">
              {selectedCustomer ? (
                /* ── Customer Detail View ─── */
                <div>
                  <button className="detail-back-btn" onClick={() => { setSelectedCustomer(null); setUdhaarForm(null); }}>
                    <ChevronLeft size={16} /> Back to Customers
                  </button>

                  <div className="customer-detail-header">
                    <div className="customer-avatar-lg">{getInitials(selectedCustomer.name)}</div>
                    <div className="customer-detail-info">
                      <h2>{selectedCustomer.name}</h2>
                      <div className="customer-detail-meta">
                        <span><Phone size={13} /> {selectedCustomer.phone}</span>
                        {selectedCustomer.email && <span><Mail size={13} /> {selectedCustomer.email}</span>}
                        {selectedCustomer.address && <span><MapPin size={13} /> {selectedCustomer.address}</span>}
                      </div>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingCustomer(selectedCustomer)}><Edit2 size={14} /> Edit</button>
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => deleteCustomer(selectedCustomer.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>

                  {/* Udhaar Summary */}
                  <div className="udhaar-summary-grid">
                    <div className="udhaar-summary-card card-credit">
                      <div className="udhaar-summary-label">Total Credit</div>
                      <div className="udhaar-summary-value">{fmt(safeNum(selectedCustomer.total_credit))}</div>
                    </div>
                    <div className="udhaar-summary-card card-payment">
                      <div className="udhaar-summary-label">Total Paid</div>
                      <div className="udhaar-summary-value">{fmt(safeNum(selectedCustomer.total_paid))}</div>
                    </div>
                    <div className={`udhaar-summary-card card-balance ${safeNum(selectedCustomer.outstanding_balance) === 0 ? "zero" : ""}`}>
                      <div className="udhaar-summary-label">Outstanding</div>
                      <div className="udhaar-summary-value">{fmt(safeNum(selectedCustomer.outstanding_balance))}</div>
                    </div>
                  </div>

                  {/* Udhaar Actions */}
                  <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setUdhaarForm(udhaarForm === "credit" ? null : "credit")}>
                      <Plus size={14} /> Add Credit
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => setUdhaarForm(udhaarForm === "payment" ? null : "payment")}>
                      <IndianRupee size={14} /> Record Payment
                    </button>
                  </div>

                  {/* Udhaar Form */}
                  {udhaarForm && (
                    <div className="card" style={{ marginBottom: "20px" }}>
                      <div className="card-header">
                        <h3 className="card-title">{udhaarForm === "credit" ? "Add Credit Entry" : "Record Payment"}</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => setUdhaarForm(null)}>Cancel</button>
                      </div>
                      <div className="card-body">
                        <form onSubmit={saveUdhaarEntry}>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Amount (₹)</label>
                              <input className="form-input" required type="number" min="1" step="0.01" name="amount" />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Note (optional)</label>
                              <input className="form-input" name="note" placeholder="e.g., Monthly groceries" />
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setUdhaarForm(null)}>Cancel</button>
                            <button type="submit" className="btn btn-primary">
                              {udhaarForm === "credit" ? "Add Credit" : "Record Payment"}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Edit Customer Form (inline) */}
                  {editingCustomer && editingCustomer.id === selectedCustomer.id && (
                    <div className="card" style={{ marginBottom: "20px" }}>
                      <div className="card-header">
                        <h3 className="card-title">Edit Customer</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingCustomer(null)}>Cancel</button>
                      </div>
                      <div className="card-body">
                        <form onSubmit={async (e) => { await saveCustomer(e); await loadCustomerDetail(selectedCustomer.id); }}>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Name</label>
                              <input className="form-input" required name="name" defaultValue={editingCustomer.name} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Phone</label>
                              <input className="form-input" required name="phone" defaultValue={editingCustomer.phone} />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Email</label>
                              <input className="form-input" name="email" defaultValue={editingCustomer.email || ""} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Address</label>
                              <input className="form-input" name="address" defaultValue={editingCustomer.address || ""} />
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setEditingCustomer(null)}>Cancel</button>
                            <button type="submit" className="btn btn-primary">Save Customer</button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Udhaar Ledger */}
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">Udhaar Ledger</h3>
                      <span className="badge badge-neutral">{customerUdhaar.length} entries</span>
                    </div>
                    {customerUdhaar.length > 0 ? (
                      <div>
                        {customerUdhaar.map((entry) => (
                          <div className="udhaar-row" key={entry.id}>
                            <div className={`udhaar-type-icon ${entry.type}`}>
                              {entry.type === "credit" ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            </div>
                            <div className="udhaar-info">
                              <strong>{entry.type === "credit" ? "Credit Given" : "Payment Received"}</strong>
                              <small>{entry.note || "—"} · {new Date(entry.created_at).toLocaleDateString("en-IN")}</small>
                            </div>
                            <div>
                              <div className={`udhaar-amount ${entry.type}`}>
                                {entry.type === "credit" ? "+" : "−"}{fmt(entry.amount)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={<IndianRupee size={40} />}
                        title="No udhaar entries"
                        desc="Add credit or record payments to see the ledger."
                      />
                    )}
                  </div>
                </div>
              ) : (
                /* ── Customer List View ─── */
                <div>
                  <div className="page-header">
                    <h2 className="page-title">Customers</h2>
                    <button className="btn btn-primary" onClick={() => setEditingCustomer({})}>
                      <Plus size={18} /> Add Customer
                    </button>
                  </div>

                  {editingCustomer && !editingCustomer.id && (
                    <div className="card" style={{ marginBottom: "24px" }}>
                      <div className="card-header">
                        <h3 className="card-title">New Customer</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingCustomer(null)}>Cancel</button>
                      </div>
                      <div className="card-body">
                        <form onSubmit={saveCustomer}>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Customer Name</label>
                              <input className="form-input" required name="name" />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Phone Number</label>
                              <input className="form-input" required name="phone" />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Email (optional)</label>
                              <input className="form-input" name="email" type="email" />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Address (optional)</label>
                              <input className="form-input" name="address" />
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setEditingCustomer(null)}>Cancel</button>
                            <button type="submit" className="btn btn-primary">Save Customer</button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  <div className="card">
                    {filteredCustomers.length > 0 ? (
                      <div className="table-container">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Customer</th>
                              <th>Phone</th>
                              <th>Email</th>
                              <th>Outstanding</th>
                              <th style={{ textAlign: "right" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredCustomers.map((customer) => (
                              <tr key={customer.id} style={{ cursor: "pointer" }} onClick={() => loadCustomerDetail(customer.id)}>
                                <td>
                                  <div className="td-product">
                                    <div className="product-icon"><Users size={20} /></div>
                                    <div className="product-details">
                                      <strong>{customer.name}</strong>
                                      <small>Since {new Date(customer.created_at).toLocaleDateString("en-IN")}</small>
                                    </div>
                                  </div>
                                </td>
                                <td>{customer.phone}</td>
                                <td>{customer.email || "—"}</td>
                                <td>
                                  <span className={`badge ${(customer.outstanding_balance || 0) > 0 ? "badge-danger" : "badge-success"}`}>
                                    {fmt(customer.outstanding_balance || 0)}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEditingCustomer(customer); }}><Edit2 size={16} /></button>
                                    <button className="btn btn-ghost btn-sm text-danger" onClick={(e) => { e.stopPropagation(); deleteCustomer(customer.id); }}><Trash2 size={16} /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState
                        icon={<Users size={48} />}
                        title="No customers yet"
                        desc="Add your first customer to start tracking credit."
                        action={{ label: "Add Customer", onClick: () => setEditingCustomer({}) }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              PURCHASES
          ================================================================ */}
          {activeTab === "purchases" && (
            <div className="fade-in">
              <div className="page-header">
                <h2 className="page-title">Purchases</h2>
                <button className="btn btn-primary" onClick={() => setEditingPurchase({})}>
                  <Plus size={18} /> Record Purchase
                </button>
              </div>

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
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                            ))}
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
                          <th>Product</th>
                          <th>Supplier</th>
                          <th>Qty</th>
                          <th>Cost/Unit</th>
                          <th>Total</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPurchases.map((purchase) => (
                          <tr key={purchase.id}>
                            <td>
                              <div className="td-product">
                                <div className="product-icon"><Truck size={20} /></div>
                                <div className="product-details">
                                  <strong>{purchase.product_name}</strong>
                                </div>
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
                  <EmptyState
                    icon={<Truck size={48} />}
                    title="No purchases yet"
                    desc="Record your first stock purchase to track restocking."
                    action={{ label: "Record Purchase", onClick: () => setEditingPurchase({}) }}
                  />
                )}
              </div>
            </div>
          )}

          {/* ================================================================
              HISTORY
          ================================================================ */}'''
content = content.replace(pages_search, pages_replace)

with open("/Users/jansidoshi/POS/frontend/src/main.jsx", "w") as f:
    f.write(content)

print("Patch applied to main.jsx")
