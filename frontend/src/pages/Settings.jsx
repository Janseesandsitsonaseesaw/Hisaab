import React, { useEffect, useMemo, useState } from "react";
import {
  Building2, Check, Database, Download, FileText, ImagePlus,
  Palette, Printer, Receipt, Settings as SettingsIcon, ShieldCheck,
  Store, Users, Wallet, Package, Hexagon,
} from "lucide-react";
import { fmt, safeNum } from "../services/api";

const themeOptions = [
  { id: "light", label: "Light Mode", color: "#ffffff" },
  { id: "dark", label: "Dark Mode", color: "#0f172a" },
];

const themeVars = {
  light: {
    primary: "#8b5cf6",
    hover: "#7c3aed",
    soft: "#f5f3ff",
    bgPrimary: "#fdfbf7",
    bgSecondary: "#ffffff",
    bgTertiary: "#f7f5f0",
    textPrimary: "#18181b",
    textSecondary: "#52525b",
    textTertiary: "#a1a1aa",
    sidebarBg: "#ffffff",
    sidebarBgHover: "#f4f4f5",
    sidebarBgActive: "#f5f3ff",
    sidebarText: "#52525b",
    sidebarTextActive: "#8b5cf6",
    sidebarBorder: "#e4e4e7",
    borderColor: "#e4e4e7",
    borderColorHover: "#d4d4d8",
  },
  dark: {
    primary: "#a78bfa",
    hover: "#c084fc",
    soft: "rgba(167, 139, 250, 0.1)",
    bgPrimary: "#1e1e1e",
    bgSecondary: "#262626",
    bgTertiary: "#333333",
    textPrimary: "#ffffff",
    textSecondary: "#c7c7c7",
    textTertiary: "#8c8c8c",
    sidebarBg: "#1e1e1e",
    sidebarBgHover: "#262626",
    sidebarBgActive: "rgba(167, 139, 250, 0.15)",
    sidebarText: "#c7c7c7",
    sidebarTextActive: "#a78bfa",
    sidebarBorder: "#2e2e2e",
    borderColor: "#2e2e2e",
    borderColorHover: "#3e3e3e",
  },
};

function applyTheme(theme = "light") {
  const selected = themeVars[theme] || themeVars.light;
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", selected.primary);
  root.style.setProperty("--brand-primary-hover", selected.hover);
  root.style.setProperty("--brand-primary-soft", selected.soft);
  root.style.setProperty("--bg-primary", selected.bgPrimary);
  root.style.setProperty("--bg-secondary", selected.bgSecondary);
  root.style.setProperty("--bg-tertiary", selected.bgTertiary);
  root.style.setProperty("--text-primary", selected.textPrimary);
  root.style.setProperty("--text-secondary", selected.textSecondary);
  root.style.setProperty("--text-tertiary", selected.textTertiary);
  root.style.setProperty("--sidebar-bg", selected.sidebarBg);
  root.style.setProperty("--sidebar-bg-hover", selected.sidebarBgHover);
  root.style.setProperty("--sidebar-bg-active", selected.sidebarBgActive);
  root.style.setProperty("--sidebar-text", selected.sidebarText);
  root.style.setProperty("--sidebar-text-active", selected.sidebarTextActive);
  root.style.setProperty("--sidebar-border", selected.sidebarBorder);
  root.style.setProperty("--border-color", selected.borderColor);
  root.style.setProperty("--border-color-hover", selected.borderColorHover);
}

function getInitials(name = "") {
  return (name || "").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "H";
}

export default function Settings({
  store,
  dashboard,
  products,
  customers,
  sales,
  purchases,
  saveStore,
  showNotice,
}) {
  const [draft, setDraft] = useState(() => ({
    receipt_prefix: "BILL",
    receipt_footer: "Thank you for shopping with us!",
    theme_color: "light",
    ...store,
  }));

  useEffect(() => {
    setDraft({
      receipt_prefix: "BILL",
      receipt_footer: "Thank you for shopping with us!",
      theme_color: "light",
      ...store,
    });
  }, [store]);

  useEffect(() => {
    applyTheme(draft.theme_color);
  }, [draft.theme_color]);

  const latestSale = sales[0];
  const previewItems = latestSale?.items?.slice(0, 3) || [
    { name: "Aashirvaad Atta 5kg", quantity: 1, selling_price: 245 },
    { name: "Tata Salt 1kg", quantity: 2, selling_price: 28 },
  ];
  const previewTotal = latestSale?.total_amount ?? previewItems.reduce((sum, item) => sum + safeNum(item.selling_price) * safeNum(item.quantity), 0);
  const activeTheme = themeOptions.find((option) => option.id === draft.theme_color) || themeOptions[0];

  const exportPayload = useMemo(() => ({
    exported_at: new Date().toISOString(),
    store: draft,
    products,
    customers,
    sales,
    purchases,
  }), [draft, products, customers, sales, purchases]);

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showNotice("Please upload an image file", "error");
      return;
    }
    if (file.size > 1024 * 1024) {
      showNotice("Logo must be under 1 MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => updateDraft("logo_data_url", reader.result);
    reader.onerror = () => showNotice("Could not read logo file", "error");
    reader.readAsDataURL(file);
  }

  function submitSettings(e) {
    e.preventDefault();
    saveStore(e);
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printTestReceipt() {
    const receiptHtml = document.querySelector(".receipt-preview-paper")?.innerHTML;
    const win = window.open("", "_blank", "width=420,height=640");
    if (!win || !receiptHtml) {
      showNotice("Unable to open print preview", "error");
      return;
    }
    win.document.write(`
      <html>
        <head>
          <title>Test Receipt</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; padding: 20px; }
            .receipt-preview-paper { max-width: 320px; margin: 0 auto; }
            .receipt-line, .receipt-total-row { display: flex; justify-content: space-between; gap: 12px; margin: 8px 0; }
            .receipt-divider { border-top: 1px dashed #94a3b8; margin: 12px 0; }
            .receipt-total-row { font-weight: 700; font-size: 18px; }
            .receipt-muted { color: #64748b; font-size: 12px; }
            .receipt-logo { width: 42px; height: 42px; object-fit: cover; border-radius: 8px; }
          </style>
        </head>
        <body><div class="receipt-preview-paper">${receiptHtml}</div></body>
      </html>
    `);
    win.document.close();
    win.print();
  }

  const overviewCards = [
    { label: "Total Products", value: products.length, icon: Package, tone: "primary" },
    { label: "Total Customers", value: customers.length, icon: Users, tone: "success" },
    { label: "Today's Sales", value: fmt(dashboard.today_sales), icon: Receipt, tone: "primary" },
    { label: "Outstanding Udhaar", value: fmt(dashboard.total_udhaar_outstanding), icon: Wallet, tone: "warning" },
  ];

  return (
    <div className="settings-page fade-in">
      <div className="settings-hero">
        <div>
          <div className="settings-eyebrow"><SettingsIcon size={15} /> Store Settings</div>
          <h2 className="page-title">Configure your Hisaab workspace</h2>
          <p className="page-subtitle">Manage profile, receipts, appearance, and store data from one control center.</p>
        </div>
        <button className="btn btn-primary" type="submit" form="settings-form">
          <Check size={17} /> Save Changes
        </button>
      </div>

      <section className="settings-overview-grid">
        {overviewCards.map((card) => (
          <div className="settings-stat-card" key={card.label}>
            <div className={`settings-stat-icon kpi-icon-${card.tone}`}>
              <card.icon size={18} />
            </div>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </section>

      <form id="settings-form" onSubmit={submitSettings}>
        <input type="hidden" name="logo_data_url" value={draft.logo_data_url || ""} />
        <input type="hidden" name="theme_color" value={draft.theme_color || "navy"} />

        <div className="settings-grid">
          <div className="settings-main-col">
            <section className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon"><Store size={18} /></div>
                <div>
                  <h3>Store Profile</h3>
                  <p>Core identity used across billing and receipts.</p>
                </div>
              </div>
              <div className="settings-profile-row">
                <div className="logo-uploader">
                  <div className="logo-preview" style={{ borderColor: activeTheme.color }}>
                    {draft.logo_data_url ? (
                      <img src={draft.logo_data_url} alt="Store logo preview" />
                    ) : (
                      <Hexagon size={36} strokeWidth={1.5} style={{ color: "var(--brand-primary)" }} />
                    )}
                  </div>
                  <label className="btn btn-secondary btn-sm">
                    <ImagePlus size={15} /> Upload Logo
                    <input type="file" accept="image/*" onChange={handleLogoChange} />
                  </label>
                </div>
                <div className="settings-form-grid">
                  <div className="form-group">
                    <label className="form-label">Store Name</label>
                    <input className="form-input" required name="store_name" value={draft.store_name || ""} onChange={(e) => updateDraft("store_name", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Owner Name</label>
                    <input className="form-input" required name="owner_name" value={draft.owner_name || ""} onChange={(e) => updateDraft("owner_name", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input className="form-input" required name="phone" inputMode="numeric" maxLength={10} value={draft.phone || ""} onChange={(e) => updateDraft("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Store Category</label>
                    <select className="form-input" required name="store_category" value={draft.store_category || "Kirana Store"} onChange={(e) => updateDraft("store_category", e.target.value)}>
                      <option>Kirana Store</option>
                      <option>Stationery Shop</option>
                      <option>General Retail</option>
                      <option>Pharmacy</option>
                      <option>Supermarket</option>
                      <option>Electronics</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>

            <section className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon"><Building2 size={18} /></div>
                <div>
                  <h3>Business Information</h3>
                  <p>Details shown in documents and store records.</p>
                </div>
              </div>
              <div className="settings-form-grid">
                <div className="form-group">
                  <label className="form-label">GST Number</label>
                  <input className="form-input" name="gst_number" placeholder="Optional" value={draft.gst_number || ""} onChange={(e) => updateDraft("gst_number", e.target.value.toUpperCase())} />
                </div>
                <div className="form-group">
                  <label className="form-label">Receipt Prefix</label>
                  <input className="form-input" name="receipt_prefix" value={draft.receipt_prefix || ""} onChange={(e) => updateDraft("receipt_prefix", e.target.value.toUpperCase().slice(0, 10))} />
                </div>
                <div className="form-group">
                  <label className="form-label">UPI ID (e.g. merchant@paytm)</label>
                  <input className="form-input" name="upi_id" placeholder="Optional" value={draft.upi_id || ""} onChange={(e) => updateDraft("upi_id", e.target.value)} />
                </div>
                <div className="form-group settings-span-2">
                  <label className="form-label">Business Address</label>
                  <textarea className="form-input settings-textarea" name="business_address" rows={3} placeholder="Street, city, state" value={draft.business_address || ""} onChange={(e) => updateDraft("business_address", e.target.value)} />
                </div>
              </div>
            </section>

            <section className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon"><FileText size={18} /></div>
                <div>
                  <h3>Receipt Settings</h3>
                  <p>Customize what customers see on printed and WhatsApp receipts.</p>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Footer Message</label>
                <textarea className="form-input settings-textarea" name="receipt_footer" rows={3} value={draft.receipt_footer || ""} onChange={(e) => updateDraft("receipt_footer", e.target.value)} />
              </div>
            </section>
          </div>

          <div className="settings-side-col">
            <section className="settings-card receipt-preview-card">
              <div className="settings-card-header compact">
                <div className="settings-card-icon"><Receipt size={18} /></div>
                <div>
                  <h3>Receipt Preview</h3>
                  <p>Live customer-facing format.</p>
                </div>
              </div>
              <div className="receipt-preview-paper">
                <div className="receipt-preview-top">
                  {draft.logo_data_url ? (
                    <img className="receipt-logo" src={draft.logo_data_url} alt="" />
                  ) : (
                    <div className="receipt-logo-fallback">
                      <Hexagon />
                    </div>
                  )}
                  <div>
                    <strong>{draft.store_name || "Hisaab Store"}</strong>
                    <span>{draft.store_category || "Retail Store"}</span>
                  </div>
                </div>
                <div className="receipt-muted">{draft.business_address || "Store address appears here"}</div>
                <div className="receipt-muted">Phone: {draft.phone || "9876543210"}</div>
                {draft.gst_number && <div className="receipt-muted">GST: {draft.gst_number}</div>}
                <div className="receipt-divider" />
                <div className="receipt-line"><span>Invoice</span><strong>{draft.receipt_prefix || "BILL"}-00042</strong></div>
                <div className="receipt-line"><span>Date</span><span>{new Date().toLocaleDateString("en-IN")}</span></div>
                <div className="receipt-divider" />
                {previewItems.map((item, index) => (
                  <div className="receipt-line" key={`${item.name}-${index}`}>
                    <span>{item.name} x {item.quantity}</span>
                    <strong>{fmt(safeNum(item.selling_price) * safeNum(item.quantity))}</strong>
                  </div>
                ))}
                <div className="receipt-divider" />
                <div className="receipt-total-row"><span>Total</span><strong>{fmt(previewTotal)}</strong></div>
                <p className="receipt-footer-text">{draft.receipt_footer || "Thank you!"}</p>
              </div>
            </section>

            <section className="settings-card">
              <div className="settings-card-header compact">
                <div className="settings-card-icon"><Palette size={18} /></div>
                <div>
                  <h3>Appearance</h3>
                  <p>Brand color across the app.</p>
                </div>
              </div>
              <div className="theme-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
                {themeOptions.map((option) => (
                  <button
                    type="button"
                    className={`theme-swatch ${draft.theme_color === option.id ? "active" : ""}`}
                    key={option.id}
                    onClick={() => updateDraft("theme_color", option.id)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      padding: "8px",
                      borderRadius: "12px",
                      border: "2px solid " + (draft.theme_color === option.id ? "var(--brand-primary)" : "var(--border-color)"),
                      background: "var(--bg-secondary)",
                      cursor: "pointer",
                      gap: "8px",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {/* Mockup layout */}
                    <div style={{
                      height: "80px",
                      borderRadius: "8px",
                      background: option.id === "dark" ? "#090d16" : "#f9fafb",
                      border: "1px solid var(--border-color)",
                      display: "flex",
                      padding: "6px",
                      gap: "6px",
                      position: "relative",
                      overflow: "hidden",
                      width: "100%"
                    }}>
                      {/* Sidebar mock */}
                      <div style={{
                        width: "25%",
                        background: option.id === "dark" ? "#111827" : "#ffffff",
                        borderRadius: "4px",
                        borderRight: `1px solid ${option.id === "dark" ? "#1f2937" : "#e5e7eb"}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        padding: "4px"
                      }}>
                        <div style={{ height: "6px", width: "12px", background: "#3b82f6", borderRadius: "2px" }} />
                        <div style={{ height: "4px", width: "16px", background: "var(--text-tertiary)", borderRadius: "1px", opacity: 0.3 }} />
                        <div style={{ height: "4px", width: "14px", background: "var(--text-tertiary)", borderRadius: "1px", opacity: 0.3 }} />
                      </div>
                      {/* Content mock */}
                      <div style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px"
                      }}>
                        <div style={{ height: "10px", background: option.id === "dark" ? "#111827" : "#ffffff", borderRadius: "4px", border: "1px solid var(--border-color)" }} />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                          <div style={{ height: "24px", background: option.id === "dark" ? "#111827" : "#ffffff", borderRadius: "4px", border: "1px solid var(--border-color)" }} />
                          <div style={{ height: "24px", background: option.id === "dark" ? "#111827" : "#ffffff", borderRadius: "4px", border: "1px solid var(--border-color)" }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
                      <strong style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>{option.label}</strong>
                      {draft.theme_color === option.id && <Check size={16} style={{ color: "var(--brand-primary)" }} />}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-card">
              <div className="settings-card-header compact">
                <div className="settings-card-icon"><ShieldCheck size={18} /></div>
                <div>
                  <h3>Quick Actions</h3>
                  <p>Operational shortcuts.</p>
                </div>
              </div>
              <div className="quick-action-list">
                <button type="button" className="quick-action-row" onClick={printTestReceipt}>
                  <Printer size={17} /> <span>Print Test Receipt</span>
                </button>
                <button type="button" className="quick-action-row" onClick={() => downloadJson("hisaab-export.json", exportPayload)}>
                  <Download size={17} /> <span>Export Data</span>
                </button>
                <button type="button" className="quick-action-row" onClick={() => downloadJson(`hisaab-backup-${new Date().toISOString().slice(0, 10)}.json`, exportPayload)}>
                  <Database size={17} /> <span>Backup Store Data</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </form>
    </div>
  );
}
