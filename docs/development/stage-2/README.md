# Tahap 2 — Pusat tugas dan notifikasi

Acuan awal: main `08380e2a7d28c12fc02a8b1b0cb3824f019420eb` (PR #45). Implementasi program profesional 2.1–2.6 pada 24 Oktober 2026 WIB. Auth internal, kewenangan, SQL/NUMERIC/ledger/final snapshot dan worker existing dipertahankan.

## Status rilis

Pengguna memberikan izin eksplisit pada 24 Oktober 2026 WIB untuk dua migrasi, perubahan worker/reminder dan pembatalan reminder legacy pending/retry. Batch berhasil diterapkan ke produksi setelah checksum baseline diverifikasi. Ledger kini 28 migrasi, kedua checksum cocok, dua tabel baru ENABLE/FORCE RLS, helper privat/legacy claim tidak dapat dipanggil role bisnis/worker, dan guard KBM aktif. Security advisor sesudah penerapan: tidak ada lint.

Penolakan auto-review pada giliran sebelumnya sudah diselesaikan dengan izin eksplisit pengguna, bukan bypass. SQL yang diterapkan identik dengan batch yang diuji. Tidak menjalankan SMTP/worker sebagai pengujian. Status merge/deployment frontend diperiksa pada PR #46; jangan mengasumsikan status dari file ini.

## Hasil

| ID | Implementasi | Sumber kebenaran |
|---|---|---|
| 2.1 / TASK-01 | ID stabil, jenis, alasan/prasyarat, sumber, tanggal, deadline WIB eksklusif, prioritas | `app.task_items(actor)`; actor hanya hasil sesi internal; tidak menerima role/user ID browser |
| 2.2 / TASK-01 | `/tugas`: segera, berikutnya, perlu prasyarat; filter, pagination 20; dashboard 5 tugas teratas | Proyeksi sumber dimuat ulang saat fokus/tab terlihat dan setiap menit; galat bukan hasil kosong |
| 2.3 / TASK-01 | CTA membuka halaman sumber dengan tanggalnya, konteks sumber (guru/kelas/mapel/sesi/acara) terlihat | `useActivityDate`: URL/back/forward/reload; tanggal formulir tetap saat tengah malam, input kosong tetap dapat diedit; SQL command tujuan memeriksa izin/versi/eligibility lagi |
| 2.4 / NOTIF-01 | `/notifikasi`: inbox pribadi, status email, belum dibaca, pagination server 20, preferensi email domain dan pengingat | Outbox `ops.domain_outbox` existing, receipts dan preferences pribadi dengan FORCE RLS; tidak menyalin pesan keamanan/OTP |
| 2.5 / NOTIF-01 | Satu digest per penerima/hari WIB, penggabungan sumber, penghentian pesan pending/retry saat tugas selesai/tidak lagi sah/opt-out | `ops.reminders` dan `ops.domain_claim` existing; unique dedupe key; cek sumber kembali saat claim; legacy claim tidak dapat dipanggil worker untuk melewati pemeriksaan |
| 2.6 | Urutan dashboard: tugas, konteks hari, jadwal/penugasan, pengumuman, metrik/ringkasan, akun | Dashboard/summary/announcements existing; kegagalan ringkasan tidak menghilangkan pengumuman atau pusat tugas |

## Kamus tugas dan kewenangan

| Jenis / ID stabil | Pemilik/pembaca | Kapan aktif dan selesai | Batas |
|---|---|---|---|
| `journal:<occurrence>` | Guru efektif | KBM valid; hilang setelah jurnal aktif. Menunggu konfirmasi/blok ditampilkan sebagai prasyarat menurut `journal_eligibility` | Sebelum 00.00 WIB hari berikutnya; bila H-1 aktif, sebelum 00.00 dua hari setelah kegiatan |
| `bap:<occurrence>` | Pengawas efektif | Periode ujian aktif, belum ada BAP aktif; tunggu konfirmasi dan 5 menit setelah akhir kegiatan | Sebelum 00.00 WIB setelah tanggal akhir periode ujian, sesuai guard BAP existing |
| `event-journal:<attendance>` | Pemilik kehadiran acara | Kehadiran sah, acara aktif, belum pernah ada jurnal; blok dan H-1 mengikuti sumber | Batas hari/H-1 seperti jurnal; pembatalan/final meniadakan tugas |
| `confirmation:<assignment>` | Admin atau piket/panitia sesuai tanggal dan kewenangan | Konfirmasi guru lain belum ada; petugas harus memenuhi syarat konfirmasi/kehadiran; rekap ujian yang belum lengkap menjadi prasyarat | Hari ini; final/removed/konfirmasi aktif meniadakan tugas |
| `assignment:<occurrence>` | Pemilik piket/upacara/panitia | Upacara menuju konfirmasi sendiri sesuai fitur; piket/panitia menunggu admin | Hari ini, belum terkonfirmasi dan belum final |
| `attendance:<row>` | Pemilik baris kehadiran | Baris berpola tanpa jam keluar: masuk/keluar sesuai status/waktu; jadwal tidak sesuai jam masuk ditandai prasyarat | Hari ini dan belum final; tidak membuat baris/pola baru otomatis |
| `students:<class>:<date>` | Admin | Daftar kelas wajib KBM/ujian dari `students_required`/`exam_required` belum lengkap | Hari ini, belum final; rekap tersimpan meniadakan tugas |
| `job:<business_key>`, `mail:<outbox>` | Admin | Job failed atau email failed/unknown | Tidak diberi deadline buatan; status sumber pulih meniadakan tugas |

Tidak ada endpoint checkbox “selesai”. Menandai notifikasi dibaca **tidak** menyelesaikan tugas. Kelengkapan administrasi bukan penilaian kinerja. Tugas bukan pengganti engine kelayakan transaksi. Jadwal mendatang tetap pada ringkasan/menu jadwal; sumber terarsip/removed/final/di luar jendela input tidak dipaksa menjadi tugas aktif. GET tasks memakai materializer canonical dan advisory lock yang sama dengan activity read untuk penugasan hari ini, bukan engine jadwal kedua.

## Inbox, preferensi, dan pengiriman

- Inbox membaca hanya pesan domain milik sesi. Menyimpan receipts tidak mengubah outbox delivery atau sumber bisnis. Akses ID notifikasi akun lain menghasilkan NOT_FOUND; admin juga tidak membaca inbox orang lain lewat endpoint ini.
- Preferensi memakai CAS version, actor server, origin/CSRF dan rate limit existing. Email keamanan akun memakai outbox terpisah dan tidak dinonaktifkan oleh preferensi domain.
- Perubahan preferensi berlaku sebelum claim; pesan yang sudah diklaim/terkirim tidak dapat ditarik kembali. Status `sent` berarti layanan pengiriman menerima, bukan penerima sudah membuka/membaca email. `unknown` tidak dikirim ulang otomatis.
- Worker tetap menghormati mailEnabled/jobsEnabled/maintenance dan lease/fencing existing. Tidak mengaktifkan SMTP, scheduler atau job yang sebelumnya nonaktif; tidak menjalankan pengiriman email sebagai pengujian produksi.
- Digest digabung sekali per penerima/hari. Tugas yang muncul setelah digest hari itu tidak membuat email kedua; selalu terlihat pada pusat tugas. Snapshot pesan inbox dapat berbeda dari jumlah tugas terbaru, sehingga CTA meminta membaca sumber terkini.
- Jurnal baru diingatkan setelah akhir kegiatan +5 menit, acara setelah akhir acara; BAP menunggu eligibility waktunya. Tugas/prasyarat tetap dapat ditinjau lewat pusat tugas.
- Pending/retry legacy reminders dibatalkan sekali pada migrasi agar tidak bersaing dengan digest. Riwayat inbox tetap tersedia. Recheck source dilakukan saat claim; sumber dapat berubah setelah SMTP mulai, dan email yang sudah dikirim tidak bisa dibatalkan.

## Kontrak dan komponen

GET `/api/operations/tasks` → `{date,generatedAt,items}`. GET `/api/operations/inbox?page=1&unread=false` → `{preferences,total,unread,items}`. POST `notification-read` menerima `{id}`. POST `notification-preferences` menerima `{version,emailEnabled,reminderEmail}`. Semua memakai envelope `{ok,data,requestId}`/error existing; query/command strict dan schema respons Zod.

Halaman memakai Button, StatusBadge, Pagination, ErrorFeedback/FeatureState/EmptyState existing. Draft preferensi tidak hilang ketika membaca notifikasi. Ref pending mencegah submit ganda; hasil write ambigu/conflict mengunci pengiriman berikutnya sampai reload. Abort/read race tidak menimpa state layar yang ditinggalkan. Tautan sumber hanya route internal allowlist; tidak menyimpan token/identitas akun/draft di URL.

## Validasi dan batas

Lihat [validation.json](validation.json). Test baru: unit kontrak/urgensi/tautan; integrasi SQL dengan sesi nyata, RLS/grants/private helper, cross-user, CAS, origin/CSRF, canonical journal completion, digest dedupe/cancel, rekap/kehadiran/admin, H-1, acara dan BAP. Sebagian fixture BAP/acara dibentuk langsung di DB untuk menguji proyeksi; bisnis command tetap tercakup suite modul existing.

Browser: pusat tugas/inbox 24 kombinasi view/role/viewport, empty/error/malformed/retry, pagination, tanggal CTA, long text, preferensi/read/double submit/uncertain recovery; real SQL fixture response; regresi tujuh modul tujuan dan dashboard; matriks global; production-build Next App Router untuk tanggal sumber/history/reload dan sesi berakhir.

Fixture browser membekukan waktu pukul 12 WIB, sedangkan DB memakai jam host. Lease pratinjau fixture attendance/module/duty dibuat valid untuk kedua jam agar tes tidak salah gagal pada pagi hari; ini hanya fixture disposable, tidak mengubah TTL produksi. Tes empty input dan midnight menemukan/mencegah regresi helper tanggal.

Bukan bukti SLA/load produksi, pembaca layar/perangkat fisik, SMTP delivery atau UAT akun pengguna. API tugas saat ini mengagregasi seluruh tugas relevan sebelum pagination UI; profil data besar dan pagination SQL tugas tetap kandidat PERF-01 Tahap 8. Inbox sudah dibatasi di SQL. Tidak ada engine honor frontend baru.

## Rilis dan rollback

Migrasi baru `20261024000945_task_center_and_notification_preferences.sql` bersifat additive untuk dua tabel privat dan kolom task_keys, mengganti reminder/claim wrapper dengan fingerprint routine lama yang diverifikasi. Preflight produksi menemukan 26 migrasi sebelumnya dan guard KBM `20261023094531` belum diterapkan; guard pendukung itu harus mendahului Tahap 2.

Batch rilis mengunci migrasi/write, memverifikasi semua 26 checksum baseline, menerapkan dua file persis dari repo, dan mencatat nama/checksum ke `sim_guru_migration.schema_migrations` dalam transaksi yang sama. Ini menjaga kompatibilitas runner migrasi repo selain histori Supabase. Batch diuji pada DB disposable 26→28 dan runner normal sesudahnya no-op. Hasil penerapan/metadata/advisors/smoke aktual dicatat pada validation.json; jangan mengasumsikan penerapan hanya dari file SQL.

Rollback aplikasi ke PR #45 tetap kompatibel dengan skema additive. Pertahankan receipts/preferences; jangan drop data pengguna. Bila worker perlu dihentikan, gunakan kontrol jobs/mail existing; kembalikan routine hanya melalui migrasi kompensasi yang direview. Guard KBM lama tidak dibalik karena merupakan perbaikan kompatibilitas sebelumnya.

## Berikutnya

Tahap 3.1: kamus pemeriksaan kesiapan honorarium per periode/guru dari `finance.bundle/issues` existing. Bedakan tugas administratif dari blocker finalisasi; jangan membuat engine honor kedua. Tahap 3–8 belum dijalankan oleh pekerjaan ini.
