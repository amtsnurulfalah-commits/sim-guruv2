# Tahap 8 — Keamanan, pemulihan dan rilis

Implementasi melanjutkan roadmap profesional0–8 setelah Tahap 7/PR51. Cakupan8.1–8.6: audit keamanan berbasis keluarga kontrol ASVS 5.0.0; regresi lintas peran/sumber; profil native/browser dengan batas eksplisit; backup terenkripsi dan restore native disposable; gate CI/release/smoke; runbook serta panduan pengguna/admin.

## Perubahan utama

Format inventori2 menambahkan fingerprint isi seluruh tabel privat, metadata skema/grants/policy/constraint/index/trigger/default dan ledger migrasi. AES-GCM context v2 mengautentikasi manifest sekaligus dump. Restore mengisolasi lease/antrean aktif, sesi dan bahan pemulihan. Backup v1 tetap kompatibel dengan keterangan verifikasi terbatas. Tidak mengubah SQL/schema, API atau engine honor bisnis; tidak ada migrasi produksi pada tahap ini.

Job CI native-release berjalan dengan PostgreSQL lokal pada runner sekali pakai; memakai pg_dump/pg_restore asli, dataset sintetis dan validasi pasca-restore. Rilis tidak boleh diluluskan sebelum hasil native nyata diperiksa. Tes browser/metadata source tidak dianggap pengganti restore native. Artefak CI hanya metrik sintetis, tidak membawa dump/key atau data produksi.

## Paket dan penerimaan

- [Audit keamanan dan temuan](SECURITY_AUDIT.md): source sesi/API/SQL/log, pengujian penolakan, perbaikan integritas/isolasi, batas kapasitas yang teridentifikasi.
- [Runbook rilis, backup dan rollback](RUNBOOK.md): gate head final, lingkungan disposable, smoke read-only, rollback aplikasi vs pemulihan data, RPO/RTO aktual dengan batas.
- [Panduan pengguna/admin](PANDUAN.md): tugas, draft, hasil tidak pasti, laporan kendala, honor dan kewenangan.
- validation.json / performance.json: hasil aktual dan batas pengukuran. Status CI/merge/deployment akhir mengikuti PR tahap ini; tidak menyatakan artefak rencana sebagai keberhasilan.

8.1–8.2 selesai pada cakupan source/gateway privat setelah seluruh tes dan temuan kritis rilis tertangani. 8.3 mengukur dua workload berbeda, bukan sertifikasi kapasitas produksi: browser localhost kecil dan native dataset201 akun/12.060 kehadiran/201 slip dengan filter guru. Profil awal global paralel timeout dicatat sebagai pekerjaan kapasitas; tidak dihapus dengan menaikkan timeout atau melemahkan locking. 8.4 memerlukan laporan native sukses sebelum rilis. 8.5 mewajibkan quality+native pada head final, merge lease dan smoke deployment. 8.6 menyediakan panduan dan runbook.

Batas: ASVS dipakai sebagai acuan, bukan klaim sertifikasi. Tidak ada email nyata, UAT perangkat fisik/pembaca layar, load WAN/produksi, backup objek Storage/secret/provider atau latihan restore produksi. RPO/RTO yang diukur adalah drill lokal sintetis. Pengaturan backup berkala dan target layanan produksi tetap keputusan operator dengan bukti privat; jangan menganggap roadmap kode otomatis mengaktifkannya.
