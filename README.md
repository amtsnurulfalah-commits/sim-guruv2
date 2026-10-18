# SiM-Guru — Pembangunan Ulang

Tahap saat ini **1.3: hash password, bootstrap dan aktivasi internal**, dengan pengujian SQL lokal PostgreSQL WASM. Stack: Next.js App Router, TypeScript strict, Tailwind CSS, shadcn/ui source components, Zod dan Postgres.js. Target hosting Vercel dengan Supabase PostgreSQL/Storage. Autentikasi internal akan dibuat pada tahap berikutnya; tanpa Central SSO dan tanpa Supabase Auth.

## Menjalankan

Gunakan Node24 (lihat .nvmrc) dan npm11. Semua dependensi langsung dikunci versi exact; instalasi ulang memakai lockfile.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Buka http://localhost:3000. Halaman /kesiapan menjelaskan fitur yang belum tersedia. GET /api/health memeriksa liveness proses saja; tidak memeriksa database, email, akun atau kelayakan transaksi.

## Pemeriksaan

```bash
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
npm run db:migrate
npm run env:check -- core
npm run env:check -- all
```

Opsional setelah build: `python3 docs/verification/http-smoke.py` untuk HTTP smoke dengan Python3 standar.

`all` sengaja keluar nonzero sampai konfigurasi layanan lengkap. Tidak mencetak nilai secret/URL. Core development memakai URL localhost dan timezone WIB; production wajib APP_URL HTTPS. Build halaman fondasi bisa berjalan tanpa database; kesiapan bisnis/auth tetap ditolak jika secret/URL hilang.

## Konfigurasi dan provisioning

.env.example berisi nama variabel saja. DATABASE_URL dan AUTH_DATABASE_URL harus ke PostgreSQL aplikasi yang sama dengan role berbeda, bukan owner. Supabase URL/password harus berasal dari proyek yang dipilih nanti; tidak ada proyek yang diprovision pada 1.1. Jangan gunakan URL contoh sebagai koneksi produksi. DB_POOL_MAX default2 per pool/per instance. SSL production true; tidak memakai rejectUnauthorized:false. prepare:false dipilih agar dapat diuji dengan transaction pooling.

Adapter server-only berada di src/server/db. withBusinessTransaction memasang actor/session/request/sessionTokenHash melalui set_config(...,true) pada transaksi yang sama. Hanya boleh dipanggil setelah sesi terverifikasi; belum ada endpoint yang memakainya. RLS, GRANT dan routine identitas sudah diuji dengan engine PostgreSQL WASM pada1.2; native PostgreSQL, pool TCP dan Supabase nyata belum diuji. Token/hash/OTP/role tidak disimpan localStorage.

MAIL_PROVIDER/MAIL_API_KEY/MAIL_FROM, Supabase key, HMAC/encryption/session dan cron secret belum dipakai untuk layanan nyata. Schema hanya memeriksa kesiapan bentuk; provider/bucket/job dibuat pada tahap terkait. AUTH_OUTBOX_ENCRYPTION_KEY berupa 32 byte hex (64 digit); secret lain minimal32 karakter berbeda. Tidak menyimpan nilai nyata dalam dokumentasi/source.

## Target Vercel

Root Directory menunjuk folder proyek ini, Framework Preset Next.js, Node24, Install `npm ci`, Build `npm run build`. Sebelum menghubungkan produksi, jalankan seluruh check dan provisioning layanan sesuai tahap. Tidak ada vercel.json cron atau deployment ID rekaan; belum deploy pada 1.1. Jangan mengatur static export karena aplikasi target membutuhkan server transaction/auth.

## Cakupan

Tersedia: konfigurasi proyek, UI dasar berbahasa Indonesia, halaman status/404/loading/error, favicon, health liveness, schema environment, adapter koneksi/transaksi terpisah, Decimal domain dasar, tes validasi konfigurasi.

Tersedia pada1.2: tiga migrasi identitas, group role terpisah, RLS/GRANT, routine privat, runner checksum dan24 skenario SQL lokal.

Belum tersedia: provisioning Supabase/native, login/aktivasi HTTP, command admin, CRUD master, kegiatan/jurnal/BAP/ledger/honor, email/Storage/jobs serta deployment. Tidak ada seed kredensial, data finansial dummy, maupun tombol login palsu.

Acuan versi dokumen dalam docs/reference; ADR teknis dalam docs/architecture. Periksa docs/verification/Tahap_1_2.md untuk hasil perintah yang benar-benar dijalankan dan batasnya.

## Migrasi dan pengujian database

`npm run db:migrate` hanya rencana tanpa koneksi. Apply memakai MIGRATION_DATABASE_URL terpisah dan flag --apply; remote perlu --allow-remote eksplisit. Migrasi tidak membuat LOGIN/password DB atau akun admin asli. Baca docs/operations/Database_Tahap_1_2.md sebelum provisioning.

`npm run test:db` menjalankan PGlite in-memory tanpa Supabase. `npm run test:db:native` terpisah, memerlukan database lokal kosong berakhiran _test; ketiadaan URL adalah error, bukan skip. Test native tidak termasuk npm run check sampai target tersedia. RLS memakai bukti sesi internal, bukan auth.uid(). Business/auth group tidak memiliki SELECT tabel privat langsung.

## Tahap 1.3

Argon2id nyata, bootstrap operator terpisah, aktivasi sekali pakai dan encrypted outbox tersedia sebagai layanan internal. Login publik menyusul pada Tahap 1.4. Baca [prosedur operator](docs/operations/Bootstrap_Tahap_1_3.md) dan [hasil verifikasi](docs/verification/Tahap_1_3.md). Tidak ada akun atau email nyata yang dibuat otomatis.
