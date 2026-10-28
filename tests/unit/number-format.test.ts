import test from "node:test";
import assert from "node:assert/strict";
import { formatNumber } from "../../src/lib/format/number";
import { formatHonorAmount } from "../../src/lib/finance/contracts";
import { rupiah } from "../../src/lib/dashboard/summary";

test("Indonesian number display removes only insignificant fraction zeros", () => {
  for(const [raw, expected] of [["2.0000","2"],["2.5000","2,5"],["1000.0500","1.000,05"],["0.0001","0,0001"],["-0.0000","0"],["-1250.25","-1.250,25"],["99999999999999999999.123400001","99.999.999.999.999.999.999,123400001"]])assert.equal(formatNumber(raw),expected);
  assert.equal(formatNumber(1e-7),"0,0000001");assert.equal(formatNumber(1e21),"1.000.000.000.000.000.000.000");
  for(const value of [null,undefined,NaN,Infinity,"2026-10-28","not-a-number"])assert.equal(formatNumber(value),"—");
});
test("currency and Dashboard share exact presentation without rounding fractions away",()=>{
 assert.equal(formatHonorAmount("2000.0000"),"Rp 2.000");assert.equal(formatHonorAmount("2000.5000"),"Rp 2.000,5");assert.equal(rupiah("1000.25"),"Rp 1.000,25");
});
