/** Presentation only. Canonical decimal strings never pass through floating point. */
export function formatNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value))) return "—";
  let text = String(value);
  // Expand scientific notation only for JS numbers, never parse arbitrary identifiers.
  if (typeof value === "number" && /e/i.test(text)) {
    const [coefficient, exponent] = text.toLowerCase().split("e");
    const negative = coefficient!.startsWith("-");
    const unsigned = coefficient!.replace(/^-/, "");
    const [whole, fraction = ""] = unsigned.split(".");
    const digits = whole! + fraction;
    const point = whole!.length + Number(exponent);
    text = (negative ? "-" : "") + (point <= 0 ? "0." + "0".repeat(-point) + digits : point >= digits.length ? digits + "0".repeat(point - digits.length) : digits.slice(0, point) + "." + digits.slice(point));
  }
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return "—";
  const whole = match[2]!.replace(/^0+(?=\d)/, "");
  const fraction = (match[3] ?? "").replace(/0+$/, "");
  const sign = match[1] && (whole !== "0" || fraction) ? "-" : "";
  return sign + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (fraction ? "," + fraction : "");
}
