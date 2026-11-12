# SiM-Guru Web Push Tahap 1–2

Baseline SiM-Guru `7132ecefed936cb9541662a963b67f0f48f65c7c`. Batch ini mengerjakan kontrak, konfigurasi, enkripsi subscription, skema, dan pembatasan akses.

## Konfigurasi

`npm run env:check -- push` memeriksa konfigurasi push. Keempat flag default nonaktif sehingga deployment dapat berjalan tanpa kunci push. Saat flag diaktifkan, konfigurasi memerlukan lingkungan yang sesuai, daftar UUID pilot, key ID, kunci VAPID, alamat kontak, serta kunci enkripsi. Konfigurasi ini baru menjadi prasyarat untuk integrasi pada tahap berikutnya.

Buat kunci untuk setiap lingkungan dengan `node --conditions=react-server --import tsx scripts/generate-push-keys.ts staging /path/privat/push-staging.env`. Ganti lingkungan dan lokasi file untuk produksi. Skrip menulis file privat baru tanpa menampilkan nilainya. Pindahkan rahasia ke penyimpanan secret server sesuai lingkungan. Gunakan key ID berbeda saat rotasi, pertahankan kunci dekripsi lama untuk membaca ciphertext lama sampai migrasi selesai, dan minta subscription ulang bila kunci VAPID berganti. Kredensial runtime produksi belum dipasang.

## Skema dan akses

- Event dan pesan inbox baru memiliki keunikan berdasarkan event serta pemilik. FK komposit menjaga recipient tetap sama dari event ke pesan dan delivery.
- Subscription menyimpan ciphertext AES-256-GCM yang terikat pada pengguna, instalasi, generation, lingkungan, dan key ID. Constraint membatasi satu subscription aktif per instalasi dan satu hash endpoint aktif per lingkungan. Saat rotasi binding, buat baris subscription baru dan cabut baris lama agar histori delivery tetap konsisten.
- RLS aktif dan dipaksa pada lima tabel baru. Runtime business dapat menjalankan empat routine dengan sesi lokal yang sah untuk membaca metadata perangkat, preferensi dan inbox, serta menandai pesan sendiri dibaca.
- Migrasi menambah preferensi push dengan default nonaktif. Receipt lama tetap mengacu pada outbox. Receipt baru mengacu pada notifikasi dan pemiliknya.
- Produser event, perpindahan inbox, API perangkat, dan worker akan dihubungkan pada tahap yang sesuai. Tahap ini belum mengirim push.

## Validasi

Uji integrasi PostgreSQL WASM mencakup upgrade skema, kelangsungan receipt lama, deduplikasi, batas pemilik, sesi invalid dan onboarding, grant runtime, enkripsi terikat konteks, dan rollback transaksi. Suite database existing menguji pemasangan bersih serta pengulangan migrasi. Pemeriksaan TypeScript terarah dan dua tes kontrak juga dijalankan. Status CI, merge, dan deployment dapat diperiksa melalui PR.

Migrasi `20261112010235_push_notification_foundation.sql` memakai ledger aplikasi SiM-Guru. Bila kode perlu dikembalikan, pertahankan skema dan data baru. Sebelum rollback, tinjau kompatibilitas kode dan ledger migrasi agar runner dari versi lama tidak diterapkan pada skema yang lebih baru.
