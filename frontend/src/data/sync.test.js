import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { localAdapter } from "./localAdapter.js";
import { MemoryDb } from "./localDb.js";
import { syncNow, startSync, signOutLocal } from "./sync.js";

// Mirrors the Task 6 server contract: LWW per (entity, uuid), one global sequence, tombstones.
class FakeServer {
  constructor() {
    this.rows = new Map();
    this.seq = 0;
    this.pushCalls = 0;
    this.pullCalls = 0;
    this.failPush = false;
  }
  async post(url, body) {
    assert.equal(url, "/sync/push");
    this.pushCalls++;
    if (this.failPush) throw new Error("network down");
    let applied = 0;
    let skipped = 0;
    for (const c of body.changes) {
      const key = `${c.entity}:${c.uuid}`;
      const cur = this.rows.get(key);
      if (cur && cur.updatedAtMs >= c.updatedAtMs) {
        skipped++;
        continue;
      }
      this.rows.set(key, { ...c, seq: ++this.seq });
      applied++;
    }
    return { data: { applied, skipped } };
  }
  async get(url, { params }) {
    assert.equal(url, "/sync/pull");
    this.pullCalls++;
    const all = [...this.rows.values()].filter((r) => r.seq > params.cursor).sort((a, b) => a.seq - b.seq).slice(0, params.limit);
    return { data: { changes: all.map(({ seq, ...c }) => c), nextCursor: all.length ? all[all.length - 1].seq : params.cursor } };
  }
}

let uuidN = 0;
function client(server, owner, t0 = 1000) {
  const clock = { t: t0 };
  const db = new MemoryDb();
  const call = localAdapter(db, { now: () => ++clock.t, uuid: () => `u${++uuidN}` });
  const req = async (method, url, data, params) => (await call({ method, url, data, params })).data;
  const sync = (extra = {}) => syncNow({ db, api: server, owner, now: () => clock.t, ...extra });
  return { db, req, sync, clock };
}
const live = async (c) =>
  (await c.db.load()).expenses.filter((e) => !e.deleted).map((e) => [e.uuid, e.description, e.amountMinor]).sort();
const MONTH = { month: "2026-11" };

test("first sign-in uploads guest data; a second sync is a no-op", async () => {
  const server = new FakeServer();
  const a = client(server, "u-1");
  await a.req("post", "/expenses", { amount: 12.5, description: "Tea", date: "2026-11-01" });
  const r1 = await a.sync();
  assert.equal(r1.pushed, 1);
  assert.equal(server.rows.size, 1);
  assert.equal([...server.rows.values()][0].data.amountMinor, 1250);
  assert.equal((await a.db.load()).expenses[0].dirty, false);
  assert.equal((await a.db.load()).owner, "u-1");
  const pushes = server.pushCalls;
  const r2 = await a.sync();
  assert.deepEqual([r2.pushed, r2.pulled, server.pushCalls], [0, 0, pushes]);
});

test("replaying the same push (client died before clearing dirty) is idempotent", async () => {
  const server = new FakeServer();
  const a = client(server, "u-1");
  await a.req("post", "/expenses", { amount: 5, description: "x", date: "2026-11-01" });
  const snapshot = await a.db.load();
  await a.sync();
  const seqAfterFirst = server.seq;
  await a.db.save(snapshot); // dirty again, as if the first run never finished
  await a.sync();
  assert.equal(server.rows.size, 1);
  assert.equal(server.seq, seqAfterFirst);
  assert.equal((await a.db.load()).expenses[0].dirty, false);
});

test("a newer server edit wins; a newer local edit wins", async () => {
  const server = new FakeServer();
  const a = client(server, "u-1", 1000);
  const b = client(server, "u-1", 5000);
  const e = await a.req("post", "/expenses", { amount: 1, description: "v1", date: "2026-11-01" });
  await a.sync();
  await b.sync();
  const bid = (await b.req("get", "/expenses", null, MONTH))[0].id;
  await b.req("put", `/expenses/${bid}`, { amount: 1, description: "from-b" });
  await b.sync();
  await a.sync();
  assert.equal((await a.req("get", "/expenses", null, MONTH))[0].description, "from-b");

  a.clock.t = 9000; // a edits later than b did
  await a.req("put", `/expenses/${e.id}`, { amount: 1, description: "from-a-later" });
  await a.sync();
  await b.sync();
  assert.equal((await b.req("get", "/expenses", null, MONTH))[0].description, "from-a-later");
});

test("delete beats an older edit; a newer edit beats an older delete", async () => {
  const server = new FakeServer();
  const a = client(server, "u-1", 1000);
  const b = client(server, "u-1", 1000);
  const e1 = await a.req("post", "/expenses", { amount: 1, description: "one", date: "2026-11-01" });
  const e2 = await a.req("post", "/expenses", { amount: 2, description: "two", date: "2026-11-01" });
  await a.sync();
  await b.sync();
  const idOf = async (c, d) => (await c.req("get", "/expenses", null, MONTH)).find((x) => x.description === d).id;

  // one: b edits at 3000, a deletes later at 6000 -> the tombstone wins
  b.clock.t = 3000;
  await b.req("put", `/expenses/${await idOf(b, "one")}`, { amount: 1, description: "edited" });
  a.clock.t = 6000;
  await a.req("delete", `/expenses/${e1.id}`);
  await a.sync();
  await b.sync();
  assert.deepEqual((await b.req("get", "/expenses", null, MONTH)).map((x) => x.description), ["two"]);

  // two: a deletes at 7000, b (offline) edits later at 20000 -> the edit wins everywhere
  a.clock.t = 7000;
  await a.req("delete", `/expenses/${e2.id}`);
  await a.sync();
  b.clock.t = 20000;
  await b.req("put", `/expenses/${await idOf(b, "two")}`, { amount: 2, description: "kept" });
  await b.sync();
  await a.sync();
  assert.deepEqual((await a.req("get", "/expenses", null, MONTH)).map((x) => x.description), ["kept"]);
});

test("two clients converge after interleaved offline edits", async () => {
  const server = new FakeServer();
  const a = client(server, "u-1", 1000);
  const b = client(server, "u-1", 1000);
  await a.req("post", "/expenses", { amount: 1, description: "a1", date: "2026-11-01" });
  await b.req("post", "/expenses", { amount: 2, description: "b1", date: "2026-11-02" });
  await a.req("post", "/income", { amount: 100, source: "SALARY", date: "2026-11-03" });
  await a.sync();
  await b.sync();
  await a.sync();
  assert.deepEqual(await live(a), await live(b));
  assert.equal((await live(a)).length, 2);
  assert.equal((await b.req("get", "/income", null, MONTH)).length, 1);
});

test("two devices setting the same month's budget converge to one record", async () => {
  const server = new FakeServer();
  const a = client(server, "u-1", 1000);
  const b = client(server, "u-1", 1000);
  await a.req("post", "/budget", { month: "2026-11", limitAmount: 100 });
  b.clock.t = 2000;
  await b.req("post", "/budget", { month: "2026-11", limitAmount: 200 });
  for (const c of [a, b, a, b]) await c.sync();
  const limits = await Promise.all([a, b].map((c) => c.req("get", "/budget", null, MONTH)));
  assert.equal(limits[0].limit, limits[1].limit);
  assert.equal(limits[0].limit, 200);
});

test("pull pages through every change", async () => {
  const server = new FakeServer();
  const a = client(server, "u-1");
  for (let i = 0; i < 5; i++) await a.req("post", "/expenses", { amount: 1, description: `e${i}`, date: "2026-11-01" });
  await a.sync();
  const b = client(server, "u-1");
  const r = await b.sync({ pageSize: 2 });
  assert.equal(r.pulled, 5);
  assert.equal((await b.db.load()).sync.cursor, server.seq);
});

test("a failed push keeps records dirty and the next sync succeeds", async () => {
  const server = new FakeServer();
  const a = client(server, "u-1");
  await a.req("post", "/expenses", { amount: 1, description: "x", date: "2026-11-01" });
  server.failPush = true;
  await assert.rejects(a.sync(), /network down/);
  assert.equal((await a.db.load()).expenses[0].dirty, true);
  server.failPush = false;
  assert.equal((await a.sync()).pushed, 1);
});

test("signing in as a different user never mixes data", async () => {
  const s1 = new FakeServer();
  const s2 = new FakeServer();
  const other = client(s2, "u-2");
  await other.req("post", "/expenses", { amount: 9, description: "u2-data", date: "2026-11-01" });
  await other.sync();

  const a = client(s1, "u-1");
  await a.req("post", "/expenses", { amount: 1, description: "u1-data", date: "2026-11-01" });
  await a.sync();
  const r = await syncNow({ db: a.db, api: s2, owner: "u-2", now: () => 1 });
  assert.equal(r.reset, true);
  assert.deepEqual((await live(a)).map((x) => x[1]), ["u2-data"]);
  assert.equal(s2.rows.size, 1, "u1 data was not uploaded to u2");
});

test("concurrent syncNow calls share one run", async () => {
  const server = new FakeServer();
  const a = client(server, "u-1");
  await a.req("post", "/expenses", { amount: 1, description: "x", date: "2026-11-01" });
  await Promise.all([a.sync(), a.sync(), a.sync()]);
  assert.equal(server.pushCalls, 1);
});

test("startSync runs on start, focus, debounced local writes and the interval, and stops", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const server = new FakeServer();
    const a = client(server, "u-1");
    const target = new EventTarget();
    const settle = () => new Promise((r) => setImmediate(r));
    const stop = startSync({ db: a.db, api: server, owner: "u-1", target, intervalMs: 60000, debounceMs: 1000, now: () => 1 });
    await settle();
    assert.equal(server.pullCalls, 1);
    target.dispatchEvent(new Event("focus"));
    await settle();
    assert.equal(server.pullCalls, 2);
    target.dispatchEvent(new Event("local:write"));
    target.dispatchEvent(new Event("local:write"));
    mock.timers.tick(1000);
    await settle();
    assert.equal(server.pullCalls, 3);
    mock.timers.tick(60000);
    await settle();
    assert.equal(server.pullCalls, 4);
    stop();
    target.dispatchEvent(new Event("focus"));
    mock.timers.tick(120000);
    await settle();
    assert.equal(server.pullCalls, 4);
  } finally {
    mock.timers.reset();
  }
});

test("startSync reports remote changes through onSynced, and stays quiet otherwise", async () => {
  const server = new FakeServer();
  const other = client(server, "u-1");
  await other.req("post", "/expenses", { amount: 1, description: "remote", date: "2026-11-01" });
  await other.sync();
  const a = client(server, "u-1");
  const seen = [];
  const settle = () => new Promise((r) => setTimeout(r, 20));
  const target = new EventTarget();
  const stop = startSync({ db: a.db, api: server, owner: "u-1", target, intervalMs: 1e9, debounceMs: 1e9, now: () => 1, onSynced: (r) => seen.push(r.pulled) });
  await settle();
  target.dispatchEvent(new Event("focus"));
  await settle();
  stop();
  assert.deepEqual(seen, [1]);
});

test("signing out clears synced account data but never destroys unsynced edits", async () => {
  const server = new FakeServer();
  const a = client(server, "u-1");
  await a.req("post", "/expenses", { amount: 1, description: "synced", date: "2026-11-01" });
  await a.sync();
  assert.deepEqual(await signOutLocal(a.db), { wiped: true, unsynced: 0 });
  assert.equal((await live(a)).length, 0);
  assert.equal((await a.db.load()).owner, null);

  const b = client(server, "u-1");
  await b.sync();
  await b.req("post", "/expenses", { amount: 2, description: "offline", date: "2026-11-02" });
  assert.deepEqual(await signOutLocal(b.db), { wiped: false, unsynced: 1 });
  assert.equal((await live(b)).length, 2);
  await b.sync(); // same account signs back in: nothing lost
  assert.equal(server.rows.size, 2);
});

test("signing out of guest mode leaves guest data alone", async () => {
  const g = client(new FakeServer(), "u-1");
  await g.req("post", "/expenses", { amount: 1, description: "guest", date: "2026-11-01" });
  assert.deepEqual(await signOutLocal(g.db), { wiped: false, unsynced: 1 });
});
