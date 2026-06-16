import React, { useState, useMemo } from "react";
import {
  Users, Plus, Edit2, Trash2, ChevronLeft, Phone, Mail, MapPin,
  TrendingUp, TrendingDown, IndianRupee, AlertCircle, CheckCircle2,
} from "lucide-react";
import { fmt, safeNum } from "../services/api";

function getInitials(name = "") {
  return (name || "").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "U";
}

function limitPhoneDigits(e) {
  e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 10);
}

export default function Customers({
  filteredCustomers, editingCustomer, setEditingCustomer,
  saveCustomer, deleteCustomer, loadCustomerDetail,
  selectedCustomer, setSelectedCustomer,
  customerUdhaar,
  udhaarForm, setUdhaarForm,
  saveUdhaarEntry,
  sales = [],
}) {
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [balanceFilter, setBalanceFilter] = useState("all"); // "all", "all_udhaar", "unpaid", "partial", "paid"

  const displayedCustomers = useMemo(() => {
    return filteredCustomers.filter(c => {
      const balance = safeNum(c.outstanding_balance);
      const paid = safeNum(c.total_paid);
      const totalCredit = safeNum(c.total_credit);
      
      if (balanceFilter === "all_udhaar") {
        return totalCredit > 0;
      }
      if (balanceFilter === "unpaid") {
        return balance > 0 && paid === 0;
      }
      if (balanceFilter === "partial") {
        return balance > 0 && paid > 0;
      }
      if (balanceFilter === "paid") {
        return balance === 0 && totalCredit > 0;
      }
      return true; // "all"
    });
  }, [filteredCustomers, balanceFilter]);
  return (
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
              <button className="btn btn-ghost btn-sm text-danger" onClick={() => setCustomerToDelete(selectedCustomer.id)}><Trash2 size={14} /></button>
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
                      <label className="form-label">
                        Amount (₹)
                        {udhaarForm === "payment" && (
                          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginLeft: "6px" }}>
                            (Max: {fmt(safeNum(selectedCustomer.outstanding_balance))})
                          </span>
                        )}
                      </label>
                      <input
                        className="form-input"
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={udhaarForm === "payment" ? safeNum(selectedCustomer.outstanding_balance) : undefined}
                        name="amount"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Note (optional)</label>
                      <input className="form-input" name="note" placeholder={udhaarForm === "payment" ? "e.g., Cash repayment" : "e.g., Monthly groceries"} />
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
                      <input
                        className="form-input"
                        required
                        name="phone"
                        defaultValue={editingCustomer.phone}
                        inputMode="numeric"
                        maxLength={10}
                        pattern="[0-9]{10}"
                        onInput={limitPhoneDigits}
                      />
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
              <div className="empty-state-v2">
                <div className="empty-state-v2-icon"><IndianRupee size={40} /></div>
                <h3 className="empty-state-v2-title">No udhaar entries</h3>
                <p className="empty-state-v2-desc">Add credit or record payments to see the ledger.</p>
              </div>
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

          {/* Balance Filters */}
          <div className="inv-pills" style={{ marginBottom: "20px" }}>
            {[
              { id: "all", label: "All Customers" },
              { id: "all_udhaar", label: "All Udhaar" },
              { id: "unpaid", label: "Unpaid" },
              { id: "partial", label: "Partially Paid" },
              { id: "paid", label: "Paid" },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                className={`inv-pill ${balanceFilter === f.id ? "active" : ""}`}
                onClick={() => setBalanceFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {editingCustomer && !selectedCustomer && (
            <div className="card" style={{ marginBottom: "24px" }}>
              <div className="card-header">
                <h3 className="card-title">{editingCustomer.id ? "Edit Customer" : "New Customer"}</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingCustomer(null)}>Cancel</button>
              </div>
              <div className="card-body">
                <form onSubmit={saveCustomer}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Customer Name</label>
                      <input className="form-input" required name="name" defaultValue={editingCustomer.name || ""} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <input
                        className="form-input"
                        required
                        name="phone"
                        defaultValue={editingCustomer.phone || ""}
                        inputMode="numeric"
                        maxLength={10}
                        pattern="[0-9]{10}"
                        onInput={limitPhoneDigits}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Email (optional)</label>
                      <input className="form-input" name="email" type="email" defaultValue={editingCustomer.email || ""} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Address (optional)</label>
                      <input className="form-input" name="address" defaultValue={editingCustomer.address || ""} />
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
            {displayedCustomers.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Phone Number</th>
                      <th>Total Purchases</th>
                      <th>Udhaar Amount</th>
                      <th>Last Purchase Date</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedCustomers.map((customer) => {
                      const customerSales = sales.filter((s) => s.customer_id === customer.id);
                      const totalPurchasesSum = customerSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
                      const lastPurchaseDate = customerSales.length > 0
                        ? new Date(Math.max(...customerSales.map(s => new Date(s.created_at).getTime()))).toLocaleDateString("en-IN")
                        : "Never";

                      return (
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
                          <td>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <strong>{fmt(totalPurchasesSum)}</strong>
                              <small style={{ color: "var(--text-tertiary)" }}>{customerSales.length} bill{customerSales.length !== 1 ? "s" : ""}</small>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${(customer.outstanding_balance || 0) > 0 ? "badge-danger" : "badge-success"}`}>
                              {fmt(customer.outstanding_balance || 0)}
                            </span>
                          </td>
                          <td>{lastPurchaseDate}</td>
                          <td>
                            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                              <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEditingCustomer(customer); }} title="Edit Customer"><Edit2 size={16} /></button>
                              <button className="btn btn-ghost btn-sm text-danger" onClick={(e) => { e.stopPropagation(); setCustomerToDelete(customer.id); }} title="Delete Customer"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state-v2">
                <div className="empty-state-v2-icon"><Users size={48} /></div>
                <h3 className="empty-state-v2-title">No customers yet</h3>
                <p className="empty-state-v2-desc">Add your first customer to start tracking credit.</p>
                <button className="btn btn-primary btn-sm" onClick={() => setEditingCustomer({})}>Add Customer</button>
              </div>
            )}
          </div>
        </div>
      )}
      {customerToDelete && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          backdropFilter: "blur(2px)"
        }}>
          <div className="card" style={{ width: "100%", maxWidth: "400px", padding: "24px", boxShadow: "0 10px 25px rgba(0,0,0,0.15)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", color: "var(--danger)" }}>
              <AlertCircle size={24} />
              <h3 style={{ fontSize: "1.15rem", fontWeight: "bold", margin: 0, color: "var(--text-primary)" }}>Confirm Deletion</h3>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: "0 0 20px 0", lineHeight: "1.5" }}>
              Are you sure you want to delete this customer? This will also remove all their associated credit and udhaar transaction history.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setCustomerToDelete(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={async () => {
                await deleteCustomer(customerToDelete);
                setCustomerToDelete(null);
                setSelectedCustomer(null);
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
