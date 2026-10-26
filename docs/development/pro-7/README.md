# PRO-7 — Pemasangan, kalender, riwayat dan pembaruan

Baseline main `fdc7a99c865ddcc6bb8f922ac28ea5a4ce264a94` (PR76/PRO-6). Pengelola mengizinkan implementasi, merge dan migrasi jika diperlukan pada 26 Oktober 2026 WIB.

## Fitur

1. **Pemasangan aplikasi**: manifest/id stabil, start `/dashboard` dengan pemeriksaan sesi existing, ikon PNG192/512 dari ikon SVG existing, Apple metadata dan petunjuk di `/pembaruan`. Prompt hanya atas klik pengguna setelah browser menawarkan dukungan. Tidak ada service worker, Cache Storage, background sync, atau pengiriman ulang offline. Data/transaksi tetap online; pembaruan melalui reload manual setelah proses simpan dipastikan.
2. **Kalender pribadi** `/agenda`: rentang maksimal31hari, maksimal2000kejadian. Membaca jadwal KBM/piket/upacara, penugasan ujian, kejadian efektif/pengganti/alokasi dan acara existing. Tidak mematerialisasi atau menulis jadwal. Rencana disembunyikan ketika kejadian sumber sudah ada, termasuk yang dihapus, sehingga tidak menghidupkan kembali jadwal batal. UID memakai jenis+sumber+tanggal, stabil ketika rencana menjadi kejadian. Acara yang dapat diikuti ditandai “tersedia”, bukan kewajiban/konfirmasi kehadiran. Alokasi JTM memakai rentang kegiatan sumber, bukan jam kerja parsial yang tidak tersimpan.
3. **Unduhan `.ics`** privat: tanggal/jam WIB dikonversi UTC, committee tanpa jam khusus menjadi all-day dengan akhir eksklusif; UID opaque per akun, UTF8 folding75byte/escaping sesuaiRFC5545. Unduhan snapshot bukan subscription. Pengguna perlu menghapus impor lama lalu impor ulang setelah perubahan/pembatalan; file yang telah diunduh berada di luar kendali logout aplikasi.
4. **Riwayat perubahan** `/riwayat-perubahan`: audit existing, terbaru100 dalam31hari. Admin dapat membaca kategori yang diizinkan; guru melihat tindakan sendiri, perubahan jadwalnya dan penugasan terkait (termasuk alokasi yang pernah diterima). Nama/alasan pihak lain disamarkan, tidak mengembalikan raw old_data/new_data. Label field berubah berasal dari perbandingan whitelist. Keterbatasan before/after ditampilkan, tidak direkonstruksi. Tidak ada jalur mutasi bukti audit.
5. **Catatan pembaruan** `/pembaruan`: public dengan pemeriksaan sesi PublicWorkspace existing, kategori fitur/perbaikan/tindakan, tautan `/kesiapan`. Footer menampilkan penanda baru tanpa toast/popup berulang. Penanda sudah dibaca per tab/akun+role, dihapus bersama preferensi saat logout; bukan notifikasi email/inbox baru.

## Database dan keamanan

Migrasi37: `20261026120030_pro7_personal_calendar_history.sql`, SHA256 `a768404e75a79f4b238dce58b7082dbd2e2bd0f3fc039611704b13182acb018e`.

Dua RPC read model baru `app.personal_calendar(text,date,date)` dan `app.personal_history(text,date,date)`. Owner `sim_guru_owner`, search_path=pg_catalog, grant hanya owner+business; PUBLIC/auth/worker tidak boleh EXECUTE. Keduanya memanggil activity_guard/lifecycle/resolve_actor existing. Tidak memakai Supabase Auth/anon atau mengubah hak tabel. Tidak menambah tabel, index, jadwal paralel, tarif, ledger, antrean, audit palsu atau perubahan sesi/cron.

API hanya GET dengan private no-store, cookie business session, cross-site read guard dan strict range (tanpa parameter userId). Kalender selalu akun sendiri termasuk ketika admin. Audit memberi lingkup admin eksplisit di SQL, bukan parameter client. Target routine ada pada [routine-targets](routine-targets.json).

## Batas penerimaan

PRO-3 backup produksi/RPO/RTO/inbox dan PRO-4 perangkat fisik masih mengikuti gate lamanya. Instruksi pengelola menjalankan PRO-7 digunakan untuk rilis teknis bertahap; tidak dianggap bukti seluruh prasyarat diterima. Uji OS install/update/launch, Safari/perangkat fisik, import aplikasi kalender sasaran dan pemahaman pengguna belum dilakukan. Jangan mengklaim offline atau sinkron kalender otomatis.

## Referensi primer yang diperiksa

- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- https://www.rfc-editor.org/rfc/rfc5545.html
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/changelog (Markdown endpoint tidak dapat dibaca; HTML diperiksa. Perubahan TLS HTTP API tidak mengubah koneksi Postgres/pooler aplikasi ini.)

Lihat [validasi](VALIDATION.md) dan [checkpoint](CHECKPOINT.md).
