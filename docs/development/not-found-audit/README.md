# Audit halaman tidak ditemukan

## Alur dan temuan

- `app/not-found.tsx` menangani URL publik yang tidak cocok. Tidak ada CRUD, data bisnis, filter, form, atau panggilan API milik halaman ini.
- `/modul/[slug]` memanggil `notFound()` sebelum membaca sesi jika slug tidak dikenal. Jalur ini berada di `(workspace)`, yang memiliki main, skip target, SessionBoundary, dan kontrol akun sendiri. Fallback umum sebelumnya memiliki main/id sendiri; memakai konten yang sama langsung dalam workspace berisiko landmark/target ganda.
- Navigasi pemulihan sebelumnya hanya satu tautan ke beranda. Pengguna perlu jalur yang jelas untuk kembali bekerja atau membaca panduan.
- Main publik sebelumnya tidak dapat menjadi target fokus eksplisit. Tambahan `tabIndex={-1}` membuat skip link dapat memindahkan fokus ke konten.
- Judul tab tetap dikelola layout Next.js. Percobaan ekspor metadata fallback tidak mengubah judul publik; penambahan title manual menghasilkan judul ganda sehingga tidak disertakan dalam kode final.

## Perubahan

Konten reusable `NotFoundState` menyediakan heading, penjelasan singkat, tujuan Beranda/Dashboard/Panduan, dan petunjuk menghubungi administrator. Ikon dekoratif disembunyikan dari pembaca layar; label tautan selalu terlihat. Fallback root memakai satu main dengan tinggi minimum viewport dan tinggi konten alami. Fallback `(workspace)/not-found.tsx` memakai mode embedded tanpa main/brand tambahan.

Tidak ada auth baru, penghapusan cookie/draft, redirect otomatis, manipulasi browser history, penayangan URL/query pengguna, atau prefetch tujuan privat. Proteksi Dashboard dan lifecycle SessionBoundary area kerja tetap berlaku. Pengunjung anonim yang membuka modul privat tetap mengikuti redirect login yang sudah ada; gangguan pemeriksaan sesi masih menyediakan retry. Halaman publik tetap dapat dibaca tanpa server auth dan tanpa JavaScript.

Styling memakai token/komponen bersama; tidak ada CSS global, dependensi, migrasi database, atau konfigurasi produksi baru. Pada layar pendek/pembesaran teks, halaman dapat menggulir vertikal secara alami tanpa konten terpotong.

## Status HTTP dan keterbatasan

URL publik yang tidak cocok mengembalikan HTTP 404. Route modul dinamis dapat mengirim HTTP 200 karena response sudah streaming sebelum `notFound()`, sebagaimana perilaku Next.js yang sudah ada; UI tetap menampilkan fallback dan robots noindex dari framework. Audit ini tidak menambahkan rewrite/proxy untuk memaksa status atau mengubah arsitektur routing.

Referensi: https://nextjs.org/docs/app/api-reference/file-conventions/not-found

## Validasi

- `npm run test:ui:not-found` memakai build produksi Next.js dan sesi sintetis di localhost.
- 32 kombinasi: publik/workspace × 8 viewport (280–1920 piksel, termasuk landscape) × teks 100%/200%.
- Tepat satu main, h1, skip target, dan title; tidak ada nested main, overflow horizontal, atau teks terpotong.
- Area sentuh minimal 44 piksel, tautan dan fokus keyboard, skip link, root404 tanpa JavaScript, URL panjang/query tidak direfleksikan.
- Kedua peran mempertahankan kontrol akun saat menuju Dashboard/Panduan; cookie sintetis tetap ada; tidak ada permintaan logout.
- Sesi loading, layanan sesi gagal/retry, redirect anonim ke batas login; halaman/login sesungguhnya memiliki suite sendiri (target login difixture agar tidak memerlukan konfigurasi/akun nyata).
- Nol page error/console error yang tidak diharapkan. Error HTTP404 serta401/503 sintetis yang diharapkan tidak dihitung sebagai JavaScript error.
- Lint, typecheck, 160 unit test, build produksi; CI repositori memeriksa regresi lengkap sebelum merge.

Tidak ada email nyata, kredensial produksi, atau perubahan data bisnis saat pengujian. Pengujian authenticated end-to-end memakai fixture browser, bukan akun produksi nyata.
