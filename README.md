# SiM-Guru — Pembangunan Ulang

Tahap implementasi saat ini **8.1–8.5: kesiapan migrasi dan cutover**. Migrasi data nyata, restore native dan UAT/cutover masih memerlukan bukti operasional. Stack: Next.js App Router, TypeScript strict, Tailwind CSS, shadcn/ui source components, Zod, Postgres.js dan Argon2id. Vercel untuk hosting; Supabase PostgreSQL/Storage untuk data. Autentikasi dikelola SiM-Guru sendiri, tanpa Central SSO dan tanpa Supabase Auth.

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

`check` mencakup lint, typecheck, unit, crypto, integrasi SQL/HTTP handler dan build. `db:migrate` tanpa --apply hanya menampilkan rencana. `env:check -- all` sengaja gagal sampai layanan opsional yang terkait tahap berikutnya juga diisi. Detail hasil dan batas pengujian terbaru: [Tahap 8](docs/verification/Tahap_8.md).

## Konfigurasi

Gunakan .env.example sebagai daftar nama variabel, bukan credential produksi. APP_URL harus canonical dan HTTPS di production; APP_TIMEZONE=Asia/Jakarta. DATABASE_URL dan AUTH_DATABASE_URL menuju proyek PostgreSQL yang sama dengan LOGIN berbeda, masing-masing hanya anggota role bisnis/auth; bukan owner atau postgres administratif. DB_POOL_MAX default 2 per pool/per instance, SSL production memverifikasi sertifikat (DB_SSL_CA untuk CA Supabase), prepare:false untuk transaction pooling.

SESSION_SECRET, AUTH_CHALLENGE_HMAC_SECRET dan AUTH_OUTBOX_ENCRYPTION_KEY wajib berbeda; key enkripsi 32 byte hex (64 digit), secret lain minimal 32 karakter. Jangan memakai NEXT_PUBLIC_ untuk secret. Konfigurasi email/Storage/cron disiapkan pada tahap terkait.

Cookie sesi HttpOnly, Secure production, SameSite=Lax; tidak ada token/role pada localStorage. Setiap POST auth memakai Origin canonical dan CSRF. Sesi dibaca ulang dari database; scope onboarding tidak mendapat akses bisnis. Rate limit dipersistenkan di PostgreSQL. RLS memakai bukti sesi internal, bukan auth.uid().

## Database dan deployment

Dua puluh tiga migrasi domain tersedia dengan checksum pada ledger aplikasi. CLI apply memakai MIGRATION_DATABASE_URL terpisah, flag --apply dan --allow-remote untuk target remote. Bootstrap admin memakai koneksi operator tersendiri dan input password tersembunyi; tidak ada akun/password default atau seed finansial dummy.

Proyek Supabase dan Vercel telah dibuat. Penerapan remote setiap rilis harus diperiksa terhadap ledger migrasi. Koneksi Vercel→Transaction pooler terverifikasi dengan dua LOGIN terpisah dan verifikasi sertifikat TLS. Bukti runtime dan batas penerimaan ada di docs/verification/Pooler_Production.md. Onboarding, profil, OTP dan pemulihan tersedia pada Tahap1.5; pengiriman nyata menunggu provider email terkonfigurasi. Detail operasional:

- [Deployment Vercel/Supabase](docs/operations/Deployment_Vercel_Supabase.md)
- [Pengiriman OTP dan konfigurasi email](docs/operations/Pengiriman_OTP.md)
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

Tersedia: autentikasi internal, akun/onboarding/OTP dan Gmail SMTP, pengguna, master akademik/tarif/tunjangan, kalender/DayContext, jadwal KBM, kehadiran/izin, rekap siswa, jurnal/ledger, piket/upacara/substitusi/JTM, ujian/BAP dan acara. Tahap6 menambahkan bonus libur, transport, engine honor tunggal, finalisasi/snapshot immutable, koreksi, riwayat/slip/PDF/cetak/XLSX dan verifikasi dokumen publik. Baca [runbook Tahap6](docs/operations/Honorarium_Tahap_6.md).

Tahap7 menyediakan pengumuman, pengaturan, worker/reminder dan scheduler dengan switch pengiriman terpisah. Tahap8 menyediakan staging admin, normalisasi/impor/reconciliation operator, backup terenkripsi dan gate cutover. Baca [runbook migrasi/cutover](docs/operations/Migrasi_Cutover_Tahap_8.md). Data operasional lama, restore native, UAT bisnis dan cutover nyata belum diverifikasi; jangan mengaktifkan seluruh pengiriman sebelum antrean dan penerima ditinjau.

Acuan desain ada di docs/reference; kemajuan aktual di docs/parity/IMPLEMENTATION_STATUS.md. `npm run test:db` memakai PGlite in-memory. `npm run test:db:native` khusus database lokal disposable kosong berakhiran _test; tidak dijalankan otomatis terhadap proyek produksi. Pengujian MCP remote tidak menggantikan uji TCP/pooler dan browser produksi.

Tahap 3.1–3.6: [Kehadiran dan jurnal](docs/operations/Kehadiran_Jurnal_Tahap_3.md) · [Bukti pengujian](docs/verification/Tahap_3.md). Dua belas migrasi, 40 tabel domain FORCE RLS.

Tahap 4.1–4.4: [Piket, upacara dan relokasi JTM](docs/operations/Piket_Upacara_JTM_Tahap_4.md) · [Verifikasi](docs/verification/Tahap_4.md). Tiga belas migrasi, 45 tabel domain FORCE RLS.


Tahap 5.1–5.5: [Ujian, BAP dan acara](docs/operations/Ujian_Acara_Tahap_5.md).

Tahap 6.1–6.5: [Honor, transport dan libur](docs/operations/Honorarium_Tahap_6.md) · [Verifikasi](docs/verification/Tahap_6.md).


## Antarmuka dan design system

Modernisasi UI mempertahankan auth internal, hak akses dan kontrak API. Layout, kontrol, breadcrumb, modal kontekstual serta state feedback menggunakan komponen bersama. [Audit46halaman](docs/ui/AUDIT_UI_UX.md), [pedoman design system](docs/ui/DESIGN_SYSTEM.md) dan [laporan verifikasi UI](docs/ui/VERIFIKASI_UI_UX.md) mencatat cakupan serta batas penerimaan. `npm run test:ui` memakai fixture localhost disposable dan memerlukan Playwright/Chromium eksternal; tidak mengakses data produksi. Pengujian integrasi dibatasi dua file bersamaan untuk menghindari kehabisan sumber daya saat menjalankan PostgreSQL WASM.
