import test from "node:test";
import assert from "node:assert/strict";
import { renderCsv, renderPdf } from "../../src/server/activities/export";
import { writeFile, mkdir } from "node:fs/promises";
test("CSV escapes multiline quotes and neutralizes spreadsheet formulas", () => {
  const csv = renderCsv(
    [
      {
        date: "2090-01-02",
        teacherName: '=HYPERLINK("bad")',
        material: 'Materi,\n"sel"',
        notes: "  +cmd",
      },
    ],
    "journals",
  );
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("\"'=HYPERLINK"));
  assert.ok(csv.includes('Materi,\n""sel""'));
  assert.ok(csv.includes("'  +cmd"));
});
test("PDF renders multipage attendance and journals as real downloadable documents", async () => {
  await mkdir("/tmp/sim-guru-stage3", { recursive: true });
  for (const kind of ["attendance", "journals"] as const) {
    const rows = Array.from({ length: 110 }, (_, i) => ({
      date: "2090-01-02",
      teacherName: `Guru Contoh ${i + 1}`,
      scheduledIn: "07:30",
      scheduledOut: "14:00",
      actualIn: "07:40",
      actualOut: "14:00",
      effectiveMinutes: 380,
      ratio: "0.974",
      className: "VII A",
      subjectName: "IPA",
      material: "Struktur sel dan jaringan. ".repeat(8),
      notes: "Diskusi kelompok dan pengamatan.",
      present: 28,
      absent: 2,
      inputType: "H_MINUS_1",
      creditedJtm: "2.4000",
    }));
    const pdf = await renderPdf(rows, kind, "Januari 2090");
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    assert.ok(pdf.length > 10000);
    await writeFile(`/tmp/sim-guru-stage3/${kind}.pdf`, pdf);
  }
});

test("journal template exports all reflection fields and long cells continue across pages", async () => {
  const row={id:"one",userId:"guru",teacherName:"Guru Uji",date:"2026-07-14",className:"VII A",subjectName:"IPA",schoolName:"Madrasah Uji",periodLabel:"2026/2027 · Semester 1",timeStart:"07:00",timeEnd:"08:20",material:"Materi panjang ".repeat(100),learningObjectives:"Tujuan pembelajaran ".repeat(100),obstacles:"Kendala ".repeat(200),followUp:"Tindak lanjut ".repeat(100),reflection:"Refleksi guru ".repeat(100),present:20,absent:0,notes:"Catatan lama tetap ada",submittedAt:"2026-07-14T02:00:00Z",creditedJtm:"2.0000",inputType:"SAME_DAY"};
  const csv=renderCsv([row],"journals");
  for(const text of [row.learningObjectives,row.obstacles,row.followUp,row.reflection,row.notes])assert.ok(csv.includes(text));
  const pdf=await renderPdf([row],"journals","Juli 2026");
  assert.equal(pdf.subarray(0,4).toString(),"%PDF");
  await writeFile('/tmp/sim-guru-stage3/journal-reflection-long.pdf',pdf);
});
