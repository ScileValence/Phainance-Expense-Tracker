import test from "node:test";
import assert from "node:assert/strict";
import { toCsv, expensesCsv } from "./csv.js";

test("plain values are written as they are", () => {
  assert.equal(toCsv(["a", "b"], [["x", "y"]]), "a,b\r\nx,y");
});

test("a comma, a double quote or a newline wraps the value in quotes", () => {
  assert.equal(toCsv(["h"], [["a,b"]]), 'h\r\n"a,b"');
  assert.equal(toCsv(["h"], [['say "hi"']]), 'h\r\n"say ""hi"""');
  assert.equal(toCsv(["h"], [["line1\nline2"]]), 'h\r\n"line1\nline2"');
});

test("null and undefined become empty cells", () => {
  assert.equal(toCsv(["a", "b", "c"], [[null, "x", undefined]]), "a,b,c\r\n,x,");
});

test("numbers are written as numbers and negatives are not altered", () => {
  assert.equal(toCsv(["n"], [[12.5], [-3], [0]]), "n\r\n12.5\r\n-3\r\n0");
});

test("text that starts like a formula is neutralised", () => {
  for (const bad of ["=SUM(A1:A2)", "+1", "-1+1", "@cmd", "\tx", "\rx"]) {
    const out = toCsv(["h"], [[bad]]).split("\r\n")[1];
    assert.ok(out.startsWith("'") || out.startsWith("\"'"), `${JSON.stringify(bad)} was not neutralised: ${out}`);
  }
});

test("text that merely contains a formula character in the middle is untouched", () => {
  assert.equal(toCsv(["h"], [["a=b"]]), "h\r\na=b");
});

test("there is no trailing blank row", () => {
  assert.equal(toCsv(["a"], []), "a");
  assert.ok(!toCsv(["a"], [["x"]]).endsWith("\r\n"));
});

test("expensesCsv starts with a byte-order mark and the five headers", () => {
  const csv = expensesCsv([], { formatAmount: (n) => String(n), currency: "INR" });
  assert.equal(csv, "\uFEFFDate,Description,Category,Amount,Currency");
});

test("expensesCsv writes one row per expense using formatAmount and the currency code", () => {
  const rows = [
    { id: 1, amount: 450, description: "Groceries, weekly", date: "2026-11-03", category: { id: 1, name: "Food" } },
    { id: 2, amount: 90, description: "=cmd", date: "2026-11-10", category: null },
  ];
  const csv = expensesCsv(rows, { formatAmount: (n) => (n / 83).toFixed(2), currency: "USD" });
  const lines = csv.replace("\uFEFF", "").split("\r\n");
  assert.equal(lines[1], '2026-11-03,"Groceries, weekly",Food,5.42,USD');
  assert.equal(lines[2], "2026-11-10,'=cmd,,1.08,USD");
});
