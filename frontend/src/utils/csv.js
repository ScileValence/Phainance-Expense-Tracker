// CSV building (RFC 4180 quoting) with protection against spreadsheet formula injection.
// Pure functions only, so they can be tested with `node --test`.

const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "object" && "raw" in value) return String(value.raw); // numbers already formatted, never altered

  let s = String(value);
  // a text cell that starts like a formula would be executed by Excel / Sheets: prefix it so it stays text
  if (FORMULA_START.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** header: string[]; rows: arrays of string | number | null | { raw }. Lines end with CRLF, no trailing blank line. */
export function toCsv(header, rows) {
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

const HEADERS = ["Date", "Description", "Category", "Amount", "Currency"];

/**
 * The file for a list of expenses. formatAmount(baseAmount) must return a plain number string in the display
 * currency (for example "12.50"). Starts with a byte-order mark so Excel reads the text as UTF-8.
 */
export function expensesCsv(expenses, { formatAmount, currency }) {
  const rows = expenses.map((e) => [
    e.date,
    e.description,
    e.category?.name ?? "",
    { raw: formatAmount(e.amount) },
    currency,
  ]);
  return `\uFEFF${toCsv(HEADERS, rows)}`;
}
