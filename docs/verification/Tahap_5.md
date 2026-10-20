# Verifikasi Tahap 5.1–5.5

Implementasi dan alur ada di [runbook](../operations/Ujian_Acara_Tahap_5.md). Empat migrasi baru memperluas occurrence bertipe sumber serta ledger yang sama, menambah8tabel ujian/pratinjau dan4tabel acara. Seluruh57tabel pada schema app/auth_private/ops/finance wajib FORCE RLS; assertion khusus tiga schema nonfinance berubah41→53.

`tests/integration/programs.test.ts` mencakup upgrade/idempotensi, batas admin/onboarding, hierarki dan kelas gabungan, bentrok guru/ruang/sesi, konfirmasi panitia, BAP dan batas waktunya, integer/jumlah siswa, pemilik, submit/edit/versi/reversal, basis0, konservasi alokasi, fingerprint/actor/replay, BAP terkunci, batas akhir periode/final guard, template UJIAN, PC/PCT/rekap, substitusi dan absensi harian, hapus cascade, acara bertanggal, interval hadir, peserta guru, pemilik jurnal, blok, H-1, snapshot/ledger atomik, penghapusan dengan reversal, ledger immutable serta guard HTTP/CSRF/payload.

Seluruh regresi lama dijalankan bersama lint, typecheck, unit, crypto dan build. Hasil akhir dicatat pada `stage-5-check.txt` dan `stage-5-results.json` setelah verifikasi selesai. Bukti lokal bukan klaim UAT browser produksi atau race native dua koneksi.

Migrasi ujian dibagi menjadi inti schema/ledger dan API/integrasi kehadiran untuk membatasi ukuran panggilan konektor. Urutan: `20261020014753_exams_bap_stage5.sql`, `20261020015111_events_journals_stage5.sql`, `20261020022247_exam_api_attendance_stage5.sql`, `20261020045419_exam_attendance_guards_stage5.sql`. Keempatnya harus diterapkan sebelum publikasi UI Tahap5.

Hasil akhir lokal: lint/typecheck,22unit,12crypto,271pengujian runner database (termasuk14parent) dan build semuanya lulus — total305runner/291skenario substantif. Suite Tahap5 berisi24runner/23skenario substantif, termasuk probe rollback yang juga diuji pada PGlite. Build sebelumnya pernah gagal akibat cache persistence Turbopack korup; pemeriksaan akhir pada `stage-5-check.txt` lulus seluruh rangkaian.

Keempat migrasi kini sudah diterapkan dan checksum cocok. Dua migrasi terakhir dijalankan melalui SQL Editor dashboard Supabase setelah konektor berulang kali gagal sebelum SQL mencapai PostgreSQL. Transaksi memeriksa semua checksum terdahulu dan mencatat hasil ke ledger domain. Ledger domain kini17migrasi,57tabel FORCE RLS; advisor keamanan0temuan. Payload dashboard yang sudah diterapkan disimpan pada `stage-5-applied-dashboard-migrations.json` untuk audit; bukan antrean migrasi yang perlu diputar ulang.

Probe PostgreSQL produksi lulus6invariant: konfirmasi pengawas tanpa BAP tidak memberi kredit, override BAP4JTM, penyesuaian0, cleanup mengunci BAP, kredit acara2.4 dan reversal idempoten. Seluruh fixture di-rollback, akun probe tersisa0, tidak ada email dikirim. Bukti visual ledger disediakan melalui percakapan pengguna.

Kode ada di PR#1, cabang `feat/stage-5-exams-events`; rilis Vercel menyusul verifikasi commit/deployment dan smoke HTTP. Hasil akhir dicatat pada `stage-5-results.json`. CRUD browser akun produksi dan race native dua koneksi belum dinyatakan lulus.
