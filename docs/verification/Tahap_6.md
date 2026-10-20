# Verifikasi Tahap 6.1–6.5

`npm run check` lulus lint, typecheck,22unit,13crypto/export,295runner database dan build. Total330runner termasuk15parent, atau315skenario substantif. Suite finance berisi24runner/23skenario. Bukti: `stage-6-check.txt`, `stage-6-finance-tests.txt`.

Golden fixtures mencakup dua jadwal libur2+3, cancel/regenerate tanpa inflasi, waive melalui pratinjau, izin klip210/420, extra attendee eksplisit, blok transport, batas10333.33/10333.34/10666.66/10666.67, H-1 acara3×0.8=2.4, honor7.4×10001=74007.4→74007, periode nol, penolakan final bulan berjalan, stale actor/source preview, koreksi berbasis revisi terakhir dan penolakan pembayaran negatif. Trigger kegagalan sintetis pada slip kedua membuktikan rollback seluruh slip/periode/outbox. Trigger itu hanya dipasang dalam database uji disposable, tidak termasuk migrasi produksi.

PDF dan XLSX diuji melalui handler dengan sesi internal nyata. XLSX juga lolos pemeriksaan ZIP CRC, XML dan pembacaan openpyxl. Verifikasi publik diuji untuk masking, tidak bocor nominal/NIP, hash token saja, status corrected dan limit30/IP/menit. Ekspor memakai seluruh filter dalam transaksi repeatable-read, bukan halaman UI saat ini.

Migrasi incremental sudah diterapkan setelah seluruh checksum lama cocok. Database produksi memiliki18migrasi dan69tabel FORCE RLS; security advisor0temuan. Delapan pemeriksaan native pada `stage-6-native-rollback.sql` lulus (pembulatan, engine nol, durasi/izin, raw transport, jadwal kosong/extra, immutability, privasi/status verifikasi, guard final). Seluruh fixture di-rollback, akun probe tersisa0, tidak ada email dikirim. Ini tidak membuktikan race native dua koneksi atau CRUD browser akun produksi.

Implementasi dan prasyarat operasional: [runbook](../operations/Honorarium_Tahap_6.md). Rilis Vercel dan pemeriksaan HTTP publik dicatat setelah deployment terverifikasi. Otomasi dan pengiriman notifikasi honor masih Tahap7.
