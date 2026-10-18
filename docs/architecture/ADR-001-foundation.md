# ADR-001 — Fondasi Next.js dan transaksi SQL

Status: diterapkan pada struktur; integrasi database belum diuji.

- Next.js App Router asli + Node runtime untuk SQL/auth, ditujukan ke Vercel. Tidak mengganti stack menjadi Vinext/Workers.
- TypeScript strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes; ESLint10 terpisah dari build, tidak diabaikan saat error. Konfigurasi langsung @next/eslint-plugin-next (recommended + core-web-vitals), typescript-eslint dan react-hooks dipakai agar dependency peer cocok; tidak memakai eslint-config-next yang membawa plugin dengan peer hanya sampai ESLint9. Pemeriksaan aksesibilitas dasar dilakukan pada review source; belum memakai jsx-a11y/browser audit.
- Tailwind v4 lewat PostCSS; komponen source-owned mengikuti pola shadcn/ui Radix/new-york. components.json mempertahankan alias agar komponen berikutnya dapat ditambahkan. Button memakai Radix Slot; Card/Badge disesuaikan dengan semantik section/h2.
- Postgres.js dipilih untuk tagged queries, begin transaction pada koneksi pinned, SET LOCAL dan pool terbatas. prepare:false untuk kompatibilitas pool transaction. numeric tetap string bawaan; tidak mengubah ke float. decimal.js constructor terisolasi untuk domain berikutnya.
- Lazy connection: build dan halaman status tidak memerlukan DB/secrets. Fungsi yang membutuhkan layanan memanggil requireEnvironment per lingkup dan gagal tertutup jika konfigurasi hilang.
- Koneksi auth/bisnis dipisah, validasi username DB berbeda. URL host bisa berbeda direct/pool; kesamaan proyek database serta GRANT harus dibuktikan pada 1.2.
- Context transaksi hanya input server yang telah diautentikasi pada 1.4. UUID parse bukan bukti auth. Tidak ada API bisnis/login sementara yang menerima context client.
- Halaman publik hanya status tahap. Tidak menyajikan dashboard guru palsu atau login yang belum bekerja.

Rujukan resmi yang dibaca pada penyusunan:
- https://nextjs.org/docs/app/getting-started/installation
- https://nextjs.org/docs/app/api-reference/config/eslint
- https://tailwindcss.com/docs/installation/framework-guides/nextjs
- https://ui.shadcn.com/docs/installation/manual
- https://github.com/porsager/postgres

Versi aktual ada pada package.json/package-lock.json. Adapter query compile bukan bukti commit/rollback/RLS sudah teruji; itu acceptance 1.2 dengan PostgreSQL nyata.
