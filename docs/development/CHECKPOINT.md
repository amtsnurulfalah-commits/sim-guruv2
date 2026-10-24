# Checkpoint kelanjutan pengembangan SiM-Guru

Diperbarui 24 Oktober 2026 WIB. Persetujuan roadmap dan instruksi Tahap 0 berasal dari percakapan 23 Oktober, dilanjutkan 24 Oktober.

## Status dan pekerjaan berikutnya

- Roadmap lanjutan Tahap 0–8 tersimpan pada [ROADMAP_PENGEMBANGAN.md](ROADMAP_PENGEMBANGAN.md).
- **Tahap 0.1–0.4 selesai dan merged**, PR #44, main `900ac39d05df412f626f73a920fc9bb4db020010`. Bukti pada [paket Tahap 0](stage-0/README.md).
- **Tahap 1.1–1.6 selesai untuk fondasi bersama + pilot jadwal**, sesuai acceptance roadmap; [hasil dan batas adopsi](stage-1/README.md), [validasi](stage-1/validation.json). PR #45 merged ke main `08380e2a7d28c12fc02a8b1b0cb3824f019420eb`.
- Implementasi: Button/ui-action konsisten, StatusBadge/Pagination reusable, empat kelompok navigasi, URL filter jadwal allowlist, required days/multi, drawer resize, wrapping dialog dan normalisasi error saat body API terputus.
- **Tahap 2.1–2.6 selesai dan merged**: pusat tugas dari sumber, inbox pribadi/preferensi, digest harian/recheck sumber, deep link tanggal dan prioritas dashboard. [Paket Tahap 2](stage-2/README.md) dan validation.json menyimpan hasil/batas/rollout aktual. Branch `feature/professional-stage-2`; periksa PR/commit/checks aktual pada GitHub. **Migrasi produksi diterapkan setelah izin eksplisit pengguna:** ledger 28/checksum cocok, RLS dan privilege/guard terverifikasi, security advisor tanpa lint. PR #46 merged ke main `b4e2cfbf4064afa7ae29a17ff40e516999b1843c`, deployment produksi READY dan health/API anonim terverifikasi. Penolakan sebelumnya diselesaikan oleh izin pengguna, bukan bypass.
- **Tahap 3.1–3.5 / HONOR-01 diimplementasikan dan divalidasi**: kesiapan dari engine existing serta pengajuan/bukti/pemeriksa/keputusan koreksi, CAS/retry, audit dan snapshot asli tetap utuh. [Paket Tahap 3](stage-3/README.md) dan validation.json menyimpan bukti/batas. Branch `feature/professional-stage-3`; periksa PR/merge/deployment aktual sebelum tahap berikutnya.
- **Tahap 4–8 belum dimulai.** Berikutnya **Tahap 4 / penanganan kendala dan pemantauan**, setelah instruksi kelanjutan pengguna.

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
3. Untuk tahap berikutnya, mulai kontrak Tahap 4/penanganan kendala dan kriteria penerimaannya; perluasan mengikuti dependency. Adopsi UI modul lain dilakukan saat modul tersebut disentuh, bukan dianggap sudah selesai serentak.
4. Catat ID selesai, hasil/batas tes, PR/commit dan pekerjaan berikutnya setelah setiap PR.

Persetujuan roadmap tidak berarti seluruh Tahap 1–8 otomatis dijalankan oleh PR Tahap 0. Eksekusi berikutnya mengikuti instruksi pengguna; persetujuan yang sudah ada tidak perlu diminta ulang untuk scope yang sama.
