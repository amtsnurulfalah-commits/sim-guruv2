# Verifikasi Tahap 1.5

## Cakupan

Profil sendiri, password permanen, verifikasi email OTP, pertanyaan keamanan, onboarding dengan rotasi sesi, aktivasi HTTP, lupa password email/admin/pertanyaan tambahan, capability reset, persetujuan admin dengan handover satu kali, encrypted outbox dan adapter Resend minimum. UI berbahasa Indonesia. Email produksi belum aktif; akun nyata tidak dibuat.

## Hasil lokal

`npm run check` lulus: ESLint tanpa warning, TypeScript strict, 10 unit, 8 crypto, 24 skenario fondasi database, 10 akun, 13 HTTP/auth dan 23 lifecycle LC01–LC23. Total88 skenario substantif. Runner database menghitung74 termasuk4 parent suite; total runner92. Build Next.js produksi lulus. Log: stage-1.5-check.txt.

LC memeriksa proof password, reuse/policy/CAS, pencabutan sesi atomik, NIP/telepon, larangan overposting, normalisasi jawaban, onboarding tanpa email, HMAC/AES OTP, cooldown, lima percobaan salah yang tetap tersimpan, purpose binding, verifikasi email/revoke, rotasi sesi, forgot generik, reset5menit/sekali pakai/expiry/tamper, persetujuan admin berbasis request/bukti, larangan target bebas, handover tanpa secret di audit, privilege worker, lease, idempotency adapter, klasifikasi failure, tampered ciphertext, Origin/CSRF/no-store dan rate limit persisten.

Adapter provider diuji dengan fetch sintetis dan pesan in-memory yang tidak dikirim. Database lokal menggunakan PostgreSQL WASM/PGlite, satu koneksi terantre, bukan bukti race multi-koneksi native. Setelah pemformatan source, lint/typecheck diperiksa ulang. Satu build awal menolak re-export konfigurasi dynamic; diperbaiki menjadi export statis di masing-masing alias sebelum full check akhir.

## Supabase remote

Migrasi `20261019055727_account_lifecycle.sql` dihasilkan CLI Supabase2.121.0 dan diterapkan sebagai `account_lifecycle_stage_1_5`. Lima checksum lama dicek sebelum penerapan; ledger kini6 migrasi. File historis tidak diubah. Security advisor setelah migrasi: tidak ada temuan.

Probe native SQL melalui MCP dalam transaksi rollback menguji context sendiri, penolakan onboarding tanpa email, antrean OTP, lima kesalahan, penolakan setelah batas, konsumsi OTP sah, penetapan email, revoke sesi dan penghapusan secret. Fixture menggunakan hash Argon2id nyata sintetis dan seluruh perubahan di-rollback; akun aplikasi tetap0. Probe ini dijalankan sebagai owner internal karena koneksi MCP tidak berhak SET ROLE ke runtime auth; tidak memperluas membership untuk mengakali pengujian. Katalog privilege mengonfirmasi auth tidak boleh claim outbox dan worker boleh. Uji role runtime penuh tersedia pada suite lokal dan jalur HTTPS produksi.

## Batas penerimaan

Pengiriman ke inbox nyata, DNS/domain sender, API key provider, LOGIN worker produksi dan scheduler belum dikonfigurasi. Environment mail produksi belum tersedia. Tidak ada pesan nyata dikirim. Aktivasi/onboarding/reset sukses akun produksi belum dibuktikan karena belum ada akun dan layanan email; tidak ada flag verified palsu atau akun dummy permanen. Browser multitab, fokus/keyboard/mobile dan race native multi-koneksi masih acceptance lanjutan.

Tahap2.1 adalah manajemen pengguna. Tahap7.3 melengkapi worker/scheduler dan notifikasi domain; worker security minimum tahap ini dapat dipanggil operator setelah provider siap.

## Deployment dan HTTPS produksi

Commit implementasi `c2d5458962b6f40eb9f6727bc53090c5057173cd`, deployment `dpl_8PxPYPuj7xLEWzDfG99TvL9eoZhX`: READY. Workflow Pemeriksaan fondasi: success. Dua belas pemeriksaan HTTPS lulus; hasil stage-1.5-production-smoke.json. Meliputi halaman/login/pemulihan/aktivasi, CSRF cookie Secure, Origin403, forgot generik melalui database, OTP/reset capability palsu422, profil/admin anonim401 dan aktivasi GET405. Tidak ada akun/sesi/email dibuat; hanya counter rate limit bertambah.

Browser cloud memverifikasi rendering halaman pemulihan (form username, metode, jawaban dan keterangan) dan screenshot desktop. Console tidak menampilkan error aplikasi; ada satu pesan dari ekstensi browser, bukan origin aplikasi. Tidak mengetik password/OTP atau menjalankan alur akun nyata. Runtime error scan10menit pada rute baru: tidak ada error yang ditemukan. Ini bukan bukti tanpa error selamanya atau pengiriman email end-to-end.
