import React, { useRef, useState, useEffect, useMemo } from "react";
import { Package, Plus, Edit2, Trash2, Camera, X, Search, BarChart2, AlertTriangle, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/library";
import { fmt } from "../services/api";

// Categories per store type
const STORE_CATEGORIES = {
  "Grocery Store":         ["Fruits & Vegetables", "Dairy & Eggs", "Grains & Pulses", "Snacks & Beverages", "Spices & Condiments", "Personal Care", "Household", "Other"],
  "Apparel & Clothing":    ["Men's Clothing", "Women's Clothing", "Kids' Clothing", "Footwear", "Accessories", "Innerwear", "Ethnic Wear", "Other"],
  "Electronics & Mobile":  ["Mobile Phones", "Accessories", "Laptops & Tablets", "Cables & Chargers", "Audio", "Smart Devices", "Appliances", "Other"],
  "Pharmacy & Healthcare": ["Prescription Medicines", "OTC Medicines", "Vitamins & Supplements", "Personal Care", "Baby Care", "Medical Devices", "Other"],
  "Restaurant / Cafe":     ["Beverages", "Starters", "Main Course", "Desserts", "Breads", "Combos", "Specials", "Other"],
  "Hardware & Tools":      ["Hand Tools", "Power Tools", "Plumbing", "Electrical", "Paints", "Fasteners", "Safety Equipment", "Other"],
  "Other Retail":          ["Category 1", "Category 2", "Category 3", "Other"],
  "Kirana Store":          ["Fruits & Vegetables", "Dairy & Eggs", "Grains & Pulses", "Snacks & Beverages", "Spices & Condiments", "Personal Care", "Household", "Other"],
  "Stationery Shop":       ["Pens & Pencils", "Notebooks & Diaries", "Art Supplies", "Office Supplies", "Files & Folders", "Other"],
  "General Retail":        ["Grocery", "Electronics", "Clothing", "Home & Kitchen", "Sports", "Toys", "Other"],
  "Pharmacy":              ["Prescription Medicines", "OTC Medicines", "Vitamins & Supplements", "Personal Care", "Baby Care", "Medical Devices", "Other"],
  "Supermarket":           ["Fruits & Vegetables", "Dairy & Eggs", "Bakery", "Beverages", "Personal Care", "Household", "Electronics", "Other"],
  "Electronics":           ["Mobile Phones", "Accessories", "Laptops & Tablets", "Cables & Chargers", "Audio", "Smart Devices", "Appliances", "Other"],
};

function getCategoriesForStore(storeCategory = "", extraCategories = [], removedCategories = []) {
  const base = STORE_CATEGORIES[storeCategory] || ["General", "Other"];
  const merged = [...base];
  extraCategories.forEach((c) => {
    if (!merged.some((b) => b.toLowerCase() === c.toLowerCase())) {
      const otherIdx = merged.findIndex((b) => b.toLowerCase() === "other");
      if (otherIdx >= 0) merged.splice(otherIdx, 0, c);
      else merged.push(c);
    }
  });
  return merged.filter(c => !removedCategories.some(r => r.toLowerCase() === c.toLowerCase()));
}

// Generate a consistent color from a string
const THUMB_COLORS = [
  "#1e3a8a","#065f46","#7c3aed","#b45309","#0e7490","#be123c",
  "#0369a1","#166534","#6d28d9","#92400e","#0f766e","#9f1239",
];
function thumbColor(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return THUMB_COLORS[h % THUMB_COLORS.length];
}
function thumbInitials(name = "") {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function Inventory({ products, filteredProducts, editingProduct, setEditingProduct, saveProduct, setProducts, setCart, store, showNotice, api, refresh }) {
  const [productToLink, setProductToLink] = useState(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categoryEdits, setCategoryEdits] = useState({});
  const [savingCategories, setSavingCategories] = useState(false);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [isProductsExpanded, setIsProductsExpanded] = useState(true);

  // Inventory-level search + category filter
  const [invSearch, setInvSearch] = useState("");
  const [activePill, setActivePill] = useState("All");

  // Product Deletion State
  const [productToDelete, setProductToDelete] = useState(null);
  const [showBulkDeleteProductsModal, setShowBulkDeleteProductsModal] = useState(false);

  // Category Deletion State
  const [categoriesToDelete, setCategoriesToDelete] = useState([]);
  const [categoryReassignTarget, setCategoryReassignTarget] = useState("Uncategorized");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState({});
  const [deletingCategories, setDeletingCategories] = useState(false);

  const videoRef   = useRef(null);
  const zxingRef   = useRef(null);
  const formVideoRef = useRef(null);

  const [formBarcode, setFormBarcode] = useState("");
  const [formScannerOn, setFormScannerOn] = useState(false);

  const extraCategories = store?.extra_categories || [];
  const removedCategories = store?.removed_categories || [];
  const allCategories = getCategoriesForStore(store?.store_category, extraCategories, removedCategories);

  useEffect(() => {
    setSelectedCategory(editingProduct?.category || "");
    setFormBarcode(editingProduct?.barcode || "");
    setFormScannerOn(false);
  }, [editingProduct?.id]);

  // Stats
  const inventoryValue = useMemo(() =>
    products.reduce((sum, p) => sum + (p.selling_price || 0) * (p.stock || 0), 0), [products]);
  const lowStockCount = useMemo(() =>
    products.filter(p => p.stock <= 10).length, [products]);

  // Filtered table products
  const tableProducts = useMemo(() => {
    let list = filteredProducts;
    if (invSearch.trim()) {
      const q = invSearch.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.barcode?.includes(q)
      );
    }
    if (activePill !== "All") {
      list = list.filter(p => p.category === activePill);
    }
    return list;
  }, [filteredProducts, invSearch, activePill]);

  async function persistCategories(next, removed = null) {
    setSavingCategories(true);
    try {
      const body = { categories: next };
      if (removed !== null) body.removed_categories = removed;
      else body.removed_categories = removedCategories;
      await api("/store/categories", { method: "PUT", body: JSON.stringify(body) });
      await refresh();
    } catch (err) {
      if (showNotice) showNotice(err.message, "error");
    } finally {
      setSavingCategories(false);
    }
  }

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    if (allCategories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      if (showNotice) showNotice("Category already exists", "error");
      return;
    }
    await persistCategories([...extraCategories, name]);
    setSelectedCategory(name);
    setNewCategoryName("");
    setShowAddCategory(false);
    if (showNotice) showNotice(`Category "${name}" added`);
  }

  async function renameCategory(oldName, newName) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) {
      setCategoryEdits((cur) => { const n = { ...cur }; delete n[oldName]; return n; });
      return;
    }
    if (allCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase() && c !== oldName)) {
      if (showNotice) showNotice("A category with this name already exists", "error");
      return;
    }
    const affected = products.filter(p => p.category === oldName);
    for (const p of affected) {
      await api(`/products/${p.id}`, { method: "PUT", body: JSON.stringify({ ...p, category: trimmed }) });
    }
    setProducts(cur => cur.map(p => p.category === oldName ? { ...p, category: trimmed } : p));
    const isCustom = extraCategories.includes(oldName);
    let next;
    if (isCustom) {
      next = extraCategories.map((c) => (c === oldName ? trimmed : c));
    } else {
      next = [...extraCategories, trimmed];
    }
    await persistCategories(next);
    setCategoryEdits((cur) => { const n = { ...cur }; delete n[oldName]; return n; });
    if (showNotice) showNotice(`Category renamed to "${trimmed}"`);
  }

  const selectedCatCount = Object.values(selectedCategoryIds).filter(Boolean).length;

  function toggleCategorySelect(cat) {
    setSelectedCategoryIds(cur => ({ ...cur, [cat]: !cur[cat] }));
  }
  function handleAttemptDeleteCategory(cat) { checkAndPromptCategoryDelete([cat]); }
  function handleBulkDeleteCategories() {
    const cats = Object.keys(selectedCategoryIds).filter(c => selectedCategoryIds[c]);
    if (cats.length === 0) return;
    checkAndPromptCategoryDelete(cats);
  }
  function checkAndPromptCategoryDelete(cats) {
    const affected = products.filter(p => cats.includes(p.category));
    if (affected.length > 0) {
      setCategoriesToDelete(cats);
      setCategoryReassignTarget("Uncategorized");
    } else {
      executeCategoryDelete(cats);
    }
  }
  async function executeCategoryDelete(cats, reassignTarget = null) {
    setDeletingCategories(true);
    try {
      if (reassignTarget) {
        const affected = products.filter(p => cats.includes(p.category));
        for (const p of affected) {
          await api(`/products/${p.id}`, { method: "PUT", body: JSON.stringify({ ...p, category: reassignTarget }) });
        }
        setProducts(cur => cur.map(p => cats.includes(p.category) ? { ...p, category: reassignTarget } : p));
      }
      const newRemoved = [...removedCategories];
      for (const cat of cats) {
        if (!extraCategories.includes(cat) && !newRemoved.includes(cat)) newRemoved.push(cat);
      }
      const next = extraCategories.filter(c => !cats.includes(c));
      await persistCategories(next, newRemoved);
      setSelectedCategoryIds({});
      setCategoriesToDelete([]);
      if (showNotice) showNotice(`Deleted ${cats.length} categor${cats.length > 1 ? "ies" : "y"}`);
      await refresh();
    } catch (err) {
      if (showNotice) showNotice(err.message, "error");
    } finally {
      setDeletingCategories(false);
    }
  }

  useEffect(() => { return () => closeScanner(); }, []);

  function closeScanner() {
    if (zxingRef.current) { try { zxingRef.current.reset(); } catch {} }
    setProductToLink(null);
  }

  function openScannerForProduct(product) {
    setProductToLink(product.id);
    setTimeout(async () => {
      try {
        if (!zxingRef.current) zxingRef.current = new BrowserMultiFormatReader();
        const video = videoRef.current;
        if (!video) { setProductToLink(null); return; }
        await zxingRef.current.decodeFromVideoDevice(undefined, video, async (result, err) => {
          if (result) {
            const code = result.getText();
            closeScanner();
            try {
              await api(`/products/${product.id}/assign-barcode`, { method: "POST", body: JSON.stringify({ barcode: code }) });
              if (showNotice) showNotice(`Barcode assigned: ${code}`);
              await refresh();
            } catch (assignErr) {
              if (assignErr.message && assignErr.message.includes("already has a barcode assigned")) {
                if (window.confirm(`Product already has a barcode assigned. Replace with ${code}?`)) {
                  try {
                    await api(`/products/${product.id}/assign-barcode`, { method: "POST", body: JSON.stringify({ barcode: code, force: true }) });
                    if (showNotice) showNotice(`Barcode replaced: ${code}`);
                    await refresh();
                  } catch (forceErr) { if (showNotice) showNotice(forceErr.message, "error"); }
                }
              } else { if (showNotice) showNotice(assignErr.message, "error"); }
            }
          }
          if (err && err.name !== "NotFoundException") console.error(err);
        });
      } catch (err) {
        if (showNotice) showNotice(`Camera error: ${err.message}`, "error");
        closeScanner();
      }
    }, 100);
  }

  const [selectedIds, setSelectedIds] = useState({});
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;
  const allSelected = tableProducts.length > 0 && tableProducts.every((p) => selectedIds[p.id]);

  function toggleSelectAll() {
    setSelectedIds((cur) => {
      if (allSelected) return {};
      const next = {};
      tableProducts.forEach((p) => { next[p.id] = true; });
      return next;
    });
  }
  function toggleSelectOne(id) { setSelectedIds((cur) => ({ ...cur, [id]: !cur[id] })); }
  function promptBulkDelete() {
    const ids = Object.keys(selectedIds).filter((id) => selectedIds[id]);
    if (ids.length === 0) return;
    setShowBulkDeleteProductsModal(true);
  }
  async function executeBulkDeleteProducts() {
    const ids = Object.keys(selectedIds).filter((id) => selectedIds[id]);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      for (const id of ids) await api(`/products/${id}`, { method: "DELETE" });
      setProducts(cur => cur.filter(p => !ids.includes(p.id)));
      setCart(cur => cur.filter(l => !ids.includes(l.product_id)));
      setSelectedIds({});
      setShowBulkDeleteProductsModal(false);
      if (showNotice) showNotice(`${ids.length} product${ids.length > 1 ? "s" : ""} deleted`);
      await refresh();
    } catch (err) { if (showNotice) showNotice(err.message, "error"); }
    finally { setBulkDeleting(false); }
  }
  async function executeSingleDeleteProduct() {
    if (!productToDelete) return;
    try {
      await api(`/products/${productToDelete.id}`, { method: "DELETE" });
      setProducts((cur) => cur.filter((p) => p.id !== productToDelete.id));
      setCart((cur) => cur.filter((l) => l.product_id !== productToDelete.id));
      if (showNotice) showNotice("Product deleted");
      setProductToDelete(null);
      await refresh();
    } catch (err) { if (showNotice) showNotice(err.message, "error"); }
  }

  // Unique categories present in products for pill filter
  const presentCategories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return ["All", ...Array.from(cats)];
  }, [products]);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2 className="page-title">Products</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          {selectedCount > 0 && (
            <button className="btn btn-danger" onClick={promptBulkDelete}>
              <Trash2 size={18} /> Delete Selected ({selectedCount})
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setEditingProduct({})}>
            <Plus size={18} /> Add Product
          </button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="inv-stats">
        <div className="inv-stat">
          <div className="inv-stat-icon navy"><DollarSign size={18} /></div>
          <div>
            <div className="inv-stat-label">Inventory Value</div>
            <div className="inv-stat-value">{fmt(inventoryValue)}</div>
          </div>
        </div>
        <div className="inv-stat">
          <div className="inv-stat-icon green"><BarChart2 size={18} /></div>
          <div>
            <div className="inv-stat-label">Products</div>
            <div className="inv-stat-value">{products.length}</div>
          </div>
        </div>
        <div className="inv-stat">
          <div className="inv-stat-icon amber"><AlertTriangle size={18} /></div>
          <div>
            <div className="inv-stat-label">Low Stock</div>
            <div className="inv-stat-value" style={{ color: lowStockCount > 0 ? "var(--warning)" : undefined }}>{lowStockCount}</div>
          </div>
        </div>
      </div>

      {/* ── Search + Filter bar ── */}
      <div className="inv-topbar">
        <div className="inv-search">
          <Search size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
          <input
            placeholder="Search products, categories, barcodes…"
            value={invSearch}
            onChange={e => setInvSearch(e.target.value)}
          />
          {invSearch && (
            <button onClick={() => setInvSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", display: "flex" }}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Category Pills ── */}
      <div className="inv-pills">
        {presentCategories.map(cat => (
          <button
            key={cat}
            className={`inv-pill ${activePill === cat ? "active" : ""}`}
            onClick={() => setActivePill(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {editingProduct && (
        <div className="card" style={{ marginBottom: "24px" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setIsProductsExpanded(!isProductsExpanded)}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {isProductsExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              <h3 className="card-title">{editingProduct.id ? "Edit Product" : "New Product"}</h3>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEditingProduct(null); }}>Cancel</button>
          </div>
          {isProductsExpanded && (
            <div className="card-body">
              <form onSubmit={saveProduct}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Product Name</label>
                  <input className="form-input" required name="name" defaultValue={editingProduct.name || ""} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Barcode</label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <input
                      className="form-input"
                      name="barcode"
                      placeholder="Enter barcode or scan/generate…"
                      value={formBarcode}
                      onChange={(e) => setFormBarcode(e.target.value)}
                      style={{ flex: 1, minWidth: "140px" }}
                    />
                    <button type="button" className="btn btn-secondary btn-sm" style={{ height: "40px", display: "flex", alignItems: "center", gap: "5px", whiteSpace: "nowrap" }}
                      onClick={() => {
                        setFormScannerOn(true);
                        setTimeout(async () => {
                          try {
                            if (!zxingRef.current) zxingRef.current = new BrowserMultiFormatReader();
                            const video = formVideoRef.current;
                            if (!video) { setFormScannerOn(false); return; }
                            await zxingRef.current.decodeFromVideoDevice(undefined, video, (result, err) => {
                              if (result) {
                                setFormBarcode(result.getText());
                                setFormScannerOn(false);
                                if (zxingRef.current) try { zxingRef.current.reset(); } catch {}
                                if (showNotice) showNotice(`Barcode scanned: ${result.getText()}`);
                              }
                              if (err && err.name !== "NotFoundException") console.error(err);
                            });
                          } catch (err) { if (showNotice) showNotice(`Camera error: ${err.message}`, "error"); setFormScannerOn(false); }
                        }, 100);
                      }}
                    >
                      <Camera size={15} /> Scan
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ height: "40px", display: "flex", alignItems: "center", gap: "5px", whiteSpace: "nowrap" }}
                      onClick={() => {
                        const code = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
                        setFormBarcode(code);
                        if (showNotice) showNotice(`Barcode generated: ${code}`);
                      }}
                    >
                      ↺ Generate
                    </button>
                  </div>
                  {formScannerOn && (
                    <div style={{ marginTop: "8px", position: "relative", borderRadius: "10px", overflow: "hidden", border: "2px solid var(--brand-primary)" }}>
                      <video ref={formVideoRef} style={{ width: "100%", maxHeight: "180px", objectFit: "cover", display: "block" }} muted playsInline />
                      <button type="button" className="btn btn-danger btn-sm" style={{ position: "absolute", top: "8px", right: "8px", zIndex: 2 }}
                        onClick={() => { setFormScannerOn(false); if (zxingRef.current) try { zxingRef.current.reset(); } catch {} }}
                      >
                        <X size={14} /> Stop
                      </button>
                    </div>
                  )}
                  {formBarcode && (
                    <small style={{ marginTop: "4px", display: "block", color: "var(--text-secondary)" }}>Barcode: <strong>{formBarcode}</strong></small>
                  )}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", flexWrap: "wrap" }}>
                    <select className="form-input" required name="category" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={{ flex: 1, minWidth: "140px" }}>
                      <option value="" disabled>Select category…</option>
                      {allCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowAddCategory((v) => !v)} style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", padding: "0 14px", height: "40px", borderRadius: "8px", border: "1.5px solid var(--brand-primary-hover)", background: "var(--brand-primary-soft)", color: "#60a5fa", cursor: "pointer", fontWeight: 600, fontSize: "13px", whiteSpace: "nowrap" }}>
                      <Plus size={15} /> Add
                    </button>
                  </div>
                  {showAddCategory && (
                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                      <input className="form-input" placeholder="New category name…" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }} autoFocus style={{ flex: 1 }} />
                      <button type="button" className="btn btn-primary btn-sm" onClick={addCategory} disabled={savingCategories || !newCategoryName.trim()}>Add</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowAddCategory(false); setNewCategoryName(""); }}>Cancel</button>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Stock Quantity</label>
                  <input className="form-input" required type="number" min="0" name="stock" defaultValue={editingProduct.stock || ""} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Cost Price (₹)</label>
                  <input className="form-input" required type="number" min="0" step="0.01" name="cost_price" defaultValue={editingProduct.cost_price || ""} />
                </div>
                <div className="form-group">
                  <label className="form-label">Selling Price (₹)</label>
                  <input className="form-input" required type="number" min="0" step="0.01" name="selling_price" defaultValue={editingProduct.selling_price || ""} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select className="form-input" name="unit" defaultValue={editingProduct.unit || "Piece"}>
                    <option value="Piece">Piece</option>
                    <option value="Kg">Kg</option>
                    <option value="Gram">Gram</option>
                    <option value="Litre">Litre</option>
                  </select>
                </div>
                <div className="form-group" style={{ display: "flex", alignItems: "flex-end", paddingBottom: "4px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
                    <input type="checkbox" name="variable_price" defaultChecked={!!editingProduct.variable_price} style={{ width: "16px", height: "16px", accentColor: "var(--brand-primary-hover)" }} />
                    Price varies (fruits / veg)
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingProduct(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Product</button>
              </div>
            </form>
          </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {isCategoriesExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            <h3 className="card-title">Manage Categories</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }} onClick={(e) => e.stopPropagation()}>
            {selectedCatCount > 0 && (
              <button className="btn btn-danger btn-sm" onClick={handleBulkDeleteCategories} disabled={deletingCategories}>
                <Trash2 size={14} /> Delete Selected ({selectedCatCount})
              </button>
            )}
          </div>
        </div>
        {isCategoriesExpanded && (
          <div className="card-body" style={{ padding: "24px" }}>
          {allCategories.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {allCategories.map((cat) => {
                const isEditing = categoryEdits[cat] !== undefined;
                return (
                  <div key={cat} style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", transition: "all 0.2s" }} className="category-item-row">
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                      <input type="checkbox" className="label-checkbox" checked={!!selectedCategoryIds[cat]} onChange={() => toggleCategorySelect(cat)} />
                      {isEditing ? (
                        <div style={{ display: "flex", gap: "8px", flex: 1 }}>
                          <input className="form-input" value={categoryEdits[cat]} onChange={(e) => setCategoryEdits((cur) => ({ ...cur, [cat]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); renameCategory(cat, categoryEdits[cat]); } }} autoFocus style={{ flex: 1, maxWidth: "240px", padding: "4px 8px", fontSize: "13px" }} />
                          <button className="btn btn-primary btn-sm" disabled={savingCategories} onClick={() => renameCategory(cat, categoryEdits[cat])}>Save</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setCategoryEdits((cur) => { const n = { ...cur }; delete n[cat]; return n; })}>Cancel</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>{cat}</span>
                      )}
                    </div>
                    {!isEditing && (
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button className="btn btn-ghost btn-sm" title="Edit category" onClick={() => setCategoryEdits((cur) => ({ ...cur, [cat]: cat }))} style={{ padding: "6px", color: "var(--text-secondary)" }}><Edit2 size={14} /></button>
                        <button className="btn btn-ghost btn-sm text-danger" title="Delete category" disabled={deletingCategories} onClick={() => handleAttemptDeleteCategory(cat)} style={{ padding: "6px" }}><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>No categories yet.</p>
          )}
          {!showAddCategory ? (
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: "16px" }} onClick={() => setShowAddCategory(true)}>
              <Plus size={14} /> Add Category
            </button>
          ) : (
            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <input className="form-input" placeholder="New category name…" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }} autoFocus style={{ flex: 1, maxWidth: "320px" }} />
              <button type="button" className="btn btn-primary btn-sm" onClick={addCategory} disabled={savingCategories || !newCategoryName.trim()}>Add</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowAddCategory(false); setNewCategoryName(""); }}>Cancel</button>
            </div>
          )}
          <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "14px" }}>
            All categories can be renamed or deleted. Products in a deleted category will be reassigned.
          </p>
        </div>
        )}
      </div>

      <div className="card">
        {tableProducts.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>
                    <input type="checkbox" className="label-checkbox" checked={allSelected} onChange={toggleSelectAll} title="Select all" />
                  </th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Cost</th>
                  <th>Price</th>
                  <th>Status / Stock</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableProducts.map((product) => (
                  <tr key={product.id} className={selectedIds[product.id] ? "row-selected" : ""}>
                    <td>
                      <input type="checkbox" className="label-checkbox" checked={!!selectedIds[product.id]} onChange={() => toggleSelectOne(product.id)} />
                    </td>
                    <td>
                      <div className="td-product">
                        <div
                          className="prod-thumb"
                          style={{ background: thumbColor(product.name) }}
                          title={product.name}
                        >
                          {thumbInitials(product.name)}
                        </div>
                        <div className="product-details">
                          <strong style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>{product.name}</strong>
                          <div style={{ marginTop: "4px" }}>
                            {product.barcode ? (
                              <span className="badge badge-success" style={{ fontSize: "10px", padding: "2px 6px" }}>Barcode: {product.barcode}</span>
                            ) : (
                              <span className="badge badge-warning" style={{ fontSize: "10px", padding: "2px 6px" }}>No Barcode</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: "11px", fontWeight: "500", textTransform: "none", padding: "3px 8px" }}>{product.category}</span>
                    </td>
                    <td>{fmt(product.cost_price)}</td>
                    <td>
                      <strong style={{ color: "var(--brand-primary)", fontWeight: 700 }}>{fmt(product.selling_price)}</strong>
                      {product.variable_price && <span style={{ marginLeft: "6px", fontSize: "11px", color: "var(--brand-primary)", fontWeight: 600 }}>Varies</span>}
                    </td>
                    <td>
                      {product.stock === 0 ? (
                        <span className="badge badge-danger">Out of stock</span>
                      ) : product.stock <= 10 ? (
                        <span className="badge badge-warning">{product.stock} low stock</span>
                      ) : (
                        <span className="badge badge-success">{product.stock} in stock</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end", alignItems: "center" }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openScannerForProduct(product)} title="Scan barcode to assign" style={{ padding: "6px", borderRadius: "6px" }}>
                          <Camera size={16} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingProduct(product)} title="Edit product" style={{ padding: "6px", borderRadius: "6px" }}>
                          <Edit2 size={16} />
                        </button>
                        <button className="btn btn-ghost btn-sm text-danger" onClick={() => setProductToDelete(product)} title="Delete product" style={{ padding: "6px", borderRadius: "6px" }}>
                          <Trash2 size={16} />
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
            <div className="empty-state-v2-icon"><Package size={48} /></div>
            <h3 className="empty-state-v2-title">No products found</h3>
            <p className="empty-state-v2-desc">{invSearch || activePill !== "All" ? "Try clearing filters." : "Add your first product to get started."}</p>
            {invSearch || activePill !== "All"
              ? <button className="btn btn-secondary btn-sm" onClick={() => { setInvSearch(""); setActivePill("All"); }}>Clear Filters</button>
              : <button className="btn btn-primary btn-sm" onClick={() => setEditingProduct({})}>Add Product</button>
            }
          </div>
        )}
      </div>

      {/* Barcode scanner modal */}
      {productToLink && (
        <div className="modal-overlay" onClick={closeScanner}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
            <div className="card-header">
              <h3 className="card-title">Scan Barcode</h3>
              <button className="btn btn-ghost btn-sm" onClick={closeScanner}><X size={16} /></button>
            </div>
            <div className="card-body">
              <p style={{ marginBottom: "12px", fontSize: "13px", color: "var(--text-secondary)" }}>
                Point the camera at a barcode to assign it to this product permanently.
              </p>
              <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", background: "#000", border: "2px solid var(--brand-primary-hover)" }}>
                <video ref={videoRef} muted playsInline style={{ width: "100%", display: "block", maxHeight: "250px", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  {[{ top: 12, left: 12, borderTop: "3px solid #fff", borderLeft: "3px solid #fff" }, { top: 12, right: 12, borderTop: "3px solid #fff", borderRight: "3px solid #fff" }, { bottom: 12, left: 12, borderBottom: "3px solid #fff", borderLeft: "3px solid #fff" }, { bottom: 12, right: 12, borderBottom: "3px solid #fff", borderRight: "3px solid #fff" }].map((style, i) => (
                    <div key={i} style={{ position: "absolute", width: 20, height: 20, ...style }} />
                  ))}
                  <div style={{ width: "70%", height: "2px", background: "var(--brand-primary-hover)", boxShadow: "0 0 8px 2px var(--brand-primary-hover)", animation: "scanline 1.6s ease-in-out infinite" }} />
                </div>
                <style>{`@keyframes scanline { 0% { transform: translateY(-40px); opacity: 0.4; } 50% { transform: translateY(40px); opacity: 1; } 100% { transform: translateY(-40px); opacity: 0.4; } }`}</style>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single Product Delete Modal */}
      {productToDelete && (
        <div className="modal-overlay" onClick={() => setProductToDelete(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title text-danger">Delete Product</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setProductToDelete(null)}><X size={16} /></button>
            </div>
            <div className="card-body">
              <p>Are you sure you want to delete <strong>{productToDelete.name}</strong>?</p>
              <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>This action cannot be undone.</p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
                <button className="btn btn-secondary" onClick={() => setProductToDelete(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={executeSingleDeleteProduct}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Products Modal */}
      {showBulkDeleteProductsModal && (
        <div className="modal-overlay" onClick={() => setShowBulkDeleteProductsModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title text-danger">Delete Selected Products</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowBulkDeleteProductsModal(false)}><X size={16} /></button>
            </div>
            <div className="card-body">
              <p>Are you sure you want to delete <strong>{Object.values(selectedIds).filter(Boolean).length} selected products</strong>?</p>
              <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>This action cannot be undone.</p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
                <button className="btn btn-secondary" onClick={() => setShowBulkDeleteProductsModal(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={executeBulkDeleteProducts} disabled={bulkDeleting}>
                  {bulkDeleting ? "Deleting..." : "Delete All"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Delete / Reassignment Modal */}
      {categoriesToDelete.length > 0 && (
        <div className="modal-overlay" onClick={() => setCategoriesToDelete([])}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title text-warning">Products Assigned to Category</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setCategoriesToDelete([])}><X size={16} /></button>
            </div>
            <div className="card-body">
              <p style={{ marginBottom: "12px" }}>
                There are products currently assigned to the categor{categoriesToDelete.length > 1 ? "ies" : "y"} you're deleting. What would you like to do with them?
              </p>
              <div className="form-group">
                <label className="form-label">Reassign products to:</label>
                <select className="form-input" value={categoryReassignTarget} onChange={(e) => setCategoryReassignTarget(e.target.value)}>
                  <option value="Uncategorized">Uncategorized</option>
                  {allCategories.filter(c => !categoriesToDelete.includes(c)).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
                <button className="btn btn-secondary" onClick={() => setCategoriesToDelete([])}>Cancel</button>
                <button className="btn btn-primary" onClick={() => executeCategoryDelete(categoriesToDelete, categoryReassignTarget)} disabled={deletingCategories}>
                  {deletingCategories ? "Processing..." : "Reassign & Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}