# Respons langsung saat menu diklik

Branch `fix/navigation-response`, berbasis `main` pada `19fc237`.

## Penyebab dan perubahan

PR #15 mempertahankan shell, tetapi prefetch dinonaktifkan sepenuhnya dan tidak
ada state tujuan yang langsung terlihat ketika router menunggu respons server.
Akibatnya halaman lama tampak tetap terbuka selama jeda jaringan/pemeriksaan sesi.

- `src/components/shell/workspace.tsx`: Next Link onNavigate memulai transisi
  router, menampilkan judul/loading tujuan segera, dan menyembunyikan konten lama
  tanpa membongkar shell. Loading mengikuti transisi; klik terbaru menang.
  Klik menu aktif tidak meminta ulang halaman dan tetap menutup drawer seluler.
- Menu awal tetap prefetch=false. Pointer/fokus/sentuhan hanya mengaktifkan
  prefetch=auto pada menu yang dituju. Route dinamis dipersiapkan sampai loading
  boundary, bukan memuat data seluruh halaman menu dengan prefetch=true.
- `navigation-loading.tsx` dan `route-loading.tsx`: UI loading konsisten, judul
  berdasarkan tujuan/URL, status aksesibel, ikon dekoratif dan reduced motion.
- `src/app/(workspace)/**/loading.tsx`: boundary setiap halaman memungkinkan
  kerangka tujuan tampil saat server masih memeriksa akses/memuat halaman.
- `tests/navigation/**`: fixture dinamis dengan respons jurnal ditunda 1.800 ms,
  pengukuran respons klik, skenario klik beruntun, drawer/menu aktif dan mode
  build produksi melalui NAV_FIXTURE_PRODUCTION=1.
- `tests/ui/navigation-stub.tsx`: kompatibilitas hook router/prop onNavigate
  untuk fixture UI existing; pengujian navigasi sebenarnya memakai Next asli.

URL, pageSession, autentikasi, RBAC, CSRF, expiry/logout, database, dan kontrak
API tidak berubah. Tidak ada cache bisnis baru atau dependensi baru. Menampilkan
kerangka tidak memberikan akses ke data tujuan sebelum otorisasi server selesai.

## Verifikasi

- Lint dan TypeScript lulus.
- Unit 30, crypto/adapter/API/export 24, SQL integration 325: 379 lulus.
- Production build aplikasi lulus setelah mengganti cache Turbopack lokal lama
  yang tidak kompatibel; ini bukan perubahan pada database aplikasi.
- Suite UI existing mode interaksi lulus: 4 ukuran, 1 CRUD, tanpa page/console error.
- Next asli development: respons awal 68 ms pada uji dengan respons server
  ditunda 1.800 ms; klik terbaru, data tujuan saja, retensi shell/ciut/pencarian,
  akun/Back, drawer ponsel dan pengalihan sesi kedaluwarsa lulus.
- Next asli build produksi lokal: respons awal 57 ms pada simulasi 1.800 ms;
  satu permintaan dokumen awal, sidebar/topbar/main tetap terpasang, data halaman
  lain tidak ikut diminta, klik terbaru menang, menu aktif menutup drawer, dan
  pengalihan sesi 401 tetap berjalan. Tidak ada page error.

Angka waktu adalah pengukuran fixture lokal, bukan jaminan kecepatan internet
atau cold start produksi. Respons awal adalah tampilan judul/kerangka tujuan;
data tetap menunggu jaringan dan pemeriksaan server. Prefetch berbasis intent
menggunakan perilaku partial prefetch Next untuk route dinamis. Fixture hanya
menggunakan sesi/data sintetis, tidak memakai akun/database/email produksi.
UAT perangkat fisik, pembaca layar dan akun produksi belum dilakukan.

## Menjalankan ulang

Jalankan npm run check. Untuk pengujian router gunakan npm run test:navigation
serta UI_PLAYWRIGHT_MODULE dan UI_BROWSER_EXECUTABLE yang menunjuk browser uji.
Gunakan NAV_FIXTURE_PRODUCTION=1 untuk build/start fixture produksi lokal.
Pengujian interaksi existing dapat memakai UI_INTERACTIONS_ONLY=1 npm run test:ui.
