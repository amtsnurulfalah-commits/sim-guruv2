# Tahap 1 — Fondasi UI/UX dan teknis

Implementasi 24 Oktober 2026 WIB. Acuan main awal: `900ac39d05df412f626f73a920fc9bb4db020010` (PR #44 / Tahap 0). Scope: UI-01–05 dan API-01, sesuai penerimaan **komponen bersama + pilot**, bukan migrasi serentak seluruh halaman.

## Inventaris, keputusan, dan hasil

Inventaris TSX sebelum perluasan pilot (jumlah file pemakai, bukan jumlah instance): Button 35, DataForm 3, FormDialog 12, ManagedDialog 3, TableRegion 6, ErrorFeedback 32, literal ui-control 13, masterRequest 22. Adapter/fungsi lain yang mengimpor komponen tersebut tetap berlaku. Sumber dipetakan lewat pencarian deklarasi/pemanggilan di `src`; hitungan bukan ukuran kepatuhan.

| ID | Sumber dan keputusan | Perubahan / bukti |
|---|---|---|
| 1.1 / UI-01 | globals.css, ui/styles.ts, Button, Badge, lib/ui-status.ts | Pine green, typography sistem, spacing/radius dan identitas lama dipertahankan. Button memakai kelas ui-action yang sama dengan tombol form. Ukuran besar min-height, sehingga label panjang bisa membungkus. StatusBadge memiliki label wajib + empat tone semantik; token warning melengkapi success/error. Pilot badge jadwal aktif/ditutup/arsip. |
| 1.2 / UI-02 | DataForm → FormDialog → Radix; ManagedDialog; TableRegion; FormFeedback/ErrorFeedback | Pakai komponen existing; tidak membuat modal/form/table baru yang menduplikasi kontrak. Pagination bersama menggantikan blok tombol jadwal dan menambahkan posisi/jumlah data. Form pendek tetap dialog; jurnal panjang tetap halaman editor existing. Heading dialog dapat wrapping tanpa mendorong tombol keluar layar. |
| 1.3 / UI-03 | lib/navigation/modules.ts → Workspace → dashboard/modules | Empat kelompok Pembelajaran, Kehadiran & Penugasan, Keuangan, Administrasi. Semua 16 modul admin/9 guru, slug, route dan guard server dipertahankan. Dialog mobile menutup saat breakpoint desktop agar background tidak tetap inert. |
| 1.4 / UI-04 | url-filters.ts + use-url-filters.ts → ScheduleManager | Allowlist hari, status, rentang tanggal, halaman. Validasi menggunakan schema jadwal existing. Nilai invalid/duplikat kembali ke default; update menghapus default, mempertahankan parameter lain/hash. Filter/pagination push history; clamp halaman replace. Popstate/pageshow memulihkan state. Tidak remount shell. |
| 1.5 / UI-05 | Pagination, DataForm, FormFeedback, dialog, sidebar | Label status selalu terlihat; posisi halaman live status; target tombol minimum 44px, fokus keyboard/field-error, petunjuk wajib/invalid pada field group, focus restore/inert dari Radix/native tetap dipakai. Resize desktop melepas modal navigasi dan memfokuskan konten utama. |
| 1.6 / API-01 | requestResponse/requestJson/readApiResponse → masterRequest → fitur | Koneksi/timeout saat membaca body kini mendapat pesan terstruktur sama dengan kegagalan headers. Write tidak pernah diulang otomatis; hasil tidak pasti mengarahkan pemeriksaan riwayat/muat ulang. Abort disengaja tidak menjadi error koneksi. JSON rusak tetap pesan aman. DataForm menolak array pilihan wajib kosong; pending guard existing tetap mencegah submit ganda. |

### Batas URL pilot

Hanya konteks non-sensitif di atas disimpan. Pencarian nama, ID guru, kelas, semester, mata pelajaran dan draft tetap lokal. Petunjuk ini terlihat pada panel filter. Berbagi tautan **bukan** berbagi seluruh pencarian/relasi. URL tidak membawa token, identitas akun, teks jurnal, data siswa, atau isi form. Backend tetap memeriksa sesi/peran; URL tidak memberikan akses tambahan. Nilai URL invalid diabaikan; URL dibersihkan untuk key milik hook saat interaksi berikutnya, tanpa menghapus parameter milik router/fitur lain.

### Aturan adopsi berikutnya

- Gunakan Button/ui-action, StatusBadge (label + tone), FormFeedback/ErrorFeedback, FormDialog/DataForm/ManagedDialog, TableRegion, Pagination. Pertahankan callback onSave yang reject bila gagal dan guard stale/uncertain-write khusus domain.
- Modal hanya untuk tindakan singkat; editor kompleks tetap halaman. Jangan menumpuk dialog preview dengan form sumber; tunggu sumber ditutup. Jangan memindahkan editor panjang tanpa tes parity.
- Hook URL menerima defaults/rules stabil di module scope. Setiap layar membuat allowlist berdasarkan schema sendiri. Gunakan push untuk pilihan eksplisit, replace untuk koreksi halaman otomatis. Jangan menyimpan pencarian bebas/draft/identitas. Jangan mengubah history secara langsung di pemakai tanpa memberi tahu store hook.
- Pilot jadwal membuktikan pola; filter/pagination/badge pada modul lain belum seluruhnya dimigrasikan. Ini pekerjaan adopsi bertahap saat modul tersebut dikembangkan, bukan klaim semua UI sudah seragam.

## Validasi

Lihat [validation.json](validation.json) untuk hasil aktual dan [design system](../../ui/DESIGN_SYSTEM.md) untuk kontrak komponen.

Perintah: `npm run check`, `npm run test:navigation`, `npm run test:ui`, `npm run test:ui:schedules`, `npm run test:ui:foundation`. Browser memakai Chromium lokal dan data sintetis/disposable; tidak menyentuh produksi.

Uji khusus: required days/multi, fokus link error, double-submit; API interrupted-body timeout/network/cancel tanpa replay; URL allowlist/duplicate/invalid/default/hash; history/reload/share/reset di real Next; drawer resize; jadwal create/edit/conflict/preview/commit/history/print, kosong/rusak/expired, 12 role/viewport, zoom/orientasi. Matriks global meliputi halaman lama agar perubahan tombol/modal tidak merusak modul lain.

Batas: bukan sertifikasi WCAG, audit pembaca layar fisik, kapasitas/latency produksi, UAT pengguna atau bukti konfigurasi/migrasi produksi. Tidak ada schema/SQL/auth/engine honor berubah. Rollback cukup revert PR; tidak ada data atau migrasi yang perlu dibalik.

## Berikutnya

Tahap 2.1: kontrak identitas tugas, sumber, alasan, prioritas, deadline WIB dan kewenangan. Baca checkpoint/roadmap/source summary/outbox existing sebelum implementasi. Tahap 2–8 belum dijalankan oleh Tahap 1.
