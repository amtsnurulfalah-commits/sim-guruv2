# reCAPTCHA pada login

Implementasi menggunakan reCAPTCHA v2 **“Saya bukan robot”**, bukan v3 atau Enterprise. Widget dimuat hanya ketika fitur diaktifkan. Ukuran compact menjaga lebar formulir mobile; bahasa Indonesia, status selesai/kedaluwarsa/gagal, dan tombol muat ulang tersedia.

## Aktivasi di Vercel

1. Daftarkan situs di https://www.google.com/recaptcha/admin/create dengan jenis **v2 → kotak centang**. Daftarkan hostname kanonis `sim-guruv2.vercel.app` (atau hostname APP_URL yang benar), tanpa protokol/path. Hostname lain harus didaftarkan sendiri; jangan izinkan seluruh `vercel.app`.
2. Di pengaturan environment Vercel isi `RECAPTCHA_SITE_KEY` dengan Site Key dan `RECAPTCHA_SECRET_KEY` dengan Secret Key. Simpan Secret Key sebagai nilai sensitif/encrypted, hanya server. Jangan masukkan ke Git, frontend, log, atau obrolan.
3. Set `RECAPTCHA_ENABLED=true` pada environment tujuan setelah kedua key siap; lakukan redeploy. `APP_URL` harus sama dengan origin aplikasi yang digunakan (login sudah mengarahkan ke host kanonis).
4. Uji centang valid → login benar, password salah → centang ulang, token kedaluwarsa, script diblokir, serta layar mobile. Daftar domain dan key Google yang nyata tidak dibuat otomatis oleh kode ini.

Default `RECAPTCHA_ENABLED=false` mempertahankan akses login sebelum konfigurasi tersedia. Flag selain kosong/false/true, atau flag true dengan key tidak lengkap, **menolak login**, bukan melewati CAPTCHA. Untuk menonaktifkan secara sengaja gunakan false lalu redeploy. Tidak menggunakan test keys Google di produksi. Tes otomatis menggunakan provider dan token sintetis, tidak menyelesaikan challenge nyata.

## Alur dan keamanan

Origin + CSRF dan JSON berbatas tetap diperiksa. Token dipisahkan dari kredensial dan tidak dikirim ke SQL. Pembatasan sumber login persisten dijalankan sebelum panggilan Google; CAPTCHA diperiksa sebelum lookup/hash kata sandi atau penerbitan sesi. Pembatasan akun, CAS kredensial, cookie dan audit login lama tetap berlaku. CAPTCHA gagal tidak mencatat kegagalan kata sandi pada akun; percobaannya tetap mengonsumsi kuota sumber.

Verifikasi POST HTTPS ke endpoint Google tetap, timeout 6 detik, no-store, tanpa redirect. Google menegakkan token sekali pakai dan kedaluwarsa dua menit. Server juga memeriksa hostname persis terhadap APP_URL. Provider down, jawaban rusak, key salah atau hostname berbeda menolak login. Token dan secret tidak dicatat. Widget direset setiap percobaan yang telah dikirim, termasuk password salah/CSRF/koneksi gagal; username dipertahankan, kata sandi dibersihkan sesuai alur lama. Tidak mengubah sesi aktif atau alur lupa password.

Secret hanya dibaca di modul server. Server Component meneruskan `enabled` dan Site Key publik, tidak meneruskan objek konfigurasi rahasia. Token hanya di memori, tidak disimpan pada draft/localStorage. reCAPTCHA memuat layanan Google; tautan privasi dan persyaratannya ditampilkan.

Dokumentasi: https://developers.google.com/recaptcha/docs/display dan https://developers.google.com/recaptcha/docs/verify.

Tidak ada migrasi database atau dependency runtime baru. Jalankan `npm run check`, pengujian login lama, dan pengujian widget sintetis sebelum rilis.
