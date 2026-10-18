# Konfigurasi hosting SiM-Guru v2

## Vercel

Proyek `sim-guruv2` berada di team `amtsnurulfalah-2546` dan mengambil source dari `amtsnurulfalah-commits/sim-guruv2`, branch `main`. Framework Next.js, Node 24.x, install `npm ci`, build `npm run build`, region fungsi `sin1`.

APP_URL production: https://sim-guruv2-amtsnurulfalah-2546.vercel.app . APP_TIMEZONE: Asia/Jakarta. DB_POOL_MAX: 2. SESSION_SECRET, AUTH_CHALLENGE_HMAC_SECRET dan AUTH_OUTBOX_ENCRYPTION_KEY dihasilkan terpisah menggunakan CSPRNG dan disimpan sebagai secret production; nilainya tidak dicatat di repository. Preview tidak mendapat credential production. Perlindungan deployment Vercel tetap memakai pengaturan bawaan.

## Supabase — provisioning tertunda

Organisasi yang dipilih pengguna: `amtsnurulfalah-2546's projects` (`vercel_icfg_Q7pX7gkrZeRAhpt6fRcJR9TE`). Target proyek baru: sim-guruv2, region ap-southeast-1. Pembuatan ditolak karena pemilik sudah menggunakan dua proyek gratis aktif: central-sso-db dan SiM-Asetku. Tidak ada proyek lama yang diubah, di-pause atau dihapus.

Setelah kuota tersedia atau organisasi di-upgrade, lanjutkan:

1. Buat proyek terpisah dan periksa role/privilege PostgreSQL managed sebelum empat migrasi dijalankan.
2. Terapkan migrasi dengan ledger/checksum sesuai prosedur database. Jangan menggunakan login runtime untuk migrasi.
3. Buat LOGIN runtime bisnis dan auth dengan password acak berbeda, masing-masing hanya member sim_guru_business atau sim_guru_auth. Bootstrap operator memakai login terpisah.
4. Simpan DATABASE_URL dan AUTH_DATABASE_URL sebagai secret production di Vercel. Gunakan koneksi pool yang sesuai dan SSL; verifikasi masing-masing identitas role dan transaksi. Jangan gunakan postgres administratif sebagai koneksi runtime.
5. Simpan SUPABASE_URL dan secret Storage hanya saat integrasi Storage disiapkan; tidak mengekspos schema app/auth_private/finance/ops ke Data API.
6. Uji migrasi native, RLS/GRANT, pool/TCP dan secret handling. Redeploy setelah environment disimpan.

Belum ada database runtime, migrasi remote, admin aplikasi, pengiriman email atau login publik. Health endpoint adalah liveness aplikasi, bukan pemeriksaan koneksi database. Login HTTP dibuat pada Tahap 1.4.

## Bukti deployment

Deployment `dpl_66j66Uh1XTjVzK1ig6T6NkFLteBK` dari commit `363a5f2` selesai. Pemeriksaan HTTP berautentikasi Vercel pada 19 Oktober 2026 WIB: beranda 200 berbahasa Indonesia; /api/health 200, phase 1.3, Cache-Control no-store, X-Content-Type-Options nosniff, X-Frame-Options DENY. Ini membuktikan aplikasi berjalan, bukan koneksi Supabase atau login pengguna. Paket native Argon2 belum diuji melalui route produksi karena route autentikasi belum dibuat. Audit dependency production lokal melaporkan 0 kerentanan; log install Vercel menandai 4 high pada dependency keseluruhan yang perlu ditinjau tersendiri.
