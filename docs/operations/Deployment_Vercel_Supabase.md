# Konfigurasi hosting SiM-Guru v2

## Vercel

Proyek `sim-guruv2` berada di team `amtsnurulfalah-2546` dan mengambil source dari `amtsnurulfalah-commits/sim-guruv2`, branch `main`. Framework Next.js, Node 24.x, install `npm ci`, build `npm run build`, region fungsi `sin1`.

APP_URL production: https://sim-guruv2-amtsnurulfalah-2546.vercel.app . APP_TIMEZONE: Asia/Jakarta. DB_POOL_MAX: 2. SESSION_SECRET, AUTH_CHALLENGE_HMAC_SECRET dan AUTH_OUTBOX_ENCRYPTION_KEY dihasilkan terpisah menggunakan CSPRNG dan disimpan sebagai secret production; nilainya tidak dicatat di repository. Preview tidak mendapat credential production. Perlindungan deployment Vercel tetap memakai pengaturan bawaan.

## Supabase — schema siap, koneksi pooler menunggu host

Proyek `sim-guruv2` (`aeethjbvdaydzdmqhawt`) berhasil dibuat pada organisasi yang dipilih pengguna, region ap-southeast-1, PostgreSQL 17.11. API URL https://aeethjbvdaydzdmqhawt.supabase.co sudah disimpan sebagai SUPABASE_URL production di Vercel. Hambatan kuota pada percobaan sebelumnya sudah tidak menghalangi pembuatan ini.

Empat SQL sumber 001–004 diterapkan atomik melalui MCP apply_migration bernama sim_guru_foundation_through_stage_1_3. Ledger aplikasi sim_guru_migration.schema_migrations tetap berisi empat nama dan SHA-256 asli, agar runner aplikasi tidak mengulang SQL. Supabase memiliki history entry untuk batch tersebut; ini berbeda dari ledger aplikasi. Pemeriksaan remote: 11 tabel, seluruhnya ENABLE dan FORCE RLS, 0 akun aplikasi, advisor security tanpa temuan.

Provisioning tambahan sim_guru_runtime_login_roles membuat sim_guru_business_login dan sim_guru_auth_login. Masing-masing hanya mewarisi sim_guru_business atau sim_guru_auth, tanpa superuser/createdb/createrole/bypassrls/owner, connection limit 10, statement_timeout dan idle_in_transaction_session_timeout 15 detik. Password masih NULL sehingga autentikasi password belum bisa dipakai. Langkah provisioning ini bukan migrasi domain tambahan dan tidak mengubah empat file sumber.

Koneksi production belum selesai. Host Shared Transaction pooler harus disalin dari Dashboard → Connect → Transaction pooler, karena indeks aws-N tidak dapat ditebak dari region. Tool Supabase yang tersedia tidak mengembalikan pooler host. Setelah host tersedia:

1. Generate dua password acak terpisah, set pada masing-masing role LOGIN melalui kanal aman; jangan menaruh password di migration/repository/log.
2. Simpan DATABASE_URL dan AUTH_DATABASE_URL sebagai secret production Vercel, port 6543, user `[role].aeethjbvdaydzdmqhawt`, database postgres, SSL aktif. Postgres.js sudah prepare:false.
3. Uji koneksi TCP, identitas role, transaksi/pool dan larangan akses silang dari runtime Vercel; baru nyatakan database runtime siap. Preview tetap tidak memperoleh credential production.
4. Provision operator bootstrap terpisah saat onboarding admin dijalankan; tidak ada password default. Storage/email disiapkan pada tahap terkait.

Belum ada koneksi runtime teruji, admin aplikasi, email terkirim atau login publik. Health endpoint adalah liveness aplikasi, bukan pemeriksaan database. Login HTTP dibuat pada Tahap 1.4. Hak akses katalog diuji remote; uji HTTP PostgREST anon tetap perlu dilakukan.

## Bukti deployment

Deployment `dpl_66j66Uh1XTjVzK1ig6T6NkFLteBK` dari commit `363a5f2` selesai. Pemeriksaan HTTP berautentikasi Vercel pada 19 Oktober 2026 WIB: beranda 200 berbahasa Indonesia; /api/health 200, phase 1.3, Cache-Control no-store, X-Content-Type-Options nosniff, X-Frame-Options DENY. Ini membuktikan aplikasi berjalan, bukan koneksi Supabase atau login pengguna. Paket native Argon2 belum diuji melalui route produksi karena route autentikasi belum dibuat. Audit dependency production lokal melaporkan 0 kerentanan; log install Vercel menandai 4 high pada dependency keseluruhan yang perlu ditinjau tersendiri.
