# Tahap 0.4 — Backlog prioritas

P0 = gate operasional/keamanan sebelum rilis terkait; P1 = fondasi/pekerjaan utama; P2 = kemampuan lanjutan setelah dependency. Pemilik merupakan peran yang diperlukan, bukan penunjukan orang. Kriteria penerimaan setiap tahap juga berlaku.

| ID / tahap | Prioritas | Dependency | Cakupan / pemilik | Penerimaan dan bukti |
|---|---|---|---|---|
| OPS-01 | P0 rilis terkait | Baseline | Operator: ledger migrasi/config/deploy | Versi/checksum dan smoke terotorisasi; file SQL bukan bukti sudah diterapkan |
| OPS-02 | P0 pemulihan | Backup tool | Operator: restore native disposable | Inventori/agregat/izin cocok; RPO/RTO aktual; backup/secret tidak masuk git |
| QA-01 | P1 | Baseline | QA: full-chain browser | E2E-01/08/10 terisolasi termasuk gagal/rollback; tidak menganggap suite parsial full-chain |
| DOC-01 | P1 | Pemetaan | Dokumentasi historis vs terkini | README/checkpoint mengarah baseline, bukti lama tidak dihapus |
| UI-01 / 1.1 | P1 pertama | Tahap 0 | Pengembang: token/status/design system | Daftar sumber/pemakai/varian, keputusan konsolidasi dan pilot; identitas visual dipertahankan |
| UI-02 / 1.2 | P1 | UI-01 | Komponen form/dialog/table/filter/feedback | Pilot singkat/panjang lulus fokus/dirty/close/error/mobile/regresi; tidak ada fungsi duplikat |
| UI-03 / 1.3 | P1 | UI-01 | Navigasi empat kelompok | Route lama dan role tetap benar; keyboard/mobile; menu bukan otorisasi |
| UI-04 / 1.4 | P1 | UI-02 | Filter URL | Back/forward/reload/share pulih; invalid dinormalisasi; tanpa token/data sensitif |
| UI-05 / 1.5 | P1 | UI-02 | Aksesibilitas | Checklist per komponen, keyboard/zoom/kontras/reader; emulasi bukan sertifikasi |
| API-01 / 1.6 | P1 | UI-02 | Kontrak/state | Null/malformed/abort/stale/double-submit/timeout; server tetap sumber kebenaran |
| TASK-01 / 2.1–2.3 | P1 | UI/API-01, izin | Pusat tugas | ID stabil, sumber/deadline/prioritas/deep link; sinkron dengan sumber dan role |
| NOTIF-01 / 2.4–2.5 | P1 | TASK-01, outbox | Inbox/preferensi/reminder | Dedupe/preferensi/stop-on-complete; unknown tidak blind resend |
| DASH-01 / 2.6 | P1 | TASK/NOTIF | Dashboard tugas | Tugas relevan tanpa menghilangkan jadwal/pengumuman; empty/error jelas |
| HONOR-01 / 3.1–3.2 | P1 | TASK, finance | Kesiapan periode/guru | Cocok finance.bundle/issues; bedakan tugas administrasi dan blocker; tanpa engine kedua |
| CORR-01 / 3.3–3.5 | P1 | HONOR, approval | Bukti/pemeriksa/keputusan | Izin/transisi eksplisit; replay aman; snapshot/target benar; SQL/browser/failure test |
| SUPPORT-01 / 4.1–4.4 | P1 | UI/API, referensi | Ticket lifecycle | Referensi asal, assignment/status/riwayat; catatan internal terlindungi |
| OBS-01 / 4.5–4.6 | P1 | NOTIF/SUPPORT | Metrik/alert/log | Definisi/periode, alert dideduplikasi, purge/akses diuji tanpa rahasia |
| REPORT-01 / 5.1–5.5 | P2 | HONOR/TASK, izin | Laporan pimpinan | Denominator/sumber jelas, summary=detail=ekspor; kelengkapan bukan skor kinerja |
| SEMESTER-01 / 6.1–6.5 | P2 | Master/jadwal, UI/API | Salin konfigurasi | Allowlist/ID/conflict/retry/rollback; transaksi dan riwayat tidak disalin |
| DRAFT-01 / 7.1–7.4 | P2 | UI/API/TASK, storage decision | Draft per akun/entity/versi | Waktu/status/TTL/logout cleanup, konflik; bukan auto-submit offline |
| MOBILE-01 / 7.5 | P2 | UI/DRAFT | Form/kartu/koneksi lambat | 320px/tablet/desktop/landscape; field/footer terjangkau, tanpa overflow dokumen |
| SEC-01 / 8.1 | P0 berulang | Setiap PR | Audit sesi/API/SQL/log | Kasus penolakan; temuan kritis cakupan rilis ditangani; review manual + tes |
| PERF-01 / 8.3 | P2 | Data representatif/OBS | Latency/render/beban | p50/p95/error/concurrency/data size; target dari bukti; PGlite minimal bukan SLO |
| RELEASE-01 / 8.2,8.4–8.6 | P0 setiap rilis | QA/SEC/OPS terkait | Rilis/restore/rollback/runbook | CI, migrasi kompatibel, smoke/restore sesuai akses dan rollback berbukti |

## Langkah berikutnya

UI-01–05/API-01 dilaksanakan melalui [Tahap 1: fondasi bersama dan pilot](../stage-1/README.md). TASK-01/NOTIF-01 dilaksanakan pada [Tahap 2](../stage-2/README.md). Berikutnya **HONOR-01 / Tahap 3.1**, mulai kamus kesiapan dari engine finance setelah instruksi kelanjutan pengguna. Tidak mengulang audit halaman yang sudah lulus tanpa perubahan/temuan baru.

OPS-01/02 memerlukan proses operator sesuai akses sebelum rilis terkait. Tidak otomatis menghalangi pekerjaan UI yang tidak bergantung produksi. Setiap item mencatat masalah/aktor/sumber, dependency, API/schema/SQL terdampak, penerimaan, tes, migrasi/rollback jika perlu, PR/commit dan sisa pekerjaan.

Belum ada janji tanggal/durasi; estimasi dibuat setelah scope dan dependency diperiksa. Tahap 1–8 belum dilaksanakan dalam Tahap 0.

HONOR-01 / Tahap 3 telah dirilis melalui PR #47. Implementasi Tahap 4 mengikuti paket stage-4; status rilis aktual pada checkpoint/PR. Setelah rilis, prioritas berikutnya Tahap 5.
