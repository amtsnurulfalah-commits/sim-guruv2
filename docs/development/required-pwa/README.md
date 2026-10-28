# PWA dan kewajiban membuka modul melalui aplikasi

## Sebelum / sesudah

PWA dasar sudah memiliki manifest, ikon 192/512, metadata Apple, install prompt berbasis klik, dan panduan. Pembaruan menambahkan panduan Android/desktop dan iOS, shortcut manifest, pemeriksaan mode awal tanpa flash modul, service worker network-only, fallback navigasi offline, dan notifikasi pembaruan tanpa reload paksa.

## Kebijakan

`AuthenticatedWorkspace` membungkus modul kerja dengan `InstallRequired` untuk sesi business selain admin. Tab biasa menampilkan panduan dan tidak me-mount children modul; admin tidak dikenai syarat ini. Onboarding, akun/profil, halaman publik, panduan dan catatan pembaruan tetap tersedia untuk pemulihan akses/pemasangan. Logout dan lifecycle sesi tetap melalui SessionBoundary yang sama.

Akses dibuka pada `display-mode: standalone` atau `navigator.standalone` Safari. Event `appinstalled` dan penyimpanan flag di local/session storage tidak membuka modul dalam tab biasa. Guru harus membuka ikon aplikasi, lalu login kembali jika sesi diperlukan. Browser tanpa dukungan diarahkan memakai Chrome/Edge atau Safari iOS; tidak ada tombol melewati kebijakan.

Ini adalah kebijakan antarmuka, bukan bukti kriptografis bahwa OS telah memasang aplikasi dan bukan kontrol otorisasi API. Web API tidak menyediakan bukti instalasi universal. Role dan izin backend tetap berlaku. Browser/OS tetap meminta persetujuan pengguna; instalasi diam-diam tidak dimungkinkan. Pengujian OS fisik tetap diperlukan sebelum menilai dukungan seluruh perangkat guru.

## Service worker

- `/sw.js`, scope `/`, updateViaCache none, HTTP no-store/no-cache.
- Hanya navigasi GET same-origin: jaringan terlebih dahulu; jika fetch gagal, tampilkan dokumen fallback statis tanpa data akun.
- Tidak menyimpan HTML privat, API, kredensial atau hasil transaksi di CacheStorage. API fetch dan semua mutasi tidak diintersep. Tidak ada background sync/queue transaksi.
- Tidak memanggil skipWaiting/clients.claim atau reload otomatis. Pembaruan worker menunggu jendela lama ditutup; banner meminta pengguna menyimpan pekerjaan lebih dahulu.
- Kegagalan registrasi worker tidak menghapus sesi atau data; akses online admin dan panduan pemasangan manual tetap tersedia.

## Validasi

Unit worker memeriksa pass-through online, API/POST/cross-origin tidak diintersep, serta fallback 503 no-store. Suite `test:ui:pwa` memakai AuthenticatedWorkspace dan sesi sintetis untuk guru tertahan, flag storage bukan bypass, pembatalan prompt, installed belum standalone, perpindahan standalone, admin exempt, Safari, dan 7 ukuran layar. Regresi catatan pembaruan mencakup race/cancel/reject prompt dan status instalasi. Produksi lokal memeriksa manifest/ikon, worker terdaftar, nol cache privat, dan navigasi offline dengan worker sebenarnya. Bukan UAT instalasi OS fisik atau transaksi produksi.

## Rilis / rollback

Tidak memerlukan migrasi database atau environment baru. PR harus disetujui sebelum merge/rilis. Rollback UI dapat menghapus gate tanpa mengubah data; worker network-only lama tetap memakai jaringan dan tidak menyajikan versi privat lama. Jika worker harus dinonaktifkan, publikasikan retirement worker pada URL/scope yang sama terlebih dahulu; menghapus file saja tidak menghapus registrasi browser yang sudah ada.
