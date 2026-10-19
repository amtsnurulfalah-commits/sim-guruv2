# Verifikasi Tahap 1.6

## Cakupan dan hasil lokal

Kerangka ruang kerja berbahasa Indonesia, dashboard guru/admin, registry modul, sidebar desktop, disclosure menu, dialog seluler, loading/error/retry, peringatan sesi dan pemeriksaan akses dashboard. Tahap ini tidak menambahkan migrasi atau data bisnis.

`npm run check` lulus: lint tanpa warning, TypeScript strict, 11 unit, 8 crypto, 24 skenario fondasi database, 10 akun, 13 auth/HTTP, 23 lifecycle dan 5 dashboard SH01–SH05. Total94 skenario substantif. Runner database menghitung80 termasuk5 parent suite; total runner99. Build Next.js produksi lulus. Log: stage-1.6-check.txt.

SH01 menguji anonim/cookie palsu dan manipulasi query role/actor. SH02 memeriksa pemisahan modul admin/guru, no-store dan DTO tanpa credential/token/nominal palsu. SH03 menolak sesi onboarding. SH04 menguji maintenance terhadap sesi guru yang sudah ada dan pengecualian admin. SH05 memeriksa Origin, sesi dicabut dan sanitasi error database. Semua memakai autentikasi lokal nyata/Argon2 dan PostgreSQL WASM/PGlite, bukan akun produksi atau bukti race pooling native.

Registry unit test memastikan slug unik, cakupan guru/admin dan aturan modul administrasi independen dari tampilan sidebar. Pemeriksaan source memastikan guard halaman berjalan sebelum konten protected dibuat dan registry tidak menjadi pengganti otorisasi server.

## Batas

Sesi/aktor tidak disimpan di localStorage; hanya preferensi sidebar. UI membaca sesi dari endpoint server dan menyembunyikan konten saat pemeriksaan gagal. Sidebar collapse bukan kontrol akses. Dashboard belum menampilkan ringkasan kegiatan atau nominal karena modul sumber belum tersedia.

Akun produksi, bootstrap admin, provider email dan worker pengiriman masih belum disiapkan. Dashboard terautentikasi, modal logout di browser nyata, mobile keyboard/focus dan interaksi multitab masih memerlukan acceptance dengan akun sah. Pengujian handler dan review komponen tidak disamakan dengan bukti browser tersebut. Konfigurasi email tetap diperlukan untuk penerimaan penuh Tahap1.5.

Tahap2.1 berikutnya: manajemen pengguna.

## Produksi dan browser

Commit implementasi `e1337646aefe88f1ec9735bbae50c76ade234883`, deployment `dpl_AJGjKa3NsEGY4uArhVMnUFNRmF5Z`: READY, CI Pemeriksaan fondasi success. Sepuluh pemeriksaan HTTPS lulus; lihat stage-1.6-production-smoke.json. Mencakup health1.6, status shell, form login, redirect anonim dashboard/akun/modul/admin, penolakan manipulasi role/actor dan Origin pada API. Tidak membuat akun, sesi atau perubahan data bisnis.

Browser desktop memverifikasi /kesiapan, label sidebar, collapse, persistensi setelah reload, lalu expand kembali. Bukti screenshot: stage-1.6-desktop-1792391925623.jpg. Tidak ada error console dari aplikasi; pesan error yang teramati berasal dari ekstensi browser. Pemindaian runtime10menit pada rute baru tidak menemukan error; ini bukan jaminan tanpa error selamanya. Drawer mobile dan dashboard terautentikasi belum diuji di browser karena akun produksi belum dibuat.
