# Audit Halaman Migrasi Data — 23 Oktober 2026

## Cakupan dan alur

Dibaca sebelum perubahan: MigrationManager, DataForm/Field/FormDialog dan styling, pageSession admin, API migration, boundedJson/CSRF/rate limit, schema ekspor/gate, normalisasi/profil/checksum/redaksi, service database, migrasi staging/read/command, rencana impor dan penerapan/rekonsiliasi operator, runbook Tahap 8, serta tes unit/database/browser terkait.

Alur tetap: admin memilih JSON → validasi ukuran/envelope → staging privat dan redaksi server → batch/temuan → tinjauan yang diizinkan dan gate dengan alasan/bukti → transaksi/CAS → refresh. UI tidak menjalankan impor, restore, pengiriman email, perubahan DNS, atau cutover. Impor operator tetap memerlukan maintenance, pause dispatch, bukti backup/restore/rollback, hash rencana dan rekonsiliasi. Tidak ada migrasi schema atau perubahan data produksi dalam audit ini.

## Temuan dan perbaikan

- Board/report/ack hanya dipercayai melalui tipe TypeScript. Config/array/identitas/enum/count malformed dapat crash atau menampilkan hasil salah. Tambahkan validasi runtime termasuk keunikan batch/gate/sequence, tanggal/checksum, versi string dan kenaikan versi BigInt. SQL counts null pada staging kosong dinormalisasi menjadi objek kosong.
- State batch dan report diperbarui terpisah, tanpa cleanup/pengunci global yang cukup pada upload/save/refresh. Gunakan satu editor, pengunci sinkron selama pembacaan berkas dan POST, pembatalan serta identitas request GET, dan laporan yang terikat ID/versi batch. Kegagalan memilih B mempertahankan laporan A tanpa menempelkannya ke B.
- Keberhasilan write bercampur dengan refresh berikutnya. Pisahkan notice sukses dan error refresh. Konflik atau hasil POST tak pasti menonaktifkan penulisan sampai pemeriksaan ulang eksplisit; nilai formulir dipertahankan ketika ditolak.
- JSON.parse menampilkan error parser mentah dan input file tidak selalu direset setelah kegagalan. Gunakan pesan format generik tanpa cuplikan berkas, reset input dalam finally, validasi envelope sebelum mengirim, dan periksa batas 2 MiB pada ukuran berkas maupun representasi JSON UTF-8 yang dikirim. Berkas tidak valid bisa dipilih ulang tanpa memuat ulang seluruh halaman.
- Resolve memakai schema server lokal dan UI input bukti 120 karakter meski backend menerima 1000. Bagikan resolveSchema dan gunakan bukti 10–1000/alasan 5–500 karakter pada UI serta server. Keputusan gate tetap dipilih eksplisit tanpa default persetujuan.
- REVIEW_NOT_ALLOWED/MIGRATION_BLOCKED/MIGRATION_NOT_IMPORTED/CUTOVER_GATES_INCOMPLETE masuk feedback gangguan layanan karena SQLSTATE 42501. Map hanya allowlist tersebut menjadi 409/422 dengan petunjuk sesuai sebab; error SQL lain tetap privat.
- Tidak ada pemulihan pemuatan awal, pencarian atau pagination untuk temuan besar. Tambahkan tombol muat ulang, loading/empty/error/success state, filter/pencarian, pagination 5 batch dan 20 temuan, jumlah per sheet, kartu gate dan panduan tindak lanjut. Batas API tetap 50 batch terbaru dan dijelaskan pada UI.

## Verifikasi

Tes unit kontrak, HTTP, dan integrasi memastikan redaksi, admin-only, atomicity/idempotency, CAS, gate yang memblokir cutover dan format board/report. Tes browser tambahan memakai database disposable untuk upload/staging/replay/resolve/gate dan fixture untuk data banyak/error/race. Matriks mencakup 280–1920px, modal, sentuh, teks 200%, landscape, 50 batch dan lebih dari 100 temuan, jaringan/DTO invalid, pengiriman ganda dan recovery hasil tak pasti. Hasil akhir, jumlah tes, dan CI dicatat pada PR.

Perangkat fisik, ekspor pengguna, impor/restore/cutover dan email produksi tidak dijalankan. Scroll vertikal normal dipertahankan untuk laporan dan modal panjang; target perbaikan adalah menghindari halaman melebar dan konten yang tidak dapat dijangkau.
