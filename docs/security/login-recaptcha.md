# reCAPTCHA pada login

Implementasi menggunakan reCAPTCHA v2 **“Saya bukan robot”**, bukan v3 atau Enterprise. Widget dimuat hanya ketika fitur diaktifkan. Ukuran compact menjaga lebar formulir mobile; bahasa Indonesia, status selesai/kedaluwarsa/gagal, dan tombol muat ulang tersedia.

## Aktivasi di Vercel

1. Daftarkan situs di https://www.google.com/recaptcha/admin/create dengan jenis **v2 → kotak centang**. Daftarkan hostname kanonis `sim-guruv2.vercel.app` (atau hostname APP_URL yang benar), tanpa protokol/path. Hostname lain harus didaftarkan sendiri; jangan izinkan seluruh `vercel.app`.
2. Di pengaturan environment Vercel isi `RECAPTCHA_SITE_KEY` dengan Site Key dan `RECAPTCHA_SECRET_KEY` dengan Secret Key. Simpan Secret Key sebagai nilai sensitif/encrypted, hanya server. Jangan masukkan ke Git, frontend, log, atau obrolan.
3. Bila `RECAPTCHA_ENABLED` belum diatur, pasangan Site Key dan Secret Key yang valid otomatis mengaktifkan proteksi. Anda juga dapat menetapkan `RECAPTCHA_ENABLED=true` secara eksplisit. Jika environment sebelumnya berisi `RECAPTCHA_ENABLED=false`, ubah menjadi true untuk mengaktifkan; lakukan redeploy. `APP_URL` harus sama dengan origin aplikasi yang digunakan (login sudah mengarahkan ke host kanonis).
4. Uji centang valid → login benar, password salah → centang ulang, token kedaluwarsa, script diblokir, serta layar mobile. Daftar domain dan key Google yang nyata tidak dibuat otomatis oleh kode ini.

Tanpa flag dan tanpa key, CAPTCHA nonaktif. Key yang terisi sebagian tanpa flag, flag selain kosong/false/true, atau flag true dengan key tidak lengkap, **menolak login**, bukan melewati CAPTCHA. `RECAPTCHA_ENABLED=false` adalah penonaktifan eksplisit walaupun kedua key tersedia. `.env.example` memakai false untuk rollout lokal yang disengaja. Untuk menonaktifkan secara sengaja gunakan false lalu redeploy. Tidak menggunakan test keys Google di produksi. Tes otomatis menggunakan provider dan token sintetis, tidak menyelesaikan challenge nyata.

## Alur dan keamanan

Origin + CSRF dan JSON berbatas tetap diperiksa. Token dipisahkan dari kredensial dan tidak dikirim ke SQL. Pembatasan sumber login persisten dijalankan sebelum panggilan Google; CAPTCHA diperiksa sebelum lookup/hash kata sandi atau penerbitan sesi. Pembatasan akun, CAS kredensial, cookie dan audit login lama tetap berlaku. CAPTCHA gagal tidak mencatat kegagalan kata sandi pada akun; percobaannya tetap mengonsumsi kuota sumber.

Verifikasi POST HTTPS ke endpoint Google tetap, timeout 6 detik, no-store, tanpa redirect. Google menegakkan token sekali pakai dan kedaluwarsa dua menit. Server juga memeriksa hostname persis terhadap APP_URL. Provider down, jawaban rusak, key salah atau hostname berbeda menolak login. Token dan secret tidak dicatat. Widget yang sama direset setiap percobaan yang telah dikirim (tidak membuat iframe/widget baru pada setiap percobaan), termasuk password salah/CSRF/koneksi gagal; username dipertahankan, kata sandi dibersihkan sesuai alur lama. Tidak mengubah sesi aktif atau alur lupa password.

Secret hanya dibaca di modul server. Server Component meneruskan `enabled` dan Site Key publik, tidak meneruskan objek konfigurasi rahasia. Token hanya di memori, tidak disimpan pada draft/localStorage. reCAPTCHA memuat layanan Google; tautan privasi dan persyaratannya ditampilkan.

Dokumentasi: https://developers.google.com/recaptcha/docs/display dan https://developers.google.com/recaptcha/docs/verify.

Tidak ada migrasi database atau dependency runtime baru. Jalankan `npm run check`, pengujian login lama, dan pengujian widget sintetis sebelum rilis.

## Audit siklus hidup — 26 Oktober 2026

- Loader memakai callback unik per percobaan muat. Skrip yang sudah timeout tidak dapat menyelesaikan promise retry berikutnya; bootstrap parsial tidak dianggap ready. Timeout/error dibersihkan, promise dapat dicoba ulang.
- Token dibatalkan saat konfigurasi/widget diganti, kedaluwarsa, provider error, reset atau setelah request login. Callback widget yang sudah dilepas diabaikan; perubahan referensi callback parent tidak merender ulang widget.
- Percobaan login memakai reset widget yang ada. Gagal reset menutup akses login dan menampilkan tombol muat ulang; bukan mempertahankan status terverifikasi palsu.
- `npm run env:check -- auth` / `all` memeriksa bentuk konfigurasi CAPTCHA dan melaporkan aktif/nonaktif/tidak valid tanpa mencetak key. Pemeriksaan ini tidak membuktikan key/domain sudah diterima Google.

Verifikasi server tetap fail-closed: token/hostname/provider error, origin/CSRF, rate limit sebelum Google, dan CAPTCHA sebelum akses kredensial. Tidak ada perubahan skema atau migrasi. Uji otomatis menggunakan provider sintetis; challenge nyata dan konfigurasi domain Google memerlukan smoke produksi setelah deployment.
