# ADR-002 — Fondasi database dan bukti context sesi

Status: SQL dan privilege diuji pada engine PostgreSQL WASM (PGlite); koneksi native/Supabase belum diverifikasi.

## Keputusan

- Empat schema domain dipisah; metadata runner pada sim_guru_migration tidak dibaca role runtime.
- Group database NOLOGIN berbeda dari role aplikasi admin/guru. Group auth hanya EXECUTE allowlist routine; business hanya SELECT kolom/profil sesuai RLS. Tidak memberi owner/superuser/BYPASSRLS kepada runtime.
- Tabel identitas ENABLE dan FORCE RLS; policy owner_internal hanya untuk pemilik NOLOGIN agar routine SECURITY DEFINER dapat membaca tanpa rekursi. Runtime tidak menjadi member owner. RLS bukan pelindung dari administrator/owner yang sudah menguasai database.
- Helper/routine SECURITY DEFINER dimiliki role owner khusus, semua objek di-body dikualifikasi schema dan search_path=pg_catalog. EXECUTE PUBLIC dicabut, termasuk default privilege global function baru.
- Actor GUC UUID saja terlalu lemah sebagai bukti context. Adapter transaksi kini juga memasang app.session_token_hash secara lokal, lalu helper memvalidasi actor/session/token hash, auth_version, expiry, scope dan onboarding pada database. Ini penguatan dari rancangan0.3, bukan integrasi penyedia identitas lain.
- session_token_hash diperlakukan sebagai rahasia bearer di server: tidak dikirim ke client, tidak dicatat pada log/query tracing dan tidak dibaca role bisnis. GUC bukan pertahanan dari BFF/auth runtime yang sudah dibajak; SQL terparameter dan session verification server tetap wajib.
- Routine issue_session dan set_password_after_verification adalah internal trusted-auth contracts. CAS hash/version menghindari hasil verifikasi usang, bukan bukti password benar. Argon2id verification, dummy verify, throttling dan HTTP lifecycle dibuat pada1.3–1.5. Hash fixture hanya sintetik berformat benar.
- Bootstrap memakai group NOLOGIN terpisah dan routine satu admin awal; script input rahasia/hashing belum dibuat sampai1.3. Tidak ada akun asli/admin default yang disediakan oleh migration/seed.
- Migrasi dijalankan satu batch atomik dengan advisory lock, metadata checksum, penolakan applied migration yang hilang/berubah, serta pemeriksaan pemilik schema metadata. Runner plan tidak terhubung DB dan remote apply membutuhkan opsi eksplisit.

## Bukti dan batas

24 skenario DB mengecek SQL nyata pada engine WASM, termasuk deny/row filtering, private routines, atomisitas, version revoke dan context rollback/commit. Harness memakai SET SESSION AUTHORIZATION untuk effective role nonsuperuser dan mengembalikan nama administrator awal secara eksplisit; RESET SESSION AUTHORIZATION saja pada PGlite tidak memulihkan effective user di pengujian ini. Jangan menganggap SET ROLE dari koneksi superuser cukup untuk menguji larangan SET ROLE lainnya.

PGlite mempunyai satu koneksi eksklusif. Pengujian ini bukan bukti login SCRAM dengan credential runtime nyata, pool reuse antarTCP koneksi, interleaving paralel, native PostgreSQL extension compatibility, PostgREST anon endpoint, Storage, atau Supabase deployment. Suite native tersedia terpisah dan sengaja gagal bila URL uji tidak diisi; tidak auto-skip menjadi hasil lulus.

Rujukan primer yang diperiksa:
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- https://www.postgresql.org/docs/current/sql-createfunction.html
- https://supabase.com/docs/guides/database/postgres/roles
- https://pglite.dev/docs/
- https://pglite.dev/docs/api
