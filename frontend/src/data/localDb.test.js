import test from "node:test";
import assert from "node:assert/strict";
import { MemoryDb, BrowserDb, freshDb, builtinUuid } from "./localDb.js";

const fakeStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
};
let n = 0;
const opts = { now: () => 1000, uuid: () => `u-${++n}` };

test("fresh db has the five built-in categories with fixed uuids", () => {
  const db = freshDb();
  assert.deepEqual(db.categories.map((c) => c.name), ["Food", "Rent", "Utilities", "Entertainment", "Other"]);
  assert.equal(db.categories[0].uuid, "00000000-0000-4000-8000-000000000001");
  assert.equal(builtinUuid(5), "00000000-0000-4000-8000-000000000005");
  assert.equal(db.owner, null);
  assert.equal(db.sync.cursor, 0);
});

test("MemoryDb round-trips and returns copies", async () => {
  const mem = new MemoryDb();
  const a = await mem.load();
  a.nextId = 999;
  assert.notEqual((await mem.load()).nextId, 999);
  await mem.save(a);
  assert.equal((await mem.load()).nextId, 999);
});

test("BrowserDb persists under its key and survives corrupted data", async () => {
  const storage = fakeStorage();
  const db = new BrowserDb({ storage, ...opts });
  const d = await db.load();
  d.nextId = 321;
  await db.save(d);
  assert.equal(JSON.parse(storage.getItem("local:db")).nextId, 321);
  storage.setItem("local:db", "{not json");
  assert.equal((await new BrowserDb({ storage, ...opts }).load()).nextId, 100);
});

const legacy = {
  nextId: 106,
  categories: [
    { id: 1, name: "Food" }, { id: 2, name: "Rent" }, { id: 3, name: "Utilities" },
    { id: 4, name: "Entertainment" }, { id: 5, name: "Other" }, { id: 6, name: "Pets" },
  ],
  expenses: [{ id: 100, amount: 12.5, description: "Tea", date: "2026-11-01", category: { id: 1, name: "Food" } }],
  income: [{ id: 101, amount: 1000, source: "SALARY", description: "", date: "2026-11-01" }],
  budgets: { "2026-11": 5000 },
  categoryBudgets: { 1: 2000 },
  recurring: [{ id: 102, title: "Rent", amount: 15000, category: { id: 2, name: "Rent" }, intervalValue: 1, intervalUnit: "MONTHS", nextDueDate: "2026-12-01", dueTime: "09:00:00", anchorDay: 1, active: true }],
};

test("BrowserDb migrates the legacy guest db, keeping ids and marking records dirty", async () => {
  const storage = fakeStorage();
  storage.setItem("guest:db", JSON.stringify(legacy));
  const d = await new BrowserDb({ storage, ...opts }).load();
  assert.equal(d.nextId, 106);
  const e = d.expenses[0];
  assert.equal(e.id, 100);
  assert.equal(e.amountMinor, 1250);
  assert.equal(e.categoryUuid, builtinUuid(1));
  assert.equal(e.dirty, true);
  assert.equal(e.updatedAt, 1000);
  assert.ok(e.uuid);
  assert.equal(d.income[0].amountMinor, 100000);
  assert.deepEqual(d.budgets.map((b) => [b.month, b.limitMinor]), [["2026-11", 500000]]);
  assert.deepEqual(d.categoryBudgets.map((b) => [b.categoryUuid, b.limitMinor]), [[builtinUuid(1), 200000]]);
  assert.equal(d.recurring[0].amountMinor, 1500000);
  assert.equal(d.recurring[0].categoryUuid, builtinUuid(2));
  const pets = d.categories.find((c) => c.id === 6);
  assert.equal(pets.name, "Pets");
  assert.notEqual(pets.uuid, builtinUuid(6));
  assert.ok(storage.getItem("guest:db"), "legacy data is kept for rollback");
});
