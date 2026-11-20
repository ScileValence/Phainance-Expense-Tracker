import { useSyncExternalStore } from "react";

// All amounts are stored in INR (base). The switcher only changes how they are shown / entered.
export const BASE = "INR";

export const CURRENCIES = [
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "AED", name: "UAE Dirham", symbol: "AED" },
  { code: "CNY", name: "Chinese Yuan", symbol: "CN¥" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR" },
];

const KEY_CUR = "currency";
const KEY_FX = "fx:cache";
const TTL = 12 * 3600 * 1000; // provider updates once a day

let state = {
  currency: localStorage.getItem(KEY_CUR) || BASE,
  rates: null, // { USD: 0.011, ... } = how much of X one INR buys
};
const listeners = new Set();
const emit = () => {
  state = { ...state };
  listeners.forEach((l) => l());
};

export const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const getSnapshot = () => state;
export const useCurrency = () => useSyncExternalStore(subscribe, getSnapshot);

// currency actually in use (falls back to INR when its rate isn't available)
export const activeCode = () =>
  state.currency === BASE || state.rates?.[state.currency] ? state.currency : BASE;

const rate = () => (activeCode() === BASE ? 1 : state.rates[activeCode()]);

export const currencySymbol = () => CURRENCIES.find((c) => c.code === activeCode())?.symbol || "₹";

export function setCurrency(code) {
  if (!CURRENCIES.some((c) => c.code === code)) return;
  localStorage.setItem(KEY_CUR, code);
  state.currency = code;
  emit();
}

async function fetchRates() {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/INR");
    const j = await r.json();
    if (j.result === "success" && j.rates) return j.rates;
  } catch {
    /* try fallback */
  }
  try {
    const r = await fetch("https://api.frankfurter.dev/v1/latest?base=INR");
    const j = await r.json();
    if (j.rates) return { ...j.rates, INR: 1 };
  } catch {
    /* give up */
  }
  return null;
}

export async function loadRates() {
  let cached = null;
  try {
    cached = JSON.parse(localStorage.getItem(KEY_FX) || "null");
  } catch {
    cached = null;
  }
  if (cached?.rates) {
    state.rates = cached.rates;
    emit();
    if (Date.now() - cached.t < TTL) return;
  }
  const fresh = await fetchRates();
  if (fresh) {
    localStorage.setItem(KEY_FX, JSON.stringify({ t: Date.now(), rates: fresh }));
    state.rates = fresh;
    emit();
  }
}

// ---- conversions (INR <-> selected currency) ----
export const fromBase = (inr) => (Number(inr) || 0) * rate();
export const toBase = (shown) => Math.round(((Number(shown) || 0) / rate()) * 100) / 100;
// value for an <input>: selected currency, 2 decimals, no symbol
export const toInput = (inr) => String(Math.round(fromBase(inr) * 100) / 100);

export function money(inr) {
  const code = activeCode();
  const v = Math.round(fromBase(inr) * 100) / 100;
  const whole = Number.isInteger(v) || code === "JPY";
  return new Intl.NumberFormat(code === "INR" ? "en-IN" : undefined, {
    style: "currency",
    currency: code,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(v);
}

export const compact = (inr) =>
  new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(fromBase(inr));
