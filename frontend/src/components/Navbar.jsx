import React from "react";
import {
  Bell, Search, Settings, LogOut, Menu, ArrowRight, AlertCircle,
  Receipt, Package, CreditCard,
} from "lucide-react";

const activityConfig = {
  bill:    { bg: "#dbeafe", color: "#2563eb", icon: Receipt },
  stock:   { bg: "#fef3c7", color: "#d97706", icon: Package },
  payment: { bg: "#d1fae5", color: "#059669", icon: CreditCard },
  alert:   { bg: "#fee2e2", color: "#dc2626", icon: AlertCircle },
};

const mockActivityFeed = [
  { id: 1, type: "bill",    title: "Bill #1042 created",       time: "10 mins ago" },
  { id: 2, type: "stock",   title: "Stock updated: Parle-G",   time: "1 hour ago" },
  { id: 3, type: "payment", title: "Payment received ₹450",    time: "2 hours ago" },
  { id: 4, type: "alert",   title: "Low stock: Amul Butter",   time: "3 hours ago" },
];

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
}) {
  const notifCount = lowStockList.length;

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button className="icon-btn hamburger-btn" onClick={() => setIsSidebarOpen(true)}>
          <Menu size={20} />
        </button>
        <div className="store-info">
          <span className="store-name">{store.store_name}</span>
          <span className="store-meta">{store.store_category}</span>
        </div>
      </div>

      <div className="navbar-search">
        <Search className="icon" />
        <input
          placeholder="Search products or bills…"
          value={
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
          }}
        />
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
              <div className="notif-header">
                <strong>Notifications</strong>
                {notifCount > 0 && <span className="badge badge-danger">{notifCount} alerts</span>}
              </div>

              {lowStockList.length > 0 && (
                <div className="notif-section">
                  <div className="notif-section-title">⚠️ Stock Alerts</div>
                  {lowStockList.slice(0, 5).map((item) => (
                    <div key={item.id} className="notif-item">
                      <div className="notif-item-icon" style={{ background: "#fee2e2", color: "#dc2626" }}>
                        <AlertCircle size={14} />
                      </div>
                      <div className="notif-item-content">
                        <div className="notif-item-title">{item.name}</div>
                        <div className="notif-item-sub">
                          {item.stock === 0 ? "Out of stock" : `Only ${item.stock} left`}
                        </div>
                      </div>
                      <span className={`badge ${item.stock === 0 ? "badge-danger" : "badge-warning"}`}>
                        {item.stock === 0 ? "Critical" : "Low"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="notif-section">
                <div className="notif-section-title">🕐 Recent Activity</div>
                {mockActivityFeed.map((activity) => {
                  const cfg = activityConfig[activity.type] || activityConfig.bill;
                  return (
                    <div key={activity.id} className="notif-item">
                      <div className="notif-item-icon" style={{ background: cfg.bg, color: cfg.color }}>
                        <cfg.icon size={14} />
                      </div>
                      <div className="notif-item-content">
                        <div className="notif-item-title">{activity.title}</div>
                        <div className="notif-item-sub">{activity.time}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {lowStockList.length > 0 && (
                <div className="notif-footer">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setActiveTab("products"); setIsNotifOpen(false); }}>
                    View all stock alerts <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile dropdown */}
        <div className="profile-dropdown-wrapper" ref={profileRef}>
          <button className="avatar-btn" onClick={() => setIsProfileOpen(!isProfileOpen)}>
            {getInitials(store.owner_name)}
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
              <button className="dropdown-item text-danger">
                <LogOut className="icon" /><span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
