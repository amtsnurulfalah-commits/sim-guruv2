# Laporan Tahap 1.2 — Fondasi Database SiM-Guru

Tanggal: 19 Oktober 2026 WIB

Status: implementasi fondasi dan verifikasi SQL lokal selesai. Acceptance koneksi native/Supabase, LOGIN DB sebenarnya, pooling paralel dan PostgREST masih belum dilakukan. Tidak ada data/proyek produksi yang diubah.

## 1. Hasil implementasi

- 3 migrasi SQL terurut, 4 schema domain (app/auth_private/finance/ops), dan schema metadata runner sim_guru_migration.
- 5 group role NOLOGIN: owner, business, auth, bootstrap, worker; runtime tidak owner/superuser/BYPASSRLS. Logins dan password DB tidak dibuat otomatis.
- 9 tabel identitas/fondasi: app_users, user_credentials, security_questions, app_sessions, verification_challenges, auth_rate_limits, password_reset_requests, system_settings dan audit_logs. Seluruhnya ENABLE+FORCE RLS dengan policy internal owner dan scope runtime yang eksplisit.
- 15 function SQL termasuk helper actor/onboarding, lookup credential, issue/read/touch/revoke sesi, create account, CAS password replacement, account status dan bootstrap privat.
- Role bisnis hanya membaca profil sesuai actor/admin serta settings/audit admin. Role auth hanya EXECUTE routine allowlist dan tidak mendapat SELECT tabel kredensial langsung. Bootstrap terpisah dari auth/business.
- Actor/session UUID tanpa bukti token hash tidak cukup. Transaksi server memasang empat setting lokal, database memeriksa sesi/version/expiry/onboarding. Hash bukti context tidak dikembalikan ke browser atau log.
- Runner migrasi plan/apply, advisory lock, checksum, kepemilikan metadata dan rollback batch; native SQL adapter terparameter. Plan tidak terkoneksi; remote apply butuh opsi eksplisit.
- Suite SQL WASM, entrypoint native yang terpisah, panduan provisioning, ADR-002 dan status implementasi.
- Halaman status/health diperbarui untuk fase1.2 tanpa form login palsu atau klaim koneksi produksi.

## 2. Daftar migrasi dan checksum

| File | SHA-256 |
|---|---|
| 202610190001_roles_and_schemas.sql | `5a02689b6c7ba930cb9bb9dd6589e662a4475968dbe0885c6812db9961485351` |
| 202610190002_identity_tables.sql | `2285393b5bedbf355acd5120c61e2e53f856d0e9e307887b6aaf345edea28739` |
| 202610190003_auth_routines_and_policies.sql | `513de24ee5b78f7f87fbcee7517321aa9bcd2ee39c1621794953250cc3178ca0` |

## 3. Verifikasi yang benar-benar dijalankan

| Pemeriksaan | Hasil | Batas |
|---|---|---|
| npm ci | Lulus | Instalasi dari lockfile, lingkungan saat ini |
| npm run lint | Lulus,0 warning lint | Bukan audit browser atau penetration test |
| npm run typecheck | Lulus | Termasuk native adapter dan context baru |
| npm test | 9/9 lulus | Tes fondasi konfigurasi/decimal |
| npm run test:db | 24/24 skenario SQL lulus | Node melaporkan25 termasuk test parent; bukan25 skenario terpisah |
| npm run check | Lulus | Lint→typecheck→unit→database WASM→build |
| npm run build | Lulus | Build Next.js produksi, tanpa database/secrets produksi |
| HTTP smoke production build | 7/7 lulus | Header/status/404/health; bukan browser E2E |
| npm run db:migrate | Lulus mode plan |3 file+checksum; tidak apply ke target eksternal |
| Uji native/Supabase/REST | Belum dijalankan | Target/kredensial tidak tersedia; tidak ditandai lulus atau auto-skip |

Engine SQL lokal yang melaporkan versi: PostgreSQL18.6 melalui PGlite0.5.10, wasm32. PostgreSQL native tidak tersedia di environment dan proses non-root tidak dapat dijalankan. PGlite adalah devDependency pengujian, bukan pengganti Supabase untuk aplikasi. Runtime Node v24.19.0/npm11.9.0.

## 4. Skenario SQL DB01–DB24

1. Clean install dan rerun migration idempotent.
2. Attribute role runtime serta larangan membership owner.
3. ENABLE+FORCE RLS seluruh tabel fondasi.
4. Tanpa context/actor palsu/proof salah tidak membaca profil.
5. Guru hanya profil sendiri dan NIP bernol awal tetap teks.
6. Admin vs guru pada profil/settings/audit.
7. Business/auth/anon ditolak membaca tabel privat langsung.
8. Lookup hash hanya routine auth allowlist.
9. Direct INSERT/UPDATE/TRUNCATE/audit DELETE ditolak.
10. Tidak dapat SET ROLE owner atau memanggil bootstrap dari business/auth.
11. Account create atomik, unique username case-insensitive, invalid hash rollback.
12. Account create tetap mengecek admin dan bukti sesi.
13. Onboarding tidak menerbitkan business session atau membaca data bisnis.
14. Context lokal tidak bocor setelah COMMIT/ROLLBACK pada satu koneksi.
15. search_path/temp table caller tidak merusak definer helper.
16. Sesi24jam, idle2jam, touch dibatasi absolut, revoke/expiry efektif.
17. Checksum mismatch dan batch gagal tidak menambah perubahan/metadata.
18. Bootstrap idempotent tidak mengganti hash dan menolak target admin kedua.
19. FK/jarak/hash constraint menolak data invalid.
20. Password replacement CAS, revoke sesi/challenge dan audit teredaksi.
21. Disable akun membatalkan sesi dan issuance berikutnya.
22. Perlindungan admin aktif terakhir.
23. Perubahan auth_version menolak sesi lama tanpa bergantung flag revoked.
24. Default privilege objek/function baru tidak membuka PUBLIC.

## 5. Temuan dan perbaikan selama verifikasi

- Default EXECUTE function milik PUBLIC tidak cukup dicabut per schema: kini ALTER DEFAULT PRIVILEGES global khusus sim_guru_owner mencabutnya; objek lain tidak diubah.
- SET ROLE dari superuser tidak membuktikan larangan perpindahan role. Harness memakai SET SESSION AUTHORIZATION effective runtime dan memulihkan user awal eksplisit; PGlite RESET saja tidak memulihkan effective identity dalam uji ini.
- RLS context diperkuat dengan sessionTokenHash tervalidasi, bukan UUID actor/session saja. Ini delta rancangan yang dijelaskan ADR-002.
- Metadata migration memeriksa owner schema sebelum dipercaya, dan group runtime menolak membership silang dalam group khusus aplikasi.

Hash fixture berformat Argon2id adalah sintetik. Tahap ini tidak mengklaim implementasi hashing/verifikasi password nyata sudah tersedia. Routine issue_session/password change hanya kontrak trusted auth server; rate limit/password verification/HTTP lifecycle pada1.3–1.5 tetap wajib sebelum endpoint dipublikasikan.

## 6. Berkas baru dan perubahan utama

Baru: supabase/migrations/202610190001_roles_and_schemas.sql, 202610190002_identity_tables.sql, 202610190003_auth_routines_and_policies.sql; scripts/migrate.ts; scripts/lib/{sql-database,native-database,migrations}.ts; tests/helpers/{pglite-database,database-suite}.ts; tests/integration/{database,native-database}.test.ts; docs/architecture/ADR-002-database-foundation.md; docs/operations/Database_Tahap_1_2.md; docs/parity/IMPLEMENTATION_STATUS.md; laporan/evidence1.2 ini.

Diubah: package.json/package-lock.json (PGlite devDependency dan command pemeriksaan), .env.example (variabel migrasi/test opsional), src/server/db/transaction.ts (bukti context), README dan README migrations, halaman beranda/kesiapan/health (status1.2), script/evidence HTTP smoke untuk fase1.2. Dokumen dasar dan snapshot Tahap0 tidak ditimpa.

## 7. Batas penerimaan dan langkah berikutnya

Implementasi dan verifikasi lokal dapat dilanjutkan ke Tahap1.3 (Argon2id nyata, command bootstrap, aktivasi awal). Tidak ada akun asli dibuat; tidak ada auth HTTP siap pakai. Pengujian native/Supabase tetap pekerjaan wajib sebelum produksi, meliputi credential LOGIN berbeda, GRANT managed platform, direct/transaction pooling, dua koneksi paralel, REST anon dan bucket Storage nanti. Tes context satu koneksi bukan bukti isolation seluruh pool.

Panduan menjalankan dan provisioning: docs/operations/Database_Tahap_1_2.md. Evidence tersimpan pada docs/verification/stage-1.2. Status modul di docs/parity/IMPLEMENTATION_STATUS.md. Tidak ada T01–T50 yang diklaim selesai end-to-end hanya dari suite SQL ini.
