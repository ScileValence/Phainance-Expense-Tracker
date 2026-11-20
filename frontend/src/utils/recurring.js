// Helpers shared by the recurring-payments UI

export const UNITS = [
  { value: "DAYS", one: "day", many: "days" },
  { value: "WEEKS", one: "week", many: "weeks" },
  { value: "MONTHS", one: "month", many: "months" },
];

export const hhmm = (t) => (t ? String(t).slice(0, 5) : "09:00");

export const dueMoment = (r) => new Date(`${r.nextDueDate}T${hhmm(r.dueTime)}:00`);

export const isDue = (r, now = new Date()) => r.active && dueMoment(r) <= now;

// due within the next 3 days (but not yet due)
export const isSoon = (r, now = new Date()) => {
  if (!r.active) return false;
  const diff = dueMoment(r) - now;
  return diff > 0 && diff <= 3 * 24 * 3600 * 1000;
};

export const intervalLabel = (r) => {
  const u = UNITS.find((x) => x.value === r.intervalUnit) || UNITS[2];
  return r.intervalValue === 1 ? `Every ${u.one}` : `Every ${r.intervalValue} ${u.many}`;
};

export const formatDue = (r) => {
  const d = dueMoment(r);
  const date = d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
};

export const relativeDue = (r, now = new Date()) => {
  const diff = dueMoment(r) - now;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hrs = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const txt = mins < 60 ? `${mins}m` : hrs < 48 ? `${hrs}h` : `${days}d`;
  return diff <= 0 ? `${txt} overdue` : `in ${txt}`;
};

export { money } from "./currency";
