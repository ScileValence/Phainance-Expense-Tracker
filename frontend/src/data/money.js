// Money is kept as integer minor units (paise). Never do arithmetic on decimal rupees.
export function toMinor(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  const abs = Math.abs(n);
  const s = String(abs);
  // "1.005e2" parses to 100.5 exactly, unlike 1.005 * 100
  const minor = s.includes("e") ? Math.round(abs * 100) : Math.round(Number(`${s}e2`));
  return n < 0 ? -minor : minor;
}

export const toMajor = (minor) => (Number(minor) || 0) / 100;
