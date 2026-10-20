# Audit cakupan UI/UX SiM-Guru

Baseline: main `c1bcfd2` (Tahap8). Inventaris aktual: 46 page routes, 26 komponen fitur, 21 tag form langsung, 20 pemakaian DataForm dan 14 dialog native sebelum refactor. API routes tidak didesain ulang dan bukan halaman produk.

| Prioritas | Temuan | Penanganan |
|---|---|---|
| P0 | Form run menangkap error tanpa meneruskannya ke editor | Jalur formRun meneruskan kegagalan; dialog tidak ditutup sebagai sukses |
| P0 | Penutupan editor berpotensi membuang draft tanpa peringatan | FormDialog dan ManagedDialog dengan guard dirty/busy; konfirmasi buang |
| P1 | Biru/hijau, ukuran tombol dan panel tidak konsisten | Token semantik dan style kontrol/panel bersama |
| P1 | Banyak editor menutupi daftar kegiatan | Modal kontekstual; editor panjang/preview bertahap tetap pada halaman |
| P1 | Pemilihan multiple membutuhkan Ctrl di desktop | Checkbox hari/multi pada DataForm dengan payload array yang sama |
| P1 | Jejak navigasi/nested active state belum ada | Breadcrumb dan longest matching navigation |
| P2 | Teks rilis lama tampil sebagai status produk | Landing/dashboard memakai deskripsi tugas; tahap tetap di halaman status |
| P2 | State error/empty kurang membantu | EmptyState/FeatureState, feedback seragam, retry dan toast |

## Seluruh halaman

Penanganan melalui komponen bersama berlaku pada semua pemakai, termasuk alias route. Tabel ini membuktikan audit/pemetaan source; bukan klaim seluruh route telah diuji dengan akun produksi.

| Route | Komponen fitur | Penanganan |
|---|---|---|
| `/absensi-siswa/input` | @/features/activities/workspace | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/absensi-siswa/riwayat` | @/features/activities/workspace | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/acara/jurnal` | @/features/programs/event-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/acara/kehadiran` | @/features/programs/event-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/acara` | @/features/programs/event-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/acara/riwayat` | @/features/programs/event-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/acara` | @/features/programs/event-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/honorarium/operasi` | @/features/finance/finance-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/honorarium` | @/features/finance/finance-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/honorarium/riwayat` | @/features/finance/finance-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/jadwal-kehadiran` | @/features/activities/workspace | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/jurnal` | @/features/activities/workspace | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/kalender` | @/features/calendar/calendar-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/kehadiran-harian` | @/features/activities/workspace | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/master` | @/features/masters/master-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/migrasi` | @/features/migration/manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/operasional` | @/features/operations/managers | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/pemulihan` | @/features/auth/admin-recovery | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/pengguna` | @/features/users/user-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/pengumuman` | @/features/operations/managers | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/piket` | @/features/duties/duty-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/ujian` | @/features/programs/exam-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/admin/upacara` | @/features/duties/duty-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/aktivasi` | @/features/auth/recovery-form | AuthLayout; label, feedback, kontrol dan layout responsif |
| `/akun` | @/features/auth/session-panel | SessionPanel/ActionForm; pengamanan bertahap; modal profil/password |
| `/dashboard` | @/features/dashboard/dashboard-view | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/honorarium` | @/features/finance/finance-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/honorarium/riwayat` | @/features/finance/finance-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/jadwal` | @/features/schedules/schedule-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/jurnal` | @/features/activities/workspace | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/kegiatan` | @/features/activities/workspace | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/kehadiran` | @/features/activities/workspace | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/kehadiran-saya` | @/features/activities/workspace | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/kesiapan` | @/features/dashboard/module-cards | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/login` | @/features/auth/login-form | AuthLayout; label, feedback, kontrol dan layout responsif |
| `/lupa-password` | @/features/auth/recovery-form | AuthLayout; label, feedback, kontrol dan layout responsif |
| `/modul/[slug]` | komposisi/alias halaman | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/onboarding` | komposisi/alias halaman | SessionPanel/ActionForm; pengamanan bertahap; modal profil/password |
| `/` | komposisi/alias halaman | Landing page; hierarki, status cakupan dan akses masuk |
| `/piket` | @/features/duties/duty-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/profil` | komposisi/alias halaman | SessionPanel/ActionForm; pengamanan bertahap; modal profil/password |
| `/ujian/bap` | @/features/programs/exam-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/ujian` | @/features/programs/exam-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/ujian/panitia` | @/features/programs/exam-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/upacara` | @/features/duties/duty-manager | Workspace/breadcrumb, token/kontrol; manager bersama sesuai modul |
| `/verifikasi-dokumen` | @/features/finance/verify-document | Panel verifikasi, error state dan tautan skip content |

## Form/modal

- DataForm: ujian/BAP, acara/kehadiran/jurnal/blok, honor/finalisasi/koreksi/blok transport, operasional/retry/reconciliation, dan bukti migrasi menggunakan dialog kontekstual; validasi native+Zod serta server tetap berlaku.
- Aktivitas: izin sementara, koreksi kehadiran, template jam, rekap siswa, jurnal dan blok jurnal menjadi modal. Jadwal piket/upacara juga menjadi modal.
- Akun: ganti password dan ubah profil menjadi modal; aktivasi, pemulihan, email/OTP dan onboarding tetap sebagai alur halaman karena membutuhkan konteks beberapa langkah.
- Editor pengguna, data master dan jadwal KBM yang telah memakai modal native dipertahankan dan diberi guard dirty/busy serta gaya konsisten. Preview dampak/keuangan tetap native untuk menjaga alur persetujuan yang sudah ada.
- Pengumuman beserta tiga pemilih sasaran tetap satu formulir halaman karena panjang dan relasi penerimanya. Editor kalender dan operasi piket/substitusi bertahap tetap pada halaman agar konteks/preview tidak hilang. Filter, pencarian dan pilihan periode tetap inline.

## Batas audit

Tidak ada perubahan schema, RPC, API contract atau arsitektur auth. Tidak dibuat KPI/dataset operasional baru. Tidak dilakukan migrasi data atau pengaktifan email/worker. Sorting/pagination/filter yang sudah tersedia dipertahankan; tidak ditambahkan parameter API untuk sorting yang belum ada. Dark mode tidak diaktifkan karena komponen domain dan dokumen cetak memerlukan audit kontras tersendiri; rilis ini menstandarkan light mode.

## Tindak lanjut UI UX Pro Max (baseline d28269c)

Pemetaan 46 route di atas tetap berlaku; tidak ada route, backend, atau alur bisnis yang ditambah/dihapus. Pemeriksaan source dan dokumentasi sebelumnya menunjukkan perbaikan yang sudah baik (modal dirty guard, CSRF, feedback gagal simpan, RBAC, breadcrumb) sehingga dipertahankan. Adaptasi berikut berfokus pada kesenjangan terukur:

| Prioritas | Kesenjangan awal | Perubahan | Area terdampak |
|---|---|---|---|
| P1 | Batas input terlalu pucat pada permukaan terang | Token input yang diuji ≥3:1 | Kontrol bersama, login, filter, formulir |
| P1 | DataForm menampilkan satu error umum tanpa asosiasi tiap field | Summary focusable, tautan field, inline error, aria-invalid/describedby | Pemakai DataForm pada ujian/acara/honor/operasional/migrasi |
| P1 | Overflow tabel sudah terkurung tetapi tanpa petunjuk/fokus keyboard eksplisit | TableRegion bernama, hint kondisional, keyboard scroll, sticky header | 8 tabel di 6 manager |
| P1 | Sidebar admin panjang dan perlu pemindaian banyak menu | Pencarian lokal berbasis daftar role existing, hasil kosong/reset | Semua Workspace; desktop dan drawer |
| P2 | Dashboard menampilkan ringkasan sebagai paragraf setara | MetricCard, native progress dan tautan kontekstual; kartu akun lebih tenang | Dashboard guru/admin |
| P2 | Isian rahasia tidak mempunyai kontrol visibilitas | PasswordInput, tetap mendukung paste/password manager | Login, aktivasi, pemulihan, lifecycle akun |
| P2 | Topbar sticky mengambil ruang layar pendek | Topbar statis di mobile; drawer tetap modal | Workspace mobile/lanskap |
| P2 | Focus offset, motion, print table dan target breadcrumb belum dinyatakan konsisten | Scroll padding, motion tokens, forced colors, safe area, target tautan | Komponen bersama dan CSS |

Riset memakai generator aktual dan pencarian terarah, bukan pemasangan template UI. Hasil awal yang tidak cocok, pencarian tanpa hasil, pencarian ulang dan keputusan yang ditolak dicatat pada `DESIGN_SYSTEM.md` serta JSON riset. Tidak ada library ikon/font/chart baru, KPI rekaan, penghilangan kolom, penggantian auth internal, atau perubahan API/database.

## Perapihan produksi setelah adaptasi Pro Max

Audit lanjutan mengganti catatan pembangunan pada beranda/panduan dan nomor tahap
pada kartu modul; memperjelas label pembuka, pratinjau, submit dan konfirmasi pada
modul yang memakai komponen bersama; memperkuat batas bagian; serta memperbaiki
pembukaan ulang editor izin dari baris kehadiran yang sama dan semantik feedback.
Rincian perubahan, bukti pengujian, serta batas kesiapan operasional dicatat dalam
[`KESIAPAN_PRODUKSI.md`](KESIAPAN_PRODUKSI.md). Peringatan transaksi dan aturan bisnis
tetap ditampilkan saat relevan, bukan dihapus sebagai teks pengembangan.
