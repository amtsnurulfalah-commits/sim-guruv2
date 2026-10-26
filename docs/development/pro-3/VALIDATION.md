# Validasi PRO-3

Source baseline22b764a, fixture lokal/PGlite dan browser Chromium153. Runtime c53f5403 diuji pada CI run40286086907/job121449975016 (PostgreSQL16.15); native job berhasil.

Lokal:401 integrasi/164unit lulus, crypto exit0, lint/typecheck/build berhasil. Fokus6tes PRO-3 meliputi paused0attempts tanpa penciptaan honor, domain/security capped retry timestamps, wrong/missing/null/stale lease, state-cohort ratio/unknown/privacy, active-vs-paused queues, heartbeat-vs-job success serta quarantine tickets/sessions/outbox. Reminder dedupe/completion-cancel dan worker fencing existing diuji ulang bersama suite penuh.

UI Laporan Kendala: reference-to-case, owner/status/resolution/reopen/audit, monitoring dan modal responsive lulus; tidak ada page error. UI Operasional lulus pada7lebar (280–1920), seluruh aksi,100row/filter/pagination, validasi, double-submit/uncertain/konflik, touch/200%text/landscape;0page error. Native restore berhasil, rincian di bawah.

Keterbatasan: MailAdapter menggunakan sender terkontrol/fixture; tidak ada email nyata. Native dump/restore adalah database disposable, bukan backup/restore produksi. Status sent produksi hanya observasi aplikasi. RPO/RTO produksi dan retensi actual belum diverifikasi.

## Drill backup/restore aktual

Lihat [native-recovery-results.json](native-recovery-results.json). Backup sintetis dibuat26Oktober2026 pada07:30:35UTC (14:30:35WIB), terenkripsi dan disimpan privat pada runner disposable. Pembuatan609ms; recovery1227ms termasuk pemeriksaan yang dicatat script.36migrasi dan seluruh tabel privat, isi/schema/ACL/RLS/checksum, NUMERIC/immutable final dan password-hash verify diperiksa. Worker-ticket purge lulus; tidak ada tiket/sesi aktif atau pengiriman dari hasil restore.

RPO drill:0transaksi fixture hilang pada snapshot frozen. RTO1227ms hanya drill ini; bukan sasaran produksi yang disepakati. Ukuran arsip dan batas lain tercatat dalam JSON. Dump/key tidak dipublikasikan dan dihapus setelah runner selesai. CI head dokumentasi final tetap menjadi gate merge.

Migrasi36 kanonis SHA256: `eb59fa404138cd4b6a42362c3451ae04371544a7d787aed274705fee653cf6cf`. Penerapan setelah merge memerlukan ledger35/body prior sesuai guard; kemudian verifikasi ledger36/checksum, metadata fungsi/ACL, security advisor dan deployment. Tidak mengisi completed_at historis atau mengubah job September.
