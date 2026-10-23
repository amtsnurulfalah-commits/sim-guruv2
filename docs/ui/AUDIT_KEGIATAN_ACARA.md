# Audit Kegiatan dan Acara

## A. Temuan dan penyebab

- Pemuatan tanggal/revisi tidak memiliki status loading lanjutan dan tidak memvalidasi respons. Data lama dapat tetap digunakan setelah permintaan gagal; respons permintaan yang dibatalkan juga belum diperiksa sebelum memperbarui state.
- Kehadiran dan pembatalannya ditawarkan untuk tanggal selain hari ini, sedangkan SQL hanya mengizinkan hari ini (WIB). Jurnal lama/future juga masih ditawarkan meskipun melewati batas H-1.
- Validasi rentang waktu/tanggal, hari rutin, tanggal insidental, dan rentang blokir digabung sebagai kesalahan umum. Pengguna tidak mengetahui kolom yang perlu diperbaiki. Jam masuk dan peserta duplikat baru ditolak server.
- Pembatalan kehadiran langsung dijalankan dengan alasan tetap, tanpa formulir konfirmasi.
- Hasil write tidak diperiksa sebelum menampilkan sukses. Status jaringan yang tidak pasti dapat mendorong pengiriman ulang tanpa memeriksa hasil sebelumnya. Penguncian hanya mengandalkan state React.
- Dialog penghapusan generik memuat penjelasan BAP yang tidak berkaitan dengan acara, tanpa nama target, waktu kedaluwarsa, atau pencegahan konfirmasi pratinjau kedaluwarsa.
- Filter/jenis dan editor tidak memiliki koordinasi state yang jelas. Pencarian dan pagination riwayat belum tersedia. Nama/deskripsi panjang dan tampilan status blokir kurang informatif.

## B. Perbaikan

- Menambahkan kontrak runtime respons baca, master, kehadiran, jurnal, blokir, serta pratinjau penghapusan. Respons write diverifikasi sesuai target/versi/status sebelum sukses.
- Membatalkan request saat navigasi/unmount, mengabaikan hasil baca yang dibatalkan, memisahkan loading/error, dan menghapus data yang gagal dimuat. Penguncian sinkron mencegah write bersamaan.
- Pada timeout, jaringan gagal, respons tidak valid, atau konflik, draft dipertahankan dan pengiriman dikunci sampai pengguna menutup formulir serta memuat ulang status. Kesalahan validasi tetap dapat diperbaiki langsung.
- Validasi memakai schema yang sama dengan service. Pesan per kolom untuk waktu, rentang, hari/tanggal acara dan blokir; pemeriksaan tanggal mulai mengikuti pengecualian SQL untuk tanggal mulai lama yang tidak berubah. Jam hadir harus dalam interval acara; kehadiran aktif duplikat ditolak sebelum POST.
- Kehadiran/pembatalan hanya ditawarkan hari ini WIB. Jurnal H-2/future diberi penjelasan. Formulir yang terbuka saat pergantian hari tetap dapat ditutup, dengan submit yang sudah tidak sesuai dinonaktifkan. Izin H-1, blokir, periode final, dan otorisasi tetap diperiksa server.
- Pembatalan kehadiran memakai modal beralasan. Jenis acara dapat diubah di dalam editor, dengan hari/tanggal yang divalidasi konsisten.
- Penghapusan menggunakan dialog Radix yang sama dengan sistem formulir: nama target, jumlah kehadiran/jurnal, JTM bersih yang dibalik, penjelasan arsip, dan kedaluwarsa WIB. Fokus kembali ke pemicu ketika ditutup.
- Kartu, status, empty state, wrapping teks panjang, pencarian, pagination 12 riwayat, serta modal dengan body scroll dan footer tetap terjangkau.

Tidak ada perubahan struktur tabel, endpoint, izin server, atau perhitungan JTM. SQL tetap menjadi sumber kebenaran: tanpa jurnal 0 JTM, jurnal hari yang sama 100%, H-1 80% jika diizinkan, dan penghapusan membalik kredit dengan riwayat tetap tersimpan. Perubahan ini tidak memerlukan migrasi database.

## C. Kode final

- `src/features/programs/event-manager.tsx`: state, interaksi, formulir, dialog dampak, dan UI responsif.
- `src/lib/programs/event-contracts.ts`: kontrak respons dan validasi kontekstual.
- `src/lib/programs/schemas.ts`: validasi bersama dengan pesan per kolom, aturan bisnis tetap.
- `tests/unit/event-contracts.test.ts`: kasus regresi kontrak, tanggal, dan validasi.
- `tests/ui/events.mjs`: alur browser dengan service dan database sementara.
- `tests/ui/server.ts`: endpoint fikstur kegiatan dan konteks akademik opt-in.

## D. Validasi

`npm run check`: lint, TypeScript, 122 tes unit + 35 tes HTTP/kriptografi + 333 tes integrasi database = **490 tes**, serta build produksi.

`npm run test:ui:events`: tambah/ubah termasuk konversi rutin ke insidental, validasi per kolom, catat/batalkan/catat ulang kehadiran, blokir/aktifkan kembali jurnal, penulisan jurnal dan kredit, arsip/pembalikan JTM/riwayat, respons baca rusak dan retry, write tidak pasti, pencarian/pagination, pratinjau kedaluwarsa, dan pergantian hari WIB. Tidak ada page error JavaScript; respons penolakan 422 dan kegagalan 503 sengaja diujikan.

Ukuran browser: desktop 1440×1000, tablet 768×1024, mobile 320×740 dan landscape 740×320. Pemeriksaan lebar dokumen, lebar modal, batas viewport, resize/orientasi, empty state dan data panjang/banyak. Zona waktu browser America/Los_Angeles memastikan aturan tanggal tetap menggunakan WIB.

Regresi global: `npm run test:ui` memeriksa seluruh halaman untuk admin/guru pada berbagai ukuran layar. Pengujian memakai data sintetis dan database sementara, tanpa menulis data produksi.
