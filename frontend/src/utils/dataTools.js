// Settings > Data: export, import and clear everything the current user owns.
// Works for both modes: guest (data in this browser) and signed-in (data on the server).
// Import goes through the normal `api` client, so the same code path serves guest and account.
import api from "../api/axios";
import { authState } from "./auth";
import { readGuestData, clearGuestData } from "./guestStore";

export const EXPORT_VERSION = 1;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 20000;
const SOURCES = ["SALARY", "FREELANCE", "GIFT", "OTHER"];
const UNITS = ["DAYS", "WEEKS", "MONTHS"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export const errorMessage = (err) => err?.response?.data?.message || err?.message || "Something went wrong";

// ---------------------------------------------------------------- export
export async function buildExport() {
  const auth = authState();
  let body;
  if (auth.mode === "user") {
    const { data } = await api.get("/data/export");
    body = data;
  } else {
    const db = readGuestData();
    body = {
      expenses: db.expenses.map((e) => ({
        amount: e.amount,
        description: e.description,
        date: e.date,
        category: e.category?.name ?? null,
      })),
      income: db.income.map((i) => ({ amount: i.amount, source: i.source, description: i.description, date: i.date })),
      budgets: Object.entries(db.budgets).map(([month, limitAmount]) => ({ month, limitAmount })),
      recurring: db.recurring.map((r) => ({
        title: r.title,
        amount: r.amount,
        category: r.category?.name ?? null,
        intervalValue: r.intervalValue,
        intervalUnit: r.intervalUnit,
        nextDueDate: r.nextDueDate,
        dueTime: (r.dueTime || "09:00").slice(0, 5),
        active: r.active !== false,
      })),
    };
  }
  return {
    app: "phainance",
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    source: auth.mode === "user" ? "account" : "guest",
    expenses: body.expenses || [],
    income: body.income || [],
    budgets: body.budgets || [],
    recurring: body.recurring || [],
  };
}

export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const exportFilename = () => `phainance-export-${new Date().toISOString().slice(0, 10)}.json`;

// ---------------------------------------------------------------- import (validate)
const str = (v, max = 255) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);

// Turns file text into clean, safe rows. Throws a readable Error if the file isn't usable.
export function parseImport(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Unrecognised file format.");
  if (raw.app && raw.app !== "phainance") throw new Error("This file wasn't exported from Phainance.");
  if (raw.version && raw.version > EXPORT_VERSION) throw new Error("This file is from a newer version of Phainance.");

  const lists = ["expenses", "income", "budgets", "recurring"];
  if (!lists.some((k) => Array.isArray(raw[k]))) throw new Error("No expenses, income, budgets or recurring payments found.");

  let skipped = 0;
  const take = (key, clean) => {
    const rows = Array.isArray(raw[key]) ? raw[key].slice(0, MAX_ROWS) : [];
    const out = [];
    rows.forEach((r) => {
      const c = r && typeof r === "object" ? clean(r) : null;
      if (c) out.push(c);
      else skipped++;
    });
    return out;
  };

  const expenses = take("expenses", (r) => {
    const amount = num(r.amount);
    if (!(amount > 0) || !DATE_RE.test(String(r.date))) return null;
    return { amount, description: str(r.description), date: r.date, category: str(r.category, 60) || null };
  });

  const income = take("income", (r) => {
    const amount = num(r.amount);
    if (!(amount > 0) || !DATE_RE.test(String(r.date))) return null;
    const source = String(r.source || "OTHER").toUpperCase();
    return { amount, source: SOURCES.includes(source) ? source : "OTHER", description: str(r.description), date: r.date };
  });

  const budgets = take("budgets", (r) => {
    const limitAmount = num(r.limitAmount);
    if (!MONTH_RE.test(String(r.month)) || !(limitAmount >= 0)) return null;
    return { month: r.month, limitAmount };
  });

  const recurring = take("recurring", (r) => {
    const amount = num(r.amount);
    const intervalValue = Math.trunc(num(r.intervalValue));
    const intervalUnit = String(r.intervalUnit || "").toUpperCase();
    if (!str(r.title) || !(amount > 0)) return null;
    if (!(intervalValue >= 1 && intervalValue <= 1000) || !UNITS.includes(intervalUnit)) return null;
    if (!DATE_RE.test(String(r.nextDueDate))) return null;
    return {
      title: str(r.title),
      amount,
      category: str(r.category, 60) || null,
      intervalValue,
      intervalUnit,
      nextDueDate: r.nextDueDate,
      dueTime: /^\d{2}:\d{2}/.test(String(r.dueTime)) ? String(r.dueTime).slice(0, 5) : "09:00",
      active: r.active !== false,
    };
  });

  return { expenses, income, budgets, recurring, skipped };
}

export const countRows = (c) => c.expenses.length + c.income.length + c.budgets.length + c.recurring.length;

// ---------------------------------------------------------------- clear / import (apply)
export async function clearAllData() {
  if (authState().mode === "user") await api.delete("/data");
  else clearGuestData();
}

export async function applyImport(clean, { replace = false } = {}) {
  if (replace) await clearAllData();

  const { data: cats } = await api.get("/categories");
  const byName = new Map((cats || []).map((c) => [String(c.name).toLowerCase(), c.id]));

  // custom categories from the file are created if you don't have them yet (otherwise they fall back to Other)
  const wanted = [...new Set([...clean.expenses, ...clean.recurring].map((x) => x.category).filter(Boolean).map(String))];
  for (const name of wanted) {
    if (byName.has(name.toLowerCase())) continue;
    try {
      const { data } = await api.post("/categories", { name });
      byName.set(name.toLowerCase(), data.id);
    } catch {
      /* uses Other */
    }
  }

  const catId = (name) => (name ? byName.get(name.toLowerCase()) ?? byName.get("other") ?? null : null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const jobs = [
    ...clean.expenses.map((e) => () =>
      api.post("/expenses", { amount: e.amount, description: e.description, date: e.date, categoryId: catId(e.category) })
    ),
    ...clean.income.map((i) => () =>
      api.post("/income", { amount: i.amount, source: i.source, description: i.description, date: i.date })
    ),
    ...clean.budgets.map((b) => () => api.post("/budget", { month: b.month, limitAmount: b.limitAmount })),
    ...clean.recurring.map((r) => async () => {
      const res = await api.post("/recurring", {
        title: r.title,
        amount: r.amount,
        categoryId: catId(r.category),
        intervalValue: r.intervalValue,
        intervalUnit: r.intervalUnit,
        nextDueDate: r.nextDueDate,
        dueTime: r.dueTime,
        timeZone,
      });
      if (!r.active && res?.data?.id) await api.post(`/recurring/${res.data.id}/toggle`);
    }),
  ];

  let done = 0;
  let failed = 0;
  const CHUNK = 8;
  for (let i = 0; i < jobs.length; i += CHUNK) {
    const results = await Promise.allSettled(jobs.slice(i, i + CHUNK).map((j) => j()));
    results.forEach((r) => (r.status === "fulfilled" ? done++ : failed++));
  }
  return { done, failed };
}
