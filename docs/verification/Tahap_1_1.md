# Laporan Tahap 1.1 — Fondasi Proyek SiM-Guru

Tanggal: 19 Oktober 2026 WIB | Status: selesai untuk cakupan fondasi lokal.

## Hasil implementasi

- Next.js App Router asli dengan Node.js runtime untuk jalur server, ditujukan ke Vercel.
- TypeScript strict, noUncheckedIndexedAccess dan exactOptionalPropertyTypes; alias @/*.
- Tailwind CSS v4 melalui PostCSS; components.json dan komponen Button/Card/Badge berpola shadcn/ui Radix/new-york dengan util cn.
- Halaman fondasi, status pengembangan, 404, loading, error boundary, favicon dan metadata Indonesia; tidak ada login palsu atau angka finansial dummy.
- Endpoint GET /api/health untuk liveness saja, no-store, requestId UUID dan tanpa detail konfigurasi.
- Zod schema environment per lingkup, CLI env:check, pesan teredaksi; layanan belum terkonfigurasi gagal tertutup.
- Postgres.js server-only dengan pool auth/bisnis terpisah dan lazy initialization; transaction pinned + set_config lokal transaksi; prepare:false dan SSL production.
- Decimal constructor terisolasi untuk persiapan aritmetika domain; belum merupakan mesin honor lengkap.
- Lockfile exact, Node24/npm11, quality scripts serta GitHub Actions workflow yang siap digunakan saat source dihubungkan ke repository.
- Dokumen dasar dan Tahap0.1–0.3 disertakan sebagai snapshot acuan, tanpa mengubah identitas file sumber.

## Versi dependensi langsung

| Paket | Versi terkunci |
|---|---|
| @next/env | 16.4.2 |
| @radix-ui/react-slot | 1.5.0 |
| class-variance-authority | 0.7.1 |
| clsx | 2.1.1 |
| decimal.js | 10.6.0 |
| lucide-react | 1.59.0 |
| next | 16.4.2 |
| postgres | 3.4.9 |
| react | 19.3.1 |
| react-dom | 19.3.1 |
| server-only | 0.0.1 |
| tailwind-merge | 3.7.0 |
| zod | 4.6.7 |
| @eslint/js | 10.0.1 |
| @next/eslint-plugin-next | 16.4.2 |
| @tailwindcss/postcss | 4.3.3 |
| @types/node | 24.19.2 |
| @types/react | 19.3.0 |
| @types/react-dom | 19.3.0 |
| eslint | 10.13.0 |
| eslint-plugin-react-hooks | 7.1.1 |
| globals | 17.13.0 |
| tailwindcss | 4.3.3 |
| tsx | 4.23.15 |
| typescript | 5.9.3 |
| typescript-eslint | 8.71.2 |

## Hasil verifikasi yang benar-benar dijalankan

| Pemeriksaan | Hasil | Batas bukti |
|---|---|---|
| npm ci | Lulus | Instalasi dari lockfile pada lingkungan ini; bukan semua OS/arsitektur |
| npm run lint | Lulus, 0 warning lint | ESLint10 + Next core-web-vitals + TypeScript + React Hooks; bukan audit browser aksesibilitas |
| npm run typecheck | Lulus | Route types digenerate dan TypeScript noEmit |
| npm test | 9/9 lulus | Validasi config negatif/positif, redaksi rahasia, role database, SSL config dan presisi Decimal |
| npm run build | Lulus | Build produksi Turbopack; /, /kesiapan, /_not-found, /icon.svg, /api/health |
| npm run check | Lulus | Rangkaian lint→typecheck→tes→build selesai exit0 |
| npm run env:check -- core | Lulus | Bentuk konfigurasi development; tidak mencoba koneksi |
| npm run env:check -- all | Exit1 sesuai harapan | Auth/database/Storage/mail/jobs belum dikonfigurasi; nilai secret tidak dicetak |
| HTTP smoke hasil next start | 7/7 lulus | Beranda/status/404/health/header; HTTP assertions, bukan browser visual/E2E bisnis |
| package.json/lockfile | Cocok, 26 dependensi langsung exact | Tidak memakai latest/caret pada dependensi langsung |
| npm ls --all | Lulus pada akhir pemeriksaan | Tidak ada invalid peer; artefak optional WASM extraneous lokal dibersihkan |

Runtime verifikasi: Node v24.19.0 dan npm11.9.0. Warning npm mengenai http-proxy berasal dari environment eksekusi dan bukan warning lint. ESLint memakai plugin Next langsung supaya tidak membawa peer plugin yang hanya mendeklarasikan ESLint≤9. Konfigurasi tidak menggunakan --force/--legacy-peer-deps atau menonaktifkan lint/typecheck untuk melewatkan kegagalan.

Evidence: check.log, http-smoke.json, http-smoke.py dalam direktori ini. HTTP smoke dapat diulang setelah build dengan Python3 standar: `python3 docs/verification/http-smoke.py`; server sementara dihentikan setelah pemeriksaan. Percobaan HTTP pertama dari proses eksekusi terpisah tidak dapat mengakses port loopback karena namespace lingkungan; pemeriksaan kemudian dijalankan dengan server dan client dalam proses lingkungan yang sama dan seluruh assertion lulus. Tidak ada pengubahan kontrol jaringan untuk mengatasinya.

## Review React dan batas keamanan

Server Components digunakan default; hanya error boundary menjadi Client Component. Tidak ada fetching client, hooks/state request global, useEffect untuk state turunan, HTML database mentah, ataupun token localStorage. Komponen punya key stabil, ikon dekoratif aria-hidden, main landmark, heading, skip link dan focus-visible pada tombol. Review ini dilakukan pada source; visual mobile/keyboard/browser belum diuji.

Adapter database sudah lolos typecheck tetapi belum diuji commit/rollback/RLS terhadap PostgreSQL nyata. UUID dalam transaction context bukan autentikasi; context hanya boleh berasal dari sesi terverifikasi yang akan dibuat pada1.4. Halaman/health tidak memanggil adapter. Build tanpa secrets diizinkan khusus halaman fondasi; hal itu bukan bukti produksi siap menerima transaksi.

## Belum termasuk dalam tahap ini

- Migrasi SQL, provisioning role, GRANT/RLS, policy helper dan tes isolation database (Tahap1.2).
- Admin bootstrap, hash Argon2id, aktivasi/login/sesi/CSRF/OTP/reset (Tahap1.3–1.5).
- CRUD master, kegiatan, jurnal, BAP, ledger domain, transport, honor dan seluruh F01–F20 operasional.
- Pengiriman email/Storage/job nyata, benchmark Argon2id, import data produksi dan UAT.
- Deployment Vercel atau perubahan repository eksternal. Tidak ada Supabase key/URL database produksi yang digunakan.

## Menjalankan dan langkah berikutnya

Ekstrak arsip, masuk folder sim-guru, gunakan Node24/npm11, jalankan npm ci, salin .env.example menjadi .env.local dan jalankan npm run dev. Halaman awal dapat dibuka tanpa kredensial layanan. Jangan isi .env.example dengan nilai nyata atau commit .env.local.

Tahap berikutnya1.2: buat migrasi schema dan role database minimum, context helper, private lifecycle routines, RLS/GRANT default deny dan pengujian negatif memakai role runtime sungguhan. Fondasi dapat dilanjutkan lokal sebelum ada akses Supabase; provisioning dan integration test memerlukan target database yang dipilih secara eksplisit.
