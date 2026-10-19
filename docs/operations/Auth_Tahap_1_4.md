# Login, sesi dan logout — Tahap 1.4

Autentikasi memakai username/password lokal SiM-Guru, Argon2id dan sesi opaque di PostgreSQL. Tidak ada Central SSO, Supabase Auth atau registrasi publik. UI tersedia pada `/login` dan `/akun`; halaman akun adalah status sesi/onboarding, bukan dashboard kegiatan.

## Kontrak HTTP

Semua endpoint mengembalikan envelope `{ok,data,requestId}` atau `{ok:false,error:{code,message},requestId}`, dengan Cache-Control no-store. Token sesi dan hash tidak ada dalam JSON. Cookie production `__Host-sim_guru_session`: Secure, HttpOnly, SameSite=Lax, Path=/, tanpa Domain. Development memakai nama terpisah.

| Endpoint | Metode | Input dan hasil |
|---|---|---|
| /api/auth/csrf | GET | Default intent=login: cookie prelogin HttpOnly + data.csrfToken; intent=session: token CSRF terikat sesi sah |
| /api/auth/login | POST | JSON username/password, Origin canonical dan X-CSRF-Token prelogin. Sukses menyetel cookie, data.session dan redirectTo=/akun |
| /api/auth/session | GET | Cookie sesi; status sesi saja, tidak memperpanjang idle |
| /api/auth/session | POST | Cookie sesi, Origin dan X-CSRF-Token sesi; heartbeat aktivitas memperpanjang idle sampai batas absolut |
| /api/auth/logout | POST | Cookie sesi, Origin dan X-CSRF-Token sesi; revoke server, hapus cookie, data.loggedOut=true |

Login menormalisasi username dengan trim/lowercase; password tidak dipangkas atau dinormalisasi. Body JSON dibatasi 8 KiB. Akun tidak ditemukan memakai dummy Argon2; akun salah password/pending/nonaktif/password sementara kedaluwarsa menerima INVALID_CREDENTIALS yang sama. Login sukses merotasi token dan mencabut token browser sebelumnya jika dikirim.

401: INVALID_CREDENTIALS atau UNAUTHENTICATED. 403: FORBIDDEN, CSRF_INVALID, ONBOARDING_REQUIRED. 422: VALIDATION_ERROR. 429: RATE_LIMITED disertai Retry-After. 503: UNAVAILABLE/MAINTENANCE. Kesalahan tak dikenal: 500 INTERNAL_ERROR. Tidak ada stack/password/token/URL koneksi dalam error.

## CSRF dan Origin

Setiap POST auth memeriksa Origin terhadap APP_URL canonical. Tidak ada wildcard Vercel origin, CORS permisif atau pengecualian Origin hilang. Halaman login/akun mengalihkan alias noncanonical ke APP_URL agar cookie dan Origin tetap konsisten. GET auth menolak Sec-Fetch-Site cross-site dan Origin yang berbeda bila dikirim.

CSRF bertanda tangan HMAC dengan SESSION_SECRET, purpose login/session, binding opaque cookie, nonce acak dan TTL 15 menit. Cookie prelogin tidak ditampilkan dalam JSON. Token CSRF berada pada memori komponen, bukan localStorage. CSRF prelogin tidak dapat dipakai sebagai CSRF sesi. Logout tidak tersedia melalui GET.

## Rate limit dan proxy

IP: maksimal 30 usaha login per bucket database 15 menit. Bucket fixed dapat memiliki burst pada batas pergantian bucket; bukan sliding window. Akun: 5 kegagalan pada window 15 menit, cooldown 15 menit sejak kegagalan kelima. Berhasil hanya menghapus failure akun tersebut; counter IP tidak direset. Key memakai HMAC dengan domain separation; raw IP/username tidak disimpan pada tabel rate/audit gagal.

Counter IP dikomit sebelum verifikasi akun. Transaksi auth memegang advisory lock akun selama verifikasi Argon2 sehingga request serentak akun yang sama diserialisasi. Runtime memakai lock_timeout 3 detik dan statement_timeout 10 detik; kegagalan lock menolak request, tidak melewati limit. Baris counter kedaluwarsa perlu cleanup job tahap berikutnya; state akun lama dibersihkan saat akun disentuh ulang.

Production hanya mempercayai `x-vercel-forwarded-for` saat env VERCEL=1; header tersebut ditulis ulang edge Vercel. Nilai harus satu IP sah, IPv6 dinormalisasi. Header forwarding kiriman client di development diabaikan dan semua request dev berbagi key local-development. Deployment mandiri/proxy lain memerlukan adapter trusted proxy tersendiri; tidak otomatis mempercayai X-Forwarded-For.

## Sesi, onboarding dan maintenance

Sesi maksimal 24 jam, idle 2 jam. Setiap verifikasi membaca status akun, auth_version, revocation, expiry dan kesiapan onboarding dari database. Tidak ada cache sesi antarrequest. Session polling 30 detik hanya membaca; pointer/keyboard pada tab terlihat memicu heartbeat maksimal satu per menit. Sesi scope onboarding tidak dapat mengakses bisnis.

Maintenance minimal adalah system_settings key maintenance.enabled dengan typed_value JSON boolean. Guru tidak dapat login selama maintenance; sesi guru yang sudah ada masih dapat membaca status/logout, tetapi guard bisnis server dan app.actor_id() menolak akses bisnis. Admin tetap dapat login; halaman konfigurasi maintenance belum dibuat. Perubahan setting hanya melalui jalur operator yang berwenang sampai modul admin tersedia.

Logout memakai modal konfirmasi, menunggu revoke server sebelum menampilkan sukses, kemudian BroadcastChannel memberi tahu tab lain. Focus/visibility dan polling tetap memverifikasi ulang sesi bila BroadcastChannel tidak tersedia. Broadcast hanya membawa kata logout, tanpa token atau identitas. Replay cookie tab lama ditolak server setelah revoke.

## Operasi dan batas produksi

Lima migrasi domain sekarang harus tercatat pada ledger aplikasi. Migrasi 005 menambah routine HTTP/rate/maintenance; tabel tetap 11. File dihasilkan lewat Supabase CLI lalu disesuaikan dengan format urutan 12 digit repository agar tidak tersortir sebelum migrasi 001–004. Jangan mengubah checksum migrasi yang sudah diterapkan.

Environment wajib: APP_URL HTTPS production, APP_TIMEZONE=Asia/Jakarta, DATABASE_URL dan AUTH_DATABASE_URL dengan LOGIN berbeda, DB_POOL_MAX=2, serta tiga secret auth terpisah. Pooler harus memakai prepare:false dan SSL; LOGIN aplikasi tidak boleh superuser/owner/bypassrls. Belum ada password default/admin nyata yang dibuat. Koneksi runtime production tetap menunggu host Transaction pooler. Tanpa konfigurasi lengkap, login sah menolak dengan 503; health liveness tidak membuktikan database siap.

Onboarding lengkap, ganti password, email OTP, pemulihan dan worker email diselesaikan pada Tahap 1.5. Akun bootstrap masih terbatas sampai lifecycle tersebut selesai. Jangan menghapus flag onboarding atau menulis email_verified_at untuk mengakali UI.

Referensi: https://nextjs.org/docs/app/guides/authentication , https://nextjs.org/docs/app/api-reference/functions/cookies , https://vercel.com/docs/headers/request-headers .
