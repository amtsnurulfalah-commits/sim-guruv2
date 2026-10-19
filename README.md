# SiM-Guru — Pembangunan Ulang

Tahap saat ini **2.4: jadwal KBM**. Stack: Next.js App Router, TypeScript strict, Tailwind CSS, shadcn/ui source components, Zod, Postgres.js dan Argon2id. Vercel untuk hosting; Supabase PostgreSQL/Storage untuk data. Autentikasi dikelola SiM-Guru sendiri, tanpa Central SSO dan tanpa Supabase Auth.

## Menjalankan

Gunakan Node 24 dan npm 11. Dependensi langsung dikunci versi exact.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Buka http://localhost:3000. `/login` menampilkan form, `/akun` memeriksa sesi dan status onboarding, `/kesiapan` menjelaskan cakupan fitur, `/dashboard` memerlukan sesi business dan `/modul/[slug]` menampilkan status modul sesuai peran. GET `/api/health` hanya memeriksa liveness, bukan koneksi database atau kesiapan login. Tanpa secret/koneksi database yang lengkap, permintaan login ditolak dengan aman.

## Pemeriksaan

```bash
npm run check
python3 docs/verification/http-smoke.py
npm run db:migrate
npm run env:check -- core
npm run env:check -- all
```

`check` mencakup lint, typecheck, unit, crypto, integrasi SQL/HTTP handler dan build. `db:migrate` tanpa --apply hanya menampilkan rencana. `env:check -- all` sengaja gagal sampai layanan opsional yang terkait tahap berikutnya juga diisi. Detail hasil dan batas pengujian: [Tahap 2.4](docs/verification/Tahap_2_4.md).

## Konfigurasi

Gunakan .env.example sebagai daftar nama variabel, bukan credential produksi. APP_URL harus canonical dan HTTPS di production; APP_TIMEZONE=Asia/Jakarta. DATABASE_URL dan AUTH_DATABASE_URL menuju proyek PostgreSQL yang sama dengan LOGIN berbeda, masing-masing hanya anggota role bisnis/auth; bukan owner atau postgres administratif. DB_POOL_MAX default 2 per pool/per instance, SSL production memverifikasi sertifikat (DB_SSL_CA untuk CA Supabase), prepare:false untuk transaction pooling.

SESSION_SECRET, AUTH_CHALLENGE_HMAC_SECRET dan AUTH_OUTBOX_ENCRYPTION_KEY wajib berbeda; key enkripsi 32 byte hex (64 digit), secret lain minimal 32 karakter. Jangan memakai NEXT_PUBLIC_ untuk secret. Konfigurasi email/Storage/cron disiapkan pada tahap terkait.

Cookie sesi HttpOnly, Secure production, SameSite=Lax; tidak ada token/role pada localStorage. Setiap POST auth memakai Origin canonical dan CSRF. Sesi dibaca ulang dari database; scope onboarding tidak mendapat akses bisnis. Rate limit dipersistenkan di PostgreSQL. RLS memakai bukti sesi internal, bukan auth.uid().

## Database dan deployment

Sepuluh migrasi domain tercatat dengan checksum pada ledger aplikasi. CLI apply memakai MIGRATION_DATABASE_URL terpisah, flag --apply dan --allow-remote untuk target remote. Bootstrap admin memakai koneksi operator tersendiri dan input password tersembunyi; tidak ada akun/password default atau seed finansial dummy.

Proyek Supabase dan Vercel telah dibuat. Sepuluh migrasi SQL remote sudah diterapkan. Koneksi Vercel→Transaction pooler terverifikasi dengan dua LOGIN terpisah dan verifikasi sertifikat TLS. Bukti runtime dan batas penerimaan ada di docs/verification/Pooler_Production.md. Onboarding, profil, OTP dan pemulihan tersedia pada Tahap1.5; pengiriman nyata menunggu provider email terkonfigurasi. Detail operasional:

- [Deployment Vercel/Supabase](docs/operations/Deployment_Vercel_Supabase.md)
- [Login, sesi, CSRF, rate limit dan logout](docs/operations/Auth_Tahap_1_4.md)
- [Kerangka UI dan dashboard](docs/operations/UI_Tahap_1_6.md)
- [Jadwal KBM](docs/operations/Jadwal_Tahap_2_4.md)
- [Kalender dan konteks hari](docs/operations/Kalender_Tahap_2_3.md)
- [Master sekolah dan akademik](docs/operations/Master_Tahap_2_2.md)
- [Manajemen pengguna](docs/operations/Pengguna_Tahap_2_1.md)
- [Bootstrap operator](docs/operations/Bootstrap_Tahap_1_3.md)
- [Fondasi database](docs/operations/Database_Tahap_1_2.md)

Vercel memakai root proyek ini, Next.js, Node24, install npm ci, build npm run build, region fungsi sin1. Jangan mengaktifkan static export. Preview tidak mendapat credential database production.

## Cakupan dan langkah berikutnya

Tersedia: fondasi aplikasi, migrasi identitas/privilege/RLS, Argon2id, CLI bootstrap, aktivasi internal/encrypted outbox, login/session/logout HTTP dan status onboarding. Tahap1.5 menambahkan profil, ganti password, onboarding, OTP, pemulihan email/admin dan worker outbox minimum; lihat docs/operations/Akun_Tahap_1_5.md. Pengiriman email produksi masih menunggu provider dan sender terverifikasi. Tahap1.6 menambahkan shell responsif, sidebar, dashboard sesuai peran dan halaman status modul. Tahap2.1 menambahkan manajemen pengguna admin, pencarian/filter/pagination, profil/peran/status, aktivasi dan keputusan pemulihan; lihat docs/operations/Pengguna_Tahap_2_1.md. Tahap2.2 menambahkan identitas sekolah, tahun/semester, kelas/standar siswa, mata pelajaran serta versi tarif/tunjangan. Tahap2.3 menambahkan kalender tunggal/rentang, DayContext bersama, preview/commit dan audit; belum membuat jurnal/bonus otomatis. Tahap2.4 menambahkan jadwal KBM, pemeriksaan bentrok guru/kelas, rekap sesuai filter, jadwal pribadi/hari ini dan penghentian massal atomik. Belum tersedia: ringkasan kegiatan/keuangan dan modul bisnis lainnya, kegiatan/jurnal/BAP/ledger/honor, serta integrasi Storage/jobs lengkap.

Acuan desain ada di docs/reference; kemajuan aktual di docs/parity/IMPLEMENTATION_STATUS.md. `npm run test:db` memakai PGlite in-memory. `npm run test:db:native` khusus database lokal disposable kosong berakhiran _test; tidak dijalankan otomatis terhadap proyek produksi. Pengujian MCP remote tidak menggantikan uji TCP/pooler dan browser produksi.
