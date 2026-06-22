import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import {
  Hexagon, Plus, Receipt, History as HistoryIcon, Settings,
  Download, FileText, AlertCircle, CheckCircle2,
  Users, Truck, ChevronLeft, IndianRupee, Phone, Mail, MapPin,
  MessageCircle, Lock, ArrowRight, Store, ImagePlus, Check, LogOut, Menu,
  Barcode, Brain, TrendingUp, Wallet, Sparkles, AlertTriangle, Eye, ShieldCheck, Palette,
  Sun, Moon
} from "lucide-react";

import { api, fmt, safeNum, downloadInvoice, printInvoice, openWhatsAppReceipt, supabase } from "./services/api";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Billing from "./pages/Billing";
import Inventory from "./pages/Inventory";
import Customers from "./pages/Customers";
import Purchases from "./pages/Purchases";
import SettingsPage from "./pages/Settings";

/** Return 1–2 uppercase initials from a full name */
function getInitials(name = "") {
  return (name || "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";
}

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
    bgPrimary: "#121214",
    bgSecondary: "#18181b",
    bgTertiary: "#202024",
    textPrimary: "#ffffff",
    textSecondary: "#a1a1aa",
    textTertiary: "#71717a",
    sidebarBg: "#121214",
    sidebarBgHover: "#18181b",
    sidebarBgActive: "rgba(167, 139, 250, 0.15)",
    sidebarText: "#a1a1aa",
    sidebarTextActive: "#a78bfa",
    sidebarBorder: "#27272a",
    borderColor: "#27272a",
    borderColorHover: "#3f3f46",
  },
};

function applyTheme(theme = "light") {
  const selected = themeVars[theme] || themeVars.light;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.className = theme === "dark" ? "dark-theme" : "light-theme";
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

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  if (!supabase) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f9fafb', color: '#111827', padding: '20px', textAlign: 'center' }}>
        <div style={{ padding: '15px', borderRadius: '50%', backgroundColor: '#fef3c7', color: '#d97706', marginBottom: '20px' }}>
          <AlertTriangle size={48} />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '10px' }}>Supabase Configuration Required</h2>
        <p style={{ maxWidth: '500px', color: '#4b5563', lineHeight: '1.5', marginBottom: '20px' }}>
          Hisaab POS requires Supabase environment variables to run. Please create a <code>.env</code> file in your <code>frontend/</code> folder with the following variables:
        </p>
        <pre style={{ backgroundColor: '#f3f4f6', padding: '15px', borderRadius: '8px', textAlign: 'left', fontSize: '0.9rem', border: '1px solid #e5e7eb', width: '100%', maxWidth: '480px', overflowX: 'auto' }}>
{`VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key`}
        </pre>
      </div>
    );
  }

  const [currentUser, setCurrentUser] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("hisaab_theme") || "light");

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace("#", "");
    const validTabs = ["landing", "signin", "signup", "forgot-password", "reset-password", "onboarding", "dashboard", "billing", "products", "udhaar", "history", "analytics", "purchases", "settings"];
    return (hash && validTabs.includes(hash)) ? hash : "landing";
  });

  const [appLoading, setAppLoading] = useState(true);
  const [storeFetchStatus, setStoreFetchStatus] = useState("loading"); // "idle", "loading", "success", "error"
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem("hisaab_sidebar_collapsed") === "true";
  });

  const handleSetSidebarCollapsed = (val) => {
    setIsSidebarCollapsed(val);
    localStorage.setItem("hisaab_sidebar_collapsed", val ? "true" : "false");
  };

  const [chartTab,         setChartTab]         = useState("sales");
  const [store,            setStore]            = useState(null);
  const [products,         setProducts]         = useState([]);
  const [sales,            setSales]            = useState([]);
  const [dashboard,        setDashboard]        = useState({ total_products: 0, low_stock_products: [], top_selling_products: [], today_sales: 0, today_profit: 0, weekly_sales: 0, monthly_sales: 0, total_customers: 0, total_udhaar_outstanding: 0, recent_purchases: [], recent_udhaar: [] });
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [cart,             setCart]             = useState([]);
  const [productQuery,     setProductQuery]     = useState("");
  const [historyQuery,     setHistoryQuery]     = useState("");
  const [historyDateFilter, setHistoryDateFilter] = useState("all");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [historyPaymentFilter, setHistoryPaymentFilter] = useState("all");
  const [editingProduct,   setEditingProduct]   = useState(null);
  const [pendingBarcodeCart, setPendingBarcodeCart] = useState(null);
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
  const [paymentMethod,    setPaymentMethod]    = useState("Cash");
  const [lastSale,         setLastSale]         = useState(null);
  const [udhaarForm,       setUdhaarForm]       = useState(null);

  const [readNotifIds, setReadNotifIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("hisaab_read_notifs") || "[]");
    } catch { return []; }
  });

  const markNotifRead = (id) => {
    setReadNotifIds(prev => {
      const next = prev.includes(id) ? prev : [...prev, id];
      localStorage.setItem("hisaab_read_notifs", JSON.stringify(next));
      return next;
    });
  };

  const markAllNotifsRead = (notifs) => {
    const allIds = notifs.map(n => n.id);
    setReadNotifIds(allIds);
    localStorage.setItem("hisaab_read_notifs", JSON.stringify(allIds));
  };

  function timeAgo(dateStr) {
    if (!dateStr) return "Some time ago";
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  const getNotifications = () => {
    const list = [];
    const LOW_STOCK_THRESHOLD = 10;
    
    // 1. Low stock alerts
    (products || []).forEach(p => {
      if (p.stock <= LOW_STOCK_THRESHOLD) {
        list.push({
          id: `stock-${p.id}-${p.stock}`,
          type: "alert",
          title: `Low stock: ${p.name}`,
          sub: p.stock === 0 ? "Out of stock!" : `Only ${p.stock} left`,
          time: p.stock === 0 ? "Critical" : "Warning",
          tab: "products",
          query: p.name,
          rawTime: new Date(0)
        });
      }
    });

    // 2. Sales activity
    (sales || []).slice(0, 10).forEach(s => {
      list.push({
        id: `sale-${s.id}`,
        type: "bill",
        title: `Sale: ${s.bill_number}`,
        sub: `₹${s.total_amount} via ${s.payment_method}`,
        time: timeAgo(s.created_at),
        tab: "history",
        query: s.bill_number,
        rawTime: new Date(s.created_at)
      });
    });

    // 3. Udhaar activity
    (dashboard?.recent_udhaar || []).forEach(u => {
      list.push({
        id: `udhaar-${u.id}`,
        type: "payment",
        title: u.type === "credit" ? "Udhaar Created" : "Udhaar Paid",
        sub: `₹${u.amount} · ${u.customer_name || "Customer"}`,
        time: timeAgo(u.created_at),
        tab: "customers",
        query: u.customer_name,
        rawTime: new Date(u.created_at)
      });
    });

    // 4. Purchase activity
    (purchases || []).slice(0, 10).forEach(p => {
      list.push({
        id: `purchase-${p.id}`,
        type: "stock",
        title: `Restocked ${p.product_name || "Product"}`,
        sub: `+${p.quantity} units from ${p.supplier_name}`,
        time: timeAgo(p.created_at),
        tab: "purchases",
        query: p.product_name,
        rawTime: new Date(p.created_at)
      });
    });

    return list.sort((a, b) => b.rawTime - a.rawTime);
  };

  // SaaS Auth & Onboarding States
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Store Onboarding Form State
  const [onboardStoreName, setOnboardStoreName] = useState("");
  const [onboardOwnerName, setOnboardOwnerName] = useState("");
  const [onboardPhone, setOnboardPhone] = useState("");
  const [onboardCategory, setOnboardCategory] = useState("Grocery Store");
  const [onboardLogo, setOnboardLogo] = useState("");

  const profileRef     = useRef(null);
  const notifRef       = useRef(null);
  const barcodeBuffer  = useRef("");
  const barcodeTimeout = useRef(null);

  async function refresh() {
    const safeFetch = async (path, fallback) => {
      try {
        const res = await api(path);
        return res;
      } catch (err) {
        console.error(`Error loading secondary API ${path}:`, err);
        return fallback;
      }
    };

    try {
      setStoreFetchStatus("loading");
      setDashboardLoading(true);
      const storeData = await api("/store");
      setStore(storeData);
      setStoreFetchStatus("success");
      setAppLoading(false);

      // Only fetch secondary data if a store actually exists.
      // Skipping these calls prevents 4xx errors for brand-new users who haven't set up a store yet.
      if (!storeData || !storeData.store_name) {
        setProducts([]);
        setSales([]);
        setCustomers([]);
        setPurchases([]);
        setDashboard({ total_products: 0, low_stock_products: [], top_selling_products: [], today_sales: 0, today_profit: 0, weekly_sales: 0, monthly_sales: 0, total_customers: 0, total_udhaar_outstanding: 0, recent_purchases: [], recent_udhaar: [] });
        setDashboardLoading(false);
        return storeData;
      }

      // Fetch other less critical elements in the background to ensure instantaneous load!
      Promise.all([
        safeFetch("/products", []),
        safeFetch("/sales", []),
        safeFetch("/dashboard", { total_products: 0, low_stock_products: [], top_selling_products: [], today_sales: 0, today_profit: 0, weekly_sales: 0, monthly_sales: 0, total_customers: 0, total_udhaar_outstanding: 0, recent_purchases: [], recent_udhaar: [] }),
        safeFetch("/customers", []),
        safeFetch("/purchases", []),
      ]).then(([productData, salesData, dashboardData, customerData, purchaseData]) => {
        setProducts(productData);
        setSales(salesData);
        setDashboard(dashboardData);
        setCustomers(customerData);
        setPurchases(purchaseData);
        setDashboardLoading(false);
      });

      return storeData;
    } catch (err) {
      console.error("Critical store profile load failed:", err);
      setStoreFetchStatus("error");
      setAppLoading(false);
      throw err;
    }
  }

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Handle Supabase Auth Session and Route Protection
  useEffect(() => {
    // 1. Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    setCurrentUser(session.user);
    refresh()
      .then((storeData) => {
        if ((!storeData || !storeData.store_name) && !["landing", "signin", "signup", "forgot-password", "reset-password"].includes(activeTab)) {
          setActiveTab("onboarding");
        }
      })
      .catch((err) => {
        console.error("Failed to load store data:", err);
        showNotice("Store data load failed. Please check connection.", "error");
      })
      .finally(() => setAppLoading(false));
  } else {
    setCurrentUser(null);
    setAppLoading(false);
    setStoreFetchStatus("idle");
  }
});

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            setCurrentUser(session.user);
            if (event !== "SIGNED_UP") {
              refresh()
                .catch((err) => console.error("Initial load failed:", err))
                .finally(() => setAppLoading(false));
            }
          } else {
            setCurrentUser(null);
            setStoreFetchStatus("idle");
            const publicTabs = ["landing", "signin", "signup", "forgot-password", "reset-password"];
            if (!publicTabs.includes(activeTab)) {
              setActiveTab("landing");
              showNotice("Session expired or signed out. Please log in.", "error");
            }
          }
        });

    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setIsProfileOpen(false);
      if (notifRef.current   && !notifRef.current.contains(e.target))   setIsNotifOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Protected Route Guard & Onboarding Redirect Audit
  useEffect(() => {
    if (appLoading) return;

    const publicTabs = ["landing", "signin", "signup", "forgot-password", "reset-password"];
    const protectedTabs = ["dashboard", "billing", "products", "udhaar", "history", "analytics", "purchases", "settings", "customers", "inventory", "sales"];

    if (currentUser) {
      if (storeFetchStatus === "success") {
        const hasStore = store && store.store_name;
        if (hasStore) {
          // Logged-in user with a store should not see public or onboarding pages
          if (publicTabs.includes(activeTab) || activeTab === "onboarding") {
            setActiveTab("dashboard");
          }
        } else {
          // Logged-in user without a store must be routed to onboarding
          if (activeTab !== "onboarding" && !publicTabs.includes(activeTab)) {
            setActiveTab("onboarding");
          }
        }
      }
    } else {
      // User is not logged in: protect tabs
      if (protectedTabs.includes(activeTab)) {
        setActiveTab("signin");
      }
    }
  }, [currentUser, store, storeFetchStatus, activeTab, appLoading]);

  useEffect(() => {
    if (store?.theme_color && !localStorage.getItem("hisaab_theme")) {
      setTheme(store.theme_color);
    }
  }, [store?.theme_color]);

  // Sync theme if Settings page updates localStorage (e.g., user picks a theme in Settings)
  useEffect(() => {
    function handleStorageChange(e) {
      if (e.key === "hisaab_theme" && e.newValue && e.newValue !== theme) {
        setTheme(e.newValue);
      }
    }
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [theme]);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("hisaab_theme", theme);
  }, [theme]);

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
          addProductToCart(found);
          showNotice(`Added ${found.name} to cart`);
        } else {
          showNotice(`Barcode ${val} not found`, "error");
        }
      }
    }
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [activeTab, products]);
  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash.replace("#", "");
      const validTabs = ["landing", "signin", "signup", "forgot-password", "reset-password", "onboarding", "dashboard", "billing", "products", "udhaar", "history", "analytics", "purchases", "settings"];
      if (hash && validTabs.includes(hash)) {
        setActiveTab(hash);
      } else if (!hash) {
        setActiveTab("landing");
      }
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (window.location.hash.replace("#", "") !== activeTab) {
      window.location.hash = activeTab;
    }
  }, [activeTab]);


  function showNotice(msg, type = "success") {
    setNotice({ message: msg, type });
    setTimeout(() => setNotice(null), 3000);
  }

  const filteredProducts = useMemo(() => {
    const q = productQuery.toLowerCase();
    const seen = new Set();
    return products.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return `${p.name} ${p.barcode || ""} ${p.category}`.toLowerCase().includes(q);
    });
  }, [products, productQuery]);

  const filteredSales = useMemo(() => {
    let list = sales;

    // Search query filter
    if (historyQuery.trim()) {
      const q = historyQuery.toLowerCase();
      list = list.filter((s) =>
        `${s.bill_number} ${s.items.map((i) => i.name).join(" ")}`.toLowerCase().includes(q)
      );
    }

    // Payment method filter
    if (historyPaymentFilter !== "all") {
      list = list.filter((s) => {
        const method = s.payment_method || "Cash";
        return method.toLowerCase() === historyPaymentFilter.toLowerCase();
      });
    }

    // Date filter
    const now = new Date();
    if (historyDateFilter === "today") {
      const todayStr = now.toDateString();
      list = list.filter((s) => new Date(s.created_at).toDateString() === todayStr);
    } else if (historyDateFilter === "week") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      list = list.filter((s) => new Date(s.created_at) >= sevenDaysAgo);
    } else if (historyDateFilter === "month") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      list = list.filter((s) => new Date(s.created_at) >= thirtyDaysAgo);
    } else if (historyDateFilter === "custom") {
      if (historyStartDate) {
        const start = new Date(historyStartDate);
        start.setHours(0,0,0,0);
        list = list.filter((s) => new Date(s.created_at) >= start);
      }
      if (historyEndDate) {
        const end = new Date(historyEndDate);
        end.setHours(23,59,59,999);
        list = list.filter((s) => new Date(s.created_at) <= end);
      }
    }

    return list;
  }, [sales, historyQuery, historyDateFilter, historyStartDate, historyEndDate, historyPaymentFilter]);

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

  function findCustomer(customerId) {
    return customers.find((customer) => customer.id === customerId);
  }

  function shareReceipt(sale) {
    openWhatsAppReceipt(sale, store, findCustomer(sale.customer_id));
  }

  async function completeSale(doPrint = false) {
    if (cart.length === 0) return;
    if (paymentMethod === "Udhaar" && !billCustomerId) {
      showNotice("Select a customer before creating an udhaar bill", "error");
      return;
    }
    try {
      const params = new URLSearchParams({ payment_method: paymentMethod });
      if (billCustomerId) params.set("customer_id", billCustomerId);
      const sale = await api(`/sales?${params.toString()}`, {
        method: "POST",
        body: JSON.stringify(cart.map((line) => ({
          product_id: line.product_id,
          quantity: line.quantity,
          ...(line.override_price != null ? { override_price: line.override_price } : {}),
        }))),
      });
      setCart([]);
      setLastSale(sale);
      setBillCustomerId("");
      setPaymentMethod("Cash");
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

  async function handleLogin(e) {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError("Email and password are required.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim().toLowerCase(),
        password: authPassword,
      });
      if (error) throw error;
      
      showNotice("Welcome back!");
      
      // Load all user data (including store settings, products, sales, etc.)
      const storeData = await refresh();
      
      // If store is unconfigured/empty, go to onboarding, else dashboard
      if (!storeData || !storeData.store_name) {
        setActiveTab("onboarding");
      } else {
        setActiveTab("dashboard");
      }
      
      // Clear fields
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");
    } catch (err) {
      setAuthError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!authName || !authEmail || !authPassword) {
      setAuthError("All fields are required.");
      return;
    }
    if (authPassword.length < 4) {
      setAuthError("Password must be at least 4 characters long.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail.trim().toLowerCase(),
        password: authPassword,
        options: {
          data: {
            name: authName
          }
        }
      });
      if (error) throw error;
      if (data.session) {
      setCurrentUser(data.session.user);
    }
      
      showNotice("Registration successful! Let's set up your store.");
      
      // Set default owner name from registration name
      setOnboardOwnerName(authName);
      
      // Go to onboarding
      setActiveTab("onboarding");
      
      // Clear fields
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");
    } catch (err) {
      setAuthError(err.message || "Registration failed. Email might be in use.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setAuthLoading(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      setAuthError(err.message || "Google login failed.");
      setAuthLoading(false);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    if (!authEmail) {
      setAuthError("Email is required to reset password.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
        redirectTo: `${window.location.origin}/#reset-password`
      });
      if (error) throw error;
      setResetEmailSent(true);
      showNotice("Password reset link sent to your email!");
    } catch (err) {
      setAuthError(err.message || "Failed to send reset link.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!authPassword) {
      setAuthError("New password is required.");
      return;
    }
    if (authPassword.length < 4) {
      setAuthError("Password must be at least 4 characters long.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.updateUser({
        password: authPassword
      });
      if (error) throw error;
      showNotice("Password reset successful! Please log in.");
      setActiveTab("signin");
      setAuthPassword("");
    } catch (err) {
      setAuthError(err.message || "Failed to reset password.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    }
    setCurrentUser(null);
    setStore(null);
    setProducts([]);
    setSales([]);
    setDashboard({
      total_products: 0,
      low_stock_products: [],
      top_selling_products: [],
      today_sales: 0,
      today_profit: 0,
      weekly_sales: 0,
      monthly_sales: 0,
      total_customers: 0,
      total_udhaar_outstanding: 0,
      recent_purchases: [],
      recent_udhaar: []
    });
    setCart([]);
    setProductQuery("");
    setHistoryQuery("");
    setCustomers([]);
    setSelectedCustomer(null);
    setCustomerQuery("");
    setCustomerUdhaar([]);
    setPurchases([]);
    setBillCustomerId("");
    setPaymentMethod("Cash");
    setLastSale(null);
    setUdhaarForm(null);

    // Reset onboarding form inputs
    setOnboardStoreName("");
    setOnboardOwnerName("");
    setOnboardPhone("");
    setOnboardCategory("Grocery Store");
    setOnboardLogo("");

    showNotice("You have logged out successfully.");
    setActiveTab("landing");
  }

  async function handleOnboard(e) {
    e.preventDefault();
    if (!onboardStoreName || !onboardOwnerName || !onboardPhone) {
      showNotice("Please fill in all required fields", "error");
      return;
    }
    try {
      const payload = {
        store_name: onboardStoreName,
        owner_name: onboardOwnerName,
        phone: onboardPhone,
        store_category: onboardCategory,
        logo_data_url: onboardLogo || null,
        theme_color: "navy"
      };
      const saved = await api("/store", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setStore(saved);
      setActiveTab("dashboard");
      showNotice("Store onboarded successfully!");
      refresh().catch(() => {});
    } catch (err) {
      showNotice(err.message, "error");
    }
  }

  useEffect(() => {
    if (!editingProduct && pendingBarcodeCart) {
      setPendingBarcodeCart(null);
    }
  }, [editingProduct]);

  function addProductToCart(product) {
    setCart((cur) => {
      const ex = cur.find((l) => l.product_id === product.id);
      const inCart = ex ? ex.quantity : 0;
      if (product.stock - inCart <= 0) {
        showNotice("Product out of stock!", "error");
        return cur;
      }
      if (ex) return cur.map((l) => l.product_id === product.id ? { ...l, quantity: Math.min(l.quantity + 1, product.stock) } : l);
      const newLine = { product_id: product.id, quantity: 1 };
      if (product.variable_price) newLine.override_price = product.selling_price;
      return [...cur, newLine];
    });
  }

  async function saveProduct(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const raw  = Object.fromEntries(new FormData(form));
    const payload = {
      name: raw.name, barcode: raw.barcode || null, category: raw.category,
      cost_price: Number(raw.cost_price), selling_price: Number(raw.selling_price), stock: Number(raw.stock),
      unit: raw.unit || "Piece",
      variable_price: raw.variable_price === "on",
    };
    const path   = editingProduct?.id ? `/products/${editingProduct.id}` : "/products";
    const method = editingProduct?.id ? "PUT" : "POST";
    try {
      const saved = await api(path, { method, body: JSON.stringify(payload) });
      form.reset();
      setEditingProduct(null);
      showNotice("Product saved successfully");
      await refresh();
      if (pendingBarcodeCart && saved?.barcode === pendingBarcodeCart) {
        addProductToCart(saved);
        showNotice(`${saved.name} added to cart`);
        setPendingBarcodeCart(null);
        setActiveTab("billing");
      }
    } catch (err) { showNotice(err.message, "error"); }
  }

  function startCreateProductWithBarcode(barcode) {
    setEditingProduct({ barcode });
    setPendingBarcodeCart(barcode);
    setActiveTab("products");
  }



  async function saveCustomer(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const raw = Object.fromEntries(new FormData(form));
    const payload = { name: raw.name, phone: raw.phone, email: raw.email || null, address: raw.address || null };
    const path   = editingCustomer?.id ? `/customers/${editingCustomer.id}` : "/customers";
    const method = editingCustomer?.id ? "PUT" : "POST";
    try {
      await api(path, { method, body: JSON.stringify(payload) });
      form.reset();
      setEditingCustomer(null);
      showNotice("Customer saved successfully");
      await refresh();
    } catch (err) { showNotice(err.message, "error"); }
  }

  async function deleteCustomer(customerId) {
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
    const amount = Number(raw.amount);
    
    if (isNaN(amount) || amount <= 0) {
      showNotice("Please enter a valid amount greater than 0", "error");
      return;
    }

    if (udhaarForm === "payment") {
      const outstanding = Number(selectedCustomer?.outstanding_balance || 0);
      if (amount > outstanding) {
        showNotice(`Repayment amount (₹${amount}) cannot exceed outstanding balance (₹${outstanding})`, "error");
        return;
      }
    }

    const payload = {
      customer_id: selectedCustomer.id,
      amount: amount,
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
    const form = e.currentTarget;
    const raw = Object.fromEntries(new FormData(form));
    const payload = {
      product_id: raw.product_id,
      supplier_name: raw.supplier_name,
      quantity: Number(raw.quantity),
      cost_price: Number(raw.cost_price),
      purchase_date: raw.purchase_date || null,
    };
    try {
      await api("/purchases", { method: "POST", body: JSON.stringify(payload) });
      form.reset();
      setEditingPurchase(null);
      showNotice("Purchase recorded — stock updated");
      await refresh();
    } catch (err) { showNotice(err.message, "error"); }
  }

  // ── SaaS Views Render Helpers ───────────────────────────────────────────────
  
  function renderLanding() {
    return (
      <div className="saas-landing">
        <header className="saas-header">
          <div className="saas-brand" onClick={() => setActiveTab("landing")}>
            <Hexagon className="saas-brand-icon" size={24} strokeWidth={2.5} />
            <span>Hisaab</span>
          </div>
          <nav className="saas-nav">
            <a href="#features">Features</a>
          </nav>
          <div className="saas-header-actions" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button 
              className="lp-theme-toggle" 
              onClick={toggleTheme} 
              aria-label="Toggle theme"
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                padding: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                transition: "background 0.2s, color 0.2s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--brand-primary-soft)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            {currentUser ? (
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <span style={{ fontSize: "14px", color: "var(--text-muted)", display: "none" }} className="header-user-email">{currentUser.email}</span>
                <button className="lp-btn-secondary" onClick={handleLogout}>Sign Out</button>
                <button className="lp-btn-primary" onClick={() => setActiveTab("dashboard")}>Go to Dashboard</button>
              </div>
            ) : (
              <>
                <button className="lp-btn-secondary" onClick={() => { setAuthError(""); setActiveTab("signin"); }}>Sign In</button>
              </>
            )}
          </div>
        </header>

        <section className="saas-hero">
          <div className="hero-content">
            <div className="hero-badge"><Sparkles size={14} /> The #1 Retail POS Command Center</div>
            <h1 className="hero-title">
              The smart way to run your <span style={{ color: "var(--brand-primary)" }}>retail business</span>
            </h1>
            <p className="hero-subtitle">
              Hisaab is a premium, cloud-hosted POS platform designed to automate billing, manage real-time inventory, scan barcodes, analyze sales, and track credit ledgers (Udhaar).
            </p>
            <div className="hero-actions">
              {currentUser ? (
                <div style={{ display: "flex", gap: "12px" }}>
                  <button className="lp-btn-primary lp-btn-lg" onClick={() => setActiveTab("dashboard")}>
                    Go to Dashboard <ArrowRight size={18} />
                  </button>
                  <button className="lp-btn-secondary lp-btn-lg" onClick={handleLogout}>
                    Sign Out
                  </button>
                </div>
              ) : (
                <>
                  <button className="lp-btn-primary lp-btn-lg" onClick={() => { setAuthError(""); setActiveTab("signup"); }}>
                    Get Started Free <ArrowRight size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className="hero-preview-container">
            <div className="landing-dashboard-grid">
              <div className="landing-card card-monthly-plan">
                <span className="card-label">Sales Share</span>
                <div className="donut-wrapper">
                  <svg viewBox="0 0 100 100" className="donut-svg">
                    <circle cx="50" cy="50" r="38" fill="transparent" stroke="#222226" strokeWidth="8" />
                    <circle cx="50" cy="50" r="38" fill="transparent" stroke="var(--brand-primary)" strokeWidth="8" strokeDasharray="110 240" strokeDashoffset="-5" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="38" fill="transparent" stroke="var(--brand-secondary)" strokeWidth="8" strokeDasharray="60 240" strokeDashoffset="-125" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="38" fill="transparent" stroke="#60a5fa" strokeWidth="8" strokeDasharray="40 240" strokeDashoffset="-195" strokeLinecap="round" />
                  </svg>
                  <div className="donut-center-label">
                    <span className="donut-val">76%</span>
                    <span className="donut-desc">Direct</span>
                  </div>
                </div>
                <div className="donut-legend">
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "var(--brand-primary)" }} />
                    <span>Grocery</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "var(--brand-secondary)" }} />
                    <span>Dairy</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#60a5fa" }} />
                    <span>Snacks</span>
                  </div>
                </div>
              </div>

              <div className="landing-card card-spending-frequency">
                <div className="card-header-stats">
                  <span className="card-label">Sales Activity</span>
                  <div className="card-value-group">
                    <span className="card-value">$1,840</span>
                    <span className="card-trend positive">+14.2%</span>
                  </div>
                </div>
                <div className="line-chart-wrapper">
                  <svg viewBox="0 0 180 80" className="line-chart-svg">
                    <line x1="0" y1="20" x2="180" y2="20" stroke="#27272a" strokeWidth="0.75" strokeDasharray="3 3" />
                    <line x1="0" y1="50" x2="180" y2="50" stroke="#27272a" strokeWidth="0.75" strokeDasharray="3 3" />
                    <path d="M 10 60 C 30 30, 50 50, 70 30 C 90 10, 110 40, 130 20 C 150 50, 160 30, 170 35" fill="none" stroke="var(--brand-primary)" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="170" cy="35" r="4" fill="var(--brand-primary)" stroke="#18181b" strokeWidth="1.5" />
                  </svg>
                  <div className="chart-x-labels">
                    <span>MON</span><span>TUE</span><span>WED</span><span className="active">THU</span><span>FRI</span><span>SAT</span>
                  </div>
                </div>
              </div>

              <div className="landing-card card-weekly-plan">
                <div className="card-header-stats">
                  <span className="card-label">Weekly Revenue</span>
                  <div className="card-value-group">
                    <span className="card-value">$14,250</span>
                    <span className="card-trend positive">+8.3%</span>
                  </div>
                </div>
                <div className="area-chart-wrapper">
                  <svg viewBox="0 0 340 120" className="area-chart-svg">
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brand-secondary)" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="var(--brand-secondary)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <line x1="10" y1="20" x2="330" y2="20" stroke="#27272a" strokeWidth="0.75" strokeDasharray="3 3" />
                    <line x1="10" y1="55" x2="330" y2="55" stroke="#27272a" strokeWidth="0.75" strokeDasharray="3 3" />
                    <line x1="10" y1="90" x2="330" y2="90" stroke="#27272a" strokeWidth="0.75" strokeDasharray="3 3" />
                    {/* Filled Area */}
                    <path d="M 10 110 C 50 90, 80 70, 120 85 C 160 100, 200 55, 240 40 C 280 25, 310 60, 330 30 L 330 120 L 10 120 Z" fill="url(#areaGrad)" />
                    {/* Top Path */}
                    <path d="M 10 110 C 50 90, 80 70, 120 85 C 160 100, 200 55, 240 40 C 280 25, 310 60, 330 30" fill="none" stroke="var(--brand-secondary)" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="330" cy="30" r="4" fill="var(--brand-secondary)" stroke="#18181b" strokeWidth="1.5" />
                  </svg>
                  <div className="chart-x-labels-long">
                    <span>AUG 21</span><span>AUG 22</span><span>AUG 23</span><span className="active">AUG 24</span><span>AUG 25</span><span>AUG 26</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="saas-features">
          <div className="section-header">
            <h2>Everything you need to grow your retail store</h2>
            <p>Ditch paper ledgers and complex software. Hisaab puts all your shop operations in one premium command center.</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon"><Receipt size={24} /></div>
              <h3>Lightning Fast Billing</h3>
              <p>Generate digital receipts in seconds. Print thermal receipts or share instantly with customers via WhatsApp.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Barcode size={24} /></div>
              <h3>Barcode Scanner</h3>
              <p>Add items to cart instantly using your built-in webcam scanner or any external laser scanner.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Brain size={24} /></div>
              <h3>AI OCR Supplier Invoices</h3>
              <p>Upload a photo of your supplier invoice and watch our vision AI automatically extract and insert new products into your inventory.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Wallet size={24} /></div>
              <h3>Digital Udhaar Book</h3>
              <p>Keep track of customer credit balances, log payments, and view outstanding credit balances at a glance.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><TrendingUp size={24} /></div>
              <h3>Analytics Dashboard</h3>
              <p>Identify best-selling products, monitor net margins, and track sales performance with real-time graphs.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Store size={24} /></div>
              <h3>Multi-Store Ready</h3>
              <p>Configure store branding, receipt footers, prefixes, and customize experience to match your unique brand identity.</p>
            </div>
          </div>
        </section>



        <footer className="saas-footer">
          <div className="footer-content">
            <div className="saas-brand">
              <Hexagon size={18} />
              <span>Hisaab</span>
            </div>
            <p>&copy; 2026 Hisaab POS Inc. All rights reserved. Designed for modern retailers.</p>
          </div>
        </footer>
      </div>
    );
  }

  function renderAuth() {
    const isLogin = activeTab === "signin";
    const isRegister = activeTab === "signup";
    const isForgotPassword = activeTab === "forgot-password";
    const isResetPassword = activeTab === "reset-password";

    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo" onClick={() => setActiveTab("landing")}>
            <Hexagon size={28} strokeWidth={2.5} />
            <span>Hisaab</span>
          </div>

          <h2>
            {isLogin && "Welcome Back"}
            {isRegister && "Create your account"}
            {isForgotPassword && "Reset your password"}
            {isResetPassword && "Set a new password"}
          </h2>
          <p className="auth-subtitle">
            {isLogin && "Log in to access your dashboard and manage store operations."}
            {isRegister && "Start tracking inventory, billing, and customer credit books."}
            {isForgotPassword && "Enter your email to receive a password reset link."}
            {isResetPassword && "Choose a secure password for your account."}
          </p>

          {authError && (
            <div className="auth-alert">
              <AlertTriangle size={16} />
              <span>{authError}</span>
            </div>
          )}

          {isForgotPassword && resetEmailSent ? (
            <div className="auth-success-message" style={{ textAlign: "center", padding: "1rem 0" }}>
              <div style={{ display: "inline-flex", padding: "0.75rem", borderRadius: "50%", backgroundColor: "rgba(16, 185, 129, 0.15)", marginBottom: "1rem" }}>
                <CheckCircle2 size={32} color="#10b981" />
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "0.5rem" }}>Email Sent!</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>Please check your inbox for the password reset link.</p>
              <button className="btn btn-secondary btn-block" onClick={() => { setResetEmailSent(false); setActiveTab("signin"); }}>
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              <form 
                onSubmit={
                  isLogin ? handleLogin : 
                  isRegister ? handleRegister : 
                  isForgotPassword ? handleForgotPassword : 
                  handleResetPassword
                } 
                className="auth-form"
              >
                {isRegister && (
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Amit Sharma"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      required
                    />
                  </div>
                )}

                {!isResetPassword && (
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="you@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value.trim())}
                      required
                    />
                  </div>
                )}

                {(isLogin || isRegister || isResetPassword) && (
                  <div className="form-group">
                    <div className="form-label-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label">{isResetPassword ? "New Password" : "Password"}</label>
                      {isLogin && (
                        <button 
                          type="button" 
                          className="auth-link-btn" 
                          style={{ fontSize: '0.8rem', background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', padding: 0 }}
                          onClick={() => { setAuthError(""); setActiveTab("forgot-password"); }}
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      required
                    />
                  </div>
                )}

                <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={authLoading}>
                  {authLoading ? <div className="spinner-sm" /> : (
                    isLogin ? "Sign In" : 
                    isRegister ? "Register Account" : 
                    isForgotPassword ? "Send Reset Link" : 
                    "Reset Password"
                  )}
                </button>
              </form>

              {(isLogin || isRegister) && (
                <>
                  <div className="auth-divider" style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0' }}>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
                    <span style={{ padding: '0 0.75rem', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>or</span>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-secondary btn-block google-login-btn"
                    style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    onClick={handleGoogleLogin}
                    disabled={authLoading}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18">
                      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A9 9 0 0 0 9 18z" fill="#34A853"/>
                      <path d="M3.964 10.707c-.18-.54-.282-1.119-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.896 11.426 0 9 0A9 9 0 0 0 .957 4.961l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </>
              )}

              <div className="auth-toggle" style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
                {isLogin && (
                  <span>Don't have an account? <button style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', padding: 0, fontWeight: 'bold' }} onClick={() => { setAuthError(""); setActiveTab("signup"); }}>Sign Up</button></span>
                )}
                {isRegister && (
                  <span>Already have an account? <button style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', padding: 0, fontWeight: 'bold' }} onClick={() => { setAuthError(""); setActiveTab("signin"); }}>Sign In</button></span>
                )}
                {(isForgotPassword || isResetPassword) && (
                  <button style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', padding: 0, fontWeight: 'bold' }} onClick={() => { setAuthError(""); setActiveTab("signin"); }}>Back to Sign In</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  function renderOnboarding() {
    function handleOnboardLogoChange(e) {
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
      reader.onload = () => setOnboardLogo(reader.result);
      reader.onerror = () => showNotice("Could not read logo file", "error");
      reader.readAsDataURL(file);
    }

    return (
      <div className="onboard-container">
        <div className="onboard-card">
          <div className="onboard-logo">
            <Hexagon size={28} strokeWidth={2.5} />
            <span>Hisaab</span>
          </div>
          <h2>Set up your shop profile</h2>
          <p className="onboard-subtitle">Customize your store billing details. You can change these anytime in settings.</p>

          <form onSubmit={handleOnboard} className="onboard-form">
            <div className="onboard-grid">
              <div className="onboard-logo-section">
                <div className="logo-uploader">
                  <div className="logo-preview">
                    {onboardLogo ? (
                      <img src={onboardLogo} alt="Logo" />
                    ) : (
                      <Hexagon size={36} strokeWidth={1.5} style={{ color: "var(--brand-primary)" }} />
                    )}
                  </div>
                  <label className="btn btn-secondary btn-sm">
                    <ImagePlus size={15} /> Upload Logo
                    <input type="file" accept="image/*" onChange={handleOnboardLogoChange} />
                  </label>
                </div>
              </div>

              <div className="onboard-fields-section">
                <div className="form-group">
                  <label className="form-label">Store Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Sharma Kirana Mart"
                    value={onboardStoreName}
                    onChange={(e) => setOnboardStoreName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Owner Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Amit Sharma"
                    value={onboardOwnerName}
                    onChange={(e) => setOnboardOwnerName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Owner Phone Number *</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="10-digit number"
                    value={onboardPhone}
                    onChange={(e) => setOnboardPhone(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Store Category *</label>
                  <select
                    className="form-input"
                    value={onboardCategory}
                    onChange={(e) => setOnboardCategory(e.target.value)}
                    required
                  >
                    <option value="Grocery Store">Grocery / Kirana Store</option>
                    <option value="Apparel & Clothing">Apparel & Clothing Store</option>
                    <option value="Electronics & Mobile">Electronics & Mobile Shop</option>
                    <option value="Pharmacy & Healthcare">Pharmacy & Healthcare</option>
                    <option value="Restaurant / Cafe">Restaurant / Cafe</option>
                    <option value="Hardware & Tools">Hardware & Tools</option>
                    <option value="Other Retail">Other Retail Business</option>
                  </select>
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block onboard-submit">
              Complete Setup &amp; Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  const isAuthView = ["landing", "signin", "signup", "onboarding"].includes(activeTab);

  function renderErrorFallback() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '20px', textAlign: 'center' }}>
        <div style={{ padding: '15px', borderRadius: '50%', backgroundColor: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', marginBottom: '20px' }}>
          <AlertCircle size={48} />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '10px' }}>Failed to Load Store Data</h2>
        <p style={{ maxWidth: '500px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
          We encountered a connection issue while fetching your store settings. Please try again.
        </p>
        <button className="btn btn-primary" onClick={() => {
          setAppLoading(true);
          setStoreFetchStatus("loading");
          refresh()
            .catch((err) => showNotice(err.message, "error"))
            .finally(() => setAppLoading(false));
        }}>
          Retry Connection
        </button>
      </div>
    );
  }

  function renderPremiumSkeleton() {
    return (
      <div className="app-container" style={{ backgroundColor: "var(--bg-primary)" }}>
        {/* Skeleton Sidebar */}
        <aside className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`} style={{ pointerEvents: "none" }}>
          <div className="sidebar-header">
            <div className="brand">
              <div className="brand-icon skeleton-shimmer" style={{ background: "none" }} />
              {!isSidebarCollapsed && <div className="skeleton-block skeleton-shimmer" style={{ width: "80px", height: "18px" }} />}
            </div>
          </div>
          <div className="sidebar-nav" style={{ gap: "12px", padding: "24px 16px" }}>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", height: "36px" }}>
                <div className="skeleton-circle skeleton-shimmer" style={{ width: "24px", height: "24px" }} />
                {!isSidebarCollapsed && <div className="skeleton-block skeleton-shimmer" style={{ width: "100px", height: "14px" }} />}
              </div>
            ))}
          </div>
        </aside>

        {/* Skeleton Main Content */}
        <div className="main-wrapper" style={{ overflow: "hidden" }}>
          {/* Skeleton Navbar */}
          <header className="navbar" style={{ height: "var(--navbar-height)", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
            <div className="skeleton-block skeleton-shimmer" style={{ width: "180px", height: "20px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div className="skeleton-circle skeleton-shimmer" style={{ width: "32px", height: "32px" }} />
              <div className="skeleton-circle skeleton-shimmer" style={{ width: "32px", height: "32px" }} />
            </div>
          </header>

          <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px", height: "calc(100vh - var(--navbar-height))", overflow: "hidden" }}>
            {/* Page Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="skeleton-title skeleton-shimmer" style={{ width: "140px", height: "28px", marginBottom: "6px" }} />
                <div className="skeleton-text skeleton-shimmer" style={{ width: "200px", height: "14px" }} />
              </div>
              <div className="skeleton-block skeleton-shimmer" style={{ width: "120px", height: "40px", borderRadius: "8px" }} />
            </div>

            {/* KPI Grid */}
            <div className="kpi-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <div className="skeleton-card" key={i} style={{ height: "105px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div className="skeleton-block skeleton-shimmer" style={{ width: "80px", height: "12px" }} />
                    <div className="skeleton-circle skeleton-shimmer" style={{ width: "28px", height: "28px" }} />
                  </div>
                  <div className="skeleton-block skeleton-shimmer" style={{ width: "120px", height: "24px" }} />
                  <div className="skeleton-block skeleton-shimmer" style={{ width: "90px", height: "10px" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Route Guards
  if (!currentUser && !["landing", "signin", "signup", "forgot-password", "reset-password"].includes(activeTab)) {
    return renderLanding();
  }

  if (appLoading && currentUser && !["landing", "signin", "signup", "forgot-password", "reset-password"].includes(activeTab)) {
    return renderPremiumSkeleton();
  }

  if (storeFetchStatus === "error" && currentUser && !["landing", "signin", "signup", "forgot-password", "reset-password"].includes(activeTab)) {
    return renderErrorFallback();
  }

  if (currentUser && storeFetchStatus === "success" && (!store || !store.store_name) && !["landing", "signin", "signup", "forgot-password", "reset-password", "onboarding"].includes(activeTab)) {
    return renderOnboarding();
  }

  if (activeTab === "landing") {
    return renderLanding();
  }

  if (activeTab === "signin" || activeTab === "signup") {
    return renderAuth();
  }

  if (activeTab === "onboarding") {
    return renderOnboarding();
  }

  const lowStockList = dashboard?.low_stock_products || [];

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
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={handleSetSidebarCollapsed}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <div className="main-wrapper">
        <Navbar
          store={store}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          productQuery={productQuery} setProductQuery={setProductQuery}
          historyQuery={historyQuery} setHistoryQuery={setHistoryQuery}
          theme={theme}
          toggleTheme={toggleTheme}
          customerQuery={customerQuery} setCustomerQuery={setCustomerQuery}
          purchaseQuery={purchaseQuery} setPurchaseQuery={setPurchaseQuery}
          lowStockList={lowStockList}
          isNotifOpen={isNotifOpen} setIsNotifOpen={setIsNotifOpen} notifRef={notifRef}
          isProfileOpen={isProfileOpen} setIsProfileOpen={setIsProfileOpen} profileRef={profileRef}
          setIsSidebarOpen={setIsSidebarOpen}
          getInitials={getInitials}
          handleLogout={handleLogout}
          products={products}
          customers={customers}
          sales={sales}
          notifications={getNotifications()}
          readNotifIds={readNotifIds}
          markNotifRead={markNotifRead}
          markAllNotifsRead={markAllNotifsRead}
        />

        <main className="page-content">

          {activeTab === "dashboard" && (
            <Dashboard
              store={store}
              dashboard={dashboard}
              sales={sales}
              dashboardLoading={dashboardLoading}
              setActiveTab={setActiveTab}
              setEditingProduct={setEditingProduct}
              setEditingCustomer={setEditingCustomer}
              setEditingPurchase={setEditingPurchase}
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
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              lastSale={lastSale}
              productQuery={productQuery}
              setProductQuery={setProductQuery}
              scannerOn={scannerOn}
              setScannerOn={setScannerOn}
              showNotice={showNotice}
              completeSale={completeSale}
              shareReceipt={shareReceipt}
              api={api}
              refresh={refresh}
              addProductToCart={addProductToCart}
              startCreateProductWithBarcode={startCreateProductWithBarcode}
              store={store}
            />
          )}

          {activeTab === "products" && (
            <Inventory
              products={products}
              filteredProducts={filteredProducts}
              editingProduct={editingProduct}
              setEditingProduct={setEditingProduct}
              saveProduct={saveProduct}
              setProducts={setProducts}
              setCart={setCart}
              store={store}
              showNotice={showNotice}
              api={api}
              refresh={refresh}
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
              sales={sales}
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

          {activeTab === "history" && (
            <div className="fade-in">
              <div className="page-header">
                <h2 className="page-title">Transaction History</h2>
              </div>

              {/* Filter controls */}
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "20px",
                alignItems: "center",
                background: "var(--bg-secondary)",
                padding: "12px 16px",
                borderRadius: "12px",
                border: "1px solid var(--border-color)"
              }}>
                <div className="form-group" style={{ margin: 0, minWidth: "140px" }}>
                  <label className="form-label" style={{ fontSize: "11px", marginBottom: "4px" }}>Date Filter</label>
                  <select
                    className="form-input"
                    value={historyDateFilter}
                    onChange={(e) => setHistoryDateFilter(e.target.value)}
                    style={{ padding: "6px 10px", fontSize: "13px" }}
                  >
                    <option value="all">All Dates</option>
                    <option value="today">Today</option>
                    <option value="week">Past Week</option>
                    <option value="month">Past Month</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>

                {historyDateFilter === "custom" && (
                  <>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "11px", marginBottom: "4px" }}>Start Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={historyStartDate}
                        onChange={(e) => setHistoryStartDate(e.target.value)}
                        style={{ padding: "5px 10px", fontSize: "13px" }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "11px", marginBottom: "4px" }}>End Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={historyEndDate}
                        onChange={(e) => setHistoryEndDate(e.target.value)}
                        style={{ padding: "5px 10px", fontSize: "13px" }}
                      />
                    </div>
                  </>
                )}

                <div className="form-group" style={{ margin: 0, minWidth: "150px" }}>
                  <label className="form-label" style={{ fontSize: "11px", marginBottom: "4px" }}>Payment Method</label>
                  <select
                    className="form-input"
                    value={historyPaymentFilter}
                    onChange={(e) => setHistoryPaymentFilter(e.target.value)}
                    style={{ padding: "6px 10px", fontSize: "13px" }}
                  >
                    <option value="all">All Methods</option>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Udhaar">Udhaar</option>
                  </select>
                </div>

                {(historyDateFilter !== "all" || historyPaymentFilter !== "all") && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setHistoryDateFilter("all");
                      setHistoryPaymentFilter("all");
                      setHistoryStartDate("");
                      setHistoryEndDate("");
                    }}
                    style={{ marginTop: "16px", padding: "6px 10px", fontSize: "12px" }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              <div className="card">
                {sales.length === 0 ? (
                  <div className="empty-state-v2">
                    <div className="empty-state-v2-icon"><HistoryIcon size={48} /></div>
                    <h3 className="empty-state-v2-title">No transactions yet</h3>
                    <p className="empty-state-v2-desc">Start billing to see your transaction history here.</p>
                    <button className="btn btn-primary btn-sm" onClick={() => setActiveTab("billing")}>Start Billing</button>
                  </div>
                ) : filteredSales.length === 0 ? (
                  <div className="empty-state-v2">
                    <div className="empty-state-v2-icon"><HistoryIcon size={48} /></div>
                    <h3 className="empty-state-v2-title">No matching transactions</h3>
                    <p className="empty-state-v2-desc">Try clearing your filters or search query.</p>
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                      setHistoryQuery("");
                      setHistoryDateFilter("all");
                      setHistoryPaymentFilter("all");
                      setHistoryStartDate("");
                      setHistoryEndDate("");
                    }}>Clear Filters</button>
                  </div>
                ) : (
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
                                  <small style={{ color: sale.payment_method === "Udhaar" ? "var(--warning)" : "var(--success)" }}>
                                    {sale.payment_method || "Cash"}
                                  </small>
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
                                <button className="btn btn-ghost btn-sm" onClick={() => downloadInvoice(sale.id, sale.bill_number).catch(err => showNotice(err.message, "error"))} title="Download PDF">
                                  <Download size={14} /> PDF
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => printInvoice(sale.id).catch(err => showNotice(err.message, "error"))} title="Print">
                                  <FileText size={14} />
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => shareReceipt(sale)} title="Share via WhatsApp">
                                  <MessageCircle size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Settings ─────────────────────────────────────────── */}
          {activeTab === "settings" && (
            <SettingsPage
              store={store}
              dashboard={dashboard}
              products={products}
              customers={customers}
              sales={sales}
              purchases={purchases}
              saveStore={saveStore}
              showNotice={showNotice}
            />
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