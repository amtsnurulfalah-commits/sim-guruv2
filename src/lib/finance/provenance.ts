import { formatNumber } from "../format/number";
import { z } from "zod";
import type { HonorSnapshot, SourceLine } from "./schemas";
/** Display only: values always come from the engine/persisted final snapshot, never recomputed here. */
export const financeComponentLabels: Record<string, string> = {
  KBM: "KBM", PIKET: "Piket", UPACARA: "Upacara", EXAM_SUPERVISOR: "Pengawas ujian",
  EXAM_COMMITTEE: "Panitia ujian", PARTIAL_SUB_KBM: "Relokasi KBM", PARTIAL_SUB_PIKET: "Relokasi piket",
  PARTIAL_SUB_EXAM: "Relokasi ujian", EVENT: "Jurnal acara", HOLIDAY_BONUS: "Bonus libur",
  HOLIDAY_PENDING: "Proyeksi libur", REVERSAL: "Pembalikan", ALLOWANCE: "Tunjangan",
  TRANSPORT: "Transportasi", CORRECTION: "Koreksi",
};
export function financeComponentLabel(component: string) {
  return Object.hasOwn(financeComponentLabels, component) ? financeComponentLabels[component]! : component;
}
export function honorModeText(s: Pick<HonorSnapshot, "mode">) {
  return s.mode === "final" ? "Final — rincian saat diterbitkan" : s.mode === "projection" ? "Proyeksi — belum menjadi pembayaran final" : "Realisasi — belum menjadi pembayaran final";
}
/** Only known private routes and validated dates; never put identities, reasons or money in URLs. */
export function honorSourceLink(line: SourceLine): string | null {
  if (!z.iso.date().safeParse(line.date).success) return null;
  const paths: Record<string, string> = {
    KBM: "/jurnal", PARTIAL_SUB_KBM: "/jurnal", PIKET: "/piket", PARTIAL_SUB_PIKET: "/piket",
    UPACARA: "/upacara", EXAM_SUPERVISOR: "/ujian", EXAM_COMMITTEE: "/ujian",
    PARTIAL_SUB_EXAM: "/ujian", EVENT: "/acara/jurnal", TRANSPORT: "/kehadiran",
  };
  const path = Object.hasOwn(paths, line.component) ? paths[line.component] : undefined;
  return path ? `${path}?date=${line.date}${path === "/jurnal" ? "&section=history" : ""}` : null;
}
/** Whitelist scalar lineage fields from older extensible source snapshots; never stringify arbitrary JSON. */
export function honorLineReferences(line: SourceLine): [string, string][] {
  const fields = { sourceRef: "Referensi sumber", ledgerId: "Catatan JTM", occurrenceId: "Kegiatan", reversesId: "Membalik catatan JTM", revision: "Revisi", sourceStatementId: "Slip asal koreksi", sequence: "Urutan koreksi", dateStart: "Berlaku mulai", dateEnd: "Berlaku sampai", version: "Versi sumber", rateId: "Referensi tarif transport" };
  return Object.entries(fields).flatMap(([key, label]) => {
    const raw = line[key];
    const value = typeof raw === "number" && Number.isSafeInteger(raw) ? String(raw) : raw;
    return typeof value === "string" && value.length > 0 && value.length <= 100 ? [[label, value] as [string, string]] : [];
  });
}
export const honorExplanation = "Nilai berasal dari perhitungan sistem. Honor mengajar memakai total JTM dan tarif yang tercantum; nilai mentah dan hasil pembulatan ditampilkan terpisah. Tunjangan, transportasi dan koreksi mengikuti rincian sumber. Slip final tidak dihitung ulang dengan tarif terbaru. Pembalikan mengimbangi catatan sebelumnya; jangan menghitung keduanya sebagai tambahan terpisah.";

export function honorLineContext(line: SourceLine): [string, string][] {
  const snapshot = line.sourceSnapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return [];
  const record = snapshot as Record<string, unknown>;
  return Object.entries({ className: "Kelas / ruang", subjectName: "Mata pelajaran", sessionName: "Sesi", periodLabel: "Periode akademik" }).flatMap(([key, label]) => {
    const value = record[key];
    return typeof value === "string" && value.length <= 500 ? [[label, value] as [string, string]] : [];
  });
}
export function honorTransportFacts(line: SourceLine): [string, string][] {
  if (line.component !== "TRANSPORT") return [];
  const fields = { scheduledIn: "Jadwal masuk", scheduledOut: "Jadwal pulang", actualIn: "Masuk tercatat", actualOut: "Pulang tercatat", scheduledMinutes: "Menit terjadwal", effectiveMinutes: "Menit efektif", distance: "Jarak (km)", ratio: "Rasio tampilan (dibulatkan sistem)" };
  const facts: [string, string][] = Object.entries(fields).flatMap(([key, label]) => {
    const value = line[key];
    return typeof value === "string" && value.length <= 100 ? [[label, ["scheduledMinutes", "effectiveMinutes", "distance", "ratio"].includes(key) ? formatNumber(value) : value] as [string, string]] : [];
  });
  if (typeof line.blocked === "boolean") facts.push(["Transport diblok", line.blocked ? "Ya" : "Tidak"]);
  return facts;
}
