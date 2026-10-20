# Laporan modernisasi UI/UX SiM-Guru

20 Oktober 2026. Baseline source `c1bcfd2` (Tahap8), branch implementasi `feat/ui-ux-modernization`. Perubahan hanya pada presentasi, komponen/interaksi frontend, dokumentasi dan alat pengujian. Tidak ada perubahan schema, RPC, endpoint, kontrak API, arsitektur autentikasi internal atau konfigurasi Supabase/email/worker.

## Hasil implementasi

1. Audit/pemetaan46page routes dan26komponen fitur. Semua route ditangani melalui layout/komponen bersama atau komposisi halaman khusus; detail per route ada di [audit](AUDIT_UI_UX.md).
2. Token warna semantik, font sistem, skala kontrol44px, panel, fokus terlihat dan reduced motion. Warna tombol domain yang berbeda dipusatkan pada primary.
3. Workspace dengan breadcrumb, active state subhalaman, ikon modul, sidebar desktop, drawer mobile, batas konten dan penanganan overflow. Landing/login/aktivasi/pemulihan mempunyai hierarki yang konsisten; status produk yang usang diperbarui.
4. DataForm menjadi modal kontekstual dengan validasi native+Zod, checkbox multiple/hari, busy, ref pencegah submit ganda, error tetap di modal, refresh data terkait dan toast hasil. Tombol Batal/Submit DataForm berada pada footer dialog.
5. Enam formulir aktivitas dan editor jadwal piket/upacara menjadi modal; editor password/profil juga memakai modal. Form kompleks, filter, OTP, onboarding dan preview bertahap tetap pada halaman sesuai alasan di audit.
6. Editor native pengguna/master/jadwal mendapat guard draft/busy dan konfirmasi penutupan. Perubahan yang sukses tetap menutup editor tanpa meminta konfirmasi buang. Penggantian pemilihan edit dan pembukaan kembali entity sama ditangani dengan sinyal editor.
7. FeatureState/EmptyState, pesan status Indonesia dan toast sukses. Informasi sasaran blok transport/slip koreksi ikut ditampilkan pada modal terkait agar konteks keputusan tidak hilang.
8. Error pada helper run sebelumnya hanya ditampilkan di halaman; jalur formRun sekarang meneruskan kegagalan ke form, termasuk BAP, agar modal tidak menganggap penolakan server sebagai sukses.

## Komponen reusable

| Komponen | Tanggung jawab |
|---|---|
| ui/styles | Class kontrol, aksi dan permukaan semantik |
| Button | Varian primary, outline, ghost, destructive dan target sentuh |
| FormDialog | Portal/focus trap Radix, dialog responsif, dirty/busy guard, header/body/footer |
| ManagedDialog/requestDialogClose | Penutupan editor native yang menghormati Escape/dirty guard |
| DataForm | Field metadata, native/Zod, payload lama, submit lock dan modal |
| AuthLayout | Komposisi login/aktivasi/pemulihan |
| Breadcrumbs | Jejak halaman dan submodul sesuai role |
| FeatureState/EmptyState | Loading/error/retry dan keadaan daftar kosong |
| ToastRegion/notifySuccess | Feedback sukses tanpa secret atau data pribadi |
| ui-status | Terjemahan status tampilan; nilai persistence tetap sama |

Radix Dialog merupakan satu dependensi runtime langsung tambahan yang diperlukan untuk pola modal shadcn. Chromium/Playwright yang dipakai QA dipasang terpisah di lingkungan pengujian, bukan sebagai dependensi aplikasi atau route publik. Browser fixture tidak dibundel sebagai halaman aplikasi.

## Bukti pengujian

- `npm run check`: lint/typecheck,28unit,13crypto,325hasil integrasi dan production build lulus. Setelah polish frontend, lint/typecheck/build diperiksa ulang dan unit bertambah menjadi29 dengan pengukuran kontras token AA (minimal4,5:1 untuk pasangan teks normal yang diperiksa).
- Matriks browser:174 konfigurasi pada320/375/767/768/1024/1440px, mencakup varian manager admin, guru, halaman publik dan laboratorium komponen sintetis. Tidak ada overflow halaman, page error, console error atau kegagalan API fixture yang tidak diharapkan. Ini174konfigurasi render, bukan174halaman berbeda. [Hasil](bukti/browser-matrix.json).
- Interaksi pada320/375/768/1440px: focus trap/pemulihan fokus, guard tutup dan draft, checkbox multiple, error server mempertahankan form, submit ganda tidak menggandakan callback, Escape saat busy, native editor, drawer mobile dan collapse desktop lulus.
- CRUD master mata pelajaran melalui browser → service aktual → PostgreSQL WASM disposable: create, update dan archive lulus; termasuk penutupan dialog sukses dan targeted refresh.
- Pemeriksaan ulang setelah footer modal dipoles lulus pada empat viewport interaksi dan CRUD master. [Hasil polish](bukti/dialog-polish.json).
- Production server lokal hasil clean build:12pemeriksaan HTTP lulus (beranda, kesiapan,404, liveness, login, akun anonim, cookie/CSRF, penolakan Origin, login fail-closed tanpa DB, dan metode logout). Cache build lokal yang sempat tidak konsisten setelah build tumpang tindih dipisahkan; clean build dan smoke server berhasil.
- Pemeriksaan visual screenshot login desktop, data master desktop dan modal mobile dilakukan. Semua berkas gambar memakai fixture sintetis, tanpa akun, credential atau data pribadi produksi.
- Satu percobaan suite database ketika berjalan bersamaan dengan browser berhenti tanpa laporan assertion lengkap pada proses auth HTTP. Uji terarah auth HTTP kemudian lulus14hasil. Seluruh suite lulus setelah pengujian dibatasi dua file integrasi bersamaan; pembatasan ini juga mengurangi penggunaan resource PostgreSQL WASM.

## Batas penerimaan

- Semua46route telah diaudit dan mendapat penanganan presentasi, tetapi browser otomatis menguji manager bersama pada fixture, bukan setiap URL dengan akun produksi nyata.
- Fixture HTTP hanya tersedia pada localhost di proses tes, menggunakan role/sesi/data sintetis serta service yang sudah ada. Ini bukan bukti middleware auth/CSRF produksi; batas tersebut tetap diuji oleh suite integrasi HTTP yang terpisah.
- Tidak ada email OTP/reminder produksi yang dikirim dan tidak ada mutasi data produksi untuk UAT UI. Pengujian CRUD seluruh modul dengan akun produksi nyata, inbox email, pembaca layar dan perangkat fisik masih memerlukan sesi/penerima uji yang disepakati.
- Pengukuran kontras dan pengujian keyboard tidak berarti sertifikasi WCAG penuh. Dark mode sengaja belum diaktifkan; rilis ini menstandardisasi light mode.
- Sorting/filter/pagination/export yang ada dipertahankan; tidak diperkenalkan kontrak sorting baru pada API yang belum mendukungnya.
- Migrasi data asli, native restore dan cutover bisnis Tahap8 tetap merupakan penerimaan operasional tersendiri.

## Berkas perubahan

Daftar berikut dibuat dari diff terhadap baseline; tidak ada berkas fitur lama yang dihapus. Penambahan/penyempurnaan komponen memusatkan perilaku, bukan menghapus alur bisnis.

### Ditambahkan

- `docs/ui/AUDIT_UI_UX.md`
- `docs/ui/DESIGN_SYSTEM.md`
- `docs/ui/VERIFIKASI_UI_UX.md`
- `docs/ui/bukti/browser-matrix.json`
- `docs/ui/bukti/dialog-polish.json`
- `src/components/feedback/feature-state.tsx`
- `src/components/feedback/toast-region.tsx`
- `src/components/shell/auth-layout.tsx`
- `src/components/shell/breadcrumbs.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/managed-dialog.tsx`
- `src/components/ui/styles.ts`
- `src/lib/ui-status.ts`
- `tests/ui/harness.tsx`
- `tests/ui/navigation-stub.tsx`
- `tests/ui/server.ts`
- `tests/ui/verify.mjs`
- `tests/unit/ui-design.test.ts`

### Dimodifikasi

- `README.md`
- `docs/verification/http-smoke.json`
- `docs/verification/http-smoke.py`
- `package-lock.json`
- `package.json`
- `src/app/aktivasi/page.tsx`
- `src/app/error.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/login/page.tsx`
- `src/app/lupa-password/page.tsx`
- `src/app/not-found.tsx`
- `src/app/page.tsx`
- `src/components/feedback/service-state.tsx`
- `src/components/shell/workspace.tsx`
- `src/components/ui/button.tsx`
- `src/features/activities/workspace.tsx`
- `src/features/auth/account-lifecycle.tsx`
- `src/features/calendar/calendar-manager.tsx`
- `src/features/dashboard/dashboard-view.tsx`
- `src/features/dashboard/live-summary.tsx`
- `src/features/dashboard/module-cards.tsx`
- `src/features/duties/duty-manager.tsx`
- `src/features/finance/finance-manager.tsx`
- `src/features/finance/verify-document.tsx`
- `src/features/masters/master-manager.tsx`
- `src/features/migration/manager.tsx`
- `src/features/operations/managers.tsx`
- `src/features/programs/event-manager.tsx`
- `src/features/programs/exam-manager.tsx`
- `src/features/programs/forms.tsx`
- `src/features/schedules/schedule-manager.tsx`
- `src/features/users/user-manager.tsx`

### Dihapus

Tidak ada.

Screenshot hasil pengujian disimpan untuk peninjauan lokal dan tidak disertakan dalam publikasi GitHub. Laporan teks/JSON di atas merupakan bukti yang disertakan dalam rilis.
