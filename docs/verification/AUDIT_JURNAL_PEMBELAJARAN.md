# Audit Jurnal Pembelajaran — 23 Oktober 2026

## Ruang lingkup dan alur

Diperiksa sebelum perubahan: halaman `/jurnal` dan `/admin/jurnal`, seluruh cabang jurnal pada workspace kegiatan, komponen dialog/tab/form/feedback, schema perintah, service/HTTP/export, dan fungsi SQL eligibility/save/edit/delete/H-1/blok/ledger. Halaman tetap menggunakan endpoint dan struktur data lama; tidak ada migrasi database.

- Input: tanggal WIB → options + kegiatan akun → eligibility KBM → modal → validasi → perintah server → verifikasi hasil → pemuatan ulang.
- Riwayat: rentang/guru/pencarian → debounce → pagination server → edit/hapus dengan identitas dan versi dari snapshot jurnal. CSV/PDF memakai seluruh filter, bukan satu halaman.
- Kebijakan: guru membaca status; admin mengubah H-1 dan blok dengan alasan masing-masing. Server tetap memeriksa hak akses.

## Temuan dan perbaikan

| Temuan / penyebab | Perbaikan |
| --- | --- |
| Alasan digunakan bersama oleh beberapa operasi; alasan blok berada di luar modal | Formulir terpisah dengan alasan dan payload per tindakan |
| Pemuatan serial mengikat konteks input ke filter riwayat | Loader konteks dan riwayat terpisah; rentang tidak sah tidak menutup input |
| Respons tidak diperiksa sebelum digunakan | Kontrak runtime untuk list, opsi, eligibility, blok, hasil simpan/hapus; cek identitas, tanggal, akun dan versi |
| Respons lama dapat menggantikan state yang lebih baru | AbortController, pemeriksaan request aktif, cleanup unmount dan debounce pencarian |
| Isian angka kosong menghasilkan NaN | Simpan string selama pengisian; validasi angka bulat/jumlah siswa sebelum mengirim |
| Klik ganda dan hasil simpan yang belum pasti | Kunci sinkron, cegah tutup saat menyimpan, pertahankan isian saat gagal; konflik/hasil tidak pasti memerlukan pemeriksaan ulang |
| Sukses simpan bercampur dengan kegagalan pemuatan berikutnya | Pesan sukses terpisah; perubahan berikutnya diblokir sampai data terkini terverifikasi |
| Hapus memakai konfirmasi browser dan alasan bersama | Dialog khusus dengan alasan serta penjelasan pembalikan kredit JTM |
| Halaman terakhir kosong setelah penghapusan | Ambil ulang halaman terakhir yang valid dan pulihkan tombol setelah refresh |
| Aksi/pagination/teks panjang berisiko keluar container | Pembungkusan teks dan tombol, min-width nol, grid responsif, modal bersama dengan scroll internal |
| Lookup label dapat membaca properti prototype | Object.hasOwn dan pesan fallback aman |
| Rentang blok terbalik tidak menunjuk field | Error ditautkan ke tanggal akhir, pesan Indonesia aman untuk HTTP |

## Kompatibilitas

Nama API, role, ownership, CSRF, CAS versi, aturan Hari H/H-1, konfirmasi kegiatan, kecocokan rekap siswa, blok, perlindungan periode final, soft-delete, reversal/reposting ledger dan perhitungan JTM di server dipertahankan. Workspace kegiatan selain jurnal tetap memakai implementasi sebelumnya.

## Validasi

- `npm run check`: lint, TypeScript, 90 unit, 32 crypto/HTTP, 333 integrasi database, production build lulus (455 tes).
- `npm run test:ui:journals`: tujuh lebar 280/320/375/768/1024/1440/1920; semua tab; batas modal; tambah/edit/hapus, H-1, blok dan toggle; angka kosong/jumlah tidak sesuai; klik ganda; modal saat sibuk; konflik/penolakan/ack tidak valid; sukses simpan diikuti kegagalan refresh; teks panjang; riwayat invalid independen; pencarian; CSV; hapus halaman terakhir; role guru; landscape dan teks 200%; tanpa page error. Interaksi browser memakai fixture API terkontrol.
- Tes integrasi database menjalankan SQL asli pada PostgreSQL WASM/PGlite: atomicity, duplicate, ownership, versi, reversal/repost, rekap siswa, blok, H-1, finalisasi dan ekspor. Kontrak DTO baru juga diuji terhadap hasil service nyata.
- Regresi UI seluruh aplikasi: 252 kombinasi halaman/role/viewport dan interaksi pada empat lebar lulus; 0 page error dan 0 console error yang tidak diharapkan.

Batas: pengujian lokal memakai browser Chromium dan database disposable; bukan data produksi, perangkat fisik, atau pengujian konkurensi PostgreSQL native. Tidak ada klaim bahwa semua kemungkinan bug telah dieliminasi. Tidak ada data produksi atau email yang diubah/dikirim oleh pengujian.
