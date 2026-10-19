# Verifikasi Tahap 1.4

Implementasi meliputi login lokal, sesi cookie HttpOnly, CSRF/Origin, rate limit persisten, guard onboarding/maintenance, status sesi, heartbeat aktivitas, modal logout dan sinkronisasi logout antartab. Tidak ada dashboard bisnis atau registrasi publik.

## Pengujian lokal

`npm run check`: lint, TypeScript strict, 9 unit test, 7 crypto test, 24 skenario SQL fondasi, 10 skenario akun dan 13 skenario HTTP/auth AU01–AU13; kemudian build produksi. Suite database Node menghitung 50 test termasuk tiga parent suite; total skenario substantif adalah 63. Log ada di stage-1.4-check.txt.

AU mencakup hash Argon2 nyata, DTO tanpa token/hash, credential salah/pending/nonaktif/temp expired, CSRF purpose/binding/TTL/Origin/body limit, limit akun persisten antar-instance layanan, batas IP, scope onboarding, polling/heartbeat, maintenance untuk sesi lama, rotasi login, revoke/logout idempotent/replay tab lama, expiry/auth_version, dan fail closed konfigurasi/error internal. SQL berjalan di PostgreSQL WASM/PGlite, bukan pooler Supabase. Verifikasi ulang cookie setelah logout merepresentasikan replay tab lain; belum merupakan uji browser multitab.

HTTP smoke menjalankan next start production build dan urllib dalam proses lingkungan jaringan yang sama. Dua belas pemeriksaan: beranda/kesiapan/404/headers/liveness, form login, redirect akun anonim termasuk streaming redirect Next.js, CSRF/cookie, Origin/CSRF negatif, missing database503 dan logout GET405. Loopback memakai transport HTTP dengan APP_URL origin HTTPS untuk pemeriksaan aturan production, sehingga tidak membuktikan pengiriman cookie browser melalui TLS. Hasil tersimpan di http-smoke.json.

## Pemeriksaan PostgreSQL remote

Migrasi 005 diterapkan pada Supabase dan ledger/checksum diverifikasi: lima migrasi, tanpa akun aplikasi. Probe SQL dalam transaksi rollback menguji cooldown setelah lima gagal, reset sukses, batas 30 usaha IP, penolakan sesi palsu dan hak EXECUTE terpisah. Baris probe dan audit dibatalkan; tidak menyisakan fixture. Advisor security kembali tanpa temuan. Pengujian ini melalui MCP SQL, bukan koneksi TCP dari Vercel.

## Batas penerimaan

Tidak ada akun produksi atau sesi bisnis nyata yang dibuat. Upaya menyiapkan Chromium headless gagal karena unduhan arsip tidak valid, sehingga browser interaktif, fokus modal/keyboard/mobile, BroadcastChannel antar-tab nyata, race koneksi PostgreSQL native, dan alur Vercel→pooler→data masih perlu acceptance ketika host pooler tersedia. Kehadiran komponen UI dan tes handler tidak disamakan dengan bukti browser tersebut. Route produksi kini memuat paket native Argon2; verifikasi deployment memastikan endpoint dapat dimuat, tetapi benchmark hash di fungsi Vercel tetap belum dilakukan.

Tahap 1.5 berikutnya: onboarding lengkap dan pemulihan akun. Kesiapan produksi login tetap bergantung pada koneksi database runtime, bukan sekadar deployment halaman.
