# Audit Halaman Panduan Aplikasi

## Lingkup dan alur

- Rute publik tetap `/kesiapan`, fungsi halaman tetap `ReadinessPage`, metadata dan judul menggunakan bahasa Indonesia.
- Seluruh halaman awal, `Workspace`, breadcrumb, `ModuleCards`, registri navigasi, tombol, style global, serta pemuatan Next.js dibaca sebelum implementasi. Panduan dibandingkan dengan alur pemulihan akun, feedback kesalahan, Laporan Kendala, dan Persiapan semester yang aktual.
- Konten dihasilkan dari server: petunjuk akun → alur kerja harian → modul dari satu registri → FAQ bantuan. Tidak ada CRUD, form penyimpanan, fetch data, API baru, atau integrasi GAS pada halaman ini.
- Daftar isi menggunakan anchor menuju heading yang dapat menerima fokus. FAQ memakai `details`/`summary` bawaan browser. Tidak menambahkan listener, state async, timer, modal, atau dependency baru.
- Link login `/login` dan pemulihan `/lupa-password` dipertahankan. Navigasi publik, pencarian menu, sidebar/drawer dan breadcrumb tetap memakai shell yang sama; tidak mengubah autentikasi atau perizinan.

## A. Temuan

1. **Cetak tidak terbaca.** Style global menyembunyikan seluruh body untuk cetak honorarium dan hanya mengecualikan beranda publik. Panduan tidak termasuk pengecualian tersebut.
2. **Reflow ruang konten.** Grid berdasarkan breakpoint viewport tidak memperhitungkan sidebar dan padding. Uji 200% teks pada 1024 px memperlihatkan kartu sangat sempit dan teks/tombol melampaui ruangnya. Menyembunyikan overflow hanya akan memotong informasi.
3. **Navigasi informasi minim.** Daftar panjang belum dikelompokkan atau memiliki daftar isi. Alur Dashboard–Notifikasi–Pusat tugas–verifikasi hasil belum dijelaskan.
4. **Kewenangan kurang jelas.** Label ketersediaan modul dapat disalahartikan sebagai izin akun. Panduan belum menjelaskan modul admin dan izin khusus laporan pada tiap kartu.
5. **Bantuan kendala belum operasional.** Belum ada langkah pelaporan kode referensi, penanganan akses ditolak, atau pemeriksaan riwayat sebelum mengulang penyimpanan yang hasilnya belum pasti.
6. **Pemuatan tanpa JavaScript.** HTML produksi Next.js menampilkan fallback streaming `Memuat halaman…` tanpa petunjuk ketika JavaScript nonaktif. Ini berbeda dari kegagalan API; halaman panduan tidak meminta data privat.

Tidak ditemukan CRUD, listener duplikat, race promise, atau state data remote pada halaman statis ini. Karena itu, tidak membuat operasi atau state loading/error data yang tidak diperlukan.

## B. Perbaikan

- Daftar isi empat bagian dengan target fokus, jarak aman dari topbar, dan area sentuh minimal 44 px.
- Mempertahankan semua 18 modul/deskripsinya dari registri kanonik, dikelompokkan ke empat kategori yang sama dengan navigasi. Tidak menduplikasi definisi modul atau membuat link akses privat di panduan publik.
- Opsi `describeAccess` pada `ModuleCards` hanya diaktifkan panduan. Default seluruh pemanggil lama tetap sama; keterangan ini bukan mekanisme otorisasi.
- Grid panduan memakai container query berdasarkan ruang konten, dengan wrapping dan ukuran teks responsif. Tidak menyembunyikan overflow untuk menutupi masalah layout.
- FAQ native mencakup pemulihan akun, akses, jadwal, penyimpanan tak pasti, dan referensi bantuan. Tidak menjanjikan semua gangguan memiliki referensi atau tercatat. Referensi bukan bukti identitas; jangan mengirim password/OTP/rahasia.
- CSS cetak dibatasi ke `.application-guide`: konten terlihat, chrome/tombol disembunyikan, dan jawaban FAQ ikut dicetak meski tertutup di layar. Style honorarium dan beranda tidak diganti.
- Fallback pemuatan bersama diberi `noscript` dengan instruksi mengaktifkan JavaScript dan tautan beranda. Panduan tetap membutuhkan JavaScript untuk menyelesaikan shell streaming Next.js; tidak mengklaim seluruh panduan bekerja tanpa JavaScript.

## C. Kode final

- `src/app/kesiapan/page.tsx`: struktur, daftar isi, alur, modul, FAQ, metadata.
- `src/features/dashboard/module-cards.tsx`: opsi deskripsi akses, layout panduan tanpa mengubah default.
- `src/app/kesiapan/guide.css` dan import di `src/app/globals.css`: cetak khusus panduan.
- `src/app/loading.tsx`: petunjuk fallback ketika JavaScript nonaktif.
- `tests/ui/guide.mjs` dan script `test:ui:guide`: regresi produksi khusus panduan.

Tidak ada perubahan SQL, migrasi, skema data, endpoint, kontrak autentikasi, atau data produksi.

## D. Validasi

Jalankan `npm run check`, build produksi, kemudian `npm run test:ui:guide`. Browser Playwright disediakan lingkungan pengujian melalui `UI_PLAYWRIGHT_MODULE` dan, bila diperlukan, `UI_BROWSER_EXECUTABLE`/`UI_BROWSER_ARGS`; tidak menambahkan dependency aplikasi untuk runner UI. `npm run test:ui` memeriksa regresi komponen bersama.

Pengujian khusus pada build produksi:

- Lebar 280, 320, 375, 767, 768, 1024, 1440, 1920 px × teks 100%/200%: 16 kombinasi.
- Tidak ada horizontal overflow halaman atau teks panduan terpotong pada kombinasi tersebut; semua modul/label akses tetap tampil, tidak ada link modul privat.
- Semua tujuan daftar isi unik, fokus pindah ke heading dan tidak tertutup topbar.
- Lima FAQ dibuka/ditutup dua kali memakai keyboard; sentuhan diuji pada FAQ dan anchor.
- Resize/orientasi 320×568, 812×375, 1440×1600; footer tetap dapat dicapai. Gulir vertikal dokumen panjang adalah perilaku normal, bukan overflow yang harus disembunyikan.
- PDF hasil cetak memuat seluruh jawaban FAQ tertutup; screenshot desktop/mobile dan hasil PDF ditinjau secara visual.
- JavaScript nonaktif: petunjuk terlihat dan tautan beranda berfungsi, bukan klaim dukungan panduan penuh tanpa JavaScript.
- Nol permintaan API privat, console error, atau JavaScript runtime error pada skenario khusus.

Batas validasi: konten statis memiliki 18 modul, sehingga empty/loading/error/pagination/CRUD data remote tidak berlaku. Uji UI menggunakan browser otomatis dan data sintetis lokal, bukan UAT akun produksi atau perangkat fisik. CI exact-head dan deployment produksi diperiksa sebelum dinyatakan selesai.
