import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
function luminance(hex: string) {
  const normalized =
    hex.length === 4 ? "#" + [...hex.slice(1)].map((x) => x + x).join("") : hex;
  const rgb = [1, 3, 5]
    .map((i) => parseInt(normalized.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
}
test("UI semantic foreground/background pairs meet AA normal-text contrast", async () => {
  const css = await readFile("src/app/globals.css", "utf8"),
    tokens = Object.fromEntries(
      [...css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{3,6})\s*;/g)].map((m) => [
        m[1],
        m[2],
      ]),
    );
  for (const [a, b] of [
    ["foreground", "background"],
    ["foreground", "card"],
    ["primary", "card"],
    ["muted-foreground", "background"],
    ["muted-foreground", "card"],
    ["destructive", "card"],
    ["destructive", "error-surface"],
    ["success", "success-surface"],
    ["accent-foreground", "accent"],
  ]) {
    assert.ok(tokens[a!] && tokens[b!], `missing token ${a}/${b}`);
    const values = [luminance(tokens[a!]!), luminance(tokens[b!]!)].sort(
      (a, b) => a - b,
    );
    assert.ok(
      (values[1]! + 0.05) / (values[0]! + 0.05) >= 4.5,
      `insufficient contrast ${a}/${b}`,
    );
  }
});

test("UI input boundary and focus ring retain 3:1 contrast against surfaces", async () => {
  const css = await readFile("src/app/globals.css", "utf8");
  const tokens = Object.fromEntries(
    [...css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{3,6})\s*;/g)].map((m) => [
      m[1],
      m[2],
    ]),
  );
  for (const a of ["input", "ring"])
    for (const b of ["card", "background"]) {
      const values = [luminance(tokens[a]!), luminance(tokens[b]!)].sort(
        (x, y) => x - y,
      );
      assert.ok((values[1]! + 0.05) / (values[0]! + 0.05) >= 3, a + "/" + b);
    }
});
