# Tabulasi halaman Akun dan Profil

Branch `feat/account-profile-tabs`, berbasis `main` pada `3955703`.

## Perubahan dan dampak

- `src/components/ui/tabs.tsx`: komponen tab reusable, navigasi keyboard,
  ARIA, empat kolom desktop/dua kolom mobile, panel mounted tetapi tersembunyi
  dan keluar dari navigasi keyboard ketika tidak aktif.
- `src/features/auth/account-lifecycle.tsx`: empat panel sesuai fungsi, formulir
  profil/kata sandi inline, label submit spesifik. Challenge OTP dan draf tetap
  ada saat berpindah tab. Prop inline opsional mempertahankan modal pemanggil lama.
- `src/features/auth/session-panel.tsx`: judul halaman Akun dan profil.
- `tests/ui/harness.tsx`, `tests/ui/server.ts`, `tests/ui/verify.mjs`: fixture akun
  bisnis/onboarding serta pengujian tab, keyboard, draf, OTP sintetis, dan viewport.
- `docs/ui/DESIGN_SYSTEM.md`: aturan komponen dan pengamanan draf.

Semua handler autentikasi, payload, CAS versi profil, CSRF, RBAC, kewajiban
kata sandi saat ini, OTP email, dan pengakhiran sesi dipertahankan. Tidak ada
perubahan database/backend. Tidak ada dependensi aplikasi baru. Draf hanya ada
dalam DOM panel yang mounted, tidak dipersistenkan ke storage atau URL.

## Verifikasi

- Lint dan TypeScript lulus.
- Unit 30, crypto/adapter/API/export 24, SQL integration 325: seluruh 379 lulus.
- Build produksi lulus setelah mengganti cache Turbopack lama yang tidak kompatibel.
- Suite browser lulus: 252 kombinasi halaman/role/viewport pada 320, 375, 767,
  768, 1024, 1440, dan 1920px; 4 ukuran interaksi dan 1 CRUD existing.
- Empat skenario tab akun lulus: keyboard/roving tabIndex, satu panel terlihat,
  retensi draf, dan tab awal onboarding pada 320/768/1440px; ditambah satu
  alur OTP sintetis yang mempertahankan challenge setelah berpindah tab.
- Tidak ada page error, console error tak terduga, atau overflow halaman.
- Modal pemanggil ActionForm lama dan pengujian double submit tetap lulus.

Pengujian UI memakai fixture localhost disposable. Permintaan email diintersep
sebagai respons sintetis dan tidak mengirim email/OTP nyata. Pemeriksaan perangkat
fisik, pembaca layar, dan UAT perubahan kredensial produksi tidak dilakukan.
