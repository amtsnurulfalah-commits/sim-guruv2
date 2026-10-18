# Operasi fondasi database SiM-Guru

## 1. Uji aman tanpa layanan eksternal

```bash
npm ci
npm run test:db
npm run check
npm run db:migrate
```

PGlite hanya devDependency untuk pengujian in-memory. Data dibuang setelah suite selesai. Tidak mengganti PostgreSQL Supabase sebagai database aplikasi, tidak dibundel ke browser, tidak memakai .env produksi. `test:db` memiliki24 skenario (Node menghitung25 jika test parent disertakan). Rencana migrasi tidak mencoba koneksi.

## 2. Urutan provisioning target nyata

1. Pilih proyek/database SiM-Guru dan buat backup jika sudah berisi data. Role/schema yang namanya bertabrakan dengan pemilik berbeda membuat migrasi berhenti; jangan mengubah owner sistem lain agar lolos.
2. Gunakan koneksi administratif migration yang berhak CREATE ROLE/SCHEMA dan GRANT owner kepada dirinya sendiri. Jangan memakai login runtime business/auth untuk migrasi. Jika privilege managed PostgreSQL tidak cukup, administrator proyek harus menjalankan provisioning yang relevan; jangan menggantinya dengan service-key browser.
3. Isi MIGRATION_DATABASE_URL melalui lingkungan rahasia. Tinjau rencana, lalu jalankan `npm run db:migrate -- --apply` untuk lokal. Untuk target remote yang memang dipilih operator gunakan tambahan `--allow-remote`. SSL aktif pada koneksi remote; skrip tidak mencetak URL/error SQL mentah.
4. Administrator membuat dua LOGIN berpassword acak berbeda melalui kanal administrasi aman, keduanya NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT, hanya member sim_guru_business atau sim_guru_auth masing-masing. Jangan memberi membership owner/bootstrap/worker atau kedua group sekaligus. Migrasi sengaja tidak menghasilkan perintah ALTER ROLE berisi password ke source/log.
5. Berikan CONNECT ke database yang benar jika kebijakan database tidak memberikannya. Pastikan role tidak mewarisi pg_read_all_data/pg_write_all_data atau role luas lain; cek membership transitif. Role runtime tidak memerlukan CREATE pada schema domain.
6. Isi DATABASE_URL dan AUTH_DATABASE_URL sesuai login dan proyek yang sama; `npm run env:check -- database` memeriksa bentuk/role berbeda, bukan membuktikan proyek atau GRANT. Buktikan current_user, role attributes, target database dan privilege melalui koneksi runtime sesungguhnya.
7. Pastikan exposed schemas API tidak mencakup schema domain/private; uji permintaan PostgREST anon secara nyata nanti. Bukti SQL anon dalam suite lokal tidak menggantikan uji HTTP tersebut.
8. Bootstrap admin aplikasi melalui command terkontrol yang akan dibuat1.3, lalu selesaikan lifecycle login/onboarding. Jangan membuat hash placeholder, password123456, atau auto-admin pengguna pertama.

Belum ada langkah provisioning remote di atas yang dijalankan oleh Tahap1.2 ini. Tidak perlu mengisi secret ke pesan obrolan untuk menggunakan pengujian lokal.

## 3. Uji native opsional

Siapkan PostgreSQL lokal **disposable**, database kosong dengan nama berakhiran `_test`, menggunakan akun administrator lokal yang dapat SET SESSION AUTHORIZATION untuk harness. Suite menolak host non-loopback, database bukan `_test`, dan schema app yang sudah ada; tidak otomatis DROP/RESET data lama.

Isi SIM_GURU_TEST_DATABASE_URL secara rahasia lalu:

```bash
npm run test:db:native
```

Suite memakai Postgres.js di satu koneksi, tetapi effective session authorization untuk SQL ACL; belum mencakup multi-pool atau autentikasi LOGIN runtime terpisah. Sebelum produksi, tambahkan/verifikasi kasus dengan login DB nyata dan interleaving beberapa koneksi, terutama status disable, create account, context isolation dan finalisasi pada tahap keuangan. Ketiadaan variabel uji menghasilkan exit nonzero, bukan skip.

## 4. Matriks privilege

| Group | Diizinkan | Ditolak |
|---|---|---|
| sim_guru_business | App helper; SELECT profil sendiri/admin, settings/audit hanya admin | Hash, private tables, create user langsung, role/status update, audit delete, bootstrap, owner SET ROLE |
| sim_guru_auth | EXECUTE lookup/issue/read/touch/revoke session dan account routines allowlist | SELECT table privat langsung, bootstrap, owner SET ROLE |
| sim_guru_bootstrap | EXECUTE bootstrap_admin saja | Login DB langsung; membership untuk runtime tidak diberikan |
| sim_guru_worker | Belum ada grant operasional | Seluruh domain hingga worker scope dibuat pada tahap terkait |
| sim_guru_owner | Pemilik NOLOGIN, policy internal dan routine definer | Tidak digunakan sebagai runtime LOGIN |
| anon/PUBLIC | Tidak mendapat schema/privilege domain | Read hash/profil/setting/audit dan routine privat |

## 5. Context dan penanganan rahasia

BFF memverifikasi cookie/session, lalu membuat context actorId/sessionId/requestId/sessionTokenHash di server. `withBusinessTransaction` dan `withAuthenticatedAuthTransaction` memasang empat setting lokal pada transaksi pinned. Jangan menerima context dari JSON browser. Hash token context bersifat rahasia, tidak boleh masuk audit, error telemetry atau query parameter tracing. Database memvalidasi bukti sesi, bukan percaya role dari body.

Lookup credential hanya untuk layanan auth. Routine issue_session dipanggil setelah verify password+rate limit; routine password change setelah verifikasi password lama/admin recovery sah. DB tidak menjalankan Argon2 dan tidak menganggap bentuk hash sebagai verifikasi password.

## 6. Migrasi lanjutan dan rollback

Jangan edit migration yang sudah tercatat karena checksum akan menolak. Buat file timestamp baru untuk perubahan berikutnya. Kegagalan batch saat apply akan rollback semua perubahan batch, termasuk metadata yang baru dibuat. Tidak menyediakan down migration otomatis yang menghapus akun/kredensial. Rollback operasional menggunakan backup/restore yang direkonsiliasi sebelum ada write baru, atau forward corrective migration, sesuai tahap migrasi produksi.

Seed saat ini tidak membuat user atau menulis data. Tabel master akademik/aktivitas/finance belum dibuat; tidak membuka GRANT umum untuk mempermudah tahap selanjutnya.
