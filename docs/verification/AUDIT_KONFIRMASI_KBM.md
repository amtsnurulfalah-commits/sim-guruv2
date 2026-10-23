# Audit Konfirmasi KBM — 23 Oktober 2026

## Ruang lingkup dan alur

Seluruh cabang occurrences pada workspace kegiatan, halaman `/kegiatan`, komponen dialog/form/feedback, schema perintah, service/HTTP, serta definisi dan patch SQL occurrence/list/command/piket/jurnal/ledger dibaca sebelum perubahan. Aturan Tahap 3, 4 dan 5 diperiksa bersama tes integrasi dan UI terkait.

Alur: tanggal WIB → daftar KBM terotorisasi dan kemampuan piket → filter lokal/pagination → snapshot kegiatan → modal alasan → schema perintah yang sama → CSRF/API → SQL guard → validasi identitas/versi/status respons → pesan sukses → pemuatan ulang. Request tanggal lama dibatalkan; hasil yang tidak pasti tidak dikirim ulang otomatis.

## Temuan dan perbaikan

| Temuan / penyebab | Perbaikan |
| --- | --- |
| UI menyembunyikan aksi guru piket yang sah, tetapi menawarkan konfirmasi diri kepada admin | Tombol mengikuti admin/kemampuan piket efektif, pemilik kegiatan, tanggal dan jurnal aktif; SQL tetap memeriksa ulang |
| Guard awal occurrence_command masih menolak guru piket dengan NOT_FOUND meskipun guard aksi mengizinkannya | Migrasi tambahan menyelaraskan guard akses KBM dengan app.is_piket(actor,tanggal), tanpa mengganti guard aksi lainnya |
| Data lama tetap tampil saat tanggal berubah dan tombol belum mengikuti loading | Kosongkan daftar segera, abort request lama, periksa controller aktif sebelum mengubah state |
| Data dan hasil mutasi dipercaya tanpa pemeriksaan runtime | Kontrak Zod list/opsi/DTO; verifikasi tanggal, identitas, assignment, pemilik, versi string dan status hasil tindakan |
| Alasan bersama untuk seluruh kartu dan pencabutan memakai window.confirm | Modal per tindakan dengan snapshot kegiatan, alasan 5–500 karakter dan penjelasan dampaknya |
| Klik ganda dan unmount belum ditangani secara konsisten | Mutex ref sinkron, modal terkunci saat proses, AbortController dan cleanup |
| Sukses simpan dan gagal refresh bercampur | Pesan sukses tetap terlihat; daftar lama dihapus dan tindakan dikunci sampai data terbaru berhasil dimuat |
| Tidak ada pencarian/paging untuk daftar besar; aksi/teks panjang berisiko overflow | Pencarian guru/mapel/kelas dan status lokal, 25 kartu/halaman, tombol membungkus, grid responsif dan min-width nol |
| Aksi tanggal lampau tetap ditawarkan | Tinjau tanggal lampau/mendatang tanpa tombol mutasi; indikator hari WIB diperbarui setiap 30 detik dan saat tab kembali fokus |
| Label select status dan fokus setelah modal ditutup tidak konsisten | Label eksplisit dengan htmlFor/id unik; fokus kembali ke tombol pembuka saat modal dibatalkan |

## Kompatibilitas dan keamanan

Endpoint claim/confirm/revoke, payload strict dan nama fungsi dipertahankan. Tidak ada struktur tabel/data yang diubah. Klaim pribadi tetap tidak mengonfirmasi KBM atau memposting JTM. Syarat piket tetap konfirmasi tugas dan jam masuk; tidak diberikan hanya karena klaim. Larangan mengesahkan diri sendiri, tanggal hari berjalan, CAS, periode final, jurnal aktif, cleanup dan audit tetap berlaku. Pencabutan menampilkan penjelasan dependensi; SQL menangani alokasi dan konfirmasi terkait sesuai aturan lama.

Workspace kehadiran/rekap siswa dan Jurnal Pembelajaran mempertahankan alur masing-masing. Kontrak angka JTM dan versi tetap string agar tidak kehilangan presisi.

## Validasi

- `npm run check`: lint, TypeScript, 93 unit, 32 crypto/HTTP, 333 integrasi PostgreSQL WASM/PGlite dan production build lulus (458 tes).
- Tes integrasi D06 mereproduksi NOT_FOUND sebelum migrasi, lalu membuktikan endpoint activities/confirm dan /revoke bekerja untuk piket yang memenuhi syarat setelah migrasi. Tes ownership, CAS, jurnal/ledger, finalisasi dan least privilege tetap berjalan.
- `npm run test:ui:confirmations`: browser nyata → API → service → database disposable untuk klaim guru dan konfirmasi/pencabutan admin. Fixture API terkontrol menguji 61 baris, pencarian/status/pagination, angka/versi respons rusak, gagal baca, 403/409, koneksi terputus, kiriman ganda, modal sibuk, sukses lalu gagal refresh, respons tanggal lama, kepemilikan/admin/guru/piket, jurnal aktif dan pergantian hari WIB.
- Tujuh lebar 280/320/375/768/1024/1440/1920, landscape 844×390, teks 200%, teks panjang, data kosong, tap sentuhan, pengembalian fokus dan batas modal diuji; tidak terdeteksi overflow horizontal atau page error. Screenshot modal desktop/mobile diperiksa.
- Regresi UI seluruh aplikasi (`npm run test:ui`) lulus: 252 kombinasi halaman/role/viewport, interaksi pada empat lebar, 0 page error dan 0 console error yang tidak diharapkan.

## Migrasi dan penerapan

`supabase/migrations/20261023094531_kbm_confirmation_operator_guard.sql` dibuat melalui Supabase CLI. Migrasi hanya mengganti satu guard pada fungsi yang sudah ada dan gagal aman jika definisi sebelumnya tidak cocok. Owner/security/grant tidak diubah; RESET ROLE menjaga ledger migrasi dapat ditulis oleh runner. Seluruh batch memakai transaksi, advisory lock dan checksum runner aplikasi.

Vercel tidak menerapkan migrasi database otomatis. Setelah izin inspeksi/pembaruan database produksi tersedia, operator memeriksa target dan ledger migrasi, lalu menjalankan runner yang sama dengan koneksi MIGRATION_DATABASE_URL administratif:

```bash
npm run db:migrate
npm run db:migrate -- --apply --allow-remote
```

Pada sesi audit ini, inspeksi fungsi database produksi ditolak oleh pemeriksaan persetujuan otomatis; database produksi belum diubah. Perbaikan izin piket memerlukan migrasi tersebut sebelum dianggap aktif di produksi. Pengujian tidak mengirim email atau mengubah data produksi. Uji perangkat fisik dan konkurensi PostgreSQL native tidak termasuk bukti yang diperoleh.
