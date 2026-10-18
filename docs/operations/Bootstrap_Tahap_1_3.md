# Bootstrap admin dan aktivasi awal

Tahap 1.3 menyediakan layanan internal dan CLI; belum ada login, form aktivasi, pengiriman email atau recovery publik. Jangan membuka layanan aktivasi langsung tanpa rate limit dan perlindungan endpoint Tahap 1.4–1.5.

## Persiapan operator

1. Pasang Node 24/npm 11, jalankan `npm ci`, lalu tinjau `npm run db:migrate` dan prosedur migrasi Tahap 1.2. Terapkan empat migrasi melalui koneksi migrasi terpisah.
2. Provision satu LOGIN operator dengan membership hanya `sim_guru_bootstrap`, tanpa superuser, BYPASSRLS atau membership owner/auth/business. Isi `BOOTSTRAP_DATABASE_URL` melalui secret manager; jangan gunakan koneksi runtime aplikasi.
3. `npm run admin:bootstrap` hanya menampilkan rencana. Untuk eksekusi lokal gunakan `npm run admin:bootstrap -- --apply`. Target remote membutuhkan tambahan `--allow-remote`.
4. Masukkan username, nama lengkap dan password sementara melalui prompt tersembunyi. Password minimal 20 code point dan memenuhi kompleksitas serta larangan unsur identitas. Password tidak diterima lewat argumen CLI. Untuk otomasi, gunakan `--stdin` dengan objek JSON berisi `username`, `fullName`, `temporaryPassword` dari secret manager melalui pipe; jangan menuliskannya pada command line atau shell history.
5. Hasil sukses hanya memuat ID dan status. Password sementara kedaluwarsa 24 jam, wajib diganti; business scope tetap diblokir sebelum onboarding email dan pertanyaan keamanan. Tahap ini tidak menyediakan UI untuk menyelesaikannya.

Pengulangan terhadap username/nama admin aktif yang sama tidak mengganti hash dan boleh tanpa temporaryPassword. Target berbeda, tidak aktif, credential hilang atau password sementara kedaluwarsa memerlukan jalur recovery terkontrol; CLI tidak menghidupkan atau mereset akun diam-diam. Pembuatan pertama diserialisasi dengan advisory lock.

## Aktivasi internal

`AccountActivationService` memerlukan executor auth dan runner transaksi yang memasang konteks admin terverifikasi; implementasi HTTP disambungkan pada tahap berikutnya. Invite membuat profil pending, challenge dan outbox dalam satu transaksi. Token acak 32 byte berumur 24 jam; database challenge menyimpan SHA-256 digest. Secret outbox memakai AES-256-GCM, nonce acak dan AAD yang mengikat akun, email, challenge dan outbox. Isi `AUTH_OUTBOX_ENCRYPTION_KEY` dengan tepat 64 digit hex dari CSPRNG, versi key 1. Jangan merotasi key tanpa prosedur migrasi atau penerbitan ulang; dukungan multi-key belum dibuat.

Return `queued` berarti antrean tersimpan, bukan email terkirim. Worker email dan lease/retry belum diimplementasikan. Penerbitan ulang membatalkan challenge sebelumnya. Aktivasi yang berhasil memverifikasi alamat tujuan, membuat hash password, mencabut sesi lama, menghapus secret outbox dan tetap mewajibkan pertanyaan keamanan. Jangan log password, token, ciphertext atau URL koneksi.

## Verifikasi

`npm run check`, `python docs/verification/http-smoke.py`, `npm run auth:benchmark`. Benchmark hanya mengukur container lokal. Native PostgreSQL, koneksi TCP/pool Supabase, race antarkoneksi dan deployment Vercel harus diverifikasi pada lingkungan target sebelum penerimaan produksi.
