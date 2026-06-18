import React from "react";
import {
  Receipt, Package, TrendingUp, CalendarDays, ShoppingCart, BarChart2,
  AlertCircle, Wallet, Plus, RefreshCw, ArrowRight, Truck,
  CheckCircle2, ArrowUpRight, ArrowDownRight, CreditCard, Info
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import StatCard from "../components/StatCard";
import AskHisaabAI from "../components/AskHisaabAI";
import { fmt, safeNum } from "../services/api";

const DONUT_COLORS = ["var(--brand-primary)", "#222222", "var(--border-color)"];

const activityConfig = {
  bill:    { bg: "#EAF5FF", color: "var(--brand-primary)", icon: Receipt },
  stock:   { bg: "#F3F4F6", color: "#111827", icon: Package },
  payment: { bg: "#e0f2e9", color: "var(--success)", icon: CreditCard },
  alert:   { bg: "#fee2e2", color: "var(--danger)", icon: AlertCircle },
  udhaar:  { bg: "#ffedd5", color: "#ea580c", icon: Wallet },
};

function getStockSeverity(stock) {
  if (stock === 0) return { label: "Critical", cls: "badge-danger" };
  if (stock <= 5)  return { label: "High",     cls: "badge-danger" };
  return                  { label: "Low",      cls: "badge-warning" };
}

export default function Dashboard({ store, dashboard, sales, dashboardLoading, setActiveTab, setEditingProduct, setEditingCustomer, setEditingPurchase }) {
  const todayStr    = new Date().toDateString();
  const todaysSales = sales.filter((s) => new Date(s.created_at).toDateString() === todayStr);

  const totalProducts  = safeNum(dashboard?.total_products);
  const lowStockList   = dashboard?.low_stock_products || [];
  const outOfStockCnt  = lowStockList.filter((p) => p.stock === 0).length;
  const lowStockCnt    = lowStockList.filter((p) => p.stock > 0).length;
  const healthyCnt     = Math.max(0, totalProducts - lowStockList.length);

  // Build real activity feed from recent sales
  function timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
  
  const recentActivity = sales.slice(0, 5).map(s => ({
    id: s.id,
    type: "bill",
    title: s.customer_name || "Guest Bill",
    sub: `Bill #${s.bill_number}`,
    amount: `+${fmt(s.total_amount)}`,
    time: timeAgo(s.created_at),
  }));

  // Adding dummy data to match the visual if real data is empty
  const activities = recentActivity.length > 0 ? recentActivity : [
    { id: 1, type: "bill", title: "Spotify", sub: "Payment at the store", time: "11 minutes ago", amount: "-321$" },
    { id: 2, type: "bill", title: "Apple", sub: "Payment at the store", time: "32 minutes ago", amount: "-552$" },
    { id: 3, type: "payment", title: "Bitcoin", sub: "Money transaction", time: "1 hour ago", amount: "-123$" },
    { id: 4, type: "bill", title: "Apple", sub: "Payment at the store", time: "3 hours ago", amount: "-242$" },
  ];

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0,2);
  };

  return (
    <div className="fade-in" style={{ padding: "12px 24px" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 className="page-title" style={{ fontSize: "1.2rem", fontWeight: 700 }}>Cards</h2>
        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", cursor: "pointer", fontWeight: 600 }}>See all</span>
      </div>

      <div className="dashboard-grid-new">
        
        {/* Left Column */}
        <div className="dashboard-left-col">
          
          <div className="top-cards-row">
            <div className="metric-card-dark">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-1px" }}>{fmt(dashboard.today_sales)}</span>
                <span style={{ width: "24px", height: "24px", background: "rgba(255,255,255,0.1)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}><ArrowUpRight size={14} /></span>
              </div>
              <div style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: "-4px" }}>Today's Sales</div>
              <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>**** 1810 <br/>10/24</div>
                <div style={{ fontWeight: 700, fontSize: "1.2rem", fontStyle: "italic", letterSpacing: "1px" }}>VISA</div>
              </div>
            </div>

            <div className="metric-card-light">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-1px" }}>{fmt(dashboard.monthly_sales)}</span>
                <span style={{ width: "24px", height: "24px", background: "var(--bg-tertiary)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}><ArrowDownRight size={14} /></span>
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "-4px" }}>Monthly Revenue</div>
              <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>**** 1423 <br/>10/24</div>
                <div style={{ display: "flex" }}>
                  <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#222" }}></div>
                  <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "var(--border-color)", marginLeft: "-10px" }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="pill-actions-row">
            <button className="action-pill action-pill-primary" onClick={() => setActiveTab("billing")}>
              <Receipt size={16} /> New Bill
            </button>
            <button className="action-pill" onClick={() => { setEditingProduct({}); setActiveTab("products"); }}>
              <Package size={16} /> Products
            </button>
            <button className="action-pill" onClick={() => { setEditingCustomer({}); setActiveTab("customers"); }}>
              <Wallet size={16} /> Customer
            </button>
            <button className="action-pill" onClick={() => { setEditingPurchase({}); setActiveTab("purchases"); }}>
              <Truck size={16} /> Purchase
            </button>
          </div>

          <div style={{ marginTop: "16px" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px" }}>Recent Sales</h3>
            
            <div className="table-container" style={{ background: "transparent", border: "none" }}>
              <table className="table" style={{ borderCollapse: "separate", borderSpacing: "0 10px" }}>
                <thead>
                  <tr>
                    <th style={{ background: "transparent", border: "none", padding: "0 20px 10px", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>Sender</th>
                    <th style={{ background: "transparent", border: "none", padding: "0 20px 10px", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>Date</th>
                    <th style={{ background: "transparent", border: "none", padding: "0 20px 10px", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>Status</th>
                    <th style={{ background: "transparent", border: "none", padding: "0 20px 10px", textAlign: "right", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 4).map(s => (
                    <tr key={s.id} style={{ background: "white", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                      <td style={{ border: "none", borderRadius: "12px 0 0 12px", padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 600 }}>
                            {getInitials(s.customer_name || "Guest")}
                          </div>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{s.customer_name || "Guest Customer"}</span>
                        </div>
                      </td>
                      <td style={{ border: "none", padding: "14px 20px", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                        {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td style={{ border: "none", padding: "14px 20px" }}>
                        <span className="badge badge-success">Success</span>
                      </td>
                      <td style={{ border: "none", borderRadius: "0 12px 12px 0", padding: "14px 20px", textAlign: "right", fontWeight: 700 }}>
                        {fmt(s.total_amount)}
                      </td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr><td colSpan="4" style={{ textAlign: "center", padding: "40px", color: "var(--text-tertiary)", background: "white", borderRadius: "12px" }}>No sales recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div>
          <div className="statistic-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Statistic <Info size={14} style={{ color: "var(--text-tertiary)", marginLeft: "4px" }}/></h3>
              <select style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid var(--border-color)", background: "transparent", fontSize: "0.75rem", color: "var(--text-secondary)", outline: "none" }}>
                <option>This week</option>
                <option>This month</option>
              </select>
            </div>

            <div style={{ height: "180px", position: "relative" }}>
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={[
                       { name: "Healthy",      value: Math.max(healthyCnt, 1) },
                       { name: "Low Stock",    value: Math.max(lowStockCnt, 0) },
                       { name: "Out of Stock", value: Math.max(outOfStockCnt, 0) },
                     ]}
                     innerRadius={55} outerRadius={75} paddingAngle={2} dataKey="value"
                     stroke="none"
                   >
                     {DONUT_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                   </Pie>
                 </PieChart>
               </ResponsiveContainer>
               <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                 <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Total</span>
                 <span style={{ fontSize: "1.25rem", fontWeight: 700 }}>{fmt(dashboard.today_sales)}</span>
               </div>
            </div>

            <div style={{ display: "flex", gap: "16px", justifyContent: "center", fontSize: "0.7rem", color: "var(--text-secondary)" }}>
               <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "12px", height: "8px", borderRadius: "4px", background: "var(--brand-primary)" }}></div> Healthy Stock</div>
               <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "12px", height: "8px", borderRadius: "4px", background: "#222" }}></div> Low Stock</div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px", marginTop: "8px", overflowY: "auto" }}>
              {activities.map((act) => {
                 const cfg = activityConfig[act.type] || activityConfig.bill;
                 return (
                   <div key={act.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                     <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                       <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: cfg.bg, color: cfg.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                         <cfg.icon size={16} />
                       </div>
                       <div>
                         <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>{act.title}</div>
                         <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>{act.sub}</div>
                       </div>
                     </div>
                     <div style={{ textAlign: "right" }}>
                       <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{act.amount}</div>
                       <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>{act.time}</div>
                     </div>
                   </div>
                 );
              })}
            </div>

          </div>
        </div>
      </div>
      <AskHisaabAI />
    </div>
  );
}
