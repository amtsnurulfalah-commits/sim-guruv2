# Tahap 3 — Kesiapan honorarium dan persetujuan koreksi

Program pengembangan profesional, 24 Oktober 2026 WIB. Cakupan HONOR-01 / 3.1–3.5; bukan penomoran pembangunan ulang historis. Basis main PR #46 `b4e2cfbf4064afa7ae29a17ff40e516999b1843c`.

## Perilaku akhir

- Panel **Kesiapan honorarium** di estimasi/rekap: basis selalu realisasi, meskipun estimasi utama sedang menampilkan proyeksi. Memakai `app.finance_read` lama → `finance.bundle`/`finance.calculate`; periode final memakai snapshot asli.
- Admin melihat blocker periode persis dari `bundle.issues`, penerima terdampak, serta petunjuk perbaikan. Guru hanya menerima data sendiri; respons pribadi tidak menyatakan kesiapan global periode.
- Catatan administrasi berasal dari occurrence/penugasan/konfirmasi, jurnal KBM, BAP, kehadiran acara yang belum berjurnal, dan hari lampau yang belum memiliki waktu pulang. Sumber kegiatan yang belum pernah dimaterialisasi tidak diinventarisasi secara spekulatif. Catatan bukan penilaian kinerja, bukan JTM baru, dan bukan blocker finalisasi tambahan.
- Sumber dibatasi bulan, tanggal yang sudah berjalan, konteks hari, status aktif/removed/cancelled dan periode terbuka. Tautan tanggal membuka halaman sumber; hak akses dan batas pengisian lama tetap berlaku. Panel tidak membuka kembali tanggal yang ditutup.
- Pencarian/paginasi penerima, pemuatan/error/kosong, pembungkusan nama panjang dan layout kartu memakai komponen existing.

## Pengajuan dan keputusan

1. Buka slip final → **Ajukan koreksi honorarium**; alasan 5–500 karakter dan referensi bukti 5–1000 karakter wajib. Bukti berupa referensi teks; tidak menambah penyimpanan lampiran atau mengeksekusi URL.
2. `requestKey` per pengiriman menjaga retry payload yang sama. Key sama dengan payload berubah ditolak; pengajuan baru ditolak jika slip masih memiliki pengajuan aktif. Kunci global write existing menjamin pemeriksaan dan INSERT berada dalam transaksi yang sama.
3. Admin yang berbeda dari **pengaju dan penerima honor** memulai pemeriksaan. Status `submitted` → `reviewing`; pemeriksa tersimpan. Admin pengaju membutuhkan admin lain. Tidak membuat role atau menaikkan hak kepala madrasah secara otomatis.
4. Pemeriksa dapat menolak dengan alasan, atau mengisi seluruh basis yang benar lalu membuat pratinjau persetujuan. Daftar menurut **periode slip sumber**, bukan periode tujuan. Target harus setelah periode slip sumber dan tetap terbuka sesuai engine existing.
5. Pratinjau mengikat request ID/version, pemeriksa, slip/checksum, tarif sumber, basis koreksi terakhir dan periode tujuan. Modal menampilkan penerima, tujuan, alasan/bukti dan selisih; keputusan dibuat sebelum commit.
6. Commit memanggil jalur koreksi existing dalam transaksi yang sama dengan perubahan status `approved`, relasi `correction_id`, riwayat dan audit. Tidak menulis ulang slip/snapshot/checksum lama. Outbox koreksi yang sudah ada tetap dipakai.
7. Penolakan memakai CAS version; pengajuan yang telah diputuskan tidak diputuskan ulang. Commit sukses yang diretry mengembalikan hasil preview yang sama tanpa koreksi/audit ganda. Preview bersaing atau target/source/basis berubah ditolak.

Status final: `approved` atau `rejected`. Pemilik melihat status, pemeriksa, alasan dan riwayat. Riwayat keputusan immutable. Guru tidak bisa membaca pengajuan penerima lain atau melakukan review. Akses tabel/helper langsung dan gateway lama yang dapat melewati pemeriksaan dicabut.

## Perubahan source dan kontrak

- SQL: `20261024054743_honor_readiness_and_correction_review.sql`. Menambah metadata pada `finance.correction_requests` dan tabel private FORCE RLS `finance.correction_reviews`. Precondition fingerprint gateway lama mencegah pembungkus dipasang pada routine yang berbeda.
- Gateway lama disimpan private sebagai `app.finance_read_stage2` / `app.finance_command_stage2`, tanpa EXECUTE runtime. Gateway publik bisnis mempertahankan nama existing.
- `GET /api/honorarium/read?kind=readiness&period=YYYY-MM` dan `kind=requests&period=YYYY-MM&page=1[&statementId=UUID]`. Requests dipaginasi SQL 20 baris; statement filter tetap mematuhi ownership.
- `POST /api/honorarium/request`: `statementId, reason, evidence, requestKey`.
- `POST /api/honorarium/review`: `requestId, version, decision: claim|reject, reason`.
- Preview `operation: correction` menambah `requestId, requestVersion`; basis nominal/string tetap sama. Commit tetap `previewId`.
- HTTP existing tetap memverifikasi sesi, onboarding, method, origin, CSRF, rate limit dan no-store. `CORRECTION_PENDING` → 409; `CORRECTION_REVIEW_REQUIRED` → 403; pesan bantuan terlokalisasi.
- `src/features/finance/honor-readiness.tsx`, kontrak `src/lib/finance/readiness.ts`, integrasi manager/dialog existing. Tidak ada engine finansial frontend kedua.

## Kompatibilitas dan batas operasional

- Permintaan lama mempertahankan ID/alasan. Status awal `submitted`, bukti lama kosong ditandai; pemeriksa wajib memasukkan referensi bukti pada persetujuan. Tidak menyimpulkan bahwa permintaan lama telah disetujui hanya karena ada koreksi pada slip yang sama.
- Preview koreksi lama yang belum dikonsumsi tidak memiliki request/version: buat pengajuan dan preview baru. Preview operasi lain tetap melalui jalur lama; hasil commit yang telah dikonsumsi dapat dibaca ulang oleh actor yang sama.
- Setelah deploy, muat ulang tab lama untuk kontrak pengajuan baru. Jika hanya satu admin, pengajuan yang dibuat admin itu sendiri harus diperiksa admin lain; tidak tersedia bypass persetujuan sendiri.
- Pemeriksa yang telah ditetapkan tetap pemilik pemeriksaan. Belum ada transfer pemeriksa/self-service reopening/edit pengajuan. Jika akun pemeriksa dinonaktifkan, selesaikan penugasan melalui prosedur operator yang diaudit; jangan mengubahnya menjadi self-approval.
- Salinan kode bukan bukti produksi. [validation.json](validation.json) dan PR menyimpan bukti rilis aktual. Tidak menjalankan koreksi, finalisasi, email atau membaca isi honorarium produksi sebagai smoke test.

## Validasi

`npm run check`, `npm run test:ui:finance`, `npm run test:ui:honor-readiness`, `npm run test:ui`; rincian dan batas di validation.json. Pengujian SQL memakai PGlite sintetis, browser memakai fixture SQL nyata disposable, termasuk role/ownership, ledger, pengajuan/penolakan/persetujuan, preview stale/replay, checksum, PDF/Excel dan dimensi 1440/768/320/landscape. Ini bukan UAT perangkat fisik, native race, pengiriman SMTP atau ukuran beban produksi.

Berikutnya Tahap 4 / penanganan kendala dan pemantauan, setelah instruksi pengguna.
