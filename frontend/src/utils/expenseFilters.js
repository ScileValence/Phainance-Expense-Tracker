// Pure helpers for searching, filtering and sorting a list of expenses (no React, no browser APIs).
// Amounts are compared as stored (INR); the caller converts anything the person typed.

const toNumber = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const text = (v) => String(v ?? "").trim().toLowerCase();

export function filterExpenses(expenses, { query = "", categoryId = "", min = "", max = "" } = {}) {
  const q = text(query);
  const lo = toNumber(min);
  const hi = toNumber(max);
  const cat = categoryId === "" || categoryId === null || categoryId === undefined ? null : String(categoryId);

  return expenses.filter((e) => {
    if (q && !text(e.description).includes(q) && !text(e.category?.name).includes(q)) return false;
    if (cat === "none" && e.category) return false;
    if (cat !== null && cat !== "none" && String(e.category?.id) !== cat) return false;
    const amount = Number(e.amount) || 0;
    if (lo !== null && amount < lo) return false;
    if (hi !== null && amount > hi) return false;
    return true;
  });
}

const END = "\uffff"; // sorts after any real name, so uncategorised rows come last when ascending

const keyOf = {
  amount: (e) => Number(e.amount) || 0,
  date: (e) => e.date || "",
  description: (e) => text(e.description),
  category: (e) => (e.category ? text(e.category.name) : END),
};

export function sortExpenses(expenses, key = "date", dir = "desc") {
  const get = keyOf[key] || keyOf.date;
  const sign = dir === "asc" ? 1 : -1;

  return [...expenses].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x < y) return -sign;
    if (x > y) return sign;
    // ties: newest first, then highest id, whatever the direction
    const da = a.date || "";
    const db = b.date || "";
    if (da !== db) return da < db ? 1 : -1;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}

export function summarize(expenses) {
  return {
    count: expenses.length,
    total: expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
  };
}

export function hasActiveFilters({ query = "", categoryId = "", min = "", max = "" } = {}) {
  return text(query) !== "" || String(categoryId ?? "") !== "" || String(min ?? "") !== "" || String(max ?? "") !== "";
}
