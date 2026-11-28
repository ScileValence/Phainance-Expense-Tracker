import test from "node:test";
import assert from "node:assert/strict";
import { localAdapter } from "./localAdapter.js";
import { MemoryDb } from "./localDb.js";

function setup() {
  let t = 1000;
  let u = 0;
  let writes = 0;
  const db = new MemoryDb();
  const call = localAdapter(db, { now: () => ++t, uuid: () => `id-${++u}`, onWrite: () => writes++ });
  const req = async (method, url, data, params) => (await call({ method, url, data, params })).data;
  const fails = async (method, url, data) => {
    try {
      await call({ method, url, data });
    } catch (e) {
      return e.response;
    }
    assert.fail(`${method} ${url} should have failed`);
  };
  return { db, req, fails, writes: () => writes };
}

test("categories: defaults, create, validation, rename, delete", async () => {
  const { req, fails, db } = setup();
  const list = await req("get", "/categories");
  assert.equal(list.length, 5);
  assert.ok(list.every((c) => c.builtIn));
  const pets = await req("post", "/categories", { name: "  Pets  " });
  assert.deepEqual([pets.id, pets.name, pets.builtIn], [100, "Pets", false]);
  assert.equal((await fails("post", "/categories", { name: "pets" })).status, 409);
  assert.equal((await fails("post", "/categories", { name: "" })).status, 400);
  assert.equal((await fails("post", "/categories", { name: "x".repeat(41) })).status, 400);
  assert.equal((await fails("put", "/categories/1", { name: "Eat" })).status, 403);
  assert.equal((await req("put", "/categories/100", { name: "Cats" })).name, "Cats");
  await req("delete", "/categories/100");
  assert.equal((await req("get", "/categories")).length, 5);
  assert.equal((await db.load()).categories.find((c) => c.id === 100).deleted, true);
});

test("categories: cannot delete one that is in use", async () => {
  const { req, fails } = setup();
  const c = await req("post", "/categories", { name: "Pets" });
  await req("post", "/expenses", { amount: 5, date: "2026-11-02", categoryId: c.id });
  const r = await fails("delete", `/categories/${c.id}`);
  assert.equal(r.status, 409);
  assert.match(r.data.message, /1 expense/);
});

test("expenses: create returns the old shape and hides sync fields", async () => {
  const { req } = setup();
  const e = await req("post", "/expenses", { amount: 12.5, description: "Tea", date: "2026-11-01", categoryId: 1 });
  assert.deepEqual(e, { id: 100, amount: 12.5, description: "Tea", date: "2026-11-01", category: { id: 1, name: "Food" } });
});

test("expenses: month filter, explicit range, bad range falls back to month", async () => {
  const { req } = setup();
  for (const d of ["2026-10-31", "2026-11-01", "2026-11-15", "2026-12-01"]) await req("post", "/expenses", { amount: 1, date: d });
  assert.equal((await req("get", "/expenses", null, { month: "2026-11" })).length, 2);
  assert.equal((await req("get", "/expenses", null, { from: "2026-10-31", to: "2026-11-01" })).length, 2);
  assert.equal((await req("get", "/expenses", null, { month: "2026-11", from: "2026-12-31", to: "2026-01-01" })).length, 2);
});

test("expenses: update, 404, and delete writes a tombstone that hides the row", async () => {
  const { req, fails, db } = setup();
  const e = await req("post", "/expenses", { amount: 10, date: "2026-11-01" });
  const before = (await db.load()).expenses[0];
  const up = await req("put", `/expenses/${e.id}`, { amount: 20, description: "x" });
  assert.equal(up.amount, 20);
  assert.equal((await fails("put", "/expenses/9999", { amount: 1 })).status, 404);
  await req("delete", `/expenses/${e.id}`);
  assert.equal((await req("get", "/expenses", null, { month: "2026-11" })).length, 0);
  const after = (await db.load()).expenses[0];
  assert.equal(after.deleted, true);
  assert.equal(after.dirty, true);
  assert.ok(after.updatedAt > before.updatedAt);
  assert.equal((await fails("delete", `/expenses/${e.id}`)).status, 404);
});

test("writes mark records dirty and fire onWrite; reads do not", async () => {
  const { req, db, writes } = setup();
  await req("get", "/expenses", null, { month: "2026-11" });
  assert.equal(writes(), 0);
  await req("post", "/expenses", { amount: 3, date: "2026-11-01" });
  assert.equal(writes(), 1);
  const r = (await db.load()).expenses[0];
  assert.deepEqual([r.dirty, r.uuid, r.amountMinor, r.source], [true, "id-1", 300, "manual"]);
});

test("money stays exact: 0.1 + 0.2 spent is 0.3", async () => {
  const { req } = setup();
  await req("post", "/expenses", { amount: 0.1, date: "2026-11-01" });
  await req("post", "/expenses", { amount: 0.2, date: "2026-11-01" });
  assert.equal((await req("get", "/budget", null, { month: "2026-11" })).spent, 0.3);
});

test("income: validation, ordering, month filter, delete", async () => {
  const { req, fails } = setup();
  assert.equal((await fails("post", "/income", { amount: 0, source: "SALARY" })).status, 400);
  assert.equal((await fails("post", "/income", { amount: 5, source: "LOTTERY" })).status, 400);
  const a = await req("post", "/income", { amount: 100, source: "salary", date: "2026-11-01" });
  await req("post", "/income", { amount: 50, source: "GIFT", date: "2026-11-09" });
  await req("post", "/income", { amount: 7, source: "GIFT", date: "2026-10-09" });
  const list = await req("get", "/income", null, { month: "2026-11" });
  assert.deepEqual(list.map((i) => i.amount), [50, 100]);
  await req("delete", `/income/${a.id}`);
  assert.equal((await req("get", "/income", null, { month: "2026-11" })).length, 1);
});

test("budget: set per month, update keeps one record, category limits", async () => {
  const { req, db, fails } = setup();
  assert.deepEqual(await req("get", "/budget", null, { month: "2026-11" }), { month: "2026-11", limit: 0, spent: 0 });
  await req("post", "/budget", { month: "2026-11", limitAmount: 5000 });
  await req("put", "/budget", { month: "2026-11", limitAmount: 6000 });
  assert.equal((await req("get", "/budget", null, { month: "2026-11" })).limit, 6000);
  assert.equal((await db.load()).budgets.length, 1);

  await req("post", "/expenses", { amount: 40, date: "2026-11-02", categoryId: 1 });
  await req("put", "/budget/categories/1", { limitAmount: 100 });
  assert.deepEqual(await req("get", "/budget/categories", null, { month: "2026-11" }), [{ categoryId: 1, name: "Food", limit: 100, spent: 40 }]);
  assert.equal((await fails("put", "/budget/categories/1", { limitAmount: -1 })).status, 400);
  await req("put", "/budget/categories/1", { limitAmount: 0 });
  assert.deepEqual(await req("get", "/budget/categories", null, { month: "2026-11" }), []);
});

test("recurring: validate, create, confirm logs an expense and advances, month-end anchor, skip, toggle, delete", async () => {
  const { req, fails } = setup();
  assert.equal((await fails("post", "/recurring", { title: "", amount: 5 })).status, 400);
  const r = await req("post", "/recurring", { title: "Rent", amount: 15000, categoryId: 2, intervalValue: 1, intervalUnit: "months", nextDueDate: "2026-01-31", dueTime: "09:30" });
  assert.deepEqual([r.dueTime, r.anchorDay, r.active, r.intervalUnit], ["09:30:00", 31, true, "MONTHS"]);
  const c = await req("post", `/recurring/${r.id}/confirm`);
  assert.equal(c.nextDueDate, "2026-02-28");
  const exp = await req("get", "/expenses", null, { month: "2026-01" });
  assert.deepEqual([exp.length, exp[0].amount, exp[0].description], [1, 15000, "Rent"]);
  assert.equal((await req("post", `/recurring/${r.id}/skip`)).nextDueDate, "2026-03-31");
  assert.equal((await req("post", `/recurring/${r.id}/toggle`)).active, false);
  await req("delete", `/recurring/${r.id}`);
  assert.equal((await req("get", "/recurring")).length, 0);
});

test("analytics: category, daily, trend", async () => {
  const { req } = setup();
  await req("post", "/expenses", { amount: 10, date: "2026-11-01", categoryId: 1 });
  await req("post", "/expenses", { amount: 5, date: "2026-11-01" });
  await req("post", "/expenses", { amount: 20, date: "2026-10-05", categoryId: 1 });
  const m = { month: "2026-11" };
  assert.deepEqual(await req("get", "/analytics/category", null, m), [{ name: "Food", value: 10 }, { name: "Uncategorized", value: 5 }]);
  assert.deepEqual(await req("get", "/analytics/daily", null, m), [{ date: "2026-11-01", amount: 15 }]);
  const trend = await req("get", "/analytics/trend", null, { ...m, months: 2 });
  assert.deepEqual(trend, [{ month: "2026-10", amount: 20 }, { month: "2026-11", amount: 15 }]);
});

test("unknown or account-only routes answer 401", async () => {
  const { fails } = setup();
  assert.equal((await fails("get", "/notifications/settings")).status, 401);
});
