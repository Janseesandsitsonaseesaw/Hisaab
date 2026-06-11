const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Safe money formatter — prevents ₹NaN */
export function fmt(val) {
  const n = Number(val);
  return money.format(isNaN(n) ? 0 : n);
}

/** Safe number — prevents NaN display */
export function safeNum(val, fallback = 0) {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || "Request failed");
  }
  return response.json();
}

export async function downloadInvoice(saleId, billNumber) {
  const response = await fetch(`${API_URL}/invoices/${saleId}/pdf`);
  if (!response.ok) throw new Error("Failed to generate invoice");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${billNumber}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printInvoice(saleId) {
  const url = `${API_URL}/invoices/${saleId}/pdf`;
  const win = window.open(url, "_blank");
  if (win) win.print();
}
