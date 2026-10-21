# Accordion dan tab Jurnal Pembelajaran

## Perilaku dan dampak

- Filter tanggal input, rentang riwayat, guru (admin), dan pencarian dibungkus accordion native `details/summary`, tertutup saat halaman dibuka. Nilai tetap tersimpan ketika accordion ditutup atau tab berpindah.
- Tiga tab: **Input Jurnal Pembelajaran**, **Riwayat dan Detail Jurnal**, **Kebijakan dan Pemblokiran Jurnal**. Tab awal adalah Input. Pada layar sempit tab disusun vertikal; mulai breakpoint md menjadi tiga kolom.
- Riwayat memuat unduhan, detail, tindakan jurnal, alasan penghapusan, dan paginasi. Tombol Ubah jurnal memilih tab Input dan membuka dialog dengan nilai jurnal yang dipilih.
- Guru mendapat informasi kebijakan. Kontrol H-1 dan pemblokiran tetap hanya dirender untuk admin; pengambilan daftar blok tetap hanya untuk admin.
- Komponen Tabs yang sama dengan Akun dan Profil kini mendukung nilai terkontrol opsional. Pemakai lama tetap memakai state internal. Panel tetap mounted, panel tersembunyi memakai atribut hidden; keyboard ArrowLeft/ArrowRight/Home/End tetap tersedia.
- Tidak ada perubahan backend, autentikasi, RBAC server, API, database, pembobotan JTM, atau batas pengisian.

## File

| File | Alasan |
| --- | --- |
| src/features/activities/workspace.tsx | Accordion khusus mode journals, tab, pengalihan editor, dan paginasi di Riwayat. Mode kegiatan lain mempertahankan filter dan paginasi semula. |
| src/components/ui/tabs.tsx | Controlled value opsional untuk pembukaan editor lintas tab; tata letak tiga item. |
| tests/ui/verify.mjs | Regresi tab/filter untuk admin dan guru pada 320, 768, 1440 px; pembukaan editor dari riwayat dan alasan penghapusan. |

## Verifikasi

- Lint, TypeScript, dan production build lokal: lulus.
- Unit: 30 lulus; crypto/adapter/export/API: 24 lulus; integrasi SQL: 325 lulus (379 total).
- Browser suite penuh: 252 kombinasi halaman/role/viewport, empat lebar interaksi, satu skenario CRUD; nol page errors dan console errors.
- Pengujian tab/accordion: admin dan guru pada 320, 768, 1440 px; keyboard Enter, ArrowRight, Home, End; filter bertahan; paginasi hanya di Riwayat; kontrol kebijakan admin saja: lulus.
- Suite interaksi akhir setelah penambahan regresi editor: lulus, nol page errors dan console errors. Data jurnal sintetis memastikan Ubah dari Riwayat memilih Input, dialog menampilkan materi tersimpan, Escape menutup dialog, alasan penghapusan dapat diisi di Riwayat dan mengaktifkan tombol hapus.
- git diff --check: lulus.

Pada percobaan awal regresi editor, assertion mencari tab melalui accessibility tree saat modal terbuka dan timeout: Radix memang menyembunyikan latar belakang dari assistive technology. Assertion diperbaiki memakai includeHidden untuk memeriksa state tab tanpa mengubah perilaku modal; suite akhir lulus.

Browser memakai fixture lokal dengan data sintetis. Belum ada UAT akun pengguna produksi atau perangkat fisik pada perubahan ini. Tidak ada email nyata atau modifikasi database produksi selama pengujian.
