# Audit halaman tidak ditemukan

## Alur dan temuan

- `app/not-found.tsx` menangani URL publik yang tidak cocok. Tidak ada CRUD, data bisnis, filter, form, atau panggilan API milik halaman ini.
- `/modul/[slug]` memanggil `notFound()` sebelum membaca sesi jika slug tidak dikenal. Jalur ini berada di `(workspace)`, yang memiliki main, skip target, SessionBoundary, dan kontrol akun sendiri. Fallback umum sebelumnya memiliki main/id sendiri; memakai konten yang sama langsung dalam workspace berisiko landmark/target ganda.
- Navigasi pemulihan sebelumnya hanya satu tautan ke beranda. Pengguna perlu jalur yang jelas untuk kembali bekerja atau membaca panduan.
- Main publik sebelumnya tidak dapat menjadi target fokus eksplisit. Tambahan `tabIndex={-1}` membuat skip link dapat memindahkan fokus ke konten.
- Judul tab tetap dikelola layout Next.js. Percobaan ekspor metadata fallback tidak mengubah judul publik; penambahan title manual menghasilkan judul ganda sehingga tidak disertakan dalam kode final.

## Perubahan

Konten reusable `NotFoundState` menyediakan heading, penjelasan singkat, tujuan Beranda/Dashboard/Panduan, dan petunjuk menghubungi administrator. Ikon dekoratif disembunyikan dari pembaca layar; label tautan selalu terlihat. Fallback root kini memakai PublicWorkspace bersama Panduan Aplikasi, dengan satu SessionBoundary kanonis. Status akun, kontrol keluar, sidebar, heartbeat, dan pembersihan sesi yang benar mengikuti mekanisme yang sudah ada. Saat pemeriksaan awal belum selesai, konten statis memakai satu main dengan tinggi alami agar tetap tersedia tanpa JavaScript. Fallback `(workspace)/not-found.tsx` memakai mode embedded tanpa main/brand tambahan.

Tidak ada autentikasi alternatif, otorisasi berbasis storage, penghapusan cookie/draft hanya karena halaman 404, manipulasi browser history, penayangan URL/query pengguna, atau prefetch tujuan privat. Sesi diperiksa melalui API kanonis;401 yang terkonfirmasi tetap menghapus identitas/draft terverifikasi sesuai kebijakan sesi, sedangkan gangguan sementara mempertahankan sesi yang sudah terverifikasi. Proteksi Dashboard dan lifecycle SessionBoundary area kerja tetap berlaku. Pengunjung anonim yang membuka modul privat tetap mengikuti redirect login yang sudah ada; gangguan pemeriksaan sesi masih menyediakan retry. Konten 404 publik tetap dapat dibaca saat pemeriksaan sesi gagal dan tanpa JavaScript; pengunjung anonim tidak dipaksa login oleh halaman404.

Styling memakai token/komponen bersama; tidak ada CSS global, dependensi, migrasi database, atau konfigurasi produksi baru. Pada layar pendek/pembesaran teks, halaman dapat menggulir vertikal secara alami tanpa konten terpotong.

## Status HTTP dan keterbatasan

URL publik yang tidak cocok mengembalikan HTTP 404. Route modul dinamis dapat mengirim HTTP 200 karena response sudah streaming sebelum `notFound()`, sebagaimana perilaku Next.js yang sudah ada; UI tetap menampilkan fallback dan robots noindex dari framework. Audit ini tidak menambahkan rewrite/proxy untuk memaksa status atau mengubah arsitektur routing.

Referensi: https://nextjs.org/docs/app/api-reference/file-conventions/not-found

## Validasi

- `npm run test:ui:not-found` memakai build produksi Next.js dan sesi sintetis di localhost.
- 32 kombinasi: publik/workspace × 8 viewport (280–1920 piksel, termasuk landscape) × teks 100%/200%.
- Tepat satu main, h1, skip target, dan title; tidak ada nested main, overflow horizontal, atau teks terpotong.
- Area sentuh minimal 44 piksel, tautan dan fokus keyboard, skip link, root404 tanpa JavaScript, URL panjang/query tidak direfleksikan.
- Kedua peran mempertahankan kontrol akun saat menuju Dashboard/Panduan dan kembali melalui riwayat router dari404 publik maupun modul. Draft valid milik akun dan cookie sintetis tetap ada; tidak ada permintaan logout. Gangguan sementara setelah sesi terverifikasi mempertahankan kontrol akun; logout dibatalkan tidak mengakhiri sesi.401 yang terkonfirmasi pada404 publik menghapus identitas terverifikasi/draft dan mempertahankan konten404 publik, bukan berpura-pura masih login.
- Sesi loading, layanan sesi gagal/retry, redirect anonim ke batas login; halaman/login sesungguhnya memiliki suite sendiri (target login difixture agar tidak memerlukan konfigurasi/akun nyata).
- Nol page error/console error yang tidak diharapkan. Error HTTP404 serta401/503 sintetis yang diharapkan tidak dihitung sebagai JavaScript error.
- Regresi Panduan:16 kombinasi tampilan, kedua peran, onboarding/maintenance,503/retry, heartbeat, logout-cancel, dan expiry. Regresi draft: lifecycle sesi dan perpindahan akun tetap aman.
- Lint, typecheck, 160 unit test, build produksi; CI repositori memeriksa regresi lengkap sebelum merge.

Tidak ada email nyata, kredensial produksi, atau perubahan data bisnis saat pengujian. Pengujian authenticated end-to-end memakai fixture browser, bukan akun produksi nyata.

## Penyebab laporan tampak logout

Fallback404 publik sebelumnya berada di luar shell yang membaca sesi, sehingga tidak menampilkan identitas/menu akun dan tidak memasang lifecycle sesi. Pembukaan halaman ini sendiri tidak ditemukan menghapus cookie. Perbaikan menyatukan lifecycle halaman publik dengan mekanisme Panduan, bukan melewati pemeriksaan sesi atau memperpanjang sesi yang sudah kedaluwarsa. `pendingPublicFallback` hanya digunakan jika SessionBoundary mempunyai publicFallback; route privat tetap memakai skeleton dan guard yang sama.
