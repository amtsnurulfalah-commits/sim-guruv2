# Aktivasi operasional produksi dan UAT akun nyata

Tanggal: 21 Oktober 2026 WIB. Target: SiM-Guru v2, Supabase produksi dan
https://sim-guruv2.vercel.app. Pelaksanaan atas permintaan pengguna setelah PR #9.

## Hasil yang sudah terverifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| `jobsEnabled` | Aktif (`true`) |
| `mailEnabled` | Aktif (`true`) |
| `securityMailEnabled` | Aktif (`true`) |
| Pemeliharaan | Tidak aktif |
| Cron `sim-guru-worker` | Aktif setiap menit |
| Worker setelah remediasi | HTTP 200, tidak timeout |
| Pengiriman email aktivasi `guru-010` | Satu percobaan, diterima SMTP; pengguna kemudian mengonfirmasi email diterima di Spam |
| UAT pengguna nyata | Pengguna mengonfirmasi aktivasi dan login/dashboard berhasil |
| Bukti server UAT | Akun aktif, email terverifikasi, penggantian kata sandi selesai, pertanyaan keamanan tersedia, sesi business aktif |
| Audit UAT | `account.activated`, `auth.login_succeeded`, `account.question_updated`, `account.onboarding_completed` tercatat |
| Pekerjaan notifikasi | Completed; tidak ada notifikasi kegiatan/honor tertunda saat pemeriksaan |
| Advisor keamanan Supabase | Tidak ada temuan setelah remediasi `pg_net` |
| Regresi repository | Lint, TypeScript, 30 unit + 24 crypto/adapter/API/export + 325 integrasi database + production build lulus |

Penerimaan di Spam merupakan bukti pesan sampai ke kotak surat, bukan bukti
penempatan di Inbox. Pengguna disarankan memilih **Bukan spam** dan memercayai
pengirim yang benar. Penempatan email dikendalikan penyedia/penerima; konfigurasi
SMTP tidak dapat menjamin semua pesan masuk Inbox. Tidak ada kata sandi, OTP,
token, alamat email pribadi, isi pesan atau cookie sesi disimpan dalam laporan ini.

UAT nyata yang selesai terbatas pada pengiriman, aktivasi, pengamanan akun dan
login/dashboard. Ini bukan klaim semua alur CRUD, keuangan, perangkat dan role
sudah diuji manusia. Dua sesi onboarding sebelumnya dicabut; sesi business baru
tersedia setelah penyelesaian pengamanan akun.

## Remediasi `pg_net`

Sebelum perubahan, `pg_net` 0.20.4 terdaftar di `public`, `relocatable=false`.
Objek HTTP sebenarnya berada di `net`. Karena `ALTER EXTENSION ... SET SCHEMA`
tidak didukung, registrasi dipasang ulang di `extensions` dalam satu transaksi.

Pelaksanaan:

1. Periksa dependensi, versi default, antrean, job berjalan dan akses scheduler.
2. Pause cron secara committed; pastikan job berjalan nol dan request queue nol.
3. Kunci antrean/respons; salin respons ke tabel sementara di transaksi yang sama.
4. `DROP EXTENSION ... RESTRICT` tanpa CASCADE; pasang ulang versi default yang
   harus sama dengan versi sebelumnya, dengan registrasi schema `extensions`.
5. Pulihkan seluruh 360 respons dan nilai/status sequence request. Validasi
   jumlah respons, versi/schema dan akses scheduler; kegagalan membatalkan transaksi.
6. Restart worker `pg_net`; uji scheduler saat pengiriman masih nonaktif. Request
   verifikasi 486 kembali HTTP 200 dengan `jobs.paused=true`.
7. Setelah verifikasi, aktifkan flag dengan audit pemeliharaan dan naikkan versi
   konfigurasi dari 1 ke 2, lalu aktifkan kembali cron. Request 487/488 kembali
   HTTP 200; email keamanan diproses sekali dan request berikutnya tidak mengulangnya.

Migration source: `supabase/migrations/20261020182241_pg_net_private_registration.sql`.
Supabase MCP mencatat eksekusi pada versinya sendiri `20261020183606` dengan nama
`pg_net_private_registration`. Ledger aplikasi `sim_guru_migration.schema_migrations`
dicatat menggunakan nama source serta SHA-256 file yang sama setelah verifikasi;
jumlah migration aplikasi menjadi 24. Kedua ledger memiliki identitas masing-masing.

ACL standar objek `net` dikelola dan dimiliki Supabase. Upaya tambahan membatasi
ACL tidak lolos guard dan di-rollback; migrasi final mempertahankan ACL platform
serta memverifikasi akses scheduler. Tidak ada perubahan owner platform, edit
katalog sistem, CASCADE, atau penambahan SECURITY DEFINER untuk mengatasi izin.
Hasil advisor kosong membuktikan peringatan lokasi registrasi selesai, bukan
sertifikasi keamanan menyeluruh atau klaim bahwa ACL platform telah diperketat.

Rujukan primer:

- https://supabase.com/docs/guides/database/extensions/pg_net
- https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
- https://github.com/supabase/pg_net/blob/master/pg_net.control.in
- https://github.com/supabase/pg_net/blob/master/sql/pg_net.sql

Changelog diperiksa sebelum pelaksanaan. Versi default ekstensi diverifikasi
langsung, tidak dipaksa lewat pin versi; tidak diperlukan perubahan TLS/client.

## Pengaman honorarium masih menahan finalisasi

Worker aktif bukan berarti semua pekerjaan bisnis boleh difinalisasi. Pekerjaan
honorarium September 2026 tertahan dengan `42501`; pemeriksaan `finance.bundle`
menunjukkan `SCHOOL_SIGNATORY_MISSING`. Identitas MTs Nurul Falah belum memiliki
`headmaster_id`. Tidak ada finalisasi honorarium dipaksakan untuk melewati aturan.

Pengguna menentukan penandatangan melalui akun `guru-001`. Akun itu belum ada
di database baru. Akun harus dibuat dengan identitas/email yang benar, diaktifkan,
serta memiliki jabatan tambahan `KEPALA_SEKOLAH` sebelum dipilih pada data master.
Alamat email aktivasi masih menunggu pengguna; tidak dibuat alamat fiktif dan
tidak memilih akun admin generik sebagai kepala madrasah.

Setelah akun siap:

1. Tetapkan kepala madrasah pada **Admin → Data master → Identitas sekolah**.
2. Tinjau kelengkapan tarif, periode, kegiatan dan seluruh isu honorarium untuk
   periode sebenarnya. Jangan memfinalisasi periode kosong untuk keperluan uji.
3. Gunakan tindakan ulang pekerjaan dengan alasan yang dapat diaudit bila perlu;
   jangan menghapus riwayat kegagalan. Retry otomatis dibatasi sesuai implementasi.
4. Verifikasi hasil/periode final dan notifikasi pada pengguna yang berhak.

## Operasional berkelanjutan

- Periksa Pengaturan operasional: waktu worker terakhir, pekerjaan gagal,
  status pengiriman failed/unknown dan hasil rekonsiliasi.
- `unknown` tidak dikirim ulang otomatis; pastikan penerimaan sebelum retry.
- Pengaktifan dilakukan sebagai perubahan konfigurasi lingkungan dengan audit,
  bukan mengubah default migration agar otomatis mengirim pada instalasi baru.
- Saat restore/rollback data, nonaktifkan seluruh flag pengiriman/pekerjaan
  sebelum membuka koneksi layanan. Jangan menghidupkan backup uji sebagai produksi.
- Tidak ada uji backup/restore produksi atau penetration test baru pada pekerjaan ini.
