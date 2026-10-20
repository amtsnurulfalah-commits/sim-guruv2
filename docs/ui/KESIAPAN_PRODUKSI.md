# Perapihan antarmuka dan pemeriksaan kesiapan produksi

Tanggal pemeriksaan: 21 Oktober 2026 WIB (20 Oktober UTC).
Branch: `feat/production-polish`, dasar main `dfc22986b022de178019abcdd4e2fb8f9cf8b25a`.

## Hasil dan cakupan

Antarmuka diarahkan pada tugas guru dan administrator. Perubahan hanya menyentuh
presentasi, komponen formulir, serta state pembukaan editor izin. Kontrak API,
aturan keuangan, database, migrasi, autentikasi, dan pemeriksaan RBAC server tetap
menggunakan implementasi yang sama. Tidak ada perubahan data produksi atau
pengiriman email dari pengujian ini. Kesiapan kode dan kesiapan operasi dibedakan;
hasil otomatis bukan jaminan tidak akan ada bug.

| Kelompok file | Perubahan dan alasan |
| --- | --- |
| `src/app/page.tsx`, `src/app/kesiapan/page.tsx` | Beranda menjelaskan alur kerja; halaman lama berisi panduan akun/kegiatan/bantuan, bukan tahap pembangunan. URL dipertahankan. |
| `src/components/shell/{workspace,breadcrumbs}.tsx`, `src/features/dashboard/module-cards.tsx`, `src/app/modul/[slug]/page.tsx` | Nama panduan konsisten; nomor tahap dihapus dari tampilan; modul yang belum tersedia tetap menjelaskan batas penggunaan. |
| `src/app/globals.css`, `src/features/dashboard/dashboard-view.tsx` | Garis judul, aksen batas panel dan pemisah bagian bersama; ruang modul dashboard dibedakan dari ringkasan. |
| `src/components/ui/dialog.tsx`, `src/features/programs/forms.tsx` | Deskripsi formulir sesuai beragam tindakan; `submitLabel` memisahkan pembuka dari pengiriman tanpa mengganti callback/validasi. |
| `src/features/activities/workspace.tsx` | Label izin, klaim, jurnal dan pola kehadiran diperjelas; filter diberi judul; sukses memakai status, bukan alert; counter editor memungkinkan baris izin yang sama dibuka ulang. |
| `src/features/masters/master-manager.tsx` | Label Ubah/Simpan data; pemisah panel; aturan pengisian tetap tersedia dalam rincian yang dapat dibuka. |
| `src/features/users/user-manager.tsx` | Tindakan pengguna disebut eksplisit pada konfirmasi; antrean aktivasi tetap dibedakan dari bukti email diterima; label menyembunyikan kata sandi sesuai fungsi. |
| `src/features/schedules/schedule-manager.tsx` | Nomor tahap/catatan server diganti penjelasan pengguna; label pemeriksaan bentrok, perubahan dan penghentian diperjelas; batas bagian konsisten. |
| `src/features/calendar/calendar-manager.tsx` | Pratinjau menjelaskan dampak kalender dan perlindungan data tanpa catatan tahap/integrasi. |
| `src/features/duties/duty-manager.tsx` | Konfirmasi mengikuti operasi yang dipratinjau; pembuka perubahan jadwal tidak mengklaim langsung menonaktifkan. |
| `src/features/programs/{event,exam}-manager.tsx` | Pembuka tambah/ubah berbeda dari simpan; tombol penghapusan menyatakan tahap tinjauan; BAP tetap mengikuti kondisi tambah/ubah. |
| `src/features/finance/finance-manager.tsx` | Istilah snapshot diganti rincian saat penerbitan; label cetak/pratinjau/blok diperjelas; perlindungan nilai final tetap dijelaskan. |
| `src/features/operations/managers.tsx` | Istilah operasional diperjelas; status email keamanan, email kegiatan dan pekerjaan otomatis terlihat sebelum membuka pengaturan; retry/rekonsiliasi dibedakan. |
| `src/features/migration/manager.tsx`, `src/lib/navigation/modules.ts` | Migrasi data memakai istilah pengguna; sifat privat, pemeriksaan bukti dan pemindahan layanan tidak otomatis tetap dijelaskan. |
| `tests/ui/{harness.tsx,server.ts,verify.mjs}` | Fikstur formulir pembuka/submit berbeda, baris kehadiran sintetis, pengujian buka ulang izin dan panduan; ekspektasi label CRUD diperbarui. |
| `docs/verification/http-smoke.py` | Ekspektasi halaman panduan mengikuti isi baru. |
| `docs/ui/{DESIGN_SYSTEM,AUDIT_UI_UX,KESIAPAN_PRODUKSI}.md` dan bukti JSON | Pedoman bahasa tindakan, batas bagian, cakupan perubahan dan verifikasi yang dapat ditinjau. |

## Contoh perubahan label

| Sebelumnya | Sesudah / perilaku |
| --- | --- |
| Lihat status pengembangan | Panduan penggunaan SiM-Guru |
| Simpan acara (pembuka dan submit) | Tambah/Ubah acara → Simpan acara |
| Pratinjau finalisasi (pembuka dan submit) | Tinjau finalisasi honorarium → Buat pratinjau finalisasi |
| Simpan pengaturan (pembuka) | Atur operasional aplikasi → Simpan pengaturan operasional |
| Ya, lanjutkan | Arsipkan/Nonaktifkan/Aktifkan pengguna atau Antrekan ulang email aktivasi, sesuai aksi |
| Edit / nonaktifkan | Ubah jadwal tugas |
| Periksa bentrok di server | Periksa bentrok jadwal |
| Pilih untuk izin | Ajukan izin keluar |
| Klaim hadir | Ajukan klaim kehadiran (tetap memerlukan konfirmasi yang sesuai) |
| Hapus dan balik kredit | Hapus jurnal dan batalkan JTM |
| Pratinjau hapus… | Tinjau penghapusan acara |

Navigasi, Batal/Tutup, pagination Sebelumnya/Berikutnya, serta label tindakan yang
sudah sesuai dipertahankan. Parameter API, nama aksi internal dan nomor tahap dalam
dokumentasi teknis tidak diganti untuk kepentingan tampilan.

## Pemeriksaan operasional baca-saja

- Supabase: 79 tabel domain pada `app` (39), `auth_private` (7), `finance` (15),
  `ops` (18) memakai RLS dan FORCE RLS. Role business/auth/worker tidak superuser
  dan tidak memiliki BYPASSRLS. Ini bukan audit lengkap seluruh privilege login.
- Scheduler `sim-guru-worker` aktif setiap menit. Pengaturan saat diperiksa:
  `maintenance=false`, `jobsEnabled=false`, `mailEnabled=false`,
  `securityMailEnabled=false`. Antrean email kegiatan kosong saat diperiksa. Antrean email keamanan:
  1 pending, 1 sent, 4 cancelled; nilai `sent` bukan bukti penerimaan kotak masuk.
- Flag tersebut mengendalikan pekerjaan/pengiriman latar belakang. OTP atas
  permintaan pengguna memiliki jalur langsung tersendiri (`createSecurityOtpDelivery`);
  flag nonaktif tidak membuktikan OTP langsung gagal ataupun berhasil. Penerimaan
  email nyata belum diuji dalam pekerjaan ini.
- Advisor keamanan masih melaporkan `pg_net` terdaftar pada schema `public`.
  Ekstensi digunakan penjadwal; tidak dihapus/dipindahkan tanpa rencana kompatibilitas.
  [Panduan remediasi Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).
- `npm audit --omit=dev`: 0 kerentanan yang dilaporkan pada saat pemeriksaan.

## Verifikasi kode dan antarmuka

- `npm run check`: lint, TypeScript, 30 unit test, 24 crypto/adapter/API/export
  test, 325 integrasi database dan build lulus. Total 379 pengujian otomatis.
- Lint, TypeScript dan production build dijalankan ulang setelah perapihan terakhir.
- `python docs/verification/http-smoke.py`: 12 pemeriksaan lulus terhadap
  `next start`, termasuk panduan, login, header keamanan, CSRF/origin, dan
  kegagalan database yang tertutup tanpa membocorkan detail.
- Chromium: 32 tampilan/peran unik × 7 lebar (320, 375, 767, 768, 1024, 1440,
  1920) = 224 konfigurasi lulus. Tidak ada overflow, alert tak diharapkan,
  page error atau console error pada matriks. Ini cakupan komponen/tampilan,
  bukan klaim 224 alur bisnis lengkap.
- 17 hasil skenario interaksi lulus: modal/focus/dirty/busy pada empat lebar,
  CRUD master sintetis, guard submit akun, Escape modal native, visibilitas
  kata sandi, menu role, validasi/focus field, scroll tabel keyboard,
  landscape/reduced motion, pembesaran teks 200%, drawer sentuh emulasi,
  pembuka vs submit formulir, buka ulang izin yang sama, dan panduan publik.
- Setelah penyempurnaan teks terakhir, 18 hasil skenario interaksi diulang dan
  lulus, termasuk tinjauan status operasional, label pengiriman formulir dan
  tampilan teks terakhir pada 320/1440px; seluruh error browser/server kosong.
- Tinjauan visual lokal screenshot desktop master memeriksa pemisah panel,
  hierarki judul, tombol dan rincian aturan yang dapat dibuka.
- Inventaris 211 komponen tindakan (`button`, `Button`, `DataForm`, `ActionForm`,
  `FormDialog`) disimpan sebagai bukti teks, termasuk label dinamis. Ini
  inventaris source, bukan klaim mengklik semua 211 kontrol.

Bukti: [`production-polish-browser.json`](bukti/production-polish-browser.json),
[`production-polish-final-interactions.json`](bukti/production-polish-final-interactions.json),
[`production-action-inventory.json`](bukti/production-action-inventory.json),
dan [`production-dependency-audit.json`](bukti/production-dependency-audit.json).
Browser memakai Chromium headless, data sintetis dan PGlite terisolasi; bukan
akun/database produksi. Integrasi PGlite memakai PostgreSQL 18.6 WASM, sementara
Supabase produksi merupakan layanan terpisah; hasil ini tidak membuktikan
konkurensi/pooling PostgreSQL native. Screenshot hanya ditinjau secara lokal.

## Batas kesiapan yang masih perlu dituntaskan

1. Tentukan pengaktifan pengiriman/pekerjaan otomatis sesuai kebutuhan operasional;
   tinjau antrean dan dampak sebelum mengubah pengaturan. Perubahan ini tidak
   menyalakan layanan pengiriman atau mengirim pesan kepada pengguna.
2. Jalankan uji penerimaan admin/guru nyata dan email sampai kotak masuk pada
   lingkungan yang dituju, termasuk aktivasi/pemulihan dan siklus administrasi.
3. Lengkapi bukti backup/restore dan keputusan migrasi apabila memakai data lama.
   Pengujian restore terisolasi otomatis tidak menggantikan latihan pemulihan
   produksi. Konfirmasi prosedur operasional serta penanggung jawabnya.
4. Advisor `pg_net` perlu keputusan remediasi terencana; pembacaan RLS/role tidak
   menggantikan penetration test atau audit keamanan menyeluruh.
5. Browser otomatis tidak menggantikan perangkat sentuh fisik, pembaca layar nyata,
   semua browser, atau pengujian konkurensi PostgreSQL native/Supabase.

Belum ada perubahan pada produksi dari branch ini. Penggabungan dan deployment
harus mengikuti hasil review serta pemeriksaan CI untuk commit yang sama.
