# Tahap 8 — migrasi, QA, backup dan cutover

Implementasi menyediakan alat dan gate berbukti. Status gate bukan sertifikasi otomatis: pengelola harus memeriksa berkas bukti. Belum ada ekspor operasional lama, restore native, UAT bisnis atau keputusan perpindahan produksi pada tahap implementasi ini.

| Tahap | Hasil implementasi | Penerimaan operasional |
|---|---|---|
| 8.1 | Staging privat admin, checksum, metadata sheet/header/trigger dan isu per baris | Ekspor asli lengkap, waktu pengambilan dan pemilik data terverifikasi |
| 8.2 | Normalisasi, rencana impor insert-only, peta ID stabil, transaksi dan rekonsiliasi bertipe PostgreSQL | Semua selisih data/keuangan diperiksa dan disetujui |
| 8.3 | Dialog konfirmasi native dengan fokus/keyboard, kontrol sentuh dan shell responsif | UAT admin/guru pada perangkat nyata, termasuk mobile dan aksesibilitas |
| 8.4 | Backup terenkripsi, autentikasi arsip, restore terbatas database lokal disposable | Restore native terukur, kelengkapan Storage/role/secret diverifikasi |
| 8.5 | Sepuluh gate dengan bukti, versi/CAS, audit dan pembatalan persetujuan saat bukti berubah | Parallel run, freeze/delta, persetujuan tertulis dan pemantauan setelah cutover |

## Persiapan ekspor

Simpan ekspor sumber asli di lokasi privat di luar repository. Jangan mengubah atau menimpa backup asli. Catat jumlah baris setiap sheet, header dan urutannya, zona Asia/Jakarta, locale, format tanggal serta daftar trigger aktif. Format JSON versi 1:

```json
{
  "version": 1,
  "source": "contoh-sintetis",
  "exportedAt": "2026-10-20T12:00:00+07:00",
  "timezone": "Asia/Jakarta",
  "locale": "id-ID",
  "dateFormat": "ISO",
  "sheets": [{"name":"Users","headers":["user_id","username"],"rows":[["00001","contoh"]]}],
  "triggers": [{"handler":"contohTrigger","enabled":false}]
}
```

Contoh tersebut sintetis dan bukan data siap impor. Maksimal 10.000 baris, 80 sheet; unggahan UI 2 MiB, CLI 6 MiB. Pecah ekspor lebih besar menjadi batch terencana dengan referensi pengguna lengkap. Hindari Excel mengubah ID nol awal menjadi angka. Tanggal ambigu ditolak tanpa format eksplisit; serial tanggal spreadsheet tidak ditebak. Nilai desimal lokal dinormalisasi menjadi string desimal, bukan float uang.

`/admin/migrasi` menerima ekspor melalui sesi admin, Origin dan CSRF. Staging tidak menulis data bisnis. Kredensial, sesi, OTP, jawaban keamanan dan konfigurasi rahasia dikeluarkan; password lama tidak dipindahkan. Checksum sumber dihitung dari envelope kanonis; checksum berkas CLI tambahan mempertahankan identitas byte asli. Berkas profil masih dapat berisi data pribadi: perlakukan sebagai rahasia. Tinjauan baris ambigu harus mempunyai alasan dan rujukan bukti; kesalahan harus diperbaiki pada sumber dan diekspor ulang.

```bash
npm run migration:legacy -- profile /private/source.json /private/profile.json
```

## Rencana impor yang ditinjau operator

Tidak ada konverter otomatis untuk menebak semua makna sheet lama. Operator menyusun JSON `version`, `batchId`, `sourceChecksum`, `reason`, `entries`; setiap entry berisi `sourceTable`, `legacyId`, `targetTable`, `values`. `sourceTable`/ID harus cocok tepat dengan satu baris staging. UUID baru dan seluruh FK ditentukan konsisten di rencana; masukkan dependensi sebelum anak. Nama tabel dibatasi allowlist dan semua constraint native tetap berlaku. Nilai kolom mengikuti skema SQL saat ini; kirim NUMERIC sebagai string desimal agar presisi tidak hilang.

Akun hasil impor wajib `status=pending_activation`, `must_change_password=true`; pembuatan kredensial/aktivasi mengikuti alur aplikasi. Honor historis wajib `formula_version=legacy`, `state=final` beserta `finalized_at`, snapshot `formulaVersion=legacy`; periode dikunci atomik oleh importer. Kolom NUMERIC wajib string desimal; jangan hitung ulang sejarah memakai formula baru. Operator bertanggung jawab membangun snapshot/line historis lengkap dan melakukan perbandingan ledger, JTM, tarif, tunjangan, transport, pembulatan serta total per guru/periode. Gunakan matriks B01–B25/T01–T50 pada acuan proyek sebagai daftar penerimaan, bukan menganggap tes sintetis menggantikannya.

```bash
npm run migration:legacy -- plan /private/plan.json /private/plan-review.json
# Setelah backup, restore drill dan rollback plan dibuktikan pada batch:
# MIGRATION_DATABASE_URL: koneksi operator terpisah, disediakan melalui environment aman.
npm run migration:legacy -- apply /private/plan.json /private/apply-report.json --expected-hash HASH_HASIL_REVIEW --allow-remote
npm run migration:legacy -- reconcile /private/plan.json /private/reconcile-report.json --allow-remote
```

Sebelum apply: maintenance aktif, jobs/mail/securityMail nonaktif, batch validated, semua isu selesai, gate source_backup/restore_drill/rollback_plan mempunyai bukti. Hash rencana harus sama dengan yang direview. Operasi atomik dan idempotent; replay rencana sama tidak menggandakan data. Perubahan payload terhadap pemetaan yang sudah ada ditolak dan memerlukan rencana delta terpisah yang ditinjau, bukan overwrite diam-diam. Notifikasi domain baru akibat impor dibatalkan agar sejarah tidak mengirim email. Data/honor final lama tetap tunduk pada guard immutable. Laporan dibuat privat tanpa menimpa berkas yang sudah ada.

Rekonsiliasi membandingkan setiap nilai rencana dengan data bertipe native, termasuk PK komposit dan NUMERIC, lalu menandai batch reconciled hanya jika tidak ada perbedaan. Ini membuktikan rencana diterapkan tepat; kelengkapan/ketepatan makna terhadap sumber lama tetap harus diperiksa manusia. Dokumentasikan setiap selisih sebagai cocok, berbeda tetapi dijelaskan/disetujui, atau belum terselesaikan; kondisi terakhir memblokir cutover.

## Backup dan pemulihan

Butuh `pg_dump`, `pg_restore`, `psql` PostgreSQL versi yang kompatibel sumber; `BACKUP_ENCRYPTION_KEY` 64 digit hex disimpan terpisah dari arsip; `MIGRATION_DATABASE_URL` operator. Direktori output wajib di luar repository. Manifest juga privat karena berisi inventori dan angka keuangan. Jangan menyalin credential ke argumen command, tiket, bukti publik atau log.

```bash
npm run backup:database -- create /private/backup-pre-cutover
npm run backup:database -- verify /private/backup-pre-cutover
# MIGRATION_DATABASE_URL sekarang menunjuk database lokal kosong bernama *_restore_test.
npm run backup:database -- restore-local /private/backup-pre-cutover
```

`create` memerlukan maintenance/dispatch pause; menghasilkan custom dump schema privat yang dienkripsi AES-256-GCM dengan checksum dan inventori sebelum/sesudah. `verify` hanya mengautentikasi arsip, BUKAN bukti restore. `restore-local` menolak host remote, database tidak kosong atau suffix keliru; menjalankan restore transaksi dan membandingkan inventori/keuangan/role/RLS. Setelah restore, sesi dicabut, antrean ditahan, maintenance aktif dan semua pengiriman nonaktif. Dump tidak membawa cron agar drill tidak memanggil worker produksi.

Keterbatasan: objek Supabase Storage, password LOGIN platform, secret lingkungan, konfigurasi Vercel, provider email dan scheduler harus dicadangkan/ditata terpisah. Jangan menganggap paket Supabase otomatis mencakup semuanya. Catat waktu mulai/selesai restore, RPO aktual dari waktu backup, RTO aktual hingga smoke bisnis lulus, jumlah data dan checksum. Uji kehilangan key/tamper, isolasi email, permission/runtime/RLS, login dengan akun drill dan verifikasi snapshot honor. Gunakan dokumen Supabase resmi: https://supabase.com/docs/guides/platform/backups dan https://supabase.com/docs/guides/local-development/cli/getting-started . Restore produksi harus memakai runbook insiden dan persetujuan operator tersendiri; alat ini sengaja tidak menawarkan restore produksi.

## QA dan cutover

Pada perangkat desktop dan ponsel nyata, uji login/onboarding/logout, menu admin/guru, jadwal, kehadiran, izin, jurnal, piket/substitusi, ujian/BAP/acara, honor/PDF/XLSX, pengaturan, pengumuman serta migrasi. Uji keyboard Tab/Shift-Tab/Escape, label form, kontras, zoom 200%, lebar 320/375/768 px, focus dialog dan kembali ke tombol pemicu, tabel scroll tanpa halaman melebar, pembaca layar dan jaringan lambat/gagal. Uji dua sesi/peran dan konflik versi tanpa memakai data pribadi sebagai bukti publik. Penerimaan inbox OTP/reminder nyata memerlukan penerima uji yang disetujui; jangan mengirim massal sebagai pengujian.

Sepuluh gate tersimpan per batch: source_backup, restore_drill, reconciliation, parallel_run, uat_admin, uat_guru, legacy_freeze, delta_reconciliation, rollback_plan, cutover_approval. Setiap gate membutuhkan alasan dan bukti yang dapat diverifikasi. Tiga gate rekonsiliasi/delta/cutover baru dapat diluluskan setelah impor. Perubahan gate pendukung mencabut cutover_approval; penyelesaian isu review mencabut semua gate. Tidak ada tombol yang secara otomatis mematikan aplikasi lama, mengubah DNS atau mengaktifkan semua worker.

Urutan operasional: backup sumber+target → restore drill terisolasi → import/reconciliation → parallel run pada periode representatif → UAT admin/guru → jadwal freeze tertulis dan nonaktifkan trigger lama → ambil delta final dan rekonsiliasi → persetujuan cutover → arahkan pengguna ke aplikasi baru → aktifkan jenis worker bertahap setelah pemeriksaan antrean → monitor login, error, selisih honor dan delivery. Rekam siapa menyetujui, waktu, lingkup data dan lokasi bukti privat.

Rollback: tentukan pemilik keputusan dan ambang kegagalan sebelum freeze. Jika gagal, hentikan pengiriman dan penulisan baru, simpan backup kondisi insiden, dokumentasikan transaksi sejak freeze, kembalikan jalur pengguna sesuai rencana yang disetujui, lalu rekonsiliasi transaksi baru sebelum membuka penulisan lama. Jangan membuang transaksi baru atau memulihkan dump menimpa produksi secara spontan. Persetujuan gate tidak menggantikan bukti pemulihan dan persetujuan operasional tersebut.
