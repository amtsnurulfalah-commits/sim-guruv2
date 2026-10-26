# Runbook operasional PRO-3

## Pemilik, ambang dan eskalasi

| Sinyal | Ambang/pemicu | Peran awal | Langkah aman |
|---|---|---|---|
| FAILED_JOBS | Ada job failed | Admin operasional; admin honor untuk finance | Catat business key/kode; periksa sumber dan guard. 42501 dapat berarti aturan bisnis, bukan alasan menambah privilege. Job paused tidak diulang |
| FAILED_MESSAGES | Ada failed/unknown | Admin operasional + operator email | Catat ID antrean; periksa status provider secara privat. Unknown tidak dikirim ulang otomatis; rekonsiliasi berdasarkan bukti |
| QUEUE_DELAY | Antrean kanal aktif due≥15menit | Operator Supabase/Vercel | Periksa cron, endpoint/tiket, konfigurasi dan backlog. Antrean kanal yang sengaja nonaktif dipisahkan |
| WORKER_STALE | Worker diharapkan tetapi tiket tidak terlihat≥15menit | Operator Supabase/Vercel | Periksa cron.job_run_details dan HTTP runtime tanpa mencetak secret/tiket. Jangan membuat scheduler kedua |
| JOBS_STALE | Heartbeat segar tetapi job notifikasi belum berhasil≥15menit | Operator + pengembang | Tiket terpakai belum membuktikan run_jobs selesai. Periksa hasil endpoint dan kode job |
| SLOW_API | Existing mean≥2detik, minimal10sampel/jam | Pengembang | Periksa modul/deployment/query; mean bukan p95 |

Peran di atas adalah tanggung jawab fungsi, bukan nama orang yang sudah menyetujui piket. Pengelola perlu menetapkan orang utama/cadangan, jam layanan dan kontak eskalasi. Jangan mempublikasikan nomor/email pribadi di Git. Ambang15menit mengikuti monitor existing; tinjau noise bersama operator sebelum membuat eskalasi eksternal.

Catat insiden di Laporan Kendala existing: referensi bantuan bila ada, kode alert/business key/ID antrean, waktu WIB, dampak, owner, tindakan, bukti verifikasi, lalu resolve/reopen sesuai hasil. Tidak membuat case/undangan/email otomatis dari setiap refresh monitor.

## Email dan retry

1. Bedakan queued, sending, sent (diterima server atau rekonsiliasi admin), failed, retry_wait, unknown dan cancelled. Tidak tersedia bukti inbox/DSN pada implementasi sekarang.
2. Status unknown atau lease hilang dapat berarti provider sudah menerima. Jangan reset attempts untuk mencoba keberuntungan. Periksa provider secara privat, lalu rekonsiliasi sent/cancelled menggunakan alasan audit.
3. Untuk failed, periksa penyebab/config/sumber lebih dulu. Retry melalui UI yang ada; dedupe key dan fencing tetap. Jangan mengubah state lewat SQL untuk melewati guard.
4. Pengingat daily digest memakai task_items existing. Sumber selesai/opt-out dibatalkan sebelum claim; pesan yang sudah diterima provider tidak dapat ditarik kembali.
5. Untuk uji live, pengelola menetapkan penerima dan tujuan secara eksplisit. Jangan menggunakan email akun yang ditemukan di database sebagai penerima tanpa instruksi. Catat queue ID, accepted provider dan bukti penerima secara terpisah; jangan menyimpan OTP/password/message body di Git.

## Cakupan backup

| Komponen | Cakupan dan akses | Status |
|---|---|---|
| Database | app, auth_private, ops, finance, sim_guru_migration; data, immutable snapshots/ledger, schema/RLS/ACL/checksum migrasi | CLI terenkripsi dan native drill tersedia; arsip produksi bertanggal belum diverifikasi |
| Objek | Storage buckets/object bytes dan referensi eksternal; metadata DB saja tidak memulihkan byte objek | Saat snapshot0objek/referensi; perlu prosedur terpisah saat mulai dipakai |
| Source/config | Commit main yang dirilis, project/region/APP_URL/nama env dan konfigurasi cron | Source/config nonsecret di Git; nilai environment privat dikelola operator |
| Secret | Role credentials, SMTP/provider, encryption keys dan akses Supabase/Vercel | Simpan di secret manager milik operator dengan recovery/cadangan terpisah; jangan ekspor ke artefak/Git/chat |

Backup Supabase tidak otomatis mencakup byte Storage. Daily backup juga tidak menyimpan password custom role; operator harus menyiapkan rotasi/rebinding credential saat pemulihan. Referensi resmi: https://supabase.com/docs/guides/platform/backups (diperiksa26Oktober2026).

Usulan retensi (belum dianggap konfigurasi aktif):7backup harian +4mingguan di lokasi privat berbeda, enkripsi AES-GCM, key terpisah dan akses minimum. Hapus arsip kedaluwarsa hanya setelah verifikasi restore dan persetujuan pemilik data; jangan menghapus audit/ledger aplikasi. Target usulan RPO≤24jam/RTO≤4jam harus disepakati berdasarkan dampak/biaya; bukan SLO yang telah dipenuhi.

## Backup dan latihan restore

- Metadata jadwal/arsip produksi diperiksa operator melalui Supabase Backups/penyimpanan privat. Connector sesi ini tidak menyediakan daftar backup bertanggal. Tidak ada klaim backup produksi aktif hanya dari kode CLI.
- CLI `npm run backup:database -- create PRIVATE_DIRECTORY` memerlukan sumber frozen, jobs/mail/security off dan maintenance on. Jangan menjalankan freeze produksi tanpa window yang disepakati. Direktori di luar repo; file/key tidak dicetak atau dimasukkan ke Library/artefak CI.
- `verify` memeriksa autentikasi/checksum arsip, belum membuktikan restore. `restore-local` hanya mengizinkan database loopback *_restore_test kosong, melakukan pg_restore transaksi, membandingkan isi/schema/ACL/migrasi, lalu quarantine.
- Quarantine menonaktifkan jobs/mail/security, mengaktifkan maintenance, mencabut sesi, menghapus worker tickets dan bahan token, serta membatalkan antrean aktif/unknown. Tidak membalik ledger bisnis atau mengirim email dari hasil restore.
- CI membuat backup sintetis bertanggal dan menguji key salah, manifest/arsip rusak, target tidak kosong, hak akses, NUMERIC, immutable-final, serta isolasi sesi/dispatch/tiket. Artefak hanya metrik; dump/key tetap privat dan dibersihkan.
- Jangan menganggap fixture restore sebagai restore produksi. Pemulihan produksi memerlukan target terpisah, scope/window/arsip/key/operator yang disetujui, serta verifikasi sebelum alih trafik. Jangan restore menimpa database live sebagai tes.

## Rollback dan penutupan gangguan

1. Catat commit/deployment, migrasi, waktu kejadian dan dampak. Rollback aplikasi melalui release sebelumnya bila regresi frontend; schema tambahan PRO-3 nullable dan fungsi kompatibel dengan runtime lama.
2. Jangan hapus ledger migrasi atau rollback data finansial untuk menyamarkan insiden. Perubahan SQL balik hanya dengan preflight/checksum, transaksi dan otorisasi.
3. Setelah pulih: verifikasi health, jalur anonim tetap401, metadata SQL/ACL, scheduler dan job sukses; untuk email bedakan bukti server/penerima. Resolve case dengan bukti, bukan hanya heartbeat.
4. Ubah pengaturan maintenance/job/email hanya setelah operator memeriksa kesiapan dan pengelola menyetujui; jangan mengaktifkan antrean hasil restore secara massal.

## Blocker penutupan tahap

BKP-01: operator belum menyediakan bukti jadwal/arsip backup produksi bertanggal dan retensi aktual.
BKP-02: target RPO/RTO, key custody, orang utama/cadangan serta window latihan belum disepakati.
MAIL-01: penerima uji live/instruksi pengiriman dan bukti inbox belum tersedia. Tidak ada pesan eksternal dikirim pada tahap ini.
