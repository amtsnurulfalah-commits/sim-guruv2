# Audit Akun dan Profil

## Ruang lingkup dan alur
Halaman /akun, alias /profil, dan onboarding menggunakan SessionPanel → AccountLifecycle → empat tab dan ActionForm/Field bersama. Form mengambil profil melalui accountRequest, menerapkan schema validasi akun yang sama dengan server, lalu mengirim mutasi melalui endpoint auth yang sudah ada. Server tetap memeriksa sesi, CSRF/origin, bukti kata sandi, versi profil, OTP, dan pembatasan permintaan. Komponen bersama juga dipakai pemulihan akun/admin sehingga kompatibilitasnya diperiksa dalam regresi umum.

## Temuan dan perbaikan
- Mutasi pada tab berbeda dapat berjalan bersamaan: satu kunci sinkron untuk semua aksi akun, termasuk selama pembacaan ulang profil.
- Refresh setelah penyimpanan dapat menyamarkan keberhasilan sebagai kegagalan: tampilkan pesan perubahan sudah tersimpan, detail/kode referensi kegagalan baca, dan tombol muat ulang tanpa mengulang POST.
- Pembacaan bertumpuk/unmount berpotensi memakai respons lama: AbortController, nomor urut pembacaan, dan penjagaan mounted.
- Respons profil/OTP belum divalidasi sebelum dipakai: validasi DTO runtime, error yang dapat ditindaklanjuti, dan challenge baru wajib valid.
- Status antrean/pengiriman OTP berpotensi ditampilkan sebagai sukses: pisahkan sukses, informasi, dan gagal; tampilkan email tujuan dan reset digit hanya saat challenge berganti.
- Validasi dan penunjuk kesalahan form kurang konsisten: pakai schema bisnis yang sama, tandai field kata sandi saat ini pada INVALID_CREDENTIALS, dan pertahankan draf.
- Ringkasan onboarding dapat tertinggal dari profil terbaru: sinkronkan hasil pembacaan profil ke SessionPanel.
- Reset form tidak mengembalikan visibilitas rahasia: sembunyikan kembali PasswordInput saat form miliknya direset, dengan cleanup listener.
- Hierarki profil dan form kurang jelas: ringkasan identitas/status, grid adaptif, alamat multiline, autocomplete, OTP numeric, tombol sentuh, serta wrapping teks panjang.

Tidak ada perubahan struktur database, endpoint, aturan otorisasi, kebijakan OTP, atau proses invalidasi sesi. Semua tab dan fungsi sebelumnya dipertahankan. Pergantian kata sandi tetap mengarahkan ke login.

## Validasi
- ESLint, TypeScript, production build, dan git diff --check lulus.
- 52 unit + 29 crypto/HTTP + 327 integrasi SQL = 408 pengujian lulus.
- Regresi UI umum: 252 kombinasi, empat lebar interaksi, CRUD; tanpa page error/console error.
- UI khusus akun: admin/guru pada 320, 375, 768, 1024, 1440, 1920px; keyboard tab, draf, onboarding, kunci lintas tab, klik ganda, save sukses/refresh gagal, field error, pergantian OTP, delivery gagal, reset rahasia, DTO rusak, redirect password, teks 200%, dan rotasi lulus; tanpa page error.
- Pemeriksaan visual screenshot 375px dan 1440px lulus. Tidak ditemukan horizontal overflow pada skenario uji. Konten panjang tetap memakai scroll halaman normal agar form tidak terpotong.

UI memakai fixture lokal dan respons sintetis; integrasi SQL memakai database pengujian. Tidak ada pengiriman email atau penulisan produksi. Pengujian perangkat fisik, pembaca layar, dan layanan email produksi belum dilakukan.

Jalankan npm run test:ui:account dengan Playwright tersedia (atau UI_PLAYWRIGHT_MODULE/UI_BROWSER_EXECUTABLE sesuai lingkungan); pengujian memakai harness lokal tests/ui/server.ts.
