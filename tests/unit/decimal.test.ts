import test from "node:test";
import assert from "node:assert/strict";
import { DomainDecimal } from "../../src/lib/decimal";
test("constructor decimal mempertahankan penjumlahan pecahan tanpa float", () => {
  assert.equal(new DomainDecimal("0.1").plus("0.2").toFixed(4), "0.3000");
  assert.equal(new DomainDecimal("2.4").times("10001").toFixed(0), "24002");
});
