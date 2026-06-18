import React, { useState } from "react";
import {
  Bell, Search, Settings, LogOut, Menu, ArrowRight, AlertCircle,
  Receipt, Package, CreditCard, X, Wallet, Truck, Info,
} from "lucide-react";

const activityConfig = {
  bill:    { bg: "#dbeafe", color: "#2563eb", icon: Receipt },
  stock:   { bg: "#fef3c7", color: "#d97706", icon: Package },
  payment: { bg: "#d1fae5", color: "#059669", icon: CreditCard },
  alert:   { bg: "#fee2e2", color: "#dc2626", icon: AlertCircle },
  udhaar:  { bg: "#ffedd5", color: "#ea580c", icon: Wallet },
};

export default function Navbar({
  store, activeTab, setActiveTab,
  productQuery, setProductQuery,
  historyQuery, setHistoryQuery,
  customerQuery, setCustomerQuery,
  purchaseQuery, setPurchaseQuery,
  lowStockList,
  isNotifOpen, setIsNotifOpen, notifRef,
  isProfileOpen, setIsProfileOpen, profileRef,
  setIsSidebarOpen,
  getInitials,
  handleLogout,
  products = [],
  customers = [],
  sales = [],
  notifications = [],
  readNotifIds = [],
  markNotifRead,
  markAllNotifsRead,
}) {
  const [globalQuery, setGlobalQuery] = useState("");

  const unreadNotifications = notifications.filter(n => !readNotifIds.includes(n.id));
  const notifCount = unreadNotifications.length;

  // Global Search Filtering
  const cleanQuery = globalQuery.trim().toLowerCase();
  const searchProducts = cleanQuery
    ? products.filter(p => p.name.toLowerCase().includes(cleanQuery) || p.barcode?.includes(cleanQuery) || p.category.toLowerCase().includes(cleanQuery))
    : [];
  const searchCustomers = cleanQuery
    ? customers.filter(c => c.name.toLowerCase().includes(cleanQuery) || c.phone?.includes(cleanQuery))
    : [];
  const searchSales = cleanQuery
    ? sales.filter(s => s.bill_number.toLowerCase().includes(cleanQuery))
    : [];

  const hasSearchResults = searchProducts.length > 0 || searchCustomers.length > 0 || searchSales.length > 0;

  const handleNotificationClick = (n) => {
    markNotifRead(n.id);
    if (n.tab === "products") setProductQuery(n.query);
    else if (n.tab === "history") setHistoryQuery(n.query);
    else if (n.tab === "customers") setCustomerQuery(n.query);
    else if (n.tab === "purchases") setPurchaseQuery(n.query);
    setActiveTab(n.tab);
    setIsNotifOpen(false);
  };

  return (
    <header className="navbar" style={{ position: "relative" }}>
      <div className="navbar-left">
        <button className="icon-btn hamburger-btn" onClick={() => setIsSidebarOpen(true)}>
          <Menu size={20} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingLeft: "12px" }}>
          <div style={{ fontSize: "1.5rem", display: "flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", borderRadius: "50%", background: "var(--bg-tertiary)" }}>
            👋
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>Greetings!</h2>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-tertiary)" }}>Start your day with {(store.owner_name || "").split(" ")[0].toUpperCase()}</p>
          </div>
        </div>
      </div>

      <div className="navbar-search" style={{ position: "relative" }}>
        <Search className="icon" />
        <input
          placeholder="Global Search (products, customers, bills)…"
          value={globalQuery}
          onChange={(e) => setGlobalQuery(e.target.value)}
        />
        {globalQuery && (
          <button
            onClick={() => setGlobalQuery("")}
            style={{
              position: "absolute",
              right: "10px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-tertiary)",
              display: "flex",
              alignItems: "center"
            }}
          >
            <X size={15} />
          </button>
        )}

        {/* Global Search Dropdown */}
        {globalQuery && (
          <div className="search-results-dropdown" style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            zIndex: 999,
            maxHeight: "350px",
            overflowY: "auto",
            marginTop: "6px",
            padding: "8px"
          }}>
            {searchProducts.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-tertiary)", padding: "4px 8px", borderBottom: "1px solid var(--border-color)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Products</div>
                {searchProducts.slice(0, 4).map(p => (
                  <div key={p.id} className="search-result-item" onClick={() => {
                    setProductQuery(p.name);
                    setActiveTab("products");
                    setGlobalQuery("");
                  }} style={{ padding: "8px", borderRadius: "8px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>{p.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{p.category} · Stock: {p.stock}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: "var(--brand-primary)", fontSize: "13px" }}>₹{p.selling_price}</div>
                  </div>
                ))}
              </div>
            )}

            {searchCustomers.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-tertiary)", padding: "4px 8px", borderBottom: "1px solid var(--border-color)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Customers</div>
                {searchCustomers.slice(0, 4).map(c => (
                  <div key={c.id} className="search-result-item" onClick={() => {
                    setCustomerQuery(c.name);
                    setActiveTab("customers");
                    setGlobalQuery("");
                  }} style={{ padding: "8px", borderRadius: "8px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>{c.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Phone: {c.phone}</div>
                    </div>
                    {c.outstanding_balance > 0 && (
                      <div style={{ fontSize: "12px", color: "var(--warning)", fontWeight: 600 }}>Due: ₹{c.outstanding_balance}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {searchSales.length > 0 && (
              <div style={{ marginBottom: "4px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-tertiary)", padding: "4px 8px", borderBottom: "1px solid var(--border-color)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Bills</div>
                {searchSales.slice(0, 4).map(s => (
                  <div key={s.id} className="search-result-item" onClick={() => {
                    setHistoryQuery(s.bill_number);
                    setActiveTab("history");
                    setGlobalQuery("");
                  }} style={{ padding: "8px", borderRadius: "8px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>{s.bill_number}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{new Date(s.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: "var(--success)", fontSize: "13px" }}>₹{s.total_amount}</div>
                  </div>
                ))}
              </div>
            )}

            {!hasSearchResults && (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--text-secondary)", fontSize: "13px" }}>
                No results found for "{globalQuery}"
              </div>
            )}
          </div>
        )}
      </div>

      <div className="navbar-right">
        {/* Notification bell */}
        <div className="notif-wrapper" ref={notifRef}>
          <button className="icon-btn notif-btn" onClick={() => setIsNotifOpen(!isNotifOpen)}>
            <Bell size={20} />
            {notifCount > 0 && (
              <span className="notif-badge">{notifCount > 9 ? "9+" : notifCount}</span>
            )}
          </button>

          {isNotifOpen && (
            <div className="notif-dropdown">
              <div className="notif-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>Notifications</strong>
                <div style={{ display: "flex", gap: "6px" }}>
                  {notifCount > 0 && (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: "11px", padding: "2px 6px" }} onClick={() => markAllNotifsRead(notifications)}>
                      Mark all read
                    </button>
                  )}
                  {notifCount > 0 && <span className="badge badge-danger">{notifCount} unread</span>}
                </div>
              </div>

              {notifications.length > 0 ? (
                <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {notifications.slice(0, 15).map((n) => {
                    const isRead = readNotifIds.includes(n.id);
                    const cfg = activityConfig[n.type] || activityConfig.alert;
                    return (
                      <div
                        key={n.id}
                        className={`notif-item ${isRead ? "read" : "unread"}`}
                        onClick={() => handleNotificationClick(n)}
                        style={{
                          opacity: isRead ? 0.65 : 1,
                          backgroundColor: isRead ? "transparent" : "var(--brand-primary-soft)",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                      >
                        <div className="notif-item-icon" style={{ background: cfg.bg, color: cfg.color }}>
                          <cfg.icon size={14} />
                        </div>
                        <div className="notif-item-content">
                          <div className="notif-item-title" style={{ fontWeight: isRead ? 500 : 700 }}>{n.title}</div>
                          <div className="notif-item-sub">{n.sub}</div>
                          <div className="notif-item-time" style={{ fontSize: "10px", marginTop: "2px", color: "var(--text-tertiary)" }}>{n.time}</div>
                        </div>
                        {!isRead && (
                          <span className="notif-dot" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--brand-primary)", alignSelf: "center", flexShrink: 0 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "13px" }}>
                  No notifications yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile dropdown */}
        <div className="profile-dropdown-wrapper" ref={profileRef}>
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            style={{ border: "none", cursor: "pointer", width: "auto", padding: "6px 14px 6px 6px", borderRadius: "30px", background: "#222", color: "white", display: "flex", alignItems: "center", gap: "10px", transition: "all 0.2s" }}
          >
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "white", color: "#222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700 }}>
              {getInitials(store.owner_name)}
            </div>
            <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>My account</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>

          {isProfileOpen && (
            <div className="profile-dropdown">
              <div className="profile-header">
                <div className="profile-header-avatar">{getInitials(store.owner_name)}</div>
                <div>
                  <strong>{store.owner_name}</strong>
                  <span>{store.store_name}</span>
                  <span className="profile-meta">{store.store_category} · {store.phone}</span>
                </div>
              </div>
              <button className="dropdown-item" onClick={() => { setActiveTab("settings"); setIsProfileOpen(false); }}>
                <Settings className="icon" /><span>Store Settings</span>
              </button>
              <button className="dropdown-item text-danger" onClick={() => { setIsProfileOpen(false); handleLogout(); }}>
                <LogOut className="icon" /><span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}