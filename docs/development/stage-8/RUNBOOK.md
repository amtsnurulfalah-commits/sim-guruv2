# Runbook rilis dan pemulihan profesional

Paket ini melanjutkan roadmap Tahap0–8 setelah audit PR43; berbeda dari Tahap 8 pembangunan ulang historis pada docs/operations/Migrasi_Cutover_Tahap_8.md.

## Gate rilis

1. Periksa target repository/branch, main terakhir, scope, status working tree dan diff. Jangan memasukkan .env, dump, manifest privat, key, browser session atau data pengguna.
2. Jalankan `npm ci` dan `npm run check`: lint, TypeScript, unit, crypto/HTTP, seluruh integrasi SQL, build. SQL baru wajib migrasi/checksum/upgrade/replay; file SQL bukan bukti penerapan produksi. Rilis Tahap 8 ini tidak menambah migrasi.
3. Job `native-release` pada runner disposable harus lulus: PostgreSQL16 pada loopback, database kosong identity/race/drill/restore terpisah,32 migrasi clean+replay, native role/session/race, backup/restore. Tidak menggunakan URL atau secret produksi. Cluster dihentikan selalu; arsip/key hanya dalam direktori sementara privat dan dihapus; yang diunggah hanya laporan metrik sintetis14 hari.
4. Jalankan browser regression yang sesuai. Tahap 8: matriks UI umum, draft/logout, profil30navigasi320/1440px. Fixture browser tidak menggantikan TLS/WAN/perangkat fisik/UAT. Nilai performance.json menjelaskan ukuran data, concurrency, p50/p95, error dan batas.
5. Tinjau temuan keamanan/kapasitas. Critical unresolved pada scope rilis memblokir merge. Bandingkan tree lokal vs tree remote. Periksa CI pada head final, bukan sekadar head lama; merge memakai expected-head lease. Kegagalan gate harus dianalisis, bukan di-skip atau dianggap transient tanpa bukti. Workflow menyediakan checks; ruleset/branch protection repository tidak diubah oleh rilis ini. Operator dapat mewajibkan quality/native-release melalui pengaturan repository yang sesuai.
6. Sesudah merge, cocokkan deployment produksi/commit/alias dan tunggu READY. Gunakan `SMOKE_BASE_URL=https://domain-aplikasi npm run release:smoke`: health,14gateway tanpa sesi401, no-store/nosniff/DENY. Ini tidak login, dispatch atau menulis data; health hanya liveness. Jangan menganggap200halaman sebagai UAT admin/guru.
7. Simpan hasil/status rilis pada PR/checkpoint dan bukti yang sesuai akses. Bukti publik hanya sintetis/agregat aman; detail infrastruktur/akun/backup produksi tetap privat. Jika kontrol persetujuan menolak publikasi metadata produksi, jangan mencoba jalur lain.

## Menjalankan drill native secara manual

Gunakan PostgreSQL lokal disposable versi kompatibel, dengan pg_dump/pg_restore pada PATH dan Node24. Nama source wajib *_drill_test, tujuan *_restore_test; loopback saja, kosong dan terpisah. Jangan gunakan database milik aplikasi aktif. Set `RELEASE_DRILL_DATABASE_URL` dan `RESTORE_DATABASE_URL` melalui environment lokal yang aman. Jalankan `npm run release:drill`. Script membuat fixture sendiri:201 akun,12.060 kehadiran,201 slip sintetis bernilai NUMERIC besar, satu hash password sintetis dan antrean in-flight. Tidak mengirim email.

Hasil `STAGE8_NATIVE_RESULT` mencatat engine, dataset, backup/recovery duration, ukuran arsip dan profil. RTO drill dihitung dari mulai restore CLI sampai validasi isolasi/akses/hash/final snapshot; bukan waktu menyiapkan server/operator. RPO fixture0 transaksi pada snapshot beku; tidak ada jadwal backup periodik produksi yang dapat disimpulkan. Rerun memerlukan database disposable kosong baru. `npm run test:db:native` dan `npm run test:schedules:native` memakai database *_test terpisah, bukan source drill.

## Backup operator

Lihat [runbook migrasi/backup existing](../../operations/Migrasi_Cutover_Tahap_8.md). Gunakan koneksi operator berizin minimum yang memadai dan TLS terverifikasi. Tidak ada password di argumen shell. Backup CLI memerlukan maintenance dan seluruh dispatcher pause; pekerjaan/jaringan lain juga harus benar-benar dibekukan agar inventori sebelum/sesudah sama. Tool menolak source yang berubah, bukan mengklaim snapshot cocok ketika counts tetap tetapi isi berubah.

`npm run backup:database -- create /private/backup-baru` kini menghasilkan manifest v2, database.enc AES-GCM dan metadata terautentikasi; directory 0700/files 0600, di luar repo. Key64hex disimpan terpisah di pengelola rahasia, tidak di manifest. `verify` hanya autentikasi arsip; bukti restore harus berasal dari restore disposable. Tool membatasi payload256 MiB; database lebih besar perlu prosedur streaming/backup provider yang ditinjau, bukan mematikan batas.

`restore-local` memakai RESTORE_DATABASE_URL, bukan MIGRATION_DATABASE_URL. Tolak remote/nonempty/suffix salah; schema privat dipulihkan dengan single transaction. Verifikasi isi/skema/grants/migrasi/NUMERIC dilakukan **sebelum** isolasi yang sengaja mengubah sesi/config/antrean. Format 1 lama masih dapat dibaca/dipulihkan dengan pembandingan counts/finance/role/RLS terbatas dan pesan jelas; metadata lama tidak memiliki jaminan autentikasi v2. Arsip v2 harus dipulihkan memakai tool v2 walaupun aplikasi dirollback ke versi sebelumnya.

Dump schema aplikasi tidak mencadangkan objek Storage, environment/SMTP/provider credentials, konfigurasi Vercel/domain/scheduler, LOGIN password platform, cron, extension pihak ketiga dan seluruh konfigurasi Supabase. Inventori/provisioning komponen itu harus disimpan privat dan diuji terpisah. Referensi [Supabase backups](https://supabase.com/docs/guides/platform/backups) dan [backup/restore CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## Insiden dan rollback

Pemilik keputusan: operator/admin berwenang; catat waktu WIB, gejala, referensi bantuan, commit/deployment dan lingkup data secara privat. Pemicu: lonjakan error, autentikasi/otorisasi tidak sesuai, transaksi ganda/selisih finansial atau smoke gagal. Hentikan ekspansi dan pengiriman yang berisiko; jangan blind retry saat hasil write tidak pasti. Tinjau riwayat/receipt/audit sumber.

Rollback aplikasi dan pemulihan database adalah keputusan berbeda. Rilis ini tidak mengubah schema/business engine, sehingga aplikasi sebelumnya tetap kompatibel. Untuk rollback aplikasi: pilih deployment produksi terakhir yang telah diverifikasi, pastikan environment/schema kompatibel, gunakan mekanisme Vercel operator, tungguREADY/alias lalu ulangi smoke; pertahankan source dan transaksi baru. Tidak melakukan rollback produksi hanya untuk menguji runbook.

Untuk insiden data: freeze terotorisasi, arsipkan keadaan insiden dan transaksi setelah backup, uji restore ke target terisolasi, cocokkan inventori dan hitung kehilangan data, rekonsiliasi delta, baru minta keputusan operator untuk perpindahan layanan. Jangan menimpa produksi secara spontan. Setelah restore, dispatcher harus tetap mati dan sesi/token lama tidak boleh digunakan; provision LOGIN/secret eksternal dan akun operator yang sah, kemudian aktifkan layanan bertahap setelah validasi.

Catat RPO aktual sebagai selisih snapshot valid terbaru dengan titik insiden/data terakhir yang dapat direkonsiliasi; RTO aktual sampai seluruh smoke bisnis/pemulihan akses selesai. Masa retensi/cadence backup produksi memerlukan keputusan operasional; bukti drill tidak menggantikan backup berkala. Nilai tersebut belum dapat dinyatakan sebagai SLO produksi dari tes sintetis.
