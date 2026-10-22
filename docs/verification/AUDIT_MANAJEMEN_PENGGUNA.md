# Audit Manajemen Pengguna

## Cakupan dan alur
Route /admin/pengguna memeriksa sesi admin sebelum UserManager dirender. Filter diterapkan ke GET /api/users dengan pagination. UserEditor menggunakan POST/PATCH untuk profil dan pembuatan akun. Modal konfirmasi mengirim /:id/status atau /:id/activation. Pembuatan mendukung email aktivasi dan serah terima kata sandi sementara; pemulihan tetap melalui /admin/pemulihan.

Kode UI, form/event/state, route API, request/CSRF/feedback, UserService, AccountActivationService, schema, SQL users_* beserta perlindungan admin aktif terakhir, ManagedDialog, PasswordInput, Field, TableRegion dan CSS global diperiksa. Tidak ada Google Apps Script pada alur ini. Identitas/sesi memakai autentikasi internal dan PostgreSQL.

## Temuan dan perbaikan
1. Konversi jarak rumah dan parsing URL foto dapat melempar exception sebelum validasi Zod selesai. Pipeline kini memeriksa format sebelum Decimal/new URL. Tambahkan regresi HTTP 422 dengan penunjuk field untuk input salah.
2. Submit menggunakan state busy saja sehingga dua event sangat dekat berpotensi lolos. Tambahkan ref sinkron pada editor dan konfirmasi, penjagaan mounted untuk hasil async, serta disabled saat proses berjalan.
3. Error konfirmasi bercampur dengan error daftar sehingga daftar sehat dapat menghilang. Pisahkan listError; error tindakan tetap di modal dengan detail dan referensi bantuan.
4. Kata sandi administrator salah belum ditandai pada field di modal konfirmasi. Terapkan field errors pada kedua form; gunakan PasswordInput bersama untuk visibilitas, autocomplete dan reset yang konsisten.
5. Status daftar setelah perubahan dapat gagal dimuat tanpa membedakan keberhasilan tindakan. Pesan keberhasilan tetap di induk; kegagalan refresh menjelaskan tindakan sudah diproses dan tidak perlu diulang. Tidak ada replay POST otomatis.
6. Rahasia sementara hanya berupa string dan tidak semua aksi diblokir saat serah terima. Kaitkan dengan identitas pemilik, blokir tambah/edit/status/arsip/aktivasi selama rahasia belum disembunyikan, serta pertahankan rahasia yang terbaca meskipun bagian lain respons mutasi rusak. Pesan hasil tidak terbaca mengarahkan pemeriksaan status, bukan membuat ulang akun.
7. Respons daftar dipercaya berdasarkan tipe compile-time. Validasi DTO runtime sebelum render; respons tidak sesuai menampilkan retry dan tidak menghasilkan status default buatan.
8. Pagination dapat menampilkan halaman kosong setelah total menyusut. Kembali ke halaman terakhir yang masih tersedia. Tambahkan reset filter dan validasi filter sebelum request.
9. Kebutuhan email tidak terlihat wajib pada metode aktivasi. Tandai required sesuai metode/status pending; serah terima tetap mendukung tanpa email, dengan bukti identitas yang wajib. Gunakan schema bisnis yang sama untuk validasi client tanpa mengganti validasi server.
10. Form alamat sempit dan tabel/modal berpotensi melebar. Gunakan alamat multiline, min-width/wrapping, kolom tabel terukur, perataan vertikal atas, toolbar/pagination yang dapat membungkus, label eksplisit, empty state, dan modal konfirmasi dengan batas tinggi serta scroll.

## Kompatibilitas
Tidak ada migrasi, endpoint, struktur data tersimpan, atau aturan bisnis yang diganti. Status arsip tetap permanen melalui halaman ini; data dan audit tetap disimpan. Perlindungan admin aktif terakhir, email terverifikasi immutable, CAS versi, CSRF/origin, rate limiting, invalidasi sesi/challenge, antrean email dan kewajiban onboarding tetap berasal dari server yang sama. Perubahan akun sendiri tetap mengakhiri sesi lokal. Label queued tetap dibedakan dari email terkirim.

## Validasi
- 65 unit + 29 crypto/HTTP + 329 integrasi PostgreSQL WASM/PGlite = 423 pengujian lulus.
- Pengujian khusus UI pada 320, 375, 768, 1024, 1440, 1920px, termasuk batas modal tambah/konfirmasi; tambah melalui aktivasi/handover, edit, penolakan kata sandi/admin terakhir, perubahan status/aktifkan/arsipkan/aktivasi ulang, klik ganda/busy Escape, field error, saved+refresh gagal, serah terima dan respons mutasi rusak, filter/reset, pagination menyusut, data kosong/rusak/panjang, teks 200%, orientasi dan redirect sesi sendiri.
- Lint, TypeScript, production build dan diff check lulus. Regresi UI umum 252 kombinasi, empat lebar interaksi dan CRUD lulus tanpa page error atau console error. Screenshot desktop/mobile ditinjau.
- TableRegion menyediakan scroll lokal; halaman/modal tetap dapat digulir vertikal agar formulir panjang tidak terpotong.

Semua UI memakai fixture localhost dan respons sintetis. Tidak ada pengiriman email atau penulisan produksi. Perangkat fisik, pembaca layar dan native PostgreSQL race suite belum diuji. Jalankan npm run test:ui:users dengan Playwright eksternal (UI_PLAYWRIGHT_MODULE/UI_BROWSER_EXECUTABLE bila diperlukan). Tidak ada dependency runtime baru.
