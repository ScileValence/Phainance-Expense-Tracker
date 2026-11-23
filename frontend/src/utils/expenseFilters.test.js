import test from "node:test";
import assert from "node:assert/strict";
import { filterExpenses, sortExpenses, summarize, hasActiveFilters } from "./expenseFilters.js";

const food = { id: 1, name: "Food" };
const rent = { id: 2, name: "Rent" };

const sample = () => [
  { id: 1, amount: 450, description: "Groceries", date: "2026-11-03", category: food },
  { id: 2, amount: 12000, description: "Rent", date: "2026-11-01", category: rent },
  { id: 3, amount: 90, description: "coffee beans", date: "2026-11-10", category: food },
  { id: 4, amount: 300, description: "Gift", date: "2026-11-10", category: null },
  { id: 5, amount: 450, description: "Groceries", date: "2026-10-28", category: food },
];

const ids = (list) => list.map((e) => e.id);

test("query matches the description, ignoring case and surrounding spaces", () => {
  assert.deepEqual(ids(filterExpenses(sample(), { query: "  GRO " })), [1, 5]);
});

test("query also matches the category name", () => {
  assert.deepEqual(ids(filterExpenses(sample(), { query: "rent" })), [2]);
  assert.deepEqual(ids(filterExpenses(sample(), { query: "food" })), [1, 3, 5]);
});

test("an empty query keeps everything", () => {
  assert.equal(filterExpenses(sample(), { query: "   " }).length, 5);
  assert.equal(filterExpenses(sample(), {}).length, 5);
});

test("categoryId filters by id, compared as strings", () => {
  assert.deepEqual(ids(filterExpenses(sample(), { categoryId: "1" })), [1, 3, 5]);
  assert.deepEqual(ids(filterExpenses(sample(), { categoryId: 2 })), [2]);
});

test('"none" keeps only expenses without a category', () => {
  assert.deepEqual(ids(filterExpenses(sample(), { categoryId: "none" })), [4]);
});

test("min and max are inclusive and accept numeric strings", () => {
  assert.deepEqual(ids(filterExpenses(sample(), { min: "300", max: "450" })), [1, 4, 5]);
  assert.deepEqual(ids(filterExpenses(sample(), { min: "", max: "90" })), [3]);
  assert.deepEqual(ids(filterExpenses(sample(), { min: "12000" })), [2]);
});

test("filters combine with AND", () => {
  assert.deepEqual(ids(filterExpenses(sample(), { query: "gro", categoryId: "1", min: "400" })), [1, 5]);
  assert.deepEqual(ids(filterExpenses(sample(), { query: "gift", categoryId: "1" })), []);
});

test("filterExpenses does not mutate its input", () => {
  const list = sample();
  const copy = JSON.stringify(list);
  filterExpenses(list, { query: "gro" });
  assert.equal(JSON.stringify(list), copy);
});

test("sort by amount, highest first and lowest first", () => {
  assert.deepEqual(ids(sortExpenses(sample(), "amount", "desc")), [2, 1, 5, 4, 3]);
  assert.deepEqual(ids(sortExpenses(sample(), "amount", "asc")), [3, 4, 1, 5, 2]);
});

test("sort by date, newest first and oldest first", () => {
  assert.deepEqual(ids(sortExpenses(sample(), "date", "desc")), [4, 3, 1, 2, 5]);
  assert.deepEqual(ids(sortExpenses(sample(), "date", "asc")), [5, 2, 1, 4, 3].reverse().reverse());
});

test("sort by description ignores case", () => {
  assert.deepEqual(ids(sortExpenses(sample(), "description", "asc")), [3, 4, 1, 5, 2]);
});

test("sort by category name puts the uncategorised last when ascending", () => {
  const out = sortExpenses(sample(), "category", "asc");
  assert.deepEqual(out.map((e) => e.category?.name ?? null), ["Food", "Food", "Food", "Rent", null]);
});

test("ties fall back to the newest date, then the highest id", () => {
  // ids 1 and 5 have the same amount: id 1 is newer
  assert.deepEqual(ids(sortExpenses(sample(), "amount", "desc")).slice(1, 3), [1, 5]);
  const twins = [
    { id: 7, amount: 10, description: "a", date: "2026-01-01", category: null },
    { id: 8, amount: 10, description: "a", date: "2026-01-01", category: null },
  ];
  assert.deepEqual(ids(sortExpenses(twins, "amount", "asc")), [8, 7]);
});

test("sortExpenses does not mutate its input", () => {
  const list = sample();
  const before = ids(list);
  sortExpenses(list, "amount", "desc");
  assert.deepEqual(ids(list), before);
});

test("summarize counts and totals, treating missing amounts as 0", () => {
  assert.deepEqual(summarize(sample()), { count: 5, total: 13290 });
  assert.deepEqual(summarize([{ id: 1, amount: null }, { id: 2, amount: 5 }]), { count: 2, total: 5 });
  assert.deepEqual(summarize([]), { count: 0, total: 0 });
});

test("hasActiveFilters is false for blank filters and true when any is set", () => {
  assert.equal(hasActiveFilters({ query: "  ", categoryId: "", min: "", max: "" }), false);
  assert.equal(hasActiveFilters({}), false);
  assert.equal(hasActiveFilters({ query: "a" }), true);
  assert.equal(hasActiveFilters({ categoryId: "none" }), true);
  assert.equal(hasActiveFilters({ min: "0" }), true);
});
