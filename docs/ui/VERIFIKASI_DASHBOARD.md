# Penyederhanaan Dashboard dan rincian konteks hari

Branch `feat/dashboard-context`, berbasis `main` pada `b86169c`.

## Perubahan

- `src/features/dashboard/dashboard-view.tsx`: kartu keamanan akun dipindahkan
  tepat sebelum Konteks hari ini. Daftar Modul ruang kerja dihapus dari Dashboard.
  Ringkasan kegiatan, verifikasi pemulihan administrator, dan sidebar dipertahankan.
- `src/features/calendar/day-context-card.tsx`: ringkasan tanggal/libur/KBM/ujian
  tetap terlihat; accordion native details/summary menampilkan catatan kalender,
  semester/rentang tanggal, pengaturan khusus, status kegiatan, dan alasan status.
  Kode versi internal tidak ditampilkan. Muat ulang membersihkan data lama dan
  menonaktifkan tombol selama loading. Kegagalan tetap menyediakan aksi retry.
- `tests/ui/verify.mjs`: pemeriksaan urutan bagian, hilangnya kartu modul,
  accordion dengan keyboard, overflow saat rincian terbuka, serta error/retry.
  Respons 503 sintetis diverifikasi secara eksplisit sebagai kegagalan terencana;
  error lain tetap menyebabkan suite gagal.
- `docs/ui/DESIGN_SYSTEM.md`: aturan susunan Dashboard dan accordion harian.

Komponen ModuleCards tetap digunakan pada Panduan aplikasi. Tidak ada perubahan
pada API, autentikasi, database, RBAC, atau perhitungan kegiatan/honorarium.
Accordion tidak memicu permintaan jaringan baru ketika dibuka/ditutup.

## Verifikasi

- Lint lulus.
- TypeScript lulus.
- 30 pengujian unit lulus.
- Production build lulus.
- Hasil akhir suite browser dicatat setelah proses selesai.

Pengujian browser memakai fixture localhost disposable, bukan akun atau database
produksi. UAT perangkat fisik dan pembaca layar belum dilakukan.
