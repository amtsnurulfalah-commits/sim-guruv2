# Audit Absensi Siswa — 23 Oktober 2026

## Ruang lingkup dan alur

Dibaca sebelum perubahan: kedua halaman `/absensi-siswa/input` dan `/absensi-siswa/riwayat`, seluruh cabang students pada workspace kegiatan, komponen form/dialog/tab/feedback, schema dan service/HTTP kegiatan, kontrak konteks hari, serta SQL siswa/progres/jurnal dan perluasan piket/panitia ujian. Endpoint dan struktur data tetap dipertahankan.

Alur input: tanggal WIB → options + konteks periode → progres dan seluruh halaman rekap tanggal itu sesuai scope akun → snapshot kelas/angka/versi → modal → validasi schema/jumlah → students-save → verifikasi acknowledgement → pesan sukses dan pemuatan ulang. Riwayat memakai loader, rentang dan pagination tersendiri. Halaman riwayat langsung membuka tab Riwayat Absensi.

## Temuan dan perbaikan

| Temuan / penyebab | Perbaikan |
| --- | --- |
| Versi dan angka formulir dicari hanya pada halaman riwayat yang sedang tampil; filter/page dapat membuat rekap lama dianggap baru versi 0 | Dataset input harian terpisah, membaca seluruh batch 100 baris dengan pemeriksaan kelengkapan/duplikasi; versi tidak bergantung pada filter atau halaman riwayat |
| Pemilihan kelas/date dan refresh dapat meninggalkan angka/state tidak sesuai | Modal memakai snapshot tanggal, kelas, angka dan versi; pergantian kelas memuat ulang nilai dan membersihkan error field |
| Angka kosong menggunakan valueAsNumber sehingga menghasilkan NaN | State angka berupa string; konversi setelah validasi; kosong/fractional/negatif ditolak |
| Jumlah kategori belum divalidasi lengkap di frontend | Total 1–1000 dan standar kelas diperiksa; pesan error menunjuk field; aturan ini sudah berlaku di SQL |
| Daftar kelas berisi semua periode | Pilihan input dibatasi periode dari konteks hari yang sudah ada |
| Input/progres bergantung pada loading riwayat; kegagalan rentang memblokir input | Loader dan error input/riwayat independen; filter riwayat tidak memuat ulang input |
| Respons runtime dan acknowledgement belum diperiksa | Kontrak Zod untuk options, konteks, progres, row/list, identitas hasil simpan; tanggal, scope akun, pagination, total dan versi string diperiksa |
| State lama tetap tampil saat pemuatan tanggal/rentang; klik ganda belum dicegah sinkron | AbortController, identitas request aktif, cleanup unmount, mutex ref dan modal terkunci saat menyimpan |
| Sukses simpan bercampur dengan kegagalan refresh | Pesan sukses dipertahankan, data lama dihapus, perubahan dikunci sampai input terbaru terverifikasi; tidak ada retry write otomatis |
| Riwayat nonadmin sengaja hanya menampilkan penginput sendiri sehingga detail rekap operator lain tidak tersedia | Batas privasi dipertahankan; jika progres menunjukkan kelas sudah diisi tetapi detail tidak tersedia, modal menjelaskan dan mengarahkan ke admin, bukan menimpa sebagai data baru |
| Daftar panjang, pagination dan formulir berisiko overflow/scroll berlebihan | Kartu responsif, tombol membungkus, min-width nol, 12 kelas progres/halaman dan 25 rekap riwayat/halaman, body modal scroll internal |
| Kedua URL membuka tampilan identik; fokus modal tidak dijaga per tindakan | URL riwayat membuka tab riwayat; tab keyboard memakai komponen bersama; pembatalan mengembalikan fokus ke tombol pembuka |

## Kompatibilitas

Tidak ada tabel, API, role atau aturan JTM yang diganti. Admin, piket yang memenuhi syarat, dan panitia ujian tetap mengikuti guard server. Panitia tetap dibatasi kelas/ruang penugasannya oleh SQL. Guru biasa tidak memperoleh tombol input maupun akses ke riwayat operator lain. Rekap kelas tambahan tetap tersedia sesuai periode dan hak server; kelengkapan dihitung terhadap himpunan kelas wajib yang sama.

CAS versi, validasi standar kelas, kecocokan dengan jurnal aktif, hari berjalan WIB dan periode honor final tetap dipertahankan. Tidak ditambahkan fitur hapus karena API lama tidak menyediakan penghapusan absensi siswa. Alur Kehadiran Guru, Jurnal Pembelajaran dan Konfirmasi KBM dipertahankan.

## Validasi

- `npm run check` lulus: lint, TypeScript, 97 unit, 32 crypto/HTTP, 333 integrasi database PostgreSQL WASM/PGlite dan production build (462 tes).
- Tes integrasi memeriksa kontrak acknowledgement, row/list dan progres dari service/SQL nyata; validasi jumlah, hak akses, kelas tambahan, progres dan kecocokan jurnal tetap diuji.
- `npm run test:ui:students` lulus: browser → API → service → database disposable untuk create/edit, termasuk riwayat yang mengecualikan hari ini. Fixture API terkontrol menguji 121 kelas/rekap, versi kelas pada batch kedua, pagination progres/riwayat, scope akun/periode, privasi, empty, angka kosong/pecahan/jumlah tidak sesuai, klik ganda, busy modal, 403/409/network/malformed response, sukses lalu gagal refresh, filter independen, respons tanggal lama, dan pergantian hari WIB.
- Tujuh lebar 280/320/375/768/1024/1440/1920, landscape 844×390, teks 200%, tap sentuhan, fokus setelah modal ditutup, batas modal dan overflow diperiksa; 0 page error dan 0 warning NaN pada suite khusus. Screenshot modal desktop/mobile diperiksa.
- Regresi seluruh UI dijalankan dengan `npm run test:ui` (252 kombinasi dan interaksi pada empat lebar); hasil akhirnya dicantumkan pada PR audit ini.

## Batas penerapan

Audit ini tidak menambahkan migrasi SQL dan tidak mengakses atau mengubah database produksi. Pengujian memakai database disposable dan browser Chromium, bukan perangkat fisik atau pembuktian race PostgreSQL native dua koneksi. Tidak ada email yang dikirim oleh pengujian.

Migrasi guard Konfirmasi KBM dari audit sebelumnya tetap merupakan pekerjaan terpisah yang belum diterapkan ke produksi dan tidak diperlukan untuk perubahan Absensi Siswa ini.
