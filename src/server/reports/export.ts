import "server-only";
import { workbook } from "../finance/xlsx";
import { reportDefinitions, type Report } from "../../lib/reports/contracts";
export function reportWorkbook(r: Report) {
  const academic = r.kind === "academic";
  return workbook(
    [
      ["Laporan pimpinan", academic ? "Akademik" : "Honorarium"],
      ["Periode", r.period, "Guru", r.teacher ?? "Semua", "Status", r.mode],
      ["Batas sumber WIB", r.cutoff, "Dibaca", r.updatedAt],
      ["Definisi", reportDefinitions[r.kind]],
      ["Temuan periode", r.issues.join(", ") || "Tidak ada temuan mesin"],
      ...Object.entries(r.summary).map(([k, v]) => [k, v]),
      [],
      academic
        ? [
            "ID",
            "Tanggal",
            "Jenis",
            "Guru",
            "Kelas",
            "Mapel",
            "Konfirmasi/masuk",
            "Dokumen/pulang",
            "Jam masuk",
            "Jam pulang",
          ]
        : [
            "ID guru",
            "Nama",
            "JTM",
            "Mengajar Rp",
            "Tunjangan Rp",
            "Transport Rp",
            "Koreksi Rp",
            "Total Rp",
            "Batas",
          ],
      ...r.items.map((x) =>
        academic
          ? [
              x.id,
              x.date,
              x.category,
              x.name,
              x.class_name,
              x.subject,
              x.confirmed ? "Ya" : "Belum",
              x.documented ? "Ya" : "Belum",
              x.time_in,
              x.time_out,
            ]
          : [
              x.id,
              x.name,
              x.jtm,
              x.teaching,
              x.allowances,
              x.transport,
              x.corrections,
              x.total,
              x.cutoff,
            ],
      ),
    ],
    "Laporan pimpinan",
  );
}
