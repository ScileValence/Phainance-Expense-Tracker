import { toMinor } from "./money.js";

export const BUILTIN_CATEGORIES = ["Food", "Rent", "Utilities", "Entertainment", "Other"];
// Fixed uuids so every device (and the server) agrees on the built-in categories.
export const builtinUuid = (id) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`;

const defaultUuid = () => globalThis.crypto.randomUUID();

export function freshDb() {
  return {
    version: 2,
    owner: null,
    nextId: 100,
    categories: BUILTIN_CATEGORIES.map((name, i) => ({ id: i + 1, uuid: builtinUuid(i + 1), name })),
    expenses: [],
    income: [],
    budgets: [],
    categoryBudgets: [],
    recurring: [],
    sync: { cursor: 0 },
  };
}

const clone = (x) => JSON.parse(JSON.stringify(x));

// Converts the pre-sync guest format (money as decimals, ids only) to the current shape.
export function migrateGuestDb(old, { now = Date.now, uuid = defaultUuid } = {}) {
  const db = freshDb();
  const t = now();
  const stamp = (r) => ({ ...r, uuid: uuid(), updatedAt: t, dirty: true });
  const builtinCount = BUILTIN_CATEGORIES.length;
  const catUuid = (id) => {
    if (id == null) return null;
    const c = db.categories.find((x) => x.id === Number(id));
    return c ? c.uuid : null;
  };

  db.nextId = old.nextId || db.nextId;
  (old.categories || []).forEach((c) => {
    if (c.id <= builtinCount) return;
    db.categories.push({ id: c.id, uuid: uuid(), name: c.name, updatedAt: t, dirty: true });
  });
  db.expenses = (old.expenses || []).map((e) =>
    stamp({ id: e.id, amountMinor: toMinor(e.amount), description: e.description || "", date: e.date, categoryUuid: catUuid(e.category?.id), source: "manual", upiRef: null })
  );
  db.income = (old.income || []).map((i) =>
    stamp({ id: i.id, amountMinor: toMinor(i.amount), source: i.source, description: i.description || "", date: i.date })
  );
  db.budgets = Object.entries(old.budgets || {}).map(([month, limit]) => stamp({ id: 0, month, limitMinor: toMinor(limit) }));
  db.categoryBudgets = Object.entries(old.categoryBudgets || {})
    .map(([cid, limit]) => (catUuid(cid) ? stamp({ id: 0, categoryUuid: catUuid(cid), limitMinor: toMinor(limit) }) : null))
    .filter(Boolean);
  db.recurring = (old.recurring || []).map((r) =>
    stamp({
      id: r.id, title: r.title, amountMinor: toMinor(r.amount), categoryUuid: catUuid(r.category?.id),
      intervalValue: r.intervalValue, intervalUnit: r.intervalUnit, nextDueDate: r.nextDueDate,
      dueTime: r.dueTime, anchorDay: r.anchorDay, active: r.active !== false,
    })
  );
  return db;
}

export class MemoryDb {
  constructor(initial = null) {
    this.data = initial ? clone(initial) : freshDb();
  }
  async load() {
    return clone(this.data);
  }
  async save(db) {
    this.data = clone(db);
  }
}

export class BrowserDb {
  constructor({ storage = globalThis.localStorage, key = "local:db", legacyKey = "guest:db", now, uuid } = {}) {
    Object.assign(this, { storage, key, legacyKey, now, uuid });
  }
  async load() {
    try {
      const raw = this.storage.getItem(this.key);
      if (raw) return { ...freshDb(), ...JSON.parse(raw) };
    } catch {
      return freshDb();
    }
    try {
      const legacy = this.storage.getItem(this.legacyKey);
      if (legacy) return migrateGuestDb(JSON.parse(legacy), { now: this.now, uuid: this.uuid });
    } catch {
      /* unreadable legacy data: start fresh */
    }
    return freshDb();
  }
  async save(db) {
    this.storage.setItem(this.key, JSON.stringify(db));
  }
}
