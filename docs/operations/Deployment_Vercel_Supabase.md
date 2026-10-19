# Konfigurasi hosting SiM-Guru v2

## Vercel

Proyek `sim-guruv2` berada di team `amtsnurulfalah-2546` dan mengambil source dari `amtsnurulfalah-commits/sim-guruv2`, branch `main`. Framework Next.js, Node 24.x, install `npm ci`, build `npm run build`, region fungsi `sin1`.

APP_URL production: https://sim-guruv2.vercel.app . APP_TIMEZONE: Asia/Jakarta. DB_POOL_MAX: 2. SESSION_SECRET, AUTH_CHALLENGE_HMAC_SECRET dan AUTH_OUTBOX_ENCRYPTION_KEY dihasilkan terpisah menggunakan CSPRNG dan disimpan sebagai secret production; nilainya tidak dicatat di repository. Preview tidak mendapat credential production. Perlindungan deployment Vercel tetap memakai pengaturan bawaan.

## Supabase — schema dan koneksi runtime

Proyek `sim-guruv2` (`aeethjbvdaydzdmqhawt`) berhasil dibuat pada organisasi yang dipilih pengguna, region ap-southeast-1, PostgreSQL 17.11. API URL https://aeethjbvdaydzdmqhawt.supabase.co sudah disimpan sebagai SUPABASE_URL production di Vercel. Hambatan kuota pada percobaan sebelumnya sudah tidak menghalangi pembuatan ini.

Empat SQL sumber 001–004 diterapkan atomik melalui MCP apply_migration bernama sim_guru_foundation_through_stage_1_3. Ledger aplikasi sim_guru_migration.schema_migrations tetap berisi empat nama dan SHA-256 asli, agar runner aplikasi tidak mengulang SQL. Supabase memiliki history entry untuk batch tersebut; ini berbeda dari ledger aplikasi. Pemeriksaan remote: 11 tabel, seluruhnya ENABLE dan FORCE RLS, 0 akun aplikasi, advisor security tanpa temuan.

Provisioning tambahan sim_guru_runtime_login_roles membuat sim_guru_business_login dan sim_guru_auth_login. Masing-masing hanya mewarisi sim_guru_business atau sim_guru_auth, tanpa superuser/createdb/createrole/bypassrls/owner, connection limit 10, statement_timeout dan idle_in_transaction_session_timeout 15 detik. Password acak berbeda telah dipasang sebagai verifier SCRAM; URL koneksi disimpan sebagai sensitive environment production di Vercel. Nilai rahasia tidak disimpan di repository. Langkah provisioning ini bukan migrasi domain tambahan dan tidak mengubah empat file sumber.

Host Transaction pooler yang diberikan pengguna: `aws-0-ap-southeast-1.pooler.supabase.com`, port `6543`, database `postgres`, username `[role].aeethjbvdaydzdmqhawt`. DATABASE_URL dan AUTH_DATABASE_URL memakai LOGIN terpisah; `prepare:false`, DB_POOL_MAX=2. Preview tidak memperoleh credential production.

DB_SSL_CA berisi CA publik Supabase Root 2021 dari sumber resmi. Client mempertahankan `rejectUnauthorized:true` dan memeriksa hostname; tidak ada pengecualian sertifikat. Probe Vercel memverifikasi dua identitas role, hak minimum, adapter sesi, transaksi rate limit rollback dan native Argon2id. Bukti dan batas pemeriksaan: ../verification/Pooler_Production.md.

Belum ada admin aplikasi yang dibuat. Provision operator bootstrap terpisah saat onboarding admin dijalankan; tidak ada password default. Storage/email disiapkan pada tahap terkait. Health endpoint tetap liveness, bukan pemeriksaan database. Uji HTTP PostgREST anon dan acceptance browser masih perlu dilakukan.

## Bukti deployment

Deployment `dpl_66j66Uh1XTjVzK1ig6T6NkFLteBK` dari commit `363a5f2` selesai. Pemeriksaan HTTP berautentikasi Vercel pada 19 Oktober 2026 WIB: beranda 200 berbahasa Indonesia; /api/health 200, phase 1.3, Cache-Control no-store, X-Content-Type-Options nosniff, X-Frame-Options DENY. Ini membuktikan aplikasi berjalan, bukan koneksi Supabase atau login pengguna. Paket native Argon2 belum diuji melalui route produksi karena route autentikasi belum dibuat. Audit dependency production lokal melaporkan 0 kerentanan; log install Vercel menandai 4 high pada dependency keseluruhan yang perlu ditinjau tersendiri.

## Pembaruan Tahap 1.4

Migrasi domain 005 auth_http telah diterapkan dan ledger aplikasi kini berisi lima migrasi. Rate limit, session snapshot dan guard maintenance diverifikasi pada PostgreSQL remote memakai probe yang di-rollback. Tidak ada akun atau counter uji yang tersisa. Login/session/logout HTTP dan halaman /login, /akun sudah diimplementasikan; koneksi runtime telah diverifikasi melalui Transaction pooler. Akun admin nyata dan penerimaan browser interaktif masih menyusul. Rincian terdapat pada Auth_Tahap_1_4.md dan ../verification/Tahap_1_4.md.

## Pembaruan koneksi pooler

Deployment probe `dpl_GY7jrGz3ABfZo4J5pqwqUcGThovS` dari commit `036689d` berstatus READY. `npm run db:verify-runtime` berhasil sebelum build; semua koneksi ditutup setelah probe. Perintah ini adalah pemeriksaan operator opsional, bukan syarat build normal setiap preview. Setelah perubahan password, percobaan awal pooler sempat mengembalikan 28P01; verifikasi ulang berhasil. Database menyimpan verifier SCRAM dan environment menyimpan password sensitif; tidak ada secret dalam hasil probe.
