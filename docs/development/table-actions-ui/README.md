# Sistem tampilan aksi tabel

## Cakupan

Seluruh aksi `.ui-action` di sel data `TableRegion` menggunakan ukuran, jarak, wrapping, fokus, dan bentuk yang sama. Ini mencakup komponen `Button` dan tombol HTML yang memakai `secondaryAction` pada tabel kalender, jadwal, pengguna, data master, dan honorarium. Tabel laporan, BAP, dan persiapan semester tetap memakai semantik dan konten yang sama, termasuk tabel tanpa aksi.

- Label dan ikon selalu terlihat; tidak ada aksi yang disembunyikan ke menu baru.
- Target sentuh minimal 44 piksel; font 14 piksel dan tinggi bertambah jika label panjang.
- Kelompok aksi dapat membungkus pada desktop/tablet dan disusun penuh per baris pada viewport sampai 640 piksel.
- Tabel lebar tetap digeser di region bernama, dengan petunjuk overflow yang sudah ada; halaman tidak dipaksa melebar.
- Ubah memakai permukaan hijau lembut; arsip memakai aksen peringatan; hapus/hentikan memakai aksen merah. Teks dan ikon tetap membedakan aksi tanpa bergantung pada warna.
- Hover khusus perangkat yang mendukung hover. Fokus keyboard memakai outline 2 piksel dan status disabled tetap native.

## Implementasi

`ActionIcon` menandai makna ikon lewat `data-action`; varian sekunder memakai kelas bersama `ui-action-secondary` yang sudah tersedia. CSS dibatasi pada `.ui-table-region tbody td`, sehingga tombol toolbar, pagination, dialog, dan form di luar tabel tidak mendapatkan perubahan ini. Tidak ada state, listener, endpoint, skema database, izin, label, handler, atau alur konfirmasi baru.

## Validasi

`tests/ui/table-action-checks.mjs` memeriksa geometri hasil render: area sentuh, label terlihat, wrapping, batas sel, tidak ada tombol bertumpuk, dan fokus keyboard. Pemeriksaan dipakai pada suite pengguna (6 ukuran layar) dan master (7 tab × 6 ukuran layar), bersama regresi interaksi yang sudah tersedia. Pengujian memakai data sintetis di localhost, tanpa pengiriman email nyata.

Jalankan `npm run check`, `npm run test:ui:users`, `npm run test:ui:masters`, dan `npm run test:ui` dengan Playwright/Chromium lokal yang sesuai. Perubahan ini tidak memerlukan migrasi database atau variabel lingkungan baru.
