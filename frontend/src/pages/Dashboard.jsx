import React from "react";
import {
  Receipt, Package, TrendingUp, CalendarDays, ShoppingCart, BarChart2,
  Star, AlertCircle, Wallet, Plus, RefreshCw, ArrowRight, Truck,
  IndianRupee, Clock, CheckCircle2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import StatCard from "../components/StatCard";
import { fmt, safeNum } from "../services/api";

const mockChartData = [
  { name: "Mon", sales: 4000, profit: 1200, orders: 40 },
  { name: "Tue", sales: 3000, profit: 900,  orders: 32 },
  { name: "Wed", sales: 5000, profit: 1500, orders: 55 },
  { name: "Thu", sales: 2780, profit: 800,  orders: 28 },
  { name: "Fri", sales: 6890, profit: 2100, orders: 75 },
  { name: "Sat", sales: 8390, profit: 2500, orders: 90 },
  { name: "Sun", sales: 7490, profit: 2300, orders: 82 },
];

const DONUT_COLORS = ["#10b981", "#f59e0b", "#ef4444"];

const activityConfig = {
  bill:    { bg: "#dbeafe", color: "#2563eb", icon: Receipt },
  stock:   { bg: "#fef3c7", color: "#d97706", icon: Package },
  payment: { bg: "#d1fae5", color: "#059669", icon: CheckCircle2 },
  alert:   { bg: "#fee2e2", color: "#dc2626", icon: AlertCircle },
};

const mockActivityFeed = [
  { id: 1, type: "bill",    title: "Bill #1042 created",       time: "10 mins ago" },
  { id: 2, type: "stock",   title: "Stock updated: Parle-G",   time: "1 hour ago" },
  { id: 3, type: "payment", title: "Payment received ₹450",    time: "2 hours ago" },
  { id: 4, type: "alert",   title: "Low stock: Amul Butter",   time: "3 hours ago" },
];

function getStockSeverity(stock) {
  if (stock === 0) return { label: "Critical", cls: "badge-danger" };
  if (stock <= 5)  return { label: "High",     cls: "badge-danger" };
  return                  { label: "Low",      cls: "badge-warning" };
}

export default function Dashboard({ store, dashboard, sales, setActiveTab, setEditingProduct, setEditingCustomer, chartTab, setChartTab }) {
  const todayStr    = new Date().toDateString();
  const todaysSales = sales.filter((s) => new Date(s.created_at).toDateString() === todayStr);
  const ordersToday = todaysSales.length;
  const avgBillValue = ordersToday > 0 ? safeNum(dashboard?.today_sales) / ordersToday : 0;

  const totalProducts  = safeNum(dashboard.total_products);
  const lowStockList   = dashboard.low_stock_products || [];
  const outOfStockCnt  = lowStockList.filter((p) => p.stock === 0).length;
  const lowStockCnt    = lowStockList.filter((p) => p.stock > 0).length;
  const healthyCnt     = Math.max(0, totalProducts - lowStockList.length);
  const healthPct      = totalProducts > 0 ? Math.round((healthyCnt / totalProducts) * 100) : 100;

  const barColor = chartTab === "profit" ? "var(--success)" : chartTab === "orders" ? "#8b5cf6" : "var(--brand-primary)";

  function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-label">{label}</div>
        <div className="chart-tooltip-value">
          {chartTab === "orders" ? payload[0].value : fmt(payload[0].value)}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">Welcome back, {(store.owner_name || "").split(" ")[0]} 👋</p>
        </div>
        <button className="btn btn-primary" onClick={() => setActiveTab("billing")}>
          <Plus size={18} /> New Bill
        </button>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid" style={{ marginBottom: "24px" }}>
        <StatCard title="Today's Sales" icon={Receipt} value={fmt(dashboard.today_sales)} trend="up" trendValue="+12% vs yday" colorClass="kpi-icon-primary" sub={`${ordersToday} orders placed`} />
        <StatCard title="Today's Profit" icon={TrendingUp} value={fmt(dashboard.today_profit)} trend="up" trendValue="+8% vs yday" colorClass="kpi-icon-success" sub={`${dashboard.today_sales > 0 ? Math.round((dashboard.today_profit / dashboard.today_sales) * 100) : 0}% margin`} />
        <StatCard title="Monthly Revenue" icon={CalendarDays} value={fmt(safeNum(dashboard.today_sales) * 25)} trend="up" trendValue="+15% vs last mo" colorClass="kpi-icon-primary" sub="Projected estimate" />
        <StatCard title="Orders Today" icon={ShoppingCart} value={ordersToday} trend={ordersToday > 0 ? "up" : "neutral"} trendValue={ordersToday > 0 ? "Active today" : "No orders yet"} colorClass="kpi-icon-primary" sub="Bills generated" />
        <StatCard title="Avg Bill Value" icon={BarChart2} value={fmt(avgBillValue)} trend="neutral" trendValue="Per transaction" colorClass="kpi-icon-success" sub={`Based on ${ordersToday} order${ordersToday !== 1 ? "s" : ""}`} />
        <StatCard title="Best Seller" icon={Star} value={dashboard.top_selling_products[0]?.name || "—"} trend="up" trendValue="Top product today" colorClass="kpi-icon-warning" sub={dashboard.top_selling_products[0] ? `${safeNum(dashboard.top_selling_products[0].quantity)} units sold` : "No sales yet"} isText />
        <StatCard title="Total Products" icon={Package} value={safeNum(dashboard.total_products)} trend="neutral" trendValue="Active catalog" colorClass="kpi-icon-primary" sub={`${healthyCnt} healthy`} />
        <StatCard title="Low Stock Items" icon={AlertCircle} value={lowStockList.length} trend={lowStockList.length > 5 ? "down" : "neutral"} trendValue="Needs attention" colorClass={lowStockList.length > 0 ? "kpi-icon-danger" : "kpi-icon-warning"} sub={`${outOfStockCnt} out of stock`} />
        <StatCard title="Outstanding Udhaar" icon={Wallet} value={fmt(safeNum(dashboard.total_udhaar_outstanding))} trend={safeNum(dashboard.total_udhaar_outstanding) > 0 ? "down" : "neutral"} trendValue={`${safeNum(dashboard.total_customers)} customers`} colorClass="kpi-icon-warning" sub="Collection pending" />
      </div>

      <div className="dashboard-v2-grid">
        {/* Main column */}
        <div className="dashboard-main-col">
          {/* Analytics Bar Chart */}
          <div className="card">
            <div className="card-header" style={{ borderBottom: "none", paddingBottom: "0" }}>
              <h3 className="card-title">Analytics</h3>
              <div className="chart-tabs">
                <button className={`chart-tab ${chartTab === "sales"  ? "active" : ""}`} onClick={() => setChartTab("sales")}>Sales</button>
                <button className={`chart-tab ${chartTab === "profit" ? "active" : ""}`} onClick={() => setChartTab("profit")}>Profit</button>
                <button className={`chart-tab ${chartTab === "orders" ? "active" : ""}`} onClick={() => setChartTab("orders")}>Orders</button>
              </div>
            </div>
            <div className="card-body">
              <div style={{ height: "280px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mockChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barSize={30}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--text-secondary)" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
                      tickFormatter={(v) => chartTab === "orders" ? v : `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg-tertiary)", radius: 4 }} />
                    <Bar dataKey={chartTab} fill={barColor} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Selling Products */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Top Selling Products</h3>
              <span className="badge badge-neutral">This week</span>
            </div>
            <div className="card-body">
              {dashboard.top_selling_products.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {dashboard.top_selling_products.slice(0, 5).map((item, idx) => {
                    const maxQty   = dashboard.top_selling_products[0].quantity;
                    const pct      = (item.quantity / maxQty) * 100;
                    const rankClrs = ["#f59e0b", "#94a3b8", "#cd7f32", "#64748b", "#64748b"];
                    return (
                      <div className="top-product-item" key={item.name}>
                        <div className="top-product-rank" style={{ color: rankClrs[idx] }}>#{idx + 1}</div>
                        <div className="top-product-info">
                          <div className="top-product-name">{item.name}</div>
                          <div className="top-product-bar-bg" style={{ margin: "6px 0" }}>
                            <div className="top-product-bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="top-product-stats">{safeNum(item.quantity)} units sold · {fmt(item.total_amount)}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--brand-primary)" }}>{fmt(item.total_amount)}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>{safeNum(item.quantity)} units</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state-v2">
                  <div className="empty-state-v2-icon"><BarChart2 size={40} /></div>
                  <h3 className="empty-state-v2-title">No sales data yet</h3>
                  <p className="empty-state-v2-desc">Start billing to see your top products here.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => setActiveTab("billing")}>Start Billing</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Side column */}
        <div className="dashboard-side-col">
          {/* Quick Actions */}
          <div className="card">
            <div className="card-header"><h3 className="card-title">Quick Actions</h3></div>
            <div className="card-body">
              <div className="quick-actions-grid">
                <button className="action-btn action-btn-primary" onClick={() => setActiveTab("billing")}>
                  <Receipt size={22} /> New Bill
                </button>
                <button className="action-btn" onClick={() => { setEditingProduct({}); setActiveTab("products"); }}>
                  <Plus size={22} color="var(--brand-primary)" /> Add Product
                </button>
                <button className="action-btn" onClick={() => setActiveTab("products")}>
                  <Package size={22} color="var(--brand-primary)" /> Manage Products
                </button>
                <button className="action-btn" onClick={() => { setEditingCustomer({}); setActiveTab("customers"); }}>
                  <Plus size={22} color="var(--brand-primary)" /> Add Customer
                </button>
              </div>
            </div>
          </div>

          {/* Today's Summary */}
          <div className="card card-accent-primary">
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <h3 className="card-title" style={{ color: "var(--brand-primary)" }}>Today's Summary</h3>
              <div className="summary-stat-row"><span>Gross Revenue</span><strong>{fmt(dashboard.today_sales)}</strong></div>
              <div className="summary-stat-row"><span>Net Profit</span><strong>{fmt(dashboard.today_profit)}</strong></div>
              <div className="summary-stat-row"><span>Orders</span><strong>{ordersToday}</strong></div>
              <div className="summary-stat-row">
                <span>Best Seller</span>
                <strong style={{ fontSize: "0.8125rem" }}>{dashboard.top_selling_products[0]?.name || "—"}</strong>
              </div>
            </div>
          </div>

          {/* Inventory Health */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Inventory Health</h3>
              <span className={`health-pct-badge ${healthPct >= 80 ? "health-good" : healthPct >= 50 ? "health-warn" : "health-bad"}`}>
                {healthPct}%
              </span>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "4px" }}>
                <div style={{ width: "90px", height: "90px", flexShrink: 0 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Healthy",      value: Math.max(healthyCnt, 0) },
                          { name: "Low Stock",    value: Math.max(lowStockCnt, 0) },
                          { name: "Out of Stock", value: Math.max(outOfStockCnt, 0) },
                        ]}
                        innerRadius={28} outerRadius={42} paddingAngle={2} dataKey="value"
                      >
                        {DONUT_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div className="inv-chip inv-chip-good"><span className="inv-dot" style={{ background: DONUT_COLORS[0] }} /><span>Healthy</span><strong>{healthyCnt}</strong></div>
                  <div className="inv-chip inv-chip-warn"><span className="inv-dot" style={{ background: DONUT_COLORS[1] }} /><span>Low Stock</span><strong>{lowStockCnt}</strong></div>
                  <div className="inv-chip inv-chip-bad"><span className="inv-dot" style={{ background: DONUT_COLORS[2] }} /><span>Out of Stock</span><strong>{outOfStockCnt}</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Activity</h3>
              <Clock size={16} color="var(--text-tertiary)" />
            </div>
            <div className="card-body">
              <div className="activity-feed">
                {mockActivityFeed.map((act) => {
                  const cfg = activityConfig[act.type] || activityConfig.bill;
                  return (
                    <div className="activity-item" key={act.id}>
                      <div className="activity-icon" style={{ background: cfg.bg, color: cfg.color }}><cfg.icon size={15} /></div>
                      <div className="activity-content">
                        <div className="activity-title">{act.title}</div>
                        <div className="activity-time">{act.time}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent Purchases */}
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

          {/* Recent Udhaar */}
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

          {/* Action Required */}
          <div className="card border-warning">
            <div className="card-header">
              <h3 className="card-title text-warning" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertCircle size={18} /> Action Required
              </h3>
            </div>
            <div className="card-body" style={{ padding: "0" }}>
              {lowStockList.length > 0 ? (
                <div className="item-list">
                  {lowStockList.slice(0, 4).map((item) => {
                    const sev = getStockSeverity(item.stock);
                    return (
                      <div className="action-required-item" key={item.id}>
                        <div className="action-required-info">
                          <strong>{item.name}</strong>
                          <small>{item.stock === 0 ? "Out of stock" : `${item.stock} units left`}</small>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                          <span className={`badge ${sev.cls}`}>{sev.label}</span>
                          <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab("products")}>
                            <RefreshCw size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {lowStockList.length > 4 && (
                    <div style={{ padding: "12px 20px" }}>
                      <button className="btn btn-ghost btn-sm" style={{ width: "100%" }} onClick={() => setActiveTab("products")}>
                        View all {lowStockList.length} items <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: "24px 0" }}>
                  <CheckCircle2 size={32} style={{ color: "var(--success)", marginBottom: "8px" }} />
                  <span className="empty-text" style={{ fontSize: "0.875rem" }}>All stock levels are good!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
