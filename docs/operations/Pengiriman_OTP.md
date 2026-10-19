# Pengiriman OTP verifikasi email

Sebelumnya tombol hanya membuat challenge/outbox. Tidak ada pemicu worker otomatis, dan produksi belum mempunyai provider, sender maupun LOGIN worker. Pesan produksi yang diperiksa belum pernah dicoba kirim.

Sekarang POST /api/auth/email-request memeriksa kesiapan email terlebih dahulu. Jika belum siap, respons503 EMAIL_DELIVERY_UNAVAILABLE tampil sebelum OTP baru dibuat. Jika siap, password dan email divalidasi, transaksi challenge/outbox di-commit, kemudian worker khusus mengirim challenge yang baru dibuat. Panggilan provider berada di luar transaksi database. Tidak perlu cron untuk percobaan pengiriman pertama.

UI memakai tombol **Kirim kode OTP**. Status accepted berarti provider menerima permintaan pengiriman, bukan bukti email masuk inbox. Pending/unknown dan kegagalan ditampilkan apa adanya. Pengguna dapat meminta kode baru setelah60detik; kode lama disupersede. TTL10menit, maksimal5percobaan dan ikatan challenge/email tetap berlaku. Browser tidak menerima OTP, ciphertext, key atau kredensial worker. Timeout permintaan OTP40detik untuk memberi ruang bagi koneksi worker dan provider.

## Konfigurasi produksi

Sudah disiapkan: MAIL_PROVIDER=resend dan WORKER_DATABASE_URL sensitif pada proyek sim-guruv2. LOGIN sim_guru_worker_login hanya anggota sim_guru_worker, tanpa akses tabel kredensial/owner/bypassRLS dan dibatasi4koneksi. SSL tetap memverifikasi sertifikat CA. Tidak memakai AUTH_DATABASE_URL atau role postgres untuk pengiriman.

Masih wajib diisi melalui Environment Variables Vercel (Production):

- MAIL_API_KEY: API key Resend dengan izin mengirim. Alternatif integrasi Vercel: RESEND_API_KEY; runtime otomatis mengenalinya sebagai Resend.
- MAIL_FROM: alamat email pada domain pengirim yang sudah diverifikasi di Resend. Jangan memakai alamat/domain contoh atau sender uji untuk pengiriman ke semua pengguna.

Setelah menyimpan konfigurasi, redeploy production dan minta kode baru. Jangan mengirim API key melalui chat atau memasukkannya ke repository. Verifikasi domain/DNS dilakukan di akun Resend pemilik domain. Bila menggunakan integrasi marketplace, penyambungan akun tetap memerlukan pemilik akun; CLI pada sesi ini tidak terautentikasi sehingga tidak menjalankan instalasi provider.

## Worker, kegagalan dan batas

Migrasi security_otp_dispatch menambah claim_security_otp(uuid), SECURITY DEFINER dengan owner internal dan search_path pg_catalog; EXECUTE hanya untuk worker. Claim terarah memeriksa challenge belum terpakai/superseded/kedaluwarsa, waktu retry dan lease. Pesan pengguna lain tidak ikut diambil. Idempotency key provider tetap peroutbox. Hasil sent/failed menghapus payload rahasia sesuai kontrak worker lama. Konsumsi OTP dan pencabutan sesi tetap pada jalur verifikasi semula.

429/5xx/provider timeout menjadi retry_wait; penolakan permanen failed; hasil ambigu unknown dan tidak otomatis dianggap terkirim. Percobaan ulang terjadwal masih memakai operator `npm run mail:deliver`/scheduler operasional, bukan cron permenit yang mengharuskan perubahan paket Vercel. Pengguna dapat meminta kode baru setelah cooldown. Jalur ini memperbaiki verifikasi email pribadi; notifikasi aktivasi/password_changed dan OTP pemulihan publik tetap memakai outbox/operator pada cakupan sebelumnya.

`npm run db:verify-mail-worker` adalah probe operator read-only, dijalankan dengan environment production, memeriksa LOGIN, privilege dan TLS tanpa claim atau kirim email. Probe TCP dari scratch tertahan EAI_AGAIN; probe deployment khusus sudah lulus di Vercel dengan perintah build override sementara. Probe membuktikan koneksi pooler, identitas worker, TLS dan privilege tanpa mengambil pesan atau mengirim email; lihat ../verification/otp-fix-worker-runtime-probe.json.

Pengiriman ke inbox nyata belum terbukti sebelum API key/sender aktif. Tidak ada OTP nyata dibaca atau dikirim manual dalam pengujian ini.

## Gmail SMTP

Pilih `MAIL_PROVIDER=gmail`. Wajib mengisi `SMTP_HOST=smtp.gmail.com`,
`SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER`, `SMTP_PASSWORD`, dan
`MAIL_FROM` yang sama dengan `SMTP_USER`. Password memakai Google App Password
16 karakter (spasi tampilan Google dinormalisasi), bukan password akun.
Simpan sebagai Secret di Vercel Production. Resend tetap didukung jika dipilih
secara eksplisit; API key Resend tidak diperlukan untuk Gmail.

Transport memakai Nodemailer dengan verifikasi sertifikat TLS dan tanpa log
SMTP. Status accepted hanya berarti Gmail menerima pesan, bukan jaminan masuk
inbox. SMTP tidak menyediakan idempotency key; koneksi terputus pada DATA diberi
status unknown untuk menghindari pengiriman ulang otomatis yang tidak pasti.
Antrean, enkripsi OTP, masa berlaku, cooldown dan izin worker tetap berlaku.

`node --conditions=react-server --import tsx scripts/verify-gmail.ts` memeriksa
koneksi TLS dan autentikasi tanpa mengirim email. Jalankan pada lingkungan yang
memiliki secret; hasil tidak menampilkan kredensial atau alamat pengirim.
