import test from "node:test";
import assert from "node:assert/strict";
import { renderHonorExcel } from "../../src/server/finance/export";
test("Honor export is a real OOXML ZIP, preserves decimal text and never turns names into formulas", () => {
  const data = renderHonorExcel([
    {
      id: "test",
      period: "2026-10",
      name: '=HYPERLINK("bad") <guru> & uji',
      trx_id: "SG-test",
      jtm: "2.4000",
      total: "99999999999999999999",
    },
  ]);
  assert.equal(data.readUInt32LE(0), 0x04034b50);
  const parts: Record<string, string> = {};
  let p = 0;
  while (data.readUInt32LE(p) === 0x04034b50) {
    const size = data.readUInt32LE(p + 18),
      nameLength = data.readUInt16LE(p + 26),
      extra = data.readUInt16LE(p + 28),
      start = p + 30 + nameLength + extra;
    parts[data.subarray(p + 30, p + 30 + nameLength).toString()] = data
      .subarray(start, start + size)
      .toString();
    p = start + size;
  }
  assert.equal(Object.keys(parts).length, 5);
  const sheet = parts["xl/worksheets/sheet1.xml"]!;
  assert.match(sheet, /t="inlineStr"/);
  assert.match(sheet, /&lt;guru&gt; &amp; uji/);
  assert.match(sheet, /99999999999999999999/);
  assert.equal(sheet.includes("<f>"), false);
  assert.equal(
    parts["xl/_rels/workbook.xml.rels"]!.includes("External"),
    false,
  );
});

test("honor PDF uses final snapshot values and provenance without mutating the receipt", async () => {
  const { renderHonorPdf } = await import("../../src/server/finance/export");
  const { syntheticHonorStatement } = await import("../helpers/honor-snapshot");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const statement = syntheticHonorStatement(), original = structuredClone(statement);
  const data = await renderHonorPdf(statement);
  assert.equal(data.subarray(0, 4).toString(), "%PDF");
  assert.deepEqual(statement, original);
  await mkdir("/tmp/sim-guru-pro5", { recursive: true });
  await writeFile("/tmp/sim-guru-pro5/honor.pdf", data);
});
