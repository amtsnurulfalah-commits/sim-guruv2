# Audit Beranda publik SiM-Guru

## Cakupan dan alur

Route `/` → `HomePage` (Server Component statis) → `Brand`, `Badge`, tombol
berbasis `Link`, dan kartu alur kerja. Root layout memasang bahasa Indonesia,
metadata, skip link dan ToastRegion. Tujuan tautan adalah `/`, `/login`, dan
`/kesiapan`. Halaman login, panduan, loading/error/not-found, konfigurasi header,
CSS global serta komponen bersama ditelusuri untuk memahami dependensinya.

Beranda tidak memiliki CRUD, form, modal, tab, pagination, pencarian, state data,
request API/database/Google Apps Script, atau listener miliknya sendiri. Data
berupa tiga langkah editorial tetap. Tidak diperlukan loading/empty/error state
buatan untuk data yang tidak diminta. Batas error/loading aplikasi yang sudah ada
tetap digunakan. Tidak ada perubahan autentikasi, endpoint, otorisasi atau backend.

## Temuan dan perbaikan

| Temuan dan bukti awal | Penyebab | Perbaikan terbatas pada Beranda |
| --- | --- | --- |
| Overflow 127 px pada viewport 320 px dan 72 px pada 375 px saat teks 200% | Header tanpa wrap dan batas minimum intrinsik item grid/flex | Header wrap, min-width 0, track grid minmax(0, …), wrapping teks |
| Ikon merek menyusut menjadi sekitar 32 px pada layar 320 px (seharusnya 40 px) | Item flex merek ikut menyusut ketika bersaing dengan badge | Ikon tidak shrink, isi merek boleh wrap melalui styling lokal tautannya |
| Area sentuh panduan hanya 16 px pada ukuran teks normal | Tautan inline tanpa tinggi minimum | ui-text-link dengan tinggi minimal 44 px dan focus/hover yang konsisten |
| Tombol masuk berpotensi memotong teks ketika membesar/berbaris | Tinggi tetap dari varian tombol besar | Tinggi otomatis, tinggi minimum, padding dan lebar penuh pada mobile |
| Footer berakhir pada y=886 di viewport desktop setinggi 1200 | Wrapper hanya min-height, main tidak mengambil sisa ruang | Flex column, main flex-1, footer lebar penuh tanpa posisi fixed |
| Skip-link menarget main yang tidak dinyatakan focusable | Main tanpa tabindex | tabIndex=-1; diuji perpindahan fokus dari skip link ke main lalu tombol masuk |
| Tiga langkah hanya div umum | Belum ada semantik daftar berurutan atau label kartu | ol/li, list role untuk konsistensi pembaca layar, label kartu terkait judul, nomor dekoratif disembunyikan dari accessibility tree |
| Konten Beranda tidak terlihat ketika dicetak | CSS cetak global menyembunyikan semua elemen selain laporan honorarium | Override visibility lokal pada root Beranda dan keturunannya, dengan selector khusus .public-home tanpa mengubah perilaku laporan |

Judul, isi, tiga langkah, identitas visual hijau dan seluruh tujuan tautan lama
dipertahankan. Heading mobile, jarak antarbagian, dan padding disesuaikan secara
lokal. Tidak ada fungsi duplikat, dependensi baru atau JavaScript klien tambahan.

## Validasi

Pengujian khusus `npm run test:ui:home` memakai build produksi Next.js yang
sebenarnya pada localhost; jalankan `npm run build` terlebih dahulu. Pengujian
memeriksa delapan viewport (280, 320, 375, 767, 768, 1024, 1440, 1920) dengan
ukuran teks 100%/200%, keyboard/skip-link, seluruh tujuan tautan dengan sentuhan,
JavaScript nonaktif, print, reduced motion, resize/orientasi, tinggi desktop,
semantik landmark/list, area sentuh dan clipping tombol. Tautan tujuan sentuhan
menggunakan respons sintetis agar tidak membuat sesi atau mengakses data nyata.

Halaman panjang tetap bergulir secara alami. Yang dicegah adalah overflow
horizontal atau pemotongan vertikal konten/kontrol, bukan scroll halaman yang
memang diperlukan pada layar kecil atau ukuran teks besar.

Hasil pemeriksaan akhir:

- Lint dan typecheck lulus tanpa error.
- Build produksi lulus; route `/` tetap diprerender statis.
- 67 unit, 29 crypto, dan 329 pengujian database lulus (425 total).
- `test:ui:home` lulus: 16 kombinasi viewport/ukuran teks dan seluruh skenario
  interaksi di atas, 0 page error, 0 console error, 0 request API dari Beranda.
- Tidak ada overflow horizontal pada rentang layar yang diuji; teks tombol
  tidak terpotong dan footer tetap dapat dicapai lewat scroll alami.
- Screenshot mobile 375 px dan desktop 1440 px diperiksa secara visual.

Build pertama menemukan cache Turbopack lokal yang rusak. Direktori hasil build
`.next` dibersihkan dan build bersih berhasil; tidak diperlukan perubahan kode
aplikasi untuk masalah cache tersebut.

Pengujian memakai localhost dan respons tujuan sintetis, tanpa kredensial,
perubahan data produksi, atau klaim pengujian langsung lingkungan produksi.
