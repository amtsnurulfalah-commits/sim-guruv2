# Audit Halaman Honorarium

## A. Temuan

1. Pemuatan ulang filter/pagination/tindakan belum memiliki loading state yang konsisten. Kegagalan dapat menyisakan data lama; slip dan tautan verifikasi tidak dibersihkan ketika periode/filter berubah.
2. Respons API diasumsikan sesuai tipe TypeScript. Data null/tidak lengkap dapat menyebabkan rendering gagal atau menampilkan sukses yang belum terverifikasi. Penguncian tindakan hanya memakai state React.
3. Pratinjau membuka dialog native saat DataForm masih menutup modal Radix. Konteks periode/form belum terkunci, fokus tidak dikelola konsisten, dan masa berlaku hanya dijelaskan sebagai teks tetap tanpa pemeriksaan kedaluwarsa di UI.
4. Validasi koreksi tidak menunjukkan periode tujuan yang salah. Rentang blok transportasi maksimal 365 hari baru diperiksa database. Input pencarian riwayat belum dibatasi sesuai API.
5. Mode sembunyikan nominal tidak diterapkan pada angka pratinjau koreksi. Tombol pengajuan koreksi masih dapat muncul pada cetak slip. Nominal layar juga belum memiliki format rupiah yang konsisten.
6. Rekap seluruh guru dirender sekaligus. Header ekspor/pagination dan nama panjang berisiko menyempitkan tampilan mobile. Pilihan guru tidak memiliki loading/retry dan dapat menyisakan hasil lama setelah gagal.
7. Key rincian hanya memakai sourceRef, padahal sumber yang sama dapat muncul pada komponen berbeda. Ini berpotensi menimbulkan konflik rekonsiliasi baris React.
8. Verifikasi dokumen publik belum memvalidasi status/struktur respons, tidak memiliki timeout/retry, dan tata letak metadata kurang aman untuk teks panjang pada layar sempit.

## B. Perbaikan

- Kontrak runtime untuk snapshot, bundle, riwayat, operasi, slip, token, pratinjau, hasil tindakan, dan verifikasi publik. Target periode/slip/run dan hasil finalisasi diperiksa sebelum sukses.
- Loading/error/empty dipisahkan; hasil baca yang dibatalkan diabaikan. Filter baru membersihkan slip/tautan dan data konteks sebelumnya. Request diberi timeout dan dibatalkan ketika halaman ditinggalkan.
- Penguncian sinkron mencegah tindakan bersamaan. Pada hasil jaringan yang tidak pasti, respons rusak, atau konflik, draft tetap tersedia dan pengiriman dikunci sampai status dimuat ulang. Penolakan validasi tetap bisa diperbaiki dalam formulir.
- Pratinjau memakai FormDialog yang sama dengan sistem UI, ditampilkan sesudah formulir sumber ditutup. Filter dikunci selama formulir/pratinjau terbuka. Modal menampilkan periode/tindakan, dampak, kendala finalisasi dan waktu kedaluwarsa WIB; konfirmasi kedaluwarsa dinonaktifkan.
- Pesan per kolom untuk periode koreksi serta rentang blok transportasi. Validasi tetap menggunakan schema service dan aturan SQL yang sudah ada.
- Rupiah diformat langsung dari string desimal, tanpa konversi Number/floating point dan tanpa menghitung ulang honorarium di frontend. Mode privasi diterapkan pada pratinjau koreksi; pengguna diberi keterangan bahwa PDF/Excel tetap memuat nominal lengkap.
- Pencarian dan pagination rekap 12 penerima; pagination riwayat tetap dari server. Kartu, navigasi, header tabel dan kontrol membungkus pada mobile, dengan tabel dalam area scroll terlokalisasi.
- Pilihan guru memiliki loading/error/retry, request abort, pemeriksaan respons, dan penguncian saat konteks digunakan formulir. Verifikasi dokumen memiliki validasi respons, timeout, retry, dan metadata responsif.
- Formulir koreksi disembunyikan saat cetak. Key rincian sumber dibuat unik antar-komponen/baris. Slip sumber dimuat ulang setelah tindakan agar status koreksi tidak tertinggal.

Rumus honor, presisi NUMERIC, pembulatan transportasi, sumber JTM, snapshot final, checksum, otorisasi, dan endpoint dipertahankan. Tidak ada migrasi database baru atau perubahan data produksi. Definisi tipe SourceLine diselaraskan dengan nilai nullable yang memang dikembalikan SQL.

## C. Kode final

- `src/features/finance/finance-manager.tsx`
- `src/features/finance/finance-preview-dialog.tsx`
- `src/features/finance/teacher-picker.tsx`
- `src/features/finance/verify-document.tsx`
- `src/lib/finance/contracts.ts`
- `src/lib/finance/schemas.ts`
- `tests/unit/finance-contracts.test.ts`
- `tests/ui/finance.mjs`

Fikstur browser berada pada `tests/ui/server.ts` dan `tests/ui/harness.tsx`; tidak diimpor oleh route aplikasi produksi.

## D. Validasi

- `npm run check`: lint, TypeScript, 129 tes unit, 35 tes HTTP/kriptografi, 333 tes integrasi SQL, serta build produksi — **497 tes**.
- `npm run test:ui:finance`: 18 alur browser dengan service asli dan database sementara, termasuk blok transportasi, posting/pembatalan/pengecualian libur, finalisasi, koreksi dan selisih, slip milik guru, PDF terverifikasi, Excel, privasi, cetak, pagination, respons rusak/retry, hasil write tidak pasti, kedaluwarsa, dan verifikasi dokumen publik.
- Desktop 1440×1000, tablet 768×1024, mobile 320×740, dan landscape 740×320; pengukuran lebar dokumen/modal serta batas viewport, teks panjang dan data banyak.
- Pengujian memakai zona waktu browser America/Los_Angeles dengan tanggal bisnis WIB untuk memeriksa independensi zona waktu.
- Regresi global dijalankan melalui `npm run test:ui` untuk seluruh halaman admin/guru dan interaksi bersama.

Kegagalan 503 serta respons API rusak sengaja disimulasikan. Tidak ada error JavaScript yang teridentifikasi dalam alur browser khusus. Perhitungan dan perlindungan database tetap diuji oleh rangkaian integrasi yang sudah ada, termasuk finalisasi atomik, snapshot immutable, kepemilikan slip, koreksi bertahap dan ekspor sesuai filter.
