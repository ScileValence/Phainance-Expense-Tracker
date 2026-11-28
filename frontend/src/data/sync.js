// Push local changes, pull remote ones. Idempotent by uuid; last-write-wins per record; deletes are tombstones.
import { freshDb } from "./localDb.js";

const ENTITY_ARRAYS = {
  category: "categories",
  expense: "expenses",
  income: "income",
  budget: "budgets",
  categoryBudget: "categoryBudgets",
  recurring: "recurring",
};
const LOCAL_ONLY = ["id", "uuid", "updatedAt", "dirty", "deleted"];

const without = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

function collect(d) {
  const out = [];
  for (const [entity, key] of Object.entries(ENTITY_ARRAYS)) {
    for (const r of d[key]) {
      if (r.dirty) out.push({ entity, uuid: r.uuid, updatedAtMs: r.updatedAt, deleted: !!r.deleted, data: without(r, LOCAL_ONLY) });
    }
  }
  return out;
}

function apply(d, changes) {
  let applied = 0;
  for (const c of changes) {
    const key = ENTITY_ARRAYS[c.entity];
    if (!key) continue; // an entity this client does not know yet
    const arr = d[key];
    const data = without(c.data || {}, LOCAL_ONLY);
    const local = arr.find((x) => x.uuid === c.uuid);
    if (!local) {
      if (c.deleted) continue;
      arr.push({ id: d.nextId++, uuid: c.uuid, ...data, updatedAt: c.updatedAtMs, dirty: false });
      applied++;
    } else if (c.updatedAtMs > (local.updatedAt ?? 0)) {
      Object.assign(local, data, { updatedAt: c.updatedAtMs, dirty: false });
      if (c.deleted) local.deleted = true;
      else delete local.deleted;
      applied++;
    }
  }
  return applied;
}

// One budget per month and one limit per category: if two devices created one each, keep the newest.
function dedupeNaturalKeys(d, now) {
  const dedupeBy = (arr, keyOf) => {
    const groups = new Map();
    for (const r of arr) {
      if (r.deleted) continue;
      const k = keyOf(r);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      g.sort((a, b) => b.updatedAt - a.updatedAt || (a.uuid < b.uuid ? 1 : -1));
      for (const loser of g.slice(1)) {
        loser.deleted = true;
        loser.dirty = true;
        loser.updatedAt = Math.max(now(), loser.updatedAt + 1);
      }
    }
  };
  dedupeBy(d.budgets, (r) => r.month);
  dedupeBy(d.categoryBudgets, (r) => r.categoryUuid);
}

async function run({ db, api, owner, now = Date.now, pageSize = 200 }) {
  let d = await db.load();
  let reset = false;
  if (d.owner !== owner) {
    // null owner = guest data: adopt it (first sign-in uploads it). Another account's data: never mix.
    if (d.owner !== null) {
      d = freshDb();
      reset = true;
    }
    d.owner = owner;
    await db.save(d);
  }

  const changes = collect(d);
  if (changes.length) {
    await api.post("/sync/push", { changes });
    const cur = await db.load(); // the user may have edited while the request was in flight
    for (const c of changes) {
      const r = cur[ENTITY_ARRAYS[c.entity]].find((x) => x.uuid === c.uuid);
      if (r && r.updatedAt === c.updatedAtMs) r.dirty = false;
    }
    await db.save(cur);
  }

  let pulled = 0;
  let cursor = (await db.load()).sync.cursor;
  for (;;) {
    const { data } = await api.get("/sync/pull", { params: { cursor, limit: pageSize } });
    const cur = await db.load();
    pulled += apply(cur, data.changes);
    cursor = Math.max(cursor, data.nextCursor);
    cur.sync.cursor = cursor;
    dedupeNaturalKeys(cur, now);
    await db.save(cur);
    if (data.changes.length < pageSize) break;
  }
  return { pushed: changes.length, pulled, reset };
}

const inflight = new WeakMap();

// Concurrent calls for the same db share one run.
export function syncNow(opts) {
  if (inflight.has(opts.db)) return inflight.get(opts.db);
  const p = run(opts).finally(() => inflight.delete(opts.db));
  inflight.set(opts.db, p);
  return p;
}

// Sync on start, window focus / coming back online, shortly after local writes, and on a timer.
export function startSync({ db, api, owner, target = globalThis, intervalMs = 5 * 60 * 1000, debounceMs = 1500, now, onError = () => {}, onSynced = () => {} }) {
  const go = () =>
    syncNow({ db, api, owner, now })
      .then((r) => {
        if (r.pulled > 0 || r.reset) onSynced(r);
      })
      .catch(onError);
  let timer = null;
  const onWrite = () => {
    clearTimeout(timer);
    timer = setTimeout(go, debounceMs);
  };
  target.addEventListener("focus", go);
  target.addEventListener("online", go);
  target.addEventListener("local:write", onWrite);
  const interval = setInterval(go, intervalMs);
  go();
  return () => {
    clearTimeout(timer);
    clearInterval(interval);
    target.removeEventListener("focus", go);
    target.removeEventListener("online", go);
    target.removeEventListener("local:write", onWrite);
  };
}

// On sign-out: forget the account's data (it lives on the server), unless some edits never reached it.
export async function signOutLocal(db) {
  const d = await db.load();
  const unsynced = collect(d).length;
  if (d.owner === null || unsynced > 0) return { wiped: false, unsynced };
  await db.save(freshDb());
  return { wiped: true, unsynced: 0 };
}
