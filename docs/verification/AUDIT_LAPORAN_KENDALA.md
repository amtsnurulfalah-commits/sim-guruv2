# Audit Halaman Laporan Kendala — 23 Oktober 2026

## Cakupan dan alur

Dibaca sebelum perubahan: komponen SupportReports, masterRequest/requestJson/ErrorFeedback, katalog panduan, halaman dan navigasi admin, handler/service operations, pencatatan kegagalan HTTP, recordSupportEvent, migrasi support_reports, fixture browser serta tes unit/HTTP/database. Halaman ini adalah penelusuran satu referensi, bukan pengelolaan tiket CRUD.

Alur tetap: UUID → GET /api/operations/support → sesi bisnis → ops.find_support_event → pemeriksaan admin di database → metadata atau null → rincian dan panduan. Kegagalan permintaan dicatat melalui log terstruktur dan after() secara best effort. Retensi pencarian 30 hari, hak akses, format data tersimpan, dan endpoint tidak berubah.

## Temuan dan perbaikan

- Pencarian tidak memiliki pengunci sinkron atau pembatalan. Kode dapat berubah saat request berlangsung dan hasil lama muncul untuk input baru. Tambahkan AbortController, identitas request, pengunci ref, serta cleanup saat unmount; perubahan input menghapus seluruh hasil/status lama.
- DTO respons hanya dipercayai melalui type assertion. Tanggal invalid dapat membuat Intl melempar exception; hasil dengan referensi berbeda dapat salah dikaitkan. Validasi runtime semua lima metadata, rentang HTTP, format tanggal, dan kecocokan referensi sebelum render. Respons invalid menjadi feedback yang bisa ditindaklanjuti.
- Regex UUID frontend berbeda dari z.uuid backend; maxLength 36 memotong UUID yang ditempel bersama spasi. Gunakan satu schema UUID bersama, trim/normalisasi huruf, dan batas input yang menampung spasi sebelum validasi.
- Lookup label menggunakan properti turunan objek. Gunakan Object.hasOwn; module/code juga dibatasi schema sesuai database.
- Status awal/loading kurang jelas. Tambahkan petunjuk awal, status pencarian, reset saat input berubah, serta pertahankan pesan kosong dan bantuan kegagalan API.
- Rapikan kartu metadata, spacing responsif, fokus keyboard, tombol selebar container di mobile, batas minimum 44px, dan wrapping string panjang tanpa menyembunyikan overflow. Halaman tetap dapat digulir vertikal untuk membaca seluruh isi.

## Verifikasi

Tes otomatis memakai fixture lokal dan database disposable, tanpa mengubah akun atau laporan produksi. Checklist hasil akhir dan jumlah tes dicatat pada PR. Cakupan tambahan browser: 280/320/375/768/1024/1440/1920px, salinan UUID dengan spasi/huruf besar, validasi lokal, hasil ditemukan/kosong, HTTP 401/403/429/503, gangguan jaringan, DTO invalid/tanggal invalid/referensi salah, double-submit, pembatalan respons lama, 200% ukuran teks, landscape, touch, serta metadata panjang. Hak akses admin, penolakan guru/sesi invalid, metadata allowlist, duplikasi rekaman, dan retensi tetap diuji oleh suite database yang sudah ada.

Keterbatasan: browser menggunakan Chromium otomatis; perangkat fisik dan pencarian referensi produksi tidak diuji. Hasil kosong tidak membuktikan pengguna tidak mengalami kendala. Tidak ada klaim bebas bug mutlak di luar skenario yang diperiksa.
