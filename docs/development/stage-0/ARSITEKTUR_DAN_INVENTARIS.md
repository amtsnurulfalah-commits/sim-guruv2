# Tahap 0.1 — Arsitektur dan inventaris aktual

Diperiksa kembali 24 Oktober 2026 WIB. Source acuan: `c3bced20922163d0abddae2358c3450a84437d9d`, merge PR #43 Honorarium. [Inventaris mesin](inventory.json) mencatat 317 file aplikasi, 47 halaman, 50 file API route, 27 migrasi serta domain/dependency/tes. Total analisis 441 file termasuk tooling/tests Tahap 0. Angka file route bukan jumlah action di dispatcher dinamis.

## Lapisan dan sumber kebenaran

| Lapisan | Source aktual | Peran |
|---|---|---|
| Halaman | `src/app`, `src/server/auth/page-session.ts` | App Router; gate sesi, onboarding/business dan admin sesuai route |
| UI | `src/features`, `src/components/ui`, `src/components/feedback`, `src/app/globals.css` | Tailwind/design system; FormDialog Radix dan beberapa dialog native berdampingan |
| Kontrak | `src/lib/*/schemas.ts`, `*contracts.ts`, `features/masters/api.ts`, `lib/feedback/api-error.ts` | Zod, validasi respons, CSRF/timeout/feedback; TypeScript saja bukan validasi runtime |
| HTTP/service | `src/server/*/{http,service,endpoints}.ts` | Pemeriksaan Origin/sesi/rate, bounded input, parameterized SQL dan transaksi |
| Database | `supabase/migrations`, `scripts/lib/sql-database.ts` | Sumber kebenaran izin, CAS/version, ledger, finance, final-period dan commit atomik |
| Koneksi/auth | `src/server/db/client.ts`, `src/server/auth/runtime.ts` | Pool auth/business/worker terpisah, TLS production, prepare:false; statement/lock timeout; auth internal Argon2id/cookie/scope |
| Worker | `src/server/operations/{batch,worker}.ts`, mail adapter/security-outbox, internal worker route | Lease/fencing/retry/unknown, switch pengiriman terpisah; queue bukan bukti pesan diterima |
| Ekspor/migrasi | activities/finance export, migration service, `scripts/{backup-database,migrate-legacy}.ts` | Ekspor scoped, staging/reconciliation/gates, backup terenkripsi dan restore lokal |

Pembacaan UI/menu bukan otorisasi. Handler dan routine SQL memeriksa aktor serta aturan. Business role di database tidak sama dengan role pengguna admin/guru. Source aplikasi tidak menggunakan Central SSO maupun Supabase Auth.

## Inventaris fungsi dan dependency

| Modul | Route utama/varian | API/source utama | Dependency penting |
|---|---|---|---|
| Publik/auth | `/`, `/login`, `/aktivasi`, `/lupa-password`, `/kesiapan` | `/api/auth/*`, auth/accounts lifecycle | Canonical host, challenge/sesi, provider pesan untuk alur pengiriman |
| Akun/pemulihan | `/akun`, `/profil`, `/onboarding`, `/admin/pemulihan` | accounts/auth/users | Onboarding berbeda dari business; keputusan pemulihan diverifikasi server |
| Dashboard | `/dashboard` | `/api/dashboard`, `app.dashboard_summary`, live-summary | DayContext, data pribadi dan honor berjalan; summary sudah tersedia |
| Pengguna | `/admin/pengguna` | `/api/users/*`, users service, auth_private.users_* | Role/status/onboarding/aktivasi/recovery; guard admin |
| Master | `/admin/master` | settings/[group], masters | Sekolah, tahun/semester, kelas/mapel, tarif/tunjangan, rentang efektif |
| Kalender | `/admin/kalender` | settings/calendar, settings/day-context, calendar | Semester/libur/override mempengaruhi occurrence dan hak libur |
| Jadwal | `/jadwal` | `/api/schedules/*`, schedules | Master, bentrok guru/kelas, revisi/rentang; bukan kredit langsung |
| Konfirmasi KBM | `/kegiatan` | activities occurrences/claim/confirm/revoke | Occurrence, effective assignment, operator bertanggal |
| Absensi siswa | `/absensi-siswa/input`, `/absensi-siswa/riwayat` | activities students/progress | Kelas wajib/tambahan, progres dan revalidasi jurnal |
| Kehadiran | `/kehadiran`, `/kehadiran-saya`, varian admin | activities attendance/template/export | Jadwal vs aktual, izin/extra dan durasi transport |
| Jurnal | `/jurnal`, `/admin/jurnal` | activities journal/eligible/export | Ownership, konfirmasi, rekap, waktu, H-1/blok/final guard |
| Piket/upacara | `/piket`, `/upacara`, varian admin | duties board/schedule/preview/commit | Penugasan, konfirmasi/time-in, pengganti/alokasi/reversal |
| Ujian/BAP | `/ujian`, `/ujian/bap`, `/ujian/panitia`, admin | programs domain exams | Periode/sesi/ruang/kelas/panitia/pengawas, BAP dan kredit |
| Acara | `/acara` beserta jurnal/kehadiran/riwayat, admin | programs domain events | Rutin/insidental, peserta, jurnal H/H-1, blok/arsip/ledger |
| Honorarium | `/honorarium`, riwayat, varian admin/operasi | `/api/honorarium/[action]`, finance | Engine NUMERIC, JTM, tarif/tunjangan akhir bulan, transport, libur, koreksi |
| Dokumen | `/verifikasi-dokumen` | honorarium token/pdf/excel/verify | Token hash/verifikasi publik terbatas; tidak membuka nominal seluruh slip |
| Pengumuman | `/admin/pengumuman`, komponen workspace | operations announcements/manage/save/dismiss | Sasaran/rentang/dismissal/prioritas |
| Laporan kendala | `/admin/laporan-kendala` | operations/support, ops.find_support_event | Metadata referensi 30 hari; belum ticket lifecycle |
| Operasional | `/admin/operasional` | operations/settings/retry/reconcile/job-retry | Maintenance, switch, scheduler/outbox, fencing |
| Migrasi data | `/admin/migrasi` | migration API/service/CLI | Staging, impor, reconciliation dan cutover gate; bukti operator terpisah |

Route/method individual lengkap ada pada JSON inventaris. Actions valid, schema input dan SQL guard tetap ditelusuri dari handler/service/schema masing-masing; scan statis `pageSession` tidak membuktikan seluruh kewenangan.

## Fondasi existing yang dipakai kembali

| Pengembangan | Fondasi existing | Gap |
|---|---|---|
| Pusat tugas | Dashboard summary, eligible journal, progres siswa, assignments/BAP | ID tugas lintas modul, tenggat, prioritas dan deep link |
| Notifikasi | Worker/outbox/scheduler/retry | Inbox, preferensi dan penggabungan reminder; jangan membuat worker kedua |
| Kesiapan honor | finance.bundle/issues, ledger/holiday/statements | Penjelasan per penerima dan navigasi sumber, bukan engine kedua |
| Persetujuan koreksi | correction_requests dan koreksi bertahap | Workflow keputusan/pemeriksa/bukti/status dan integrasi idempotent |
| Penanganan kendala | Referensi dan lookup metadata | Assignment/status/tindak lanjut/riwayat penyelesaian |
| Laporan pimpinan | Activities/finance/exports | Kamus indikator, agregasi/drill-down/izin pembaca |
| Salin semester | Master/jadwal serta pola preview/commit | Allowlist, ID mapping, konflik dan transaksi apply |
| Draft | DataForm/FormDialog dirty/discard | Penyimpanan per akun/entity/versi, TTL, konflik dan logout cleanup |

## Temuan dokumentasi dan batas

- Dokumen parity/README historis memuat angka/status lama. Dashboard sudah memiliki summary callback meskipun DTO fallback masih menggunakan flag false. Jangan menghapus fallback tanpa menelusuri pemakai.
- Graph literal menandai `src/server/db/transaction.ts` sebagai kandidat tanpa import. Ini bukan izin menghapus; tidak ada source produksi dihapus pada Tahap 0.
- Migrasi guard KBM `20261023094531_kbm_confirmation_operator_guard.sql` ada di repo. Penerapan pada produksi harus dicocokkan dengan ledger melalui proses operator; Tahap 0 tidak membaca database produksi.
- Jumlah tabel aktif tidak disimpulkan dari jumlah file migrasi atau teks CREATE TABLE. Dynamic import/RPC/framework entrypoint perlu review manual.
