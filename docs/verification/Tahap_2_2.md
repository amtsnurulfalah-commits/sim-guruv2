# Verifikasi Tahap 2.2 — Master sekolah dan akademik

19 Oktober2026. Tambahan24 skenario MA01–MA24 dan2 unit kebijakan master. Seluruh pengujian lint/TypeScript/unit/crypto/integrasi lolos:13 unit,8 crypto,118 skenario integrasi; total139 skenario substantif. Runner melaporkan146 termasuk7 parent test. Log check: stage-2.2-check.txt. Build awal setelah pengujian gagal membuka cache persistence Turbopack (`invalid digit found in string`); cache build lokal dibersihkan dan hasil build ulang dicatat terpisah pada stage-2.2-build-clean.txt. Build bersih berhasil (kompilasi, TypeScript, pengumpulan halaman dan optimasi). Tidak mengubah source untuk menyembunyikan kegagalan cache tersebut.

## Cakupan

Upgrade fixture bermigrasi1–7 ke migrasi8 mempertahankan identitas, checksum dan pengulangan no-op. Suite lain juga menerapkan seluruh migrasi pada database kosong. Batas admin/guru/onboarding, Origin/CSRF/metode, spoof actor/query, singleton sekolah, NPSN nol awal, jabatan kepala sekolah, jenjang/paralel, tahun berurutan/rentang, semester di dalam tahun, unique semester, overlap, switch aktif atomik beserta versi/audit, kelas/standar siswa, normalisasi mapel, pencarian/pagination seluruh dataset, CAS, arsip/relasi/terminal, nominal rupiah, window inklusif, versi finansial immutable, larangan backdate, tunjangan per penerima/tugas, pembatalan hanya masa mendatang, riwayat, RLS/least privilege, sanitasi HTTP dan sesi dicabut diuji.

Tes fondasi awal masih menetapkan jumlah tabel11 sehingga gagal saat bertambah menjadi19; expectation diperbarui dan seluruh tes dijalankan ulang. Tes tetap memeriksa ENABLE/FORCE RLS pada setiap tabel domain, tidak mengurangi validasi. Pengujian browser/UI tidak dianggap lulus hanya karena lint atau handler test lulus.

## Supabase native

Migrasi `20261019111051_academic_masters.sql` diterapkan setelah pemeriksaan7 checksum migrasi terdahulu; ledger menjadi8. SQL menambah8 tabel, RLS ENABLE/FORCE dan privilege minimum. Security advisor sebelum/sesudah tanpa temuan. Katalog remote mengonfirmasi19 tabel domain dengan FORCE RLS.

Probe native PostgreSQL17.11 melalui MCP memakai owner internal (MCP tidak mempunyai membership runtime business), hash Argon2id sintetis dan BEGIN/ROLLBACK. Assertion menguji sekolah/NPSN, tahun/semester, switch aktif dan versi lama, larangan arsip parent, kelas dan DTO relasi/filter, subject edit/CAS/history, batas overlap inklusif, penolakan nominal pecahan sebelum numeric cast/rounding, pembatalan tarif mendatang serta grant business/helper/auth/worker. Assertion selesai tanpa kesalahan; setelah rollback school/year/rate berjumlah0 dan pengguna tetap1 (admin bootstrap nyata yang sudah ada). Tidak ada nilai sekolah/tarif contoh tersimpan. Suite lokal memeriksa eksekusi memakai role business sebenarnya; native probe bukan uji race multikoneksi.

## Batas penerimaan

Admin bootstrap sudah dibuat sebelum tahap ini. Tidak ada perubahan password/identitas admin oleh migrasi. Verifikasi email/onboarding lengkap dan pengiriman inbox nyata tetap menunggu provider/sender/worker terkonfigurasi. CRUD master melalui browser dengan admin business nyata, tampilan mobile/keyboard/fokus dan race native multikoneksi belum menjadi bukti pada tahap ini. Tidak menonaktifkan gate onboarding untuk pengujian. Kalender/DayContext adalah Tahap2.3; kalkulasi dan snapshot honor final menyusul.

Pemeriksaan HTTPS produksi dan status deployment/CI dicatat setelah source disinkronkan. Health adalah liveness, bukan bukti CRUD penuh.
