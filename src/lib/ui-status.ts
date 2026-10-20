/** Presentation only: persistence/API enums remain unchanged. */
const labels: Record<string, string> = {
  blocked: "Terblokir",
  validated: "Lolos validasi",
  imported: "Sudah diimpor",
  reconciled: "Sudah direkonsiliasi",
  pending: "Menunggu",
  retry_wait: "Menunggu coba ulang",
  sent: "Terkirim",
  unknown: "Perlu pemeriksaan",
  failed: "Gagal",
  cancelled: "Dibatalkan",
  running: "Berjalan",
  succeeded: "Berhasil",
  completed: "Selesai",
  info: "Informasi",
  success: "Berhasil",
  warning: "Perhatian",
  critical: "Penting",
};
export const statusLabel = (value: string) => labels[value] ?? value;
