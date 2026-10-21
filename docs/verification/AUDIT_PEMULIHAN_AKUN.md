# Audit Halaman Pemulihan Akun

## Cakupan dan alur
- /admin/pemulihan: pageSession admin → AdminRecovery → GET/POST /api/users/reset-requests → UserService → fungsi SQL users_reset_requests, users_recovery_target, approve_admin_recovery, users_reject_recovery.
- /lupa-password: AuthLayout → RecoveryForm → forgot-password → reset-otp → reset-password. Metode email memberi challenge; admin/jawaban keamanan tetap memerlukan verifikasi identitas admin. Jawaban keamanan tidak memberi akses reset langsung.
- /aktivasi memakai komponen dalam file yang sama; validasi tautan dan kata sandi diperiksa sebagai dependensi terkait.
- ActionForm, Field, PasswordInput, feedback, CSRF/requestJson, schema Zod, sesi dan rate limiting dibaca sebelum perubahan. Backend menggunakan autentikasi internal/PostgreSQL, bukan Google Apps Script.

## Temuan dan perbaikan
1. Form keputusan berbeda dan form permintaan/OTP/reset dapat dimutasi bersamaan. Tambahkan AccountActionScope memakai kunci ref sinkron serta disabled fieldset bersama. ActionForm standalone tetap kompatibel.
2. Rahasia sementara berupa satu string dapat tertimpa hasil persetujuan lain. Ikat rahasia pada nama/username pemilik dan blokir keputusan berikutnya sampai admin menyelesaikan serah terima. Tidak disimpan di penyimpanan browser atau log.
3. Detail kegagalan GET admin dibuang dan status refresh/empty tidak jelas. Pisahkan loading/error/empty, pertahankan pesan API dan referensi bantuan, sediakan retry, batalkan pembacaan lama/unmount, serta blokir keputusan pada daftar yang belum valid.
4. Pesan keberhasilan hilang ketika formulir terhapus oleh refresh. Simpan pemberitahuan keputusan di induk, hapus baris yang sudah diproses, dan muat ulang hanya GET. Rahasia dan keberhasilan tetap terlihat bila refresh gagal; POST tidak diulang otomatis. Form lain tetap mounted saat refresh agar drafnya bertahan.
5. Bukti persetujuan terlihat opsional; field persetujuan juga muncul untuk penolakan. Tampilkan field sesuai keputusan dan validasi menggunakan approveRecoverySchema/rejectRecoverySchema yang sudah dipakai server. Alasan/bukti multiline dan batas panjang selaras kontrak.
6. Respons daftar/challenge/proof sebelumnya dipercaya berdasarkan tipe TypeScript. Tambahkan validasi runtime sebelum render atau maju tahap. Respons persetujuan tanpa kata sandi memberi instruksi periksa status akun, bukan mengulang keputusan.
7. Masa tunggu permintaan ditampilkan sebagai sukses. Gunakan feedback informasi dan sisa waktu; respons publik tetap generik agar tidak mengungkap keberadaan akun.
8. OTP lama dapat tertinggal saat challenge berganti. Key form memakai challengeId, tampilkan username tujuan, enam digit numeric/one-time-code, serta validasi proof dan konfirmasi kata sandi sebelum POST.
9. Hierarki dan label kurang jelas. Tambahkan indikator tahap publik, panduan admin, metadata permintaan, jumlah/batas daftar, label select eksplisit, tombol adaptif, wrapping teks panjang dan area sentuh.

## Kompatibilitas
Tidak ada perubahan struktur data tersimpan, endpoint, SQL/migrasi, hak akses, rate limit, waktu kedaluwarsa OTP/reset, atau kewajiban onboarding. Pemeriksaan kata sandi, CSRF/origin, versi akun, larangan menyetujui akun sendiri, audit, penolakan request yang sudah diproses dan invalidasi sesi tetap dilakukan server. Daftar tetap mengikuti batas backend 100 permintaan tertua; jumlah ditampilkan sebagai jumlah dalam daftar, bukan total seluruh antrean.

## Validasi
- ESLint, TypeScript, production build dan diff check diperiksa.
- 56 unit, 29 crypto/HTTP dan 327 integrasi SQL lulus (412 total).
- UI khusus: dua halaman × enam lebar 320–1920px; kosong, 100 baris, DTO rusak, persetujuan/penolakan, klik ganda, keputusan lintas form, serah terima, password salah, committed+refresh gagal, retry GET tanpa POST, OTP/reset/mismatch/cooldown, metode keamanan/admin dan tautan aktivasi invalid. Tanpa page error.
- Teks 200%, resize/orientasi dan horizontal overflow diuji. Scroll vertikal halaman tetap normal untuk konten panjang; tidak dipaksa ke tinggi viewport sehingga form tidak terpotong.
- Regresi UI umum 252 kombinasi dan screenshot mobile/desktop diperiksa.

Jalankan npm run test:ui:recovery dengan Playwright eksternal (UI_PLAYWRIGHT_MODULE dan UI_BROWSER_EXECUTABLE bila diperlukan). Semua UI memakai fixture localhost dan respons sintetis; SQL memakai database pengujian. Tidak ada email atau penulisan produksi. Perangkat fisik, pembaca layar dan layanan email produksi belum diuji.
