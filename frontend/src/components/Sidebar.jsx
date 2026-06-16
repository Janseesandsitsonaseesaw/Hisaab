import React from "react";
import {
  LayoutDashboard, Receipt, Package, Hexagon,
  History as HistoryIcon, Settings, Users, Truck, Tag,
  ChevronLeft, ChevronRight,
} from "lucide-react";

function NavItem({ icon: Icon, label, isActive, onClick, isCollapsed }) {
  return (
    <button 
      className={`nav-item ${isActive ? "active" : ""}`} 
      onClick={onClick}
      data-tooltip={isCollapsed ? label : undefined}
    >
      <Icon className="nav-icon" />
      <span>{label}</span>
    </button>
  );
}

export default function Sidebar({ activeTab, setActiveTab, store, isSidebarOpen, setIsSidebarOpen, getInitials, setSelectedCustomer, isCollapsed, setIsCollapsed }) {
  function nav(tab) {
    setActiveTab(tab);
    setIsSidebarOpen(false);
    if (tab !== "customers") return;
    setSelectedCustomer(null);
  }

  return (
    <aside className={`sidebar ${isSidebarOpen ? "open" : ""} ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
        <div className="brand" onClick={() => nav("dashboard")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="brand-icon" style={{ flexShrink: 0 }}>
            {store?.logo_data_url ? (
              <img src={store.logo_data_url} alt="Logo" />
            ) : (
              <Hexagon size={18} strokeWidth={3} />
            )}
          </div>
          <span>Hisaab</span>
        </div>
        <button 
          type="button"
          className="sidebar-toggle-btn" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          style={{ marginLeft: isCollapsed ? "0" : "8px" }}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        <NavItem icon={LayoutDashboard} label="Dashboard" isActive={activeTab === "dashboard"} onClick={() => nav("dashboard")} isCollapsed={isCollapsed} />
        <NavItem icon={Receipt}         label="Billing"   isActive={activeTab === "billing"}   onClick={() => nav("billing")} isCollapsed={isCollapsed} />
        <NavItem icon={Package}         label="Products"  isActive={activeTab === "products"}  onClick={() => nav("products")} isCollapsed={isCollapsed} />
        <NavItem icon={Users}           label="Customers" isActive={activeTab === "customers"} onClick={() => nav("customers")} isCollapsed={isCollapsed} />
        <NavItem icon={Truck}           label="Purchases" isActive={activeTab === "purchases"} onClick={() => nav("purchases")} isCollapsed={isCollapsed} />
        <NavItem icon={HistoryIcon}     label="History"   isActive={activeTab === "history"}   onClick={() => nav("history")} isCollapsed={isCollapsed} />
        <NavItem icon={Settings}        label="Settings"  isActive={activeTab === "settings"}  onClick={() => nav("settings")} isCollapsed={isCollapsed} />
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-store-card">
          <div className="sidebar-avatar" style={{ flexShrink: 0 }}>
            {store?.logo_data_url ? (
              <img src={store.logo_data_url} alt="Logo" />
            ) : (
              <Hexagon size={18} strokeWidth={3} />
            )}
          </div>
          <div className="sidebar-store-info">
            <strong>{store?.store_name || "Store"}</strong>
            <small>{store?.store_category || "Retail"}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}