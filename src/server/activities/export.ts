import "server-only";
import { writeJournalRegister } from "./journal-pdf";
import { journalContentFields } from "../../lib/activities/journal-content";
import PDFDocument from "pdfkit";
import { join } from "node:path";
export function csvCell(value: unknown) {
  const s = String(value ?? "");
  const safe = /^[\s]*[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function exportColumns(kind: "attendance" | "journals") {
  return kind === "attendance"
    ? [
        ["date", "Tanggal"],
        ["teacherName", "Nama guru"],
        ["scheduledIn", "Jadwal masuk"],
        ["scheduledOut", "Jadwal pulang"],
        ["actualIn", "Aktual masuk"],
        ["actualOut", "Aktual pulang"],
        ["effectiveMinutes", "Menit efektif"],
        ["ratio", "Rasio"],
      ]
    : [
        ["date", "Tanggal"],
        ["teacherName", "Nama guru"],
        ["className", "Kelas"],
        ["subjectName", "Mata pelajaran"],
        ["schoolName", "Sekolah (identitas saat ekspor)"],
        ["periodLabel", "Tahun pelajaran / semester"],
        ["timeStart", "Waktu mulai"], ["timeEnd", "Waktu selesai"],
        ["material", "Materi"],
        ...journalContentFields.map(field => [field.name, field.label]),
        ["present", "Hadir"],
        ["absent", "Absen"],
        ["notes", "Catatan"],
        ["inputType", "Jenis input"],
        ["creditedJtm", "Kredit JTM"],
        ["submittedAt", "Waktu pengiriman"],
      ];
}
export function renderCsv(
  rows: Record<string, unknown>[],
  kind: "attendance" | "journals",
) {
  const columns = exportColumns(kind);
  return (
    "\uFEFF" +
    [
      columns.map((c) => csvCell(c[1])).join(","),
      ...rows.map((r) => columns.map((c) => csvCell(r[c[0]!])).join(",")),
    ].join("\r\n")
  );
}
export async function renderPdf(
  rows: Record<string, unknown>[],
  kind: "attendance" | "journals",
  range: string,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    layout: kind === "journals" ? "landscape" : "portrait",
    margin: kind === "journals" ? 36 : 42,
    info: {
      Title:
        kind === "attendance"
          ? "Riwayat kehadiran SiM-Guru"
          : "Jurnal pembelajaran SiM-Guru",
    },
  });
  doc.font(join(process.cwd(), "src/server/activities/assets/DejaVuSans.ttf"));
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  if (kind === "journals") {
    writeJournalRegister(doc, rows, range);
    doc.end();
    return result;
  }
  doc
    .fontSize(16)
    .text(
      kind === "attendance"
        ? "Riwayat Kehadiran Guru"
        : "Riwayat Jurnal Pembelajaran",
    );
  doc
    .fontSize(10)
    .text("SiM-Guru | " + range)
    .text("Tanggal operasional: Asia/Jakarta")
    .moveDown();
  if (!rows.length) doc.text("Tidak ada catatan pada rentang ini.");
  for (const row of rows) {
    doc.fontSize(11).text(String(row.date) + " | " + String(row.teacherName));
    doc.fontSize(9);
    for (const [key, label] of exportColumns(kind).slice(2))
      doc.text(
        label +
          ": " +
          String(
            key === "inputType"
              ? row[key!] === "H_MINUS_1"
                ? "H-1 (80%)"
                : "Hari H (100%)"
              : (row[key!] ?? "—"),
          ),
        { width: 510 },
      );
    doc.moveDown();
  }
  doc.end();
  return result;
}
