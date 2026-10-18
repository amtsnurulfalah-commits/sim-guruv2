# Hasil Tahap 1.3 — akun, password dan bootstrap

Implementasi: Argon2id asli (memory 19456 KiB, time 2, parallelism 1, salt acak, digest 32 byte), kebijakan 8–128 code point tanpa trim/normalisasi password, dummy hash saat credential tidak ditemukan, serta rehash CAS yang mempertahankan parameter lebih kuat dan tidak mengubah password_changed_at/sesi.

Migrasi 004 menambahkan aktivasi dan encrypted outbox minimal, mengganti validator PHC agar menerima urutan parameter keluaran native, dan memperketat bootstrap idempotent. Tiga migrasi sebelumnya tidak diubah. Bootstrap CLI memisahkan credential operator dan tidak menyediakan password default atau argumen password.

## Bukti eksekusi

- `npm run check`: lulus lint, typecheck, 9 unit test lama, 7 tes kriptografi CR01–CR07, 24 skenario SQL DB01–DB24 dan 10 skenario akun AC01–AC10, kemudian production build. Node test runner menghitung 36 pada suite database termasuk dua parent test.
- HTTP smoke: 7 pemeriksaan lulus terhadap `next start`; health fase 1.3, header keamanan, halaman dan 404. Ini bukan QA browser interaktif.
- Bootstrap mode rencana dijalankan tanpa koneksi database/akun nyata.
- Benchmark native Argon2 lokal: lihat `argon2-local-benchmark.json`; 12 hash, 12 verify dan 4 verify bersamaan. Tidak mewakili kapasitas atau SLA Vercel.
- Bukti check: `stage-1.3-check.log`. SQL dijalankan memakai PGlite PostgreSQL WASM; bukan server PostgreSQL native atau Supabase.

AC mencakup bootstrap TTL/idempotensi, invite atomik, rollback encryption, token salah/kedaluwarsa, aktivasi sekali pakai, reissue, konflik email rollback, konsumsi ulang, privilege role, serta CAS rehash. Pengujian konsumsi ulang menggunakan antrean satu koneksi; race dua koneksi nyata belum terbukti.

## Batas penerimaan

Belum ada login/cookie/logout HTTP (Tahap 1.4), endpoint aktivasi publik/rate limit/OTP/recovery/email worker (Tahap 1.5), atau CRUD UI admin (Tahap 2.1). Tidak ada database produksi, admin nyata, email terkirim atau deployment yang dibuat. Kesiapan native PostgreSQL/pooling dan paket native Argon2 pada Vercel tetap perlu diuji pada target nyata. `serverExternalPackages` mencakup argon2; build lokal lulus, tetapi route publik belum memuatnya.

Referensi implementasi: https://github.com/ranisalt/node-argon2 dan https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html ; kontrak proyek terdapat pada docs/reference Tahap 0.2–0.3.
