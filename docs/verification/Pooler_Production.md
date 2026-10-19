# Verifikasi koneksi produksi Supabase

Tanggal: 19 Oktober 2026. Proyek Supabase `aeethjbvdaydzdmqhawt`, Vercel `sim-guruv2`.

## Konfigurasi

- Host Transaction pooler: `aws-0-ap-southeast-1.pooler.supabase.com:6543`, database `postgres`.
- LOGIN bisnis/auth terpisah; password acak berbeda, environment sensitive production saja. Tidak memakai LOGIN postgres administratif.
- Postgres.js: prepare:false, maksimum dua koneksi per pool per instance, TLS dengan rejectUnauthorized:true.
- CA publik resmi: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt . Supabase Root 2021, berlaku hingga 26 April 2031. SHA-256: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.
- APP_URL: https://sim-guruv2.vercel.app . Alias login diarahkan ke origin canonical ini.

## Probe lingkungan build Vercel

Deployment `dpl_GY7jrGz3ABfZo4J5pqwqUcGThovS`, commit `036689ded7f4d23f00af998af9535725756b0357`, READY. Menjalankan `NODE_ENV=production npm run db:verify-runtime` sebelum build. Hasil JSON: pooler-runtime-probe.json.

Kedua current_user dan membership benar, tidak owner/superuser/bypassrls, dan tidak bisa SELECT credential secara langsung. Query bisnis tanpa bukti sesi mengembalikan nol baris; karena database juga belum memiliki pengguna, ini hanya pemeriksaan konsistensi runtime, bukan bukti isolasi antar-pengguna berisi data. Penolakan RLS yang lebih lengkap diuji pada suite SQL sebelumnya.

Adapter auth menolak token sesi acak; penulisan rate limit dilakukan dalam transaksi yang sengaja di-rollback. Native Argon2id berhasil membuat dan memverifikasi hash sintetis. Semua client ditutup setelah probe. Tidak ada akun aplikasi atau sesi pengguna dibuat.

pg_stat_ssl pada kedua koneksi backend melaporkan false. Nilai ini menggambarkan sisi pooler→PostgreSQL, bukan sisi aplikasi→pooler. TLS aplikasi→pooler diverifikasi oleh Node dengan CA dan hostname; laporan ini tidak mengklaim TLS backend pooler aktif.

Kegagalan awal SELF_SIGNED_CERT_IN_CHAIN diselesaikan dengan CA resmi. Dua verifier SCRAM menggunakan parameter default database 4096 dan password acak kuat. Percobaan 28P01 setelah perubahan password hilang pada verifikasi ulang; penyebab internal pooler tidak dibuktikan. Verifier dan URL rahasia tidak dicatat.

## Pemeriksaan lokal dan batas

`npm run check` lulus setelah perubahan TLS: 10 unit, 7 crypto, 24 skenario fondasi database, 10 akun, 13 HTTP/auth (64 skenario substantif). Log: pooler-tls-check.txt. Tidak ada perubahan pada lima file migrasi yang sudah diterapkan.

Browser interaktif, fokus modal/keyboard/mobile, BroadcastChannel antartab nyata, login sukses pengguna produksi dan onboarding lengkap belum diverifikasi. Database tetap tanpa akun aplikasi. Tahap 1.5 belum dijalankan. Health200 saja tidak membuktikan kesiapan database.

## HTTPS fungsi produksi

`python docs/verification/production-auth-smoke.py` lulus tujuh pemeriksaan terhadap https://sim-guruv2.vercel.app . Hasil: production-auth-smoke.json. Health fase1.4 dan form login200, CSRF200/no-store/cookie Secure dan HttpOnly, Origin asing403, username acak melalui database auth ditolak401 INVALID_CREDENTIALS tanpa cookie sesi, serta sesi anonim401 UNAUTHENTICATED.

Probe ini memakai klien HTTPS dengan cookie jar, bukan browser interaktif. Percobaan login gagal menghasilkan audit kegagalan dan counter rate limit produksi; tidak membuat akun atau sesi. Request ID tercatat pada JSON untuk penelusuran. Uji ini membuktikan jalur HTTPS→fungsi Vercel→pooler→auth database, bukan login sukses pengguna nyata.
