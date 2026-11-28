import test from "node:test";
import assert from "node:assert/strict";
import { toMinor, toMajor } from "./money.js";

test("toMinor converts decimal amounts to exact paise", () => {
  assert.equal(toMinor(0.1), 10);
  assert.equal(toMinor(0.2), 20);
  assert.equal(toMinor(19.995), 2000);
  assert.equal(toMinor(1.005), 101);
  assert.equal(toMinor(1234567.89), 123456789);
  assert.equal(toMinor("250"), 25000);
});

test("toMinor tolerates junk and negatives", () => {
  assert.equal(toMinor(undefined), 0);
  assert.equal(toMinor("abc"), 0);
  assert.equal(toMinor(-2.5), -250);
  assert.equal(toMinor(1e-9), 0);
});

test("toMajor divides by 100 and sums stay exact in minor units", () => {
  assert.equal(toMajor(1999), 19.99);
  assert.equal(toMajor(toMinor(0.1) + toMinor(0.2)), 0.3);
});
