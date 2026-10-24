# Checkpoint kelanjutan pengembangan SiM-Guru

Diperbarui 24 Oktober 2026 WIB. Persetujuan roadmap dan instruksi Tahap 0 berasal dari percakapan 23 Oktober, dilanjutkan 24 Oktober.

## Status dan pekerjaan berikutnya

- Roadmap lanjutan Tahap 0–8 tersimpan pada [ROADMAP_PENGEMBANGAN.md](ROADMAP_PENGEMBANGAN.md).
- **Tahap 0.1–0.4 selesai dan merged**, PR #44, main `900ac39d05df412f626f73a920fc9bb4db020010`. Bukti pada [paket Tahap 0](stage-0/README.md).
- **Tahap 1.1–1.6 selesai untuk fondasi bersama + pilot jadwal**, sesuai acceptance roadmap; [hasil dan batas adopsi](stage-1/README.md), [validasi](stage-1/validation.json). PR #45 merged ke main `08380e2a7d28c12fc02a8b1b0cb3824f019420eb`.
- Implementasi: Button/ui-action konsisten, StatusBadge/Pagination reusable, empat kelompok navigasi, URL filter jadwal allowlist, required days/multi, drawer resize, wrapping dialog dan normalisasi error saat body API terputus.
- **Tahap 2.1–2.6 selesai dan merged**: pusat tugas dari sumber, inbox pribadi/preferensi, digest harian/recheck sumber, deep link tanggal dan prioritas dashboard. [Paket Tahap 2](stage-2/README.md) dan validation.json menyimpan hasil/batas/rollout aktual. Branch `feature/professional-stage-2`; periksa PR/commit/checks aktual pada GitHub. **Migrasi produksi diterapkan setelah izin eksplisit pengguna:** ledger 28/checksum cocok, RLS dan privilege/guard terverifikasi, security advisor tanpa lint. PR #46 merged ke main `b4e2cfbf4064afa7ae29a17ff40e516999b1843c`, deployment produksi READY dan health/API anonim terverifikasi. Penolakan sebelumnya diselesaikan oleh izin pengguna, bukan bypass.
- **Tahap 3.1–3.5 selesai dan merged**, PR #47 main `e8891eacf2570386adc7a6c66e95e730fd153929`. Izin eksplisit pengguna diterima; migrasi produksi berhasil, ledger29/checksum/RLS/grants/advisor terverifikasi. Deployment `dpl_5t6GVPT3vzEvCp1mJ8UzperW7Zkm` READY; health200 dan API anonim readiness/requests401. Penolakan sebelumnya diselesaikan lewat izin pengguna. [Paket Tahap 3](stage-3/README.md).
- **Tahap 4.1–4.6 diimplementasikan dan divalidasi**, branch `feature/professional-stage-4`, PR #48: lifecycle penanganan, konteks pelapor, status/penanggung jawab/catatan/riwayat, bukti keputusan, referensi berulang, metrik modul dan retensi bounded. [Paket Tahap 4](stage-4/README.md) dan validation.json menyimpan bukti/batas. **Migrasi produksi berhasil diterapkan setelah izin eksplisit pengguna:** ledger30/checksum cocok, empat tabel ENABLE/FORCE RLS, grant gateway dan penolakan akses langsung/helper terverifikasi; advisor tanpa lint. Error requestState terdahulu telah terselesaikan pada penerapan ini. Head `590e3697b6ca6a6494545f2dfc1482d535f0d2cc` CI run `40073274405` success, preview success; status merge/deployment akhir mengikuti PR #48. Periksa status rilis aktual sebelum Tahap 5.
- **Tahap 4 merged**, PR #48 main `e79a74a1747d0edc025002dfd88b0bcb8af3424b`, produksi READY `dpl_BnmYVNq4JWdeQrjCUVUYRtDY5Zar`; health200 dan API anonim401 telah diverifikasi pada rilis sebelumnya.
- **Tahap 5.1–5.5 selesai dan merged**, PR49 main `d8c274e08efd84ba0c7828294442944721723781`; migrasi produksi ledger31/checksum/RLS/grants/advisor terverifikasi setelah izin pengguna. Produksi `dpl_G3ckE38VxNUQEC5svHjRgDHYLvvY` READY, health200 dan API laporan anonim401. Detail rilis pada PR49 dan [paket Tahap5](stage-5/README.md).
- **Tahap 6.1–6.5 diimplementasikan**, branch `feature/professional-stage-6`, [PR50](https://github.com/amtsnurulfalah-commits/sim-guruv2/pull/50): allowlist kelas/jadwal KBM, preview pemetaan ID/rentang, pemeriksaan sumber/target/bentrok, commit atomik/idempotent dan pemulihan receipt. [Paket Tahap6](stage-6/README.md). 548 hasil runner (145unit/35crypto-HTTP/368integrasi), lint/typecheck/build, UI252+45 serta halaman baru7lebar/4orientasi lulus. Head89295016 CI40091177860/quality120863994344 seluruh langkah success dan preview Vercel success. **Review otomatis menolak migrasi produksi Tahap6** karena perlu izin eksplisit untuk perubahan schema/RLS/privilege ini; persetujuan Tahap5 tidak berlaku otomatis. Readback produksi tetap ledger31, tabel preparation belum ada. Batch konkret/checksum tersimpan pada stage-6/release-batch.sql dan validation.json. Jangan bypass atau merge sebelum migrasi diterapkan. Setelah izin pengguna:terapkan batch yang sama, verifikasi ledger32/checksum/ENABLE-FORCE RLS/grants/helper/advisor, perbarui bukti, tunggu final CI, merge PR50 expected-head dan verifikasi produksi READY/smoke tanpa menyalin semester nyata.
- **Tahap 7–8 belum dimulai.** Berikutnya draft otomatis dan pengalaman mobile setelah rilis Tahap6 serta instruksi pengguna.

## Konteks wajib

- Repo `amtsnurulfalah-commits/sim-guruv2`, main awal Tahap 1 `900ac39d05df412f626f73a920fc9bb4db020010` (PR #44); PR #43 Honorarium, #42 Acara. Audit halaman tersebut sudah dilakukan; ulangi hanya jika perubahan/temuan baru relevan.
- Baseline: 317 file aplikasi, 47 page, 50 file route API (bukan jumlah action), 27 file migrasi. Source tidak berubah dalam Tahap 0; tooling/tests development ditambahkan.
- Auth internal, bukan SSO/Supabase Auth; Next/TS/Tailwind/Radix/Zod/Postgres.js/Supabase PostgreSQL/Vercel.
- Admin/guru, petugas kontekstual menurut tanggal/penugasan, kepala sekolah jabatan tambahan; izin laporan baru harus eksplisit.
- WIB, satu sumber kebenaran SQL, NUMERIC/pembulatan transport, ledger/reversal/final snapshot dan koreksi selisih dipertahankan. Jangan membuat engine honor frontend kedua.
- Summary dashboard, outbox/worker, finance issues/correction_requests, support lookup serta backup/staging sudah tersedia.
- Stabilitas sebelum estetika; Tahap 1 mulai dari konsolidasi pemakaian existing, bukan redesign seluruh aplikasi.

## Bukti dan batas

- Baseline Tahap 0: 497 hasil runner. Tahap 1: 503 hasil runner (135 unit, 35 crypto/HTTP, 333 integrasi PGlite), lint/typecheck/build; rincian browser dan batas pada validation.json Tahap 1.
- Pengukuran PGlite kecil bukan latency/capacity produksi, SSR atau Core Web Vitals.
- Tahap 0 tidak mengakses metadata/SMTP/backup produksi. Tahap 2 memeriksa metadata schema/checksum/guard dan advisor untuk batch rilis; status guard KBM dan migrasi baru tercatat di validation.json Tahap 2. Tidak membaca isi keuangan/akun produksi. File SQL sendiri bukan bukti penerapan.
- Lookup bantuan saat ini metadata 30 hari/best effort, belum ticket lifecycle.
- PGlite/Chromium emulasi bukan native restore/race/perangkat fisik/pembaca layar/delivery/UAT produksi. Gap dicatat pada OPS/QA/SEC/PERF backlog.
- Workspace sementara sempat kembali ke snapshot lama. Paket ini dipulihkan dari source main dan konteks, lalu baseline dilaksanakan ulang; gunakan Git sebagai penyimpanan kelanjutan.

## Prosedur giliran berikutnya

1. Baca roadmap/checkpoint/paket Tahap 0/backlog lalu source terkait permintaan terbaru.
2. Periksa working tree, main, branch dan PR; jangan menimpa pekerjaan lain.
3. Untuk tahap berikutnya, mulai kontrak Tahap 7/draft otomatis dan pengalaman mobile dan kriteria penerimaannya; perluasan mengikuti dependency. Adopsi UI modul lain dilakukan saat modul tersebut disentuh, bukan dianggap sudah selesai serentak.
4. Catat ID selesai, hasil/batas tes, PR/commit dan pekerjaan berikutnya setelah setiap PR.

Persetujuan roadmap tidak berarti seluruh Tahap 1–8 otomatis dijalankan oleh PR Tahap 0. Eksekusi berikutnya mengikuti instruksi pengguna; persetujuan yang sudah ada tidak perlu diminta ulang untuk scope yang sama.
