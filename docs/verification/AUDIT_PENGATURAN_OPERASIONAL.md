# Audit Pengaturan Operasional — 23 Oktober 2026

## Cakupan dan alur

Dibaca sebelum perubahan: OperationsManager dan seluruh formulirnya, DataForm/Field/FormDialog beserta CSS, masterRequest/requestJson dan feedback validasi, schema perintah, route dan guard admin, OperationsService/handler HTTP, migrasi pembacaan/perintah operasional, maintenance guard, worker email/pekerjaan, scheduler, dokumentasi Tahap 7, fixture dan tes database/browser.

Alur tetap: sesi admin → GET operations → versi konfigurasi, status maintenance, metadata 100 email dan 100 pekerjaan terbaru → formulir dengan alasan audit → CSRF → validasi schema → transaksi database dengan pemeriksaan admin dan kondisi/versi → hasil tervalidasi → pemuatan ulang. Retry tidak mengirim SMTP langsung. Rekonsiliasi unknown hanya menandai sent/cancelled. Jadwal maintenance berlaku di samping sakelar maintenance segera, bukan bergantung pada sakelar tersebut. Tidak ada migrasi, perubahan struktur data, atau perubahan jadwal worker.

## Temuan dan perbaikan

1. Kegagalan GET awal hanya berupa teks status tanpa jalur coba lagi. Kini tersedia feedback error dan tombol muat ulang, serta data lama dikunci untuk perubahan sampai pemuatan berhasil.
2. DTO dipercayai lewat generic TypeScript. Config null, enum/tanggal/array invalid dapat menyebabkan crash atau tindakan salah. Tambahkan schema runtime untuk read/ack, kecocokan ID email dan kenaikan versi config (BigInt).
3. Submit hanya dikunci per DataForm; reload setelah write bercampur dengan hasil penyimpanan, tanpa perlindungan hasil tak pasti. Gunakan satu editor, pengunci sinkron global/editor, AbortController/cleanup, identitas GET, blok pengiriman ulang saat konflik/network/timeout/5xx/respons invalid, dan pemulihan eksplisit. Keberhasilan write tetap dilaporkan jika refresh berikutnya gagal.
4. Pemeriksaan unknown semula otomatis memilih Ya. Kini pilihan wajib eksplisit; jelaskan Ya=sent dan Tidak=cancelled, keduanya tanpa pengiriman ulang.
5. Jadwal semula harus diketik sebagai ISO berzona tanpa validasi frontend yang memadai. Gunakan datetime-local berlabel WIB, konversi eksplisit +07:00 termasuk detik yang dihilangkan browser, serta validasi pasangan/urutan waktu dengan error pada field. Detik/milidetik konfigurasi lama tetap dipertahankan saat ditampilkan. Jam tidak mengikuti timezone perangkat.
6. Penolakan database RETRY_NOT_ALLOWED/RECONCILE_NOT_ALLOWED masuk feedback gangguan internal/layanan. Map hanya pesan allowlist berkode 42501 tersebut menjadi AuthError 409 dengan instruksi muat ulang. Error database lainnya tetap disamarkan.
7. Antrean 100 baris semula ditampilkan sekaligus dan tanpa filter. Tambahkan pencarian, filter status, pagination lokal 10 baris, kartu responsif, tanggal WIB, empty state, serta penjelasan batas 100 terbaru. Payload/identitas penerima email tetap tidak ditampilkan.
8. Waktu pemanggilan worker semula ditampilkan mentah dan berpotensi disalahartikan sebagai keberhasilan seluruh proses. Format WIB dan jelaskan keterbatasannya.

## Verifikasi dan batas

Tes unit mencakup kontrak DTO dan konversi WIB; tes HTTP memeriksa kode 409 serta pesan validasi yang aman; tes database memastikan admin-only, konflik versi, retry failed dan state yang berubah. Browser mencakup penyimpanan konfigurasi nyata ke database disposable, 7 viewport 280–1920px, 100 baris, filter/pagination independen, retry/reconcile/job-retry, pemuatan gagal/DTO invalid, write ditolak/hasil tak pasti, double-submit, busy modal, write berhasil-refresh gagal, sentuh, pembesaran teks 200% dan landscape.

Jumlah tes dan hasil akhir CI/regresi dicatat pada PR. Semua pemeriksaan memakai fixture/database disposable; tidak mengubah konfigurasi atau mengirim email produksi. Perangkat fisik belum diuji. Halaman dan badan modal tetap memiliki scroll vertikal yang wajar untuk isi panjang; perbaikan menghindari overflow horizontal dan pemotongan isi, bukan menyembunyikan scroll.
