# Manajemen pengguna — Tahap 2.1

Halaman `/admin/pengguna` hanya untuk admin dengan sesi business dan onboarding lengkap. Daftar menampilkan profil, peran, status dan kesiapan akun; pencarian username/nama/NIP serta filter peran/status diproses pada seluruh data di server. Pagination stabil, default20 dan maksimum100 per halaman. NIP tetap teks, jarak memakai desimal eksak dua tempat. Jabatan tambahan: kosong atau KEPALA_SEKOLAH. Foto berupa referensi URL HTTPS; unggah Storage belum termasuk tahap ini.

## Operasi

- GET/POST `/api/users`: daftar dan pembuatan akun.
- GET/PATCH `/api/users/:id`: detail dan edit profil/peran.
- DELETE `/api/users/:id`: pengarsipan logis dengan body status archived; tidak menghapus riwayat.
- POST `/api/users/:id/status`: aktif/nonaktif/arsip. Pending hanya dapat diarsipkan, tidak diaktifkan tanpa pembuktian aktivasi.
- POST `/api/users/:id/activation`: batalkan tautan lama dan antrekan aktivasi baru.
- GET/POST `/api/users/reset-requests`: daftar permintaan tertunda, setujui atau tolak.
- POST `/api/users/:id/recovery`: persetujuan untuk requestId yang terikat pada target dan version saat ini.

Setiap mutasi memerlukan Origin canonical, CSRF sesi, kata sandi admin saat ini, alasan5–500 karakter dan version target (kecuali create/penolakan permintaan yang memakai status pending sebagai CAS). SQL membaca ulang sesi dan peran; peran dari browser tidak dipercaya. Konflik versi atau username/email menghasilkan409. Admin harus memuat ulang data sebelum mengulang konflik, tanpa auto-retry mutasi. Batas persistent:30 tindakan per IP dan15 per admin dalam15menit.

## Pembuatan dan pemulihan

Aktivasi membuat profil pending, digest challenge dan encrypted outbox dalam transaksi yang sama. Gagal enkripsi membatalkan semuanya. Email kandidat belum terverifikasi. Status queued hanya berarti antrean dibuat. Provider email, sender terverifikasi, worker dan scheduler tetap harus dikonfigurasi agar pesan terkirim.

Alternatif serah terima memerlukan metode pemeriksaan identitas dan referensi bukti. Server menghasilkan kata sandi acak panjang, menyimpan hash Argon2id dan masa berlaku24jam. Kata sandi hanya ada pada respons tindakan dan memori halaman; serahkan langsung kepada pemilik terverifikasi lalu sembunyikan. Tidak ada password default atau password yang ditentukan admin. Pengguna wajib mengganti password, memverifikasi email dan mengisi pertanyaan keamanan sebelum memperoleh sesi business.

Persetujuan pemulihan harus berasal dari permintaan pending berumur kurang dari7hari, terikat target/version, bukan akun admin sendiri. Faktor lama dan sesi dicabut. Penolakan mencatat pelaksana, waktu dan alasan, serta tidak bisa diproses ulang. Referensi bukti hanya identitas dokumen/pertemuan, jangan menuliskan rahasia atau isi dokumen sensitif.

## Invariant

Mutasi admin diserialkan dengan advisory transaction lock sebelum lock actor/target. Penurunan peran, penonaktifan atau pengarsipan admin aktif ditolak bila tidak ada admin aktif lain yang sudah selesai onboarding. Email terverifikasi tidak dapat diganti diam-diam dari editor. Perubahan profil/peran/status menaikkan versi dan mencabut sesi/challenge serta secret antrean lama. Edit diri sendiri menghapus cookie sesi dan meminta login ulang. Arsip bersifat terminal pada UI/API tahap ini.

DTO dibuat dengan whitelist; hash password/jawaban, digest token, cookie dan ciphertext tidak dimasukkan ke daftar/detail/audit. Audit menyimpan pelaksana, target, alasan dan perubahan peran/status/referensi bukti. Runtime auth hanya diberi EXECUTE entry point; helper tetap privat, business/worker tidak memperoleh akses manajemen pengguna.

Tidak ada akun admin nyata yang dibuat oleh pengujian tahap ini. Bootstrap operator mengikuti Bootstrap_Tahap_1_3.md. Pengujian browser CRUD dengan akun nyata dan pengiriman email adalah penerimaan lanjutan setelah konfigurasi operasional tersedia.
