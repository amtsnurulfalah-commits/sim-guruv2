# Verifikasi implementasi Tahap 8.1–8.5

Tanggal pemeriksaan: 20 Oktober 2026. Semua fixture pengujian migrasi adalah sintetis dan terisolasi; tidak ada ekspor data operasional lama yang tersedia.

## Bukti lokal

`npm run check` lulus lint, typecheck, 28 unit, 13 crypto, 324 hasil integrasi (termasuk 17 parent runner), serta build Next.js. Total 365 hasil runner; bukan 365 skenario bisnis end-to-end. Pemeriksaan ulang terarah dilakukan setelah perbaikan guard kredensial nested dan pemilihan batch UI.

Enam unit migrasi memeriksa normalisasi tanggal/waktu/boolean/desimal, nol awal ID, duplicate/orphan, redaksi kredensial/nested secret, checksum kanonis, allowlist target, akun wajib aktivasi dan klasifikasi selisih. Sepuluh skenario integrasi migrasi membuktikan:

1. Lima tabel staging privat FORCE RLS, raw access runtime ditolak, admin-only.
2. Unggah idempotent, ID nol awal dipertahankan, password lama tidak disimpan.
3. Kesalahan data tidak dapat diabaikan sebagai review atau melewati gate.
4. Import membutuhkan hash, maintenance/dispatch pause dan bukti backup/restore/rollback.
5. Kesalahan baris kedua membatalkan seluruh impor dan peta ID.
6. Apply atomik, replay tidak menggandakan data, tidak mengimpor kredensial, perubahan rencana setelah apply ditolak.
7. Rekonsiliasi menggunakan nilai typed PostgreSQL dan mendeteksi selisih NUMERIC.
8. Cutover membutuhkan sembilan bukti pendukung; perubahan bukti membatalkan persetujuan.
9. AES-GCM menolak key salah dan arsip yang dimodifikasi.
10. Snapshot PGlite dipulihkan ke instance baru; inventori, agregat keuangan, role/RLS dan penolakan raw access dibandingkan.

Uji snapshot WASM tersebut tidak membuktikan keberhasilan `pg_dump`/`pg_restore` native. Binary klien PostgreSQL dan target lokal native disposable tidak tersedia dalam lingkungan pemeriksaan ini. Tool backup/restore menyediakan alur native yang harus dijalankan operator dan dilampiri waktu pemulihan/RPO/RTO nyata.

## Supabase

Migrasi baru diterapkan setelah checksum seluruh migrasi sebelumnya diverifikasi dalam transaksi dan advisory lock. Ledger berisi 23 migrasi, 79 tabel domain. Kelima tabel migration mempunyai RLS dan FORCE RLS; akses SELECT langsung runtime ditolak, RPC bisnis disediakan dengan guard admin dan bukan anon. Tidak ada batch data operasional yang dibuat dalam pemeriksaan native.

Scheduler tetap aktif; jobsEnabled, mailEnabled dan securityMailEnabled tetap false. Pemeriksaan keamanan tidak menambah temuan; peringatan yang sudah ada adalah metadata extension `pg_net` dalam schema public. Rujukan perbaikan: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public . Perubahan extension aktif tidak dilakukan sebagai bagian migrasi data.

## UX dan batas penerimaan

Dialog konfirmasi bersama menggunakan modal native: fokus awal pada batal, fokus dikembalikan ke pemicu, Escape menghormati keadaan busy. Form bersama mempunyai tinggi kontrol minimal 44px; panel migrasi membungkus teks panjang. Pemeriksaan source/typecheck/build bukan bukti pembaca layar atau tampilan pada perangkat nyata.

Browser lokal tidak tersedia; unduhan binary browser dari CDN tidak menghasilkan arsip utuh. Jangan menandai mobile visual/UAT admin-guru lulus dari hasil integrasi SQL. Bukti penerimaan operasional yang masih dibutuhkan: ekspor sumber lengkap, rencana mapping yang ditinjau, rekonsiliasi B01–B25/T01–T50, native restore terisolasi, parallel run, UAT perangkat nyata, freeze/delta dan persetujuan cutover. Gate UI hanya menyimpan keputusan dan referensi bukti; tidak menjalankan perpindahan produksi otomatis.

Runbook: [Migrasi/cutover Tahap8](../operations/Migrasi_Cutover_Tahap_8.md).
