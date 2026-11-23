// Same rule as the backend (BudgetAlertPolicy): alert only when spending crosses a line on the way up.
export const WARN_AT = 0.8;
const EPS = 1e-9;

export function crossed(before, after, limit) {
  if (!(limit > 0) || after <= before) return "none";
  if (before + EPS < limit && after + EPS >= limit) return "exceeded";
  const line = limit * WARN_AT;
  if (before + EPS < line && after + EPS >= line) return "warning";
  return "none";
}

export const percent = (spent, limit) => (limit > 0 ? Math.round((spent / limit) * 100) : 0);
