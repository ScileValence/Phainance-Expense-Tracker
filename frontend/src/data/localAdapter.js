// A tiny in-app "backend": serves the REST routes the pages already call from the local db.
// Every write bumps updatedAt and marks the record dirty so the sync layer can push it.
import { toMinor, toMajor } from "./money.js";

const SOURCES = ["SALARY", "FREELANCE", "GIFT", "OTHER"];
const UNITS = ["DAYS", "WEEKS", "MONTHS"];
const BUILTIN_MAX_ID = 5;

const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => fmtDate(new Date());
const thisMonth = () => today().slice(0, 7);

export class LocalError extends Error {
  constructor(status, message, config) {
    super(message);
    this.isAxiosError = true;
    this.config = config;
    this.response = { status, data: { message } };
  }
}

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

function validateRecurring(b) {
  if (!b.title || !String(b.title).trim()) return "Title is required";
  if (!(Number(b.amount) > 0)) return "Amount must be greater than 0";
  if (!(Number(b.intervalValue) >= 1)) return "Interval must be at least 1";
  if (!UNITS.includes(String(b.intervalUnit).toUpperCase())) return "Interval unit must be DAYS, WEEKS or MONTHS";
  if (!b.nextDueDate) return "Due date is required";
  return null;
}

export function localAdapter(localDb, { now = Date.now, uuid = () => globalThis.crypto.randomUUID(), onWrite = () => {} } = {}) {
  return async function adapter(config) {
    const url = new URL(config.url, "http://local.app");
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
      throw new LocalError(status, msg, config);
    };

    const db = await localDb.load();
    const live = (arr) => arr.filter((x) => !x.deleted);
    const touch = (r) => {
      r.updatedAt = now();
      r.dirty = true;
      return r;
    };
    const create = (arr, fields) => {
      const r = touch({ id: db.nextId++, uuid: uuid(), ...fields });
      arr.push(r);
      return r;
    };
    const remove = (r) => {
      r.deleted = true;
      touch(r);
    };
    const commit = async (data) => {
      await localDb.save(db);
      onWrite();
      return ok(data);
    };

    const month = q.month || thisMonth();
    const inMonth = (x) => (x.date || "").startsWith(month);
    const sumMinor = (arr) => arr.reduce((s, e) => s + (e.amountMinor || 0), 0);
    const expenses = () => live(db.expenses);
    const cat = (uuidv) => live(db.categories).find((c) => c.uuid === uuidv) || null;
    const catByRequestId = (id) => live(db.categories).find((c) => c.id === Number(id)) || null;
    const catView = (c) => (c ? { id: c.id, name: c.name } : null);

    const viewExpense = (e) => ({ id: e.id, amount: toMajor(e.amountMinor), description: e.description, date: e.date, category: catView(cat(e.categoryUuid)) });
    const viewIncome = (i) => ({ id: i.id, amount: toMajor(i.amountMinor), source: i.source, description: i.description, date: i.date });
    const viewRecurring = (r) => ({
      id: r.id, title: r.title, amount: toMajor(r.amountMinor), category: catView(cat(r.categoryUuid)),
      intervalValue: r.intervalValue, intervalUnit: r.intervalUnit, nextDueDate: r.nextDueDate,
      dueTime: r.dueTime, anchorDay: r.anchorDay, active: r.active,
    });

    const seg = path.split("/").filter(Boolean);
    const [root, idRaw, action] = seg;
    const id = Number(idRaw);

    // ----- categories -----
    if (root === "categories") {
      const view = (c) => ({ id: c.id, name: c.name, builtIn: c.id <= BUILTIN_MAX_ID });
      const cleanName = (v) => String(v ?? "").trim().replace(/\s+/g, " ");
      const taken = (name, exceptId) => live(db.categories).some((c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase());
      const checkName = (name, exceptId) => {
        if (!name) fail(400, "Enter a category name");
        if (name.length > 40) fail(400, "Name must be 40 characters or fewer");
        if (taken(name, exceptId)) fail(409, "A category with that name already exists");
      };

      if (method === "get") return ok(live(db.categories).map(view));
      if (method === "post") {
        const name = cleanName(body.name);
        checkName(name, null);
        return commit(view(create(db.categories, { name })));
      }
      const c = catByRequestId(id);
      if (!c) fail(404, "Category not found");
      if (c.id <= BUILTIN_MAX_ID) fail(403, "Default categories can't be changed");
      if (method === "put") {
        const name = cleanName(body.name);
        checkName(name, c.id);
        c.name = name;
        touch(c);
        return commit(view(c));
      }
      if (method === "delete") {
        const e = expenses().filter((x) => x.categoryUuid === c.uuid).length;
        const r = live(db.recurring).filter((x) => x.categoryUuid === c.uuid).length;
        if (e || r) fail(409, `In use by ${e} expense(s) and ${r} recurring payment(s). Move them to another category first.`);
        remove(c);
        return commit(null);
      }
    }

    // ----- expenses -----
    if (root === "expenses") {
      if (method === "get") {
        if (q.from && q.to && q.from <= q.to) return ok(expenses().filter((e) => e.date >= q.from && e.date <= q.to).map(viewExpense));
        return ok(expenses().filter(inMonth).map(viewExpense));
      }
      if (method === "post") {
        const e = create(db.expenses, {
          amountMinor: toMinor(body.amount), description: body.description || "", date: body.date || today(),
          categoryUuid: catByRequestId(body.categoryId)?.uuid ?? null, source: body.source || "manual", upiRef: body.upiRef ?? null,
        });
        return commit(viewExpense(e));
      }
      const e = expenses().find((x) => x.id === id);
      if (!e) fail(404, "Not found");
      if (method === "put") {
        Object.assign(e, {
          amountMinor: toMinor(body.amount), description: body.description ?? e.description, date: body.date || e.date,
          categoryUuid: catByRequestId(body.categoryId)?.uuid ?? null,
        });
        touch(e);
        return commit(viewExpense(e));
      }
      if (method === "delete") {
        remove(e);
        return commit(null);
      }
    }

    // ----- budget -----
    if (root === "budget" && idRaw === "categories") {
      const limits = () => live(db.categoryBudgets);
      if (method === "get") {
        const rows = limits()
          .map((b) => {
            const c = cat(b.categoryUuid);
            if (!c) return null;
            const spent = sumMinor(expenses().filter((e) => inMonth(e) && e.categoryUuid === c.uuid));
            return { categoryId: c.id, name: c.name, limit: toMajor(b.limitMinor), spent: toMajor(spent) };
          })
          .filter(Boolean);
        return ok(rows);
      }
      const c = catByRequestId(action);
      if (!c) fail(404, "Category not found");
      if (method === "put") {
        const limit = Number(body.limitAmount) || 0;
        if (limit < 0) fail(400, "Enter a valid amount");
        const existing = limits().find((b) => b.categoryUuid === c.uuid);
        if (limit > 0) {
          if (existing) {
            existing.limitMinor = toMinor(limit);
            touch(existing);
          } else create(db.categoryBudgets, { categoryUuid: c.uuid, limitMinor: toMinor(limit) });
        } else if (existing) remove(existing);
        return commit({ categoryId: c.id, limit: Math.max(limit, 0) });
      }
    }

    if (root === "budget") {
      const forMonth = (m) => live(db.budgets).find((b) => b.month === m);
      if (method === "get") {
        const limit = forMonth(month)?.limitMinor || 0;
        return ok({ month, limit: toMajor(limit), spent: toMajor(sumMinor(expenses().filter(inMonth))) });
      }
      if (method === "post" || method === "put") {
        const m = body.month || thisMonth();
        const limitMinor = toMinor(body.limitAmount);
        const existing = forMonth(m);
        if (existing) {
          existing.limitMinor = limitMinor;
          touch(existing);
        } else create(db.budgets, { month: m, limitMinor });
        return commit({ month: m, limitAmount: toMajor(limitMinor) });
      }
    }

    // ----- analytics -----
    if (root === "analytics" && method === "get") {
      const list = expenses().filter(inMonth);
      if (idRaw === "category") {
        const by = {};
        list.forEach((e) => {
          const n = cat(e.categoryUuid)?.name || "Uncategorized";
          by[n] = (by[n] || 0) + e.amountMinor;
        });
        return ok(Object.entries(by).map(([name, v]) => ({ name, value: toMajor(v) })));
      }
      if (idRaw === "daily") {
        const by = {};
        list.forEach((e) => (by[e.date] = (by[e.date] || 0) + e.amountMinor));
        return ok(Object.keys(by).sort().map((date) => ({ date, amount: toMajor(by[date]) })));
      }
      if (idRaw === "trend") {
        const n = Math.min(12, Math.max(2, Number(q.months) || 6));
        const [y, m] = month.split("-").map(Number);
        const out = [];
        for (let i = n - 1; i >= 0; i--) {
          const d = new Date(y, m - 1 - i, 1);
          const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
          out.push({ month: key, amount: toMajor(sumMinor(expenses().filter((e) => (e.date || "").startsWith(key)))) });
        }
        return ok(out);
      }
      const budget = live(db.budgets).find((b) => b.month === month)?.limitMinor || 0;
      if (idRaw === "monthly") return ok([{ month, amount: toMajor(sumMinor(list)) }]);
      if (idRaw === "budget-trend") return ok([{ month, budget: toMajor(budget), spent: toMajor(sumMinor(list)) }]);
    }

    // ----- income -----
    if (root === "income") {
      if (method === "get") {
        return ok(live(db.income).filter(inMonth).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).map(viewIncome));
      }
      if (method === "post" || method === "put") {
        if (!(Number(body.amount) > 0)) fail(400, "Amount must be greater than 0");
        const source = String(body.source).toUpperCase();
        if (!SOURCES.includes(source)) fail(400, "Source must be SALARY, FREELANCE, GIFT or OTHER");
        const data = { amountMinor: toMinor(body.amount), source, description: (body.description || "").trim(), date: body.date || today() };
        if (method === "post") return commit(viewIncome(create(db.income, data)));
        const i = live(db.income).find((x) => x.id === id);
        if (!i) fail(404, "Not found");
        Object.assign(i, data);
        touch(i);
        return commit(viewIncome(i));
      }
      if (method === "delete") {
        const i = live(db.income).find((x) => x.id === id);
        if (!i) fail(404, "Not found");
        remove(i);
        return commit(null);
      }
    }

    // ----- recurring payments -----
    if (root === "recurring") {
      const sorted = () => [...live(db.recurring)].sort((a, b) => `${a.nextDueDate}${a.dueTime}`.localeCompare(`${b.nextDueDate}${b.dueTime}`));
      const fields = () => ({
        title: String(body.title).trim(), amountMinor: toMinor(body.amount), categoryUuid: catByRequestId(body.categoryId)?.uuid ?? null,
        intervalValue: Number(body.intervalValue), intervalUnit: String(body.intervalUnit).toUpperCase(), nextDueDate: body.nextDueDate,
        dueTime: `${(body.dueTime || "09:00").slice(0, 5)}:00`, anchorDay: Number(body.nextDueDate.slice(8, 10)),
      });
      if (!idRaw && method === "get") return ok(sorted().map(viewRecurring));
      if (!idRaw && method === "post") {
        const err = validateRecurring(body);
        if (err) fail(400, err);
        return commit(viewRecurring(create(db.recurring, { ...fields(), active: true })));
      }
      const r = live(db.recurring).find((x) => x.id === id);
      if (!r) fail(404, "Not found");
      if (!action && method === "put") {
        const err = validateRecurring(body);
        if (err) fail(400, err);
        Object.assign(r, fields());
        touch(r);
        return commit(viewRecurring(r));
      }
      if (!action && method === "delete") {
        remove(r);
        return commit(null);
      }
      if (action === "confirm" && method === "post") {
        create(db.expenses, { amountMinor: r.amountMinor, description: r.title, date: r.nextDueDate, categoryUuid: r.categoryUuid, source: "manual", upiRef: null });
        r.nextDueDate = nextOccurrence(r);
        touch(r);
        return commit(viewRecurring(r));
      }
      if (action === "skip" && method === "post") {
        r.nextDueDate = nextOccurrence(r);
        touch(r);
        return commit(viewRecurring(r));
      }
      if (action === "toggle" && method === "post") {
        r.active = !r.active;
        touch(r);
        return commit(viewRecurring(r));
      }
    }

    // notifications etc. need an account
    return fail(401, "Sign in required");
  };
}
