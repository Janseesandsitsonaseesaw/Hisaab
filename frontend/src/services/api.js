import { createClient } from "@supabase/supabase-js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

let supabaseInstance = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  } catch (e) {
    console.error("Failed to initialize Supabase client:", e);
  }
}

export const supabase = supabaseInstance;

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
  const headers = { "Content-Type": "application/json" };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch (e) {
    console.error("Error setting authorization header:", e);
  }

  const { headers: customHeaders, ...restOptions } = options;
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      ...headers,
      ...(customHeaders || {}),
    },
    ...restOptions,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || "Request failed");
  }
  return response.json();
}

export async function downloadInvoice(saleId, billNumber) {
  let token = "";
  if (!supabase) {
    throw new Error("Supabase client is not initialized. Please verify your environment variables.");
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.access_token) {
      token = session.access_token;
    }
  } catch (e) {
    console.error(e);
  }

  if (!token) {
    throw new Error("Authentication token is missing. Please log in again.");
  }

  const response = await fetch(
    `${API_URL}/invoices/${saleId}/pdf`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.detail || "Failed to generate invoice");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${billNumber}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function printInvoice(saleId) {
  let token = "";
  if (!supabase) {
    throw new Error("Supabase client is not initialized. Please verify your environment variables.");
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.access_token) {
      token = session.access_token;
    }
  } catch (e) {
    console.error(e);
  }

  if (!token) {
    throw new Error("Authentication token is missing. Please log in again.");
  }

  const response = await fetch(
    `${API_URL}/invoices/${saleId}/pdf`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.detail || "Failed to generate invoice");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    win.focus();
  }
}

export function buildReceiptMessage(sale, store, customer) {
  const lines = [
    `${store?.store_name || "Hisaab POS"} Receipt`,
    `Invoice: ${sale.bill_number}`,
    `Date: ${new Date(sale.created_at).toLocaleString("en-IN")}`,
  ];

  if (customer) lines.push(`Customer: ${customer.name} (${customer.phone})`);
  if (sale.payment_method) lines.push(`Payment: ${sale.payment_method}`);

  lines.push("", "Items:");
  sale.items.forEach((item, index) => {
    const amount = safeNum(item.selling_price) * safeNum(item.quantity);
    lines.push(`${index + 1}. ${item.name} x ${item.quantity} = ${fmt(amount)}`);
  });
  lines.push("", `Total: ${fmt(sale.total_amount)}`, "Thank you!");

  return lines.join("\n");
}

export function openWhatsAppReceipt(sale, store, customer) {
  const text = encodeURIComponent(buildReceiptMessage(sale, store, customer));
  const phone = customer?.phone ? String(customer.phone).replace(/\D/g, "") : "";
  const url = phone ? `https://wa.me/91${phone.slice(-10)}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
