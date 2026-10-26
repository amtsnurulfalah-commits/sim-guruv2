import "server-only";
import { honorLineContext, honorTransportFacts, financeComponentLabel, honorExplanation, honorLineReferences, honorModeText } from "../../lib/finance/provenance";
import PDFDocument from "pdfkit";
import { join } from "node:path";
import type { HonorHistory, HonorStatement } from "../../lib/finance/schemas";
import { workbook } from "./xlsx";
export function renderHonorExcel(rows: HonorHistory["items"]) {
  return workbook([
    ["Periode", "Nama guru", "ID transaksi", "JTM", "Total rupiah"],
    ...rows.map((r) => [r.period, r.name, r.trx_id, r.jtm, r.total]),
  ]);
}
export async function renderHonorPdf(
  statement: HonorStatement,
  verificationUrl?: string,
): Promise<Buffer> {
  const s = statement.snapshot;
  const doc = new PDFDocument({
    size: "A4",
    margin: 42,
    info: { Title: "Slip Honorarium " + s.period },
  });
  doc.font(join(process.cwd(), "src/server/activities/assets/DejaVuSans.ttf"));
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc
    .fontSize(16)
    .text(s.school?.name ?? "Madrasah")
    .text("SLIP HONORARIUM");
  doc
    .fontSize(9)
    .text(s.school?.address ?? "")
    .text("Periode: " + s.period)
    .text("ID transaksi: " + statement.trxId)
    .text("Penerima: " + s.recipient.name)
    .text("NIP: " + (s.recipient.nip ?? "—"))
    .moveDown();
  for (const [label, value] of [
    ["Total JTM", s.totalJtm],
    ["Tarif per JTM", s.rate],
    ["Honor mengajar (rupiah)", s.teachingSettled],
    ["Tunjangan (rupiah)", s.allowances],
    ["Transport (rupiah)", s.transportSettled],
    ["Koreksi (rupiah)", s.corrections],
    ["TOTAL DIBAYARKAN (rupiah)", s.total],
  ])
    doc.fontSize(11).text(label + ": " + value);
  doc.moveDown().fontSize(9).text(honorModeText(s)).text(honorExplanation)
    .text("Batas tanggal perhitungan: " + s.cutoff + " | Rumus: " + s.formulaVersion + " | Kebijakan: " + s.policyVersion)
    .text("Honor mentah: " + s.teachingRaw + " | Transport mentah: " + s.transportRaw)
    .text("Referensi tarif JTM: " + (s.rateId ?? "Tidak tercantum pada rincian lama"));
  doc.moveDown().fontSize(10).text("Rincian sumber");
  for (const line of s.lines) {
    if (doc.y > 730) doc.addPage();
    doc
      .fontSize(8)
      .text(
        [
          line.date,
          financeComponentLabel(line.component),
          line.name,
          line.jtm ? "JTM " + line.jtm : "",
          line.amount ? "Rupiah " + line.amount : "",
          line.raw ? "Nilai mentah " + line.raw : "",
          line.delta ? "Selisih " + line.delta : "",
          line.component === "TRANSPORT" && typeof line.rate === "string" && /^-?\d+(\.\d+)?$/.test(line.rate) ? "Tarif transport " + line.rate : "",
          ...[...honorLineContext(line), ...honorTransportFacts(line), ...honorLineReferences(line)].map(([label, value]) => label + ": " + value),
        ]
          .filter(Boolean)
          .join(" | "),
      );
  }
  doc
    .moveDown()
    .fontSize(9)
    .text("Kepala madrasah: " + (s.school?.headmaster ?? "—"))
    .text("NIP: " + (s.school?.headmasterNip ?? "—"))
    .text("Formula: " + s.formulaVersion + " | Kebijakan: " + s.policyVersion)
    .text("Checksum: " + statement.checksum, { width: 510 });
  if (statement.corrected)
    doc.text(
      "Dokumen ini memiliki koreksi terkait; snapshot penerbitan asli tetap berlaku.",
    );
  if (verificationUrl)
    doc.text("Verifikasi: " + verificationUrl, {
      link: verificationUrl,
      width: 510,
    });
  doc.end();
  return result;
}
