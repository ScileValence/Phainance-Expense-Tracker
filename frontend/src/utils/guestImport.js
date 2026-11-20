import api from "../api/axios";
import { hasGuestData, readGuestData, clearGuestData } from "./guestStore";

// After login/sign-up: offer to move guest-mode data into the account. Returns counts or null.
export async function importGuestData() {
  if (!hasGuestData()) return null;
  if (!window.confirm("You have data from guest mode on this device. Import it into your account?")) return null;

  const db = readGuestData();
  const { data: serverCats } = await api.get("/categories");
  const byName = new Map((serverCats || []).map((c) => [c.name.toLowerCase(), c.id]));
  const catId = (c) => (c ? byName.get(c.name.toLowerCase()) ?? byName.get("other") ?? null : null);

  let done = 0;
  let failed = 0;
  const run = async (fn) => {
    try {
      await fn();
      done++;
    } catch {
      failed++;
    }
  };

  for (const e of db.expenses) {
    await run(() =>
      api.post("/expenses", { amount: e.amount, description: e.description, date: e.date, categoryId: catId(e.category) })
    );
  }
  for (const i of db.income) {
    await run(() => api.post("/income", { amount: i.amount, source: i.source, description: i.description, date: i.date }));
  }
  for (const [month, limit] of Object.entries(db.budgets)) {
    await run(() => api.post("/budget", { month, limitAmount: limit }));
  }
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  for (const r of db.recurring) {
    await run(() =>
      api.post("/recurring", {
        title: r.title,
        amount: r.amount,
        categoryId: catId(r.category),
        intervalValue: r.intervalValue,
        intervalUnit: r.intervalUnit,
        nextDueDate: r.nextDueDate,
        dueTime: (r.dueTime || "09:00").slice(0, 5),
        timeZone,
      })
    );
  }

  if (failed === 0) clearGuestData();
  return { done, failed };
}
