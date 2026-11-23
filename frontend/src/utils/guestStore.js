// Guest mode: a tiny in-browser "backend" so the whole app works without an account.
// It is plugged into axios (see api/axios.js) whenever there is no login token.
const KEY = "guest:db";
const DEFAULT_CATS = ["Food", "Rent", "Utilities", "Entertainment", "Other"];
const SOURCES = ["SALARY", "FREELANCE", "GIFT", "OTHER"];
const UNITS = ["DAYS", "WEEKS", "MONTHS"];

const fresh = () => ({
  nextId: 100,
  categories: DEFAULT_CATS.map((name, i) => ({ id: i + 1, name })),
  expenses: [],
  income: [],
  budgets: {},
  recurring: [],
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch {
    /* corrupted: start over */
  }
  return fresh();
}
const save = (db) => localStorage.setItem(KEY, JSON.stringify(db));

export const readGuestData = load;
export const clearGuestData = () => localStorage.removeItem(KEY);
export function hasGuestData() {
  const db = load();
  return !!(db.expenses.length || db.income.length || db.recurring.length || Object.keys(db.budgets).length);
}

// ---- helpers ----
const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => fmtDate(new Date());
const thisMonth = () => today().slice(0, 7);
const sum = (arr) => arr.reduce((s, e) => s + (e.amount || 0), 0);
const catOf = (db, id) => db.categories.find((c) => c.id === Number(id)) || null;

function nextOccurrence(r) {
  const d = new Date(`${r.nextDueDate}T00:00:00`);
  const n = r.intervalValue >= 1 ? r.intervalValue : 1;
  if (r.intervalUnit === "DAYS") d.setDate(d.getDate() + n);
  else if (r.intervalUnit === "WEEKS") d.setDate(d.getDate() + 7 * n);
  else {
    const y = d.getFullYear();
    const m = d.getMonth() + n;
    const last = new Date(y, m + 1, 0).getDate();
    return fmtDate(new Date(y, m, Math.min(r.anchorDay || d.getDate(), last)));
  }
  return fmtDate(d);
}

class GuestError extends Error {
  constructor(status, message, config) {
    super(message);
    this.isAxiosError = true;
    this.config = config;
    this.response = { status, data: { message } };
  }
}

function validateRecurring(b) {
  if (!b.title || !String(b.title).trim()) return "Title is required";
  if (!(Number(b.amount) > 0)) return "Amount must be greater than 0";
  if (!(Number(b.intervalValue) >= 1)) return "Interval must be at least 1";
  if (!UNITS.includes(String(b.intervalUnit).toUpperCase())) return "Interval unit must be DAYS, WEEKS or MONTHS";
  if (!b.nextDueDate) return "Due date is required";
  return null;
}

// ---- axios adapter ----
export async function guestAdapter(config) {
  const url = new URL(config.url, "http://guest.local");
  const path = url.pathname.replace(/\/+$/, "");
  const q = { ...Object.fromEntries(url.searchParams), ...(config.params || {}) };
  const method = (config.method || "get").toLowerCase();
  let body = config.data;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};

  const ok = (data) => ({ data, status: 200, statusText: "OK", headers: {}, config, request: {} });
  const fail = (status, msg) => {
    throw new GuestError(status, msg, config);
  };

  const db = load();
  const month = q.month || thisMonth();
  const inMonth = (x) => (x.date || "").startsWith(month);
  const seg = path.split("/").filter(Boolean); // ["expenses", "12", "confirm"]
  const [root, idRaw, action] = seg;
  const id = Number(idRaw);

  // ----- categories -----
  if (root === "categories") {
    const isBuiltIn = (c) => c.id <= DEFAULT_CATS.length;
    const view = (c) => ({ ...c, builtIn: isBuiltIn(c) });
    const cleanName = (v) => String(v ?? "").trim().replace(/\s+/g, " ");
    const taken = (name, exceptId) => db.categories.some((c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase());
    const checkName = (name, exceptId) => {
      if (!name) return fail(400, "Enter a category name");
      if (name.length > 40) return fail(400, "Name must be 40 characters or fewer");
      if (taken(name, exceptId)) return fail(409, "A category with that name already exists");
      return null;
    };

    if (method === "get") return ok(db.categories.map(view));
    if (method === "post") {
      const name = cleanName(body.name);
      checkName(name, null);
      const c = { id: db.nextId++, name };
      db.categories.push(c);
      save(db);
      return ok(view(c));
    }

    const c = db.categories.find((x) => x.id === id);
    if (!c) return fail(404, "Category not found");
    if (isBuiltIn(c)) return fail(403, "Default categories can't be changed");
    if (method === "put") {
      const name = cleanName(body.name);
      checkName(name, c.id);
      c.name = name;
      [...db.expenses, ...db.recurring].forEach((x) => {
        if (x.category?.id === c.id) x.category = { ...x.category, name };
      });
      save(db);
      return ok(view(c));
    }
    if (method === "delete") {
      const expenses = db.expenses.filter((x) => x.category?.id === c.id).length;
      const recurring = db.recurring.filter((x) => x.category?.id === c.id).length;
      if (expenses || recurring) {
        return fail(409, `In use by ${expenses} expense(s) and ${recurring} recurring payment(s). Move them to another category first.`);
      }
      db.categories = db.categories.filter((x) => x.id !== c.id);
      save(db);
      return ok(null);
    }
  }

  // ----- expenses -----
  if (root === "expenses") {
    if (method === "get") {
      // optional explicit range, same as the server: ?from=YYYY-MM-DD&to=YYYY-MM-DD
      if (q.from && q.to && q.from <= q.to) return ok(db.expenses.filter((e) => e.date >= q.from && e.date <= q.to));
      return ok(db.expenses.filter(inMonth));
    }
    if (method === "post") {
      const e = {
        id: db.nextId++,
        amount: Number(body.amount) || 0,
        description: body.description || "",
        date: body.date || today(),
        category: catOf(db, body.categoryId),
      };
      db.expenses.push(e);
      save(db);
      return ok(e);
    }
    const e = db.expenses.find((x) => x.id === id);
    if (!e) return fail(404, "Not found");
    if (method === "put") {
      Object.assign(e, {
        amount: Number(body.amount) || 0,
        description: body.description ?? e.description,
        date: body.date || e.date,
        category: catOf(db, body.categoryId),
      });
      save(db);
      return ok(e);
    }
    if (method === "delete") {
      db.expenses = db.expenses.filter((x) => x.id !== id);
      save(db);
      return ok(null);
    }
  }

  // ----- budget -----
  // standing monthly limit per category
  if (root === "budget" && idRaw === "categories") {
    db.categoryBudgets = db.categoryBudgets || {};
    if (method === "get") {
      const rows = Object.entries(db.categoryBudgets)
        .map(([cid, limit]) => {
          const c = db.categories.find((x) => x.id === Number(cid));
          if (!c) return null;
          return { categoryId: c.id, name: c.name, limit, spent: sum(db.expenses.filter((e) => inMonth(e) && e.category?.id === c.id)) };
        })
        .filter(Boolean);
      return ok(rows);
    }
    const cid = Number(action);
    if (!db.categories.some((x) => x.id === cid)) return fail(404, "Category not found");
    if (method === "put") {
      const limit = Number(body.limitAmount) || 0;
      if (limit < 0) return fail(400, "Enter a valid amount");
      if (limit > 0) db.categoryBudgets[cid] = limit;
      else delete db.categoryBudgets[cid];
      save(db);
      return ok({ categoryId: cid, limit: Math.max(limit, 0) });
    }
  }

  if (root === "budget") {
    if (method === "get") {
      const spent = sum(db.expenses.filter(inMonth));
      return ok({ month, limit: db.budgets[month] || 0, spent });
    }
    if (method === "post" || method === "put") {
      const m = body.month || thisMonth();
      db.budgets[m] = Number(body.limitAmount) || 0;
      save(db);
      return ok({ month: m, limitAmount: db.budgets[m] });
    }
  }

  // ----- analytics -----
  if (root === "analytics" && method === "get") {
    const list = db.expenses.filter(inMonth);
    if (idRaw === "category") {
      const by = {};
      list.forEach((e) => {
        const n = e.category?.name || "Uncategorized";
        by[n] = (by[n] || 0) + (e.amount || 0);
      });
      return ok(Object.entries(by).map(([name, value]) => ({ name, value })));
    }
    if (idRaw === "daily") {
      const by = {};
      list.forEach((e) => (by[e.date] = (by[e.date] || 0) + (e.amount || 0)));
      return ok(
        Object.keys(by)
          .sort()
          .map((date) => ({ date, amount: by[date] }))
      );
    }
    if (idRaw === "trend") {
      const n = Math.min(12, Math.max(2, Number(q.months) || 6));
      const [y, m] = month.split("-").map(Number);
      const out = [];
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(y, m - 1 - i, 1);
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
        out.push({ month: key, amount: sum(db.expenses.filter((e) => (e.date || "").startsWith(key))) });
      }
      return ok(out);
    }
    if (idRaw === "monthly") return ok([{ month, amount: sum(list) }]);
    if (idRaw === "budget-trend") return ok([{ month, budget: db.budgets[month] || 0, spent: sum(list) }]);
  }

  // ----- income -----
  if (root === "income") {
    if (method === "get") {
      return ok(db.income.filter(inMonth).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id));
    }
    if (method === "post" || method === "put") {
      if (!(Number(body.amount) > 0)) return fail(400, "Amount must be greater than 0");
      const source = String(body.source).toUpperCase();
      if (!SOURCES.includes(source)) return fail(400, "Source must be SALARY, FREELANCE, GIFT or OTHER");
      const data = {
        amount: Number(body.amount),
        source,
        description: (body.description || "").trim(),
        date: body.date || today(),
      };
      if (method === "post") {
        const i = { id: db.nextId++, ...data };
        db.income.push(i);
        save(db);
        return ok(i);
      }
      const i = db.income.find((x) => x.id === id);
      if (!i) return fail(404, "Not found");
      Object.assign(i, data);
      save(db);
      return ok(i);
    }
    if (method === "delete") {
      db.income = db.income.filter((x) => x.id !== id);
      save(db);
      return ok(null);
    }
  }

  // ----- recurring payments -----
  if (root === "recurring") {
    const sorted = () =>
      [...db.recurring].sort((a, b) =>
        `${a.nextDueDate}${a.dueTime}`.localeCompare(`${b.nextDueDate}${b.dueTime}`)
      );
    if (!idRaw && method === "get") return ok(sorted());

    if (!idRaw && method === "post") {
      const err = validateRecurring(body);
      if (err) return fail(400, err);
      const r = {
        id: db.nextId++,
        title: String(body.title).trim(),
        amount: Number(body.amount),
        category: catOf(db, body.categoryId),
        intervalValue: Number(body.intervalValue),
        intervalUnit: String(body.intervalUnit).toUpperCase(),
        nextDueDate: body.nextDueDate,
        dueTime: `${(body.dueTime || "09:00").slice(0, 5)}:00`,
        anchorDay: Number(body.nextDueDate.slice(8, 10)),
        active: true,
      };
      db.recurring.push(r);
      save(db);
      return ok(r);
    }

    const r = db.recurring.find((x) => x.id === id);
    if (!r) return fail(404, "Not found");

    if (!action && method === "put") {
      const err = validateRecurring(body);
      if (err) return fail(400, err);
      Object.assign(r, {
        title: String(body.title).trim(),
        amount: Number(body.amount),
        category: catOf(db, body.categoryId),
        intervalValue: Number(body.intervalValue),
        intervalUnit: String(body.intervalUnit).toUpperCase(),
        nextDueDate: body.nextDueDate,
        dueTime: `${(body.dueTime || "09:00").slice(0, 5)}:00`,
        anchorDay: Number(body.nextDueDate.slice(8, 10)),
      });
      save(db);
      return ok(r);
    }
    if (!action && method === "delete") {
      db.recurring = db.recurring.filter((x) => x.id !== id);
      save(db);
      return ok(null);
    }
    if (action === "confirm" && method === "post") {
      db.expenses.push({
        id: db.nextId++,
        amount: r.amount,
        description: r.title,
        date: r.nextDueDate,
        category: r.category,
      });
      r.nextDueDate = nextOccurrence(r);
      save(db);
      return ok(r);
    }
    if (action === "skip" && method === "post") {
      r.nextDueDate = nextOccurrence(r);
      save(db);
      return ok(r);
    }
    if (action === "toggle" && method === "post") {
      r.active = !r.active;
      save(db);
      return ok(r);
    }
  }

  // notifications etc. need an account
  return fail(401, "Sign in required");
}
