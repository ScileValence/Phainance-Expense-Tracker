import test from "node:test";
import assert from "node:assert/strict";
import { nextAfter, occurrencesBetween, dueOccurrences } from "./recurringSchedule.js";

// the same cases as the Java tests, so the calendar and the server agree

test("monthly on the 31st clamps to February, then returns to the 31st", () => {
  assert.equal(nextAfter("2026-01-31", 1, "MONTHS", 31), "2026-02-28");
  assert.equal(nextAfter("2026-02-28", 1, "MONTHS", 31), "2026-03-31");
});

test("leap year February uses the 29th", () => {
  assert.equal(nextAfter("2028-01-31", 1, "MONTHS", 31), "2028-02-29");
});

test("monthly anchored on the 30th keeps the anchor", () => {
  assert.equal(nextAfter("2026-01-30", 1, "MONTHS", 30), "2026-02-28");
  assert.equal(nextAfter("2026-02-28", 1, "MONTHS", 30), "2026-03-30");
});

test("every two months skips a month; monthly crosses a year end", () => {
  assert.equal(nextAfter("2026-01-15", 2, "MONTHS", 15), "2026-03-15");
  assert.equal(nextAfter("2026-12-15", 1, "MONTHS", 15), "2027-01-15");
});

test("weekly adds seven days per interval; daily crosses a year end", () => {
  assert.equal(nextAfter("2026-11-21", 2, "WEEKS", null), "2026-12-05");
  assert.equal(nextAfter("2026-12-31", 1, "DAYS", null), "2027-01-01");
});

test("a missing interval or unit means every month; zero or negative means one", () => {
  assert.equal(nextAfter("2026-01-10", null, null, null), "2026-02-10");
  assert.equal(nextAfter("2026-01-10", 0, "DAYS", null), "2026-01-11");
  assert.equal(nextAfter("2026-01-10", -3, "DAYS", null), "2026-01-11");
});

test("without an anchor the current day is used", () => {
  assert.equal(nextAfter("2026-01-31", 1, "MONTHS", null), "2026-02-28");
});

const monthly = (extra = {}) => ({ nextDueDate: "2026-11-05", dueTime: "09:00:00", intervalValue: 1, intervalUnit: "MONTHS", anchorDay: 5, active: true, ...extra });

test("occurrencesBetween returns the dates inside the range, from nextDueDate forward", () => {
  assert.deepEqual(occurrencesBetween(monthly(), "2026-11-01", "2027-02-28"), ["2026-11-05", "2026-12-05", "2027-01-05", "2027-02-05"]);
  assert.deepEqual(occurrencesBetween(monthly(), "2026-12-01", "2026-12-31"), ["2026-12-05"]);
});

test("occurrencesBetween never goes back before nextDueDate", () => {
  assert.deepEqual(occurrencesBetween(monthly({ nextDueDate: "2026-12-05" }), "2026-11-01", "2026-11-30"), []);
});

test("occurrencesBetween returns nothing for a paused payment", () => {
  assert.deepEqual(occurrencesBetween(monthly({ active: false }), "2026-11-01", "2027-12-31"), []);
});

test("occurrencesBetween is bounded by max on long ranges", () => {
  const daily = monthly({ intervalUnit: "DAYS", anchorDay: null });
  const out = occurrencesBetween(daily, "2026-11-01", "2029-12-31", 50);
  assert.equal(out.length, 50);
  assert.equal(out[0], "2026-11-05");
});

test("occurrencesBetween handles the 31st across short months", () => {
  const p = monthly({ nextDueDate: "2026-01-31", anchorDay: 31 });
  assert.deepEqual(occurrencesBetween(p, "2026-01-01", "2026-04-30"), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
});

test("dueOccurrences returns nothing before the due time", () => {
  assert.deepEqual(dueOccurrences(monthly({ nextDueDate: "2026-11-21" }), new Date(2026, 10, 21, 8, 59, 59)), []);
});

test("dueOccurrences returns an occurrence at its due moment", () => {
  assert.deepEqual(dueOccurrences(monthly({ nextDueDate: "2026-11-21" }), new Date(2026, 10, 21, 9, 0, 0)), ["2026-11-21"]);
});

test("dueOccurrences returns missed ones in order and respects max", () => {
  assert.deepEqual(dueOccurrences(monthly({ nextDueDate: "2026-09-05" }), new Date(2026, 10, 10, 12, 0, 0)), ["2026-09-05", "2026-10-05", "2026-11-05"]);
  const daily = monthly({ nextDueDate: "2026-01-01", intervalUnit: "DAYS", anchorDay: null });
  assert.equal(dueOccurrences(daily, new Date(2026, 10, 21), 12).length, 12);
});

test("dueOccurrences ignores paused payments", () => {
  assert.deepEqual(dueOccurrences(monthly({ nextDueDate: "2026-01-01", active: false }), new Date(2026, 10, 21)), []);
});
