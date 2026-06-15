import React from "react";
import {
  LayoutDashboard, Receipt, Package, Hexagon,
  History as HistoryIcon, Settings, Users, Truck, Tag,
} from "lucide-react";

function NavItem({ icon: Icon, label, isActive, onClick }) {
  return (
    <button className={`nav-item ${isActive ? "active" : ""}`} onClick={onClick}>
      <Icon className="nav-icon" />
      <span>{label}</span>
    </button>
  );
}

export default function Sidebar({ activeTab, setActiveTab, store, isSidebarOpen, setIsSidebarOpen, getInitials, setSelectedCustomer }) {
  function nav(tab) {
    setActiveTab(tab);
    setIsSidebarOpen(false);
    if (tab !== "customers") return;
    setSelectedCustomer(null);
  }

  return (
    <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
      <div className="sidebar-header">
        <div className="brand" onClick={() => nav("dashboard")} style={{ cursor: "pointer" }}>
          <div className="brand-icon">
            {store?.logo_data_url ? (
              <img src={store.logo_data_url} alt="Logo" />
            ) : (
              <Hexagon size={18} strokeWidth={3} />
            )}
          </div>
          <span>Hisaab</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavItem icon={LayoutDashboard} label="Dashboard" isActive={activeTab === "dashboard"} onClick={() => nav("dashboard")} />
        <NavItem icon={Receipt}         label="Billing"   isActive={activeTab === "billing"}   onClick={() => nav("billing")} />
        <NavItem icon={Package}         label="Products"  isActive={activeTab === "products"}  onClick={() => nav("products")} />
        <NavItem icon={Users}           label="Customers" isActive={activeTab === "customers"} onClick={() => nav("customers")} />
        <NavItem icon={Truck}           label="Purchases" isActive={activeTab === "purchases"} onClick={() => nav("purchases")} />
        <NavItem icon={HistoryIcon}     label="History"   isActive={activeTab === "history"}   onClick={() => nav("history")} />
        <NavItem icon={Settings}        label="Settings"  isActive={activeTab === "settings"}  onClick={() => nav("settings")} />
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-store-card">
          <div className="sidebar-avatar">
            {store.logo_data_url ? (
              <img src={store.logo_data_url} alt="Logo" />
            ) : (
              <Hexagon size={18} strokeWidth={3} />
            )}
          </div>
          <div className="sidebar-store-info">
            <strong>{store.store_name}</strong>
            <small>{store.store_category}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}