# Akun, onboarding dan pemulihan — Tahap 1.5

Autentikasi tetap lokal di database SiM-Guru. Tidak ada registrasi publik, Central SSO atau Supabase Auth. Halaman `/akun`, `/profil` dan `/onboarding` menyediakan pengamanan akun. `/aktivasi` menerima tautan aktivasi, `/lupa-password` menyediakan pemulihan, `/admin/pemulihan` khusus admin dengan onboarding lengkap.

## Kontrak API

Semua respons memakai envelope `{ok,data,requestId}` atau `{ok:false,error:{code,message},requestId}`, Cache-Control no-store. Seluruh POST memakai JSON, Origin APP_URL canonical dan X-CSRF-Token. Endpoint publik memakai CSRF intent login/prelogin cookie; endpoint sendiri/admin memakai intent session/session cookie. Tidak menerima actorId/role/status/onboarding flags dari browser. GET tidak mengonsumsi challenge.

| Endpoint `/api/auth/…` | Metode | Bukti dan hasil |
|---|---|---|
| profile | GET, POST | Sesi sendiri; POST password saat ini dan version. DTO profil tidak berisi hash. Role/status/field asing ditolak |
| change-password | POST | currentPassword, newPassword, confirmation. Password lama terbukti; hash baru, auth_version, revoke seluruh sesi/challenge dan notifikasi atomik. Wajib login ulang |
| security-question | POST | currentPassword, question, answer. Jawaban NFKC, trim, whitespace tunggal dan lowercase id-ID, lalu Argon2id. Jawaban tidak pernah dikembalikan |
| email-request | POST | currentPassword, email. OTP masuk outbox; tidak mengubah email terverifikasi sebelum bukti. queued bukan terkirim |
| email-verify | POST | challengeId, otp. Terikat akun sesi, tujuan dan email; sukses mencabut sesi sehingga harus login ulang |
| complete-onboarding | POST | Body kosong; password permanen, email terverifikasi dan pertanyaan keamanan wajib lengkap. Mencabut sesi lama dan menerbitkan opaque cookie business baru |
| activation | POST | challengeId, token, newPassword, confirmation. Aktivasi sekali pakai, TTL24jam; login ulang lalu lengkapi pertanyaan keamanan |
| forgot-password | POST | username, method email/admin/security, answer dan reason opsional. Respons generik accepted + UUID challenge acak pada akun ada/tidak ada |
| reset-otp | POST | challengeId, otp. Membuktikan email terverifikasi, mengonsumsi OTP, menerbitkan capability reset acak TTL5menit; tidak menerbitkan sesi |
| reset-password | POST | challengeId, token, newPassword, confirmation. Sekali pakai, menolak password sama; revoke seluruh sesi/challenge, notifikasi tanpa password, login ulang |
| admin-recovery | GET, POST | GET maksimal100 permintaan pending. POST requestId, currentPassword admin, method, evidence, reason; mengikat persetujuan ke user dari request database |

OTP enam digit: CSPRNG termasuk leading zero, TTL10menit, resend minimal60detik, maksimal5 jawaban salah per challenge. Digest HMAC mencakup tujuan, ID challenge dan email. Percobaan salah disimpan walaupun HTTP gagal. Resend menggantikan challenge lama dan menghapus secret outbox lama. Rate limit persisten:30 mutasi per IP/15menit dan15 per key akun atau capability/prelogin sesi/15menit, ditambah batas OTP dan cooldown. Key HMAC dengan domain terpisah, bukan username/IP mentah.

Response forgot-password tidak mengungkap email, pertanyaan, status akun, kelayakan, kode maupun token. Jalur akun ada/tidak ada sama-sama melakukan verifikasi Argon2 dummy; ini mengurangi perbedaan waktu, bukan klaim waktu konstan jaringan/database. Untuk resend publik terlalu cepat, respons masih generik dan UUID baru tidak membuktikan pengiriman. UI menunggu60detik; jika kode sudah diminta pada tab lain, tunggu dan mulai ulang setelah cooldown.

## Pengamanan akun dan pemulihan admin

Profil sendiri: nama, username unik case-insensitive, NIP teks, nomor telepon ternormalisasi, alamat, URL foto HTTPS. Role, status kepegawaian, pangkat, jarak dan additional_role dikelola pada tahap manajemen pengguna, bukan endpoint edit mandiri. URL foto disimpan sebagai metadata dan tidak di-fetch server pada tahap ini. Versi profil mencegah overwrite perubahan tab lain. Password diverifikasi lagi sebelum perubahan profil/faktor.

Password permanen mengikuti kebijakan8–128 karakter, uppercase/lowercase/angka/simbol, tidak mengandung username atau unsur nama >2huruf, berbeda dari password lama. Semua operasi sensitif mengunci baris user sebelum credential/challenge dan memeriksa ulang status/sesi setelah lock. Perubahan status/auth_version oleh transaksi lain membuat bukti lama gagal.

Jawaban keamanan benar hanya membuat permintaan verifikasi admin; tidak menghasilkan reset capability. Admin memeriksa identitas di luar aplikasi (tatap muka atau dokumen dan panggilan), mencatat referensi bukti minimum dan alasan, serta membuktikan password sendiri. Admin tidak boleh menyetujui pemulihan akun sendiri. Bila hanya satu admin terkunci, gunakan prosedur operator terkontrol; tidak ada bypass publik atau admin otomatis.

Persetujuan membuat password sementara acak minimal20karakter, TTL24jam, Argon2id. Nilai hanya ditampilkan sekali pada respons no-store untuk serah terima aman. Tidak masuk audit/outbox/log/storage browser; admin tidak melihat password lama. Sesi/challenge lama dicabut; email dan pertanyaan keamanan dihapus agar pemilik wajib membuktikan faktor baru. Permintaan mengikat verified_by, verified_at, method/evidence dan user database; tidak menerima target user bebas dari browser.

## Outbox email minimum

Adapter tersedia: Resend HTTP API dengan Idempotency-Key stabil berdasarkan outbox ID, timeout12detik, tanpa SDK tambahan. Template: account_activation, email_verify, reset_otp, password_changed. State sent berarti diterima provider, bukan bukti email sudah masuk inbox. Jalur produksi belum diaktifkan karena konfigurasi provider/pengirim belum tersedia.

Secret aktivasi/OTP memakai AES-256-GCM, nonce acak dan AAD yang mengikat konteks pesan, alamat dan versi key. Aktivasi menggunakan binding versi1 yang sudah ada. OTP memakai domain AAD berbeda dengan purpose/challenge/outbox/email. Outbox publik hanya fullname/username/appUrl/expiresAt. Password tidak disimpan pada payload email.

Worker `npm run mail:deliver` memproses maksimal10 pesan per eksekusi. Gunakan LOGIN khusus `sim_guru_worker_login` yang hanya anggota `sim_guru_worker`, bukan koneksi auth/business/owner. Environment yang dibutuhkan: WORKER_DATABASE_URL, DB_SSL_CA, MAIL_PROVIDER=resend, MAIL_API_KEY, MAIL_FROM, APP_URL dan secret auth. Simpan nilai rahasia langsung pada secret manager, bukan chat/repository. Driver wajib TLS terverifikasi dan prepare:false. Jangan menjalankan command dengan credential administratif.

Routine claim memakai FOR UPDATE SKIP LOCKED, lease2menit, token lease acak dan acknowledge CAS. Maksimal5 usaha, retry backoff untuk429/5xx/network dengan idempotency key sama; 4xx permanen failed,409 ambigu unknown. Lease habis menjadi unknown, tidak dikirim ulang otomatis. Perlu rekonsiliasi provider secara operasional; bukan exactly-once delivery. Expiry/cancel/sent/failed menghapus secret. Pemulihan status unknown dan notifikasi domain/scheduler lengkap menyusul Tahap7.3.

Sebelum pengiriman nyata: hubungkan penyedia email, verifikasi domain dan sender, provision LOGIN worker dengan grant minimum, simpan environment, lalu uji penerimaan pada alamat yang diotorisasi. Tidak ada pengiriman ke alamat nyata selama implementasi ini. Akun tanpa email tetap onboarding; tidak ada penandaan verified palsu untuk melewati konfigurasi email.

Tautan aktivasi memakai fragment URL, dibaca ke memori lalu dibersihkan dengan history.replaceState; token tidak masuk query server atau storage browser. Token reset hanya berada di memori form, tidak pada URL/localStorage. Refresh mengharuskan memulai proses ulang.
