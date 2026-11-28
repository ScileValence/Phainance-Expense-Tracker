// Schedule arithmetic for recurring payments, shared by the bills calendar and guest mode.
// It must give the same dates as RecurringPayment.nextAfter on the server (see the matching tests).
// Dates are plain "YYYY-MM-DD" strings handled with UTC arithmetic, so time zones can never shift a day.

const pad = (n) => String(n).padStart(2, "0");
const format = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const parse = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
};
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based

function addDays(dateStr, n) {
  const { y, m, d } = parse(dateStr);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return format(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** The occurrence after dateStr. No or non-positive interval = 1, no unit = months, monthly schedules return to the anchor day. */
export function nextAfter(dateStr, every, unit, anchorDay) {
  const n = !every || every < 1 ? 1 : every;
  const u = unit || "MONTHS";
  if (u === "DAYS") return addDays(dateStr, n);
  if (u === "WEEKS") return addDays(dateStr, 7 * n);

  const { y, m, d } = parse(dateStr);
  const months = y * 12 + (m - 1) + n;
  const ny = Math.floor(months / 12);
  const nm = (months % 12) + 1;
  const anchor = anchorDay == null ? d : anchorDay;
  return format(ny, nm, Math.min(anchor, daysInMonth(ny, nm)));
}

const STEP_LIMIT = 20000; // hard stop so an odd payment can never freeze the page

/** Due dates of an active payment inside [from, to] (inclusive), starting at its nextDueDate. At most `max`. */
export function occurrencesBetween(payment, from, to, max = 400) {
  if (!payment || !payment.active || !payment.nextDueDate) return [];
  const out = [];
  let current = payment.nextDueDate;
  for (let steps = 0; steps < STEP_LIMIT && out.length < max && current <= to; steps++) {
    if (current >= from) out.push(current);
    current = nextAfter(current, payment.intervalValue, payment.intervalUnit, payment.anchorDay);
  }
  return out;
}

/** Due dates whose local due moment is at or before `now` (a Date), in order, at most `max`. */
export function dueOccurrences(payment, now, max = 12) {
  if (!payment || !payment.active || !payment.nextDueDate) return [];
  const [hh, mm, ss] = (payment.dueTime || "09:00:00").split(":").map(Number);
  const out = [];
  let current = payment.nextDueDate;
  while (out.length < max) {
    const { y, m, d } = parse(current);
    if (new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0) > now) break;
    out.push(current);
    current = nextAfter(current, payment.intervalValue, payment.intervalUnit, payment.anchorDay);
  }
  return out;
}
