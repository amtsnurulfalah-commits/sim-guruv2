import Decimal from "decimal.js";
const truthy = new Set(["true", "1", "ya", "yes", "aktif"]),
  falsy = new Set(["false", "0", "tidak", "no", "nonaktif"]);
export function booleanValue(v: unknown) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number" && [0, 1].includes(v)) return v === 1;
  if (typeof v === "string") {
    const x = v.trim().toLowerCase();
    if (truthy.has(x)) return true;
    if (falsy.has(x)) return false;
  }
  throw new Error("AMBIGUOUS_BOOLEAN");
}
export function decimalValue(v: unknown) {
  if (
    typeof v !== "string" ||
    !/^[-+]?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(v.trim())
  )
    throw new Error("DECIMAL_TEXT_REQUIRED");
  const n = new Decimal(v.trim());
  if (!n.isFinite() || n.isNegative())
    throw new Error("NEGATIVE_OR_INVALID_DECIMAL");
  return n.toFixed();
}
export function isoDate(v: unknown, format: "ISO" | "DMY") {
  if (typeof v !== "string") throw new Error("EXPLICIT_DATE_TEXT_REQUIRED");
  let s = v.trim();
  if (format === "DMY" && /^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    s = `${y}-${m}-${d}`;
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s + "T00:00:00Z")) ||
    new Date(s + "T00:00:00Z").toISOString().slice(0, 10) !== s
  )
    throw new Error("INVALID_DATE");
  return s;
}
export function localTime(v: unknown) {
  if (
    typeof v !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(v.trim())
  )
    throw new Error("INVALID_LOCAL_TIME");
  return v.trim().length === 5 ? v.trim() + ":00" : v.trim();
}
export function textIdentifier(v: unknown) {
  if (typeof v !== "string" || !v.trim() || v.length > 200)
    throw new Error("TEXT_IDENTIFIER_REQUIRED");
  return v.trim();
}
