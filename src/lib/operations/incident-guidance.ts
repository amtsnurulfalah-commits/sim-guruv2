/** Role ownership, not a claim that a named person has accepted an incident. */
export function incidentGuidance(code: string) {
  if(code === "FAILED_MESSAGES") return {owner:"Admin operasional dan operator email",step:"Periksa referensi antrean pada provider. Status tidak pasti harus direkonsiliasi sebelum pengiriman ulang."};
  if(code === "FAILED_JOBS") return {owner:"Admin operasional; admin honor untuk job honor",step:"Periksa kode hasil dan data sumber. Job yang dijeda tetap dijeda; jangan mereset percobaan untuk melewati aturan bisnis."};
  if(["WORKER_STALE","JOBS_STALE","QUEUE_DELAY"].includes(code)) return {owner:"Operator infrastruktur Supabase/Vercel",step:"Periksa scheduler, status endpoint, konfigurasi kanal dan keberhasilan job. Catat referensi gangguan sebelum perubahan."};
  return {owner:"Admin operasional dan pengembang",step:"Telusuri modul serta referensi kendala. Catat dampak, penanggung jawab dan bukti pemulihan pada laporan kendala."};
}
