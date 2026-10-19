# Kerangka ruang kerja — Tahap 1.6

Halaman `/dashboard` menyediakan kerangka dashboard guru/admin berdasarkan sesi server. Login business menuju dashboard; sesi onboarding menuju `/akun`. Penyelesaian onboarding menerbitkan sesi business baru sebelum diarahkan ke dashboard. Root `/` tetap halaman pengantar publik.

Navigasi menyediakan dashboard, akun/profil, status pengembangan dan modul sesuai peran. Admin mendapat pemulihan akun dan kelompok administrasi tambahan. `/modul/[slug]` adalah halaman status yang terlindungi, bukan rute operasional modul. Registry navigasi `src/lib/navigation/modules.ts` bukan sumber kewenangan: server tetap memeriksa sesi, scope, role dan maintenance pada halaman/API. Rute modul admin tidak dapat digunakan guru dengan menulis URL secara langsung.

GET `/api/dashboard` memeriksa sesi database setiap permintaan, Origin/Sec-Fetch-Site dan scope business. DTO hanya berisi nama/peran sendiri, tanggal WIB, registry modul yang sesuai dan flag ketersediaan ringkasan. Tidak berisi credential, token, tarif, jumlah kegiatan atau nominal perkiraan. Parameter browser role/actor tidak digunakan untuk otorisasi. Cache-Control no-store.

Dashboard tidak menampilkan angka0 untuk data yang belum tersedia. Ringkasan kegiatan dan keuangan akan ditambahkan setelah modul sumbernya dibuat dan diuji. `/kesiapan` adalah catatan rilis publik dengan shell; tidak membaca akun atau berpura-pura memeriksa layanan secara langsung. Daftar modul di halaman publik adalah cakupan pengembangan, bukan pemberian izin.

## Interaksi dan aksesibilitas

- Sidebar desktop dapat diciutkan/diperluas. Hanya preferensi `sim-guru:sidebar:v1` disimpan pada localStorage; tidak ada role, actor, token atau flag onboarding.
- Kelompok menu memakai disclosure native. Halaman aktif memakai aria-current; ikon ringkas mempunyai label yang dapat diakses.
- Layar kecil memakai dialog navigasi dengan native focus trap, tombol tutup, Escape, pengembalian fokus dan penguncian scroll halaman.
- Skip link menuju main, tombol minimum44px, teks Indonesia, dukungan reduced motion, loading skeleton dan error dengan retry.
- SessionBoundary tunggal per halaman menjalankan pemeriksaan30detik, focus/visibility, heartbeat dari aktivitas dan BroadcastChannel logout. Poll tidak memperpanjang idle. Kegagalan pemeriksaan menyembunyikan konten sampai sesi dapat diperiksa lagi.
- Status onboarding/maintenance diperiksa kembali di client sebagai umpan balik dan tetap dipaksakan server. Perubahan identitas/peran memuat ulang halaman agar konten server tidak tertinggal.
- Peringatan sesi muncul pada menit terakhir; kedaluwarsa mengarahkan ke login. Konfirmasi logout menunggu revoke server sebelum sukses.

Halaman akun dan pemulihan admin memakai shell yang sama. `/profil` dan `/onboarding` tetap alias akun. Tidak ada migrasi, akun produksi atau credential baru pada tahap ini. Pengiriman email dan bootstrap admin tetap prasyarat penerimaan lifecycle produksi, bukan prasyarat membangun shell.
