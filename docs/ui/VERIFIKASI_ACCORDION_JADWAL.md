# Accordion Jadwal Mengajar

Branch `feat/schedule-accordions`, berbasis `main` pada `a128ef6`.

## Perubahan

- `src/features/schedules/schedule-manager.tsx`: kartu Jadwal pribadi pada tanggal
  menjadi accordion native. Tanggal, konteks hari, rincian dan empty/loading state
  tetap di dalam kartu. Filter mingguan dibungkus accordion terpisah; hasil,
  rekap, cetak, muat ulang, pagination dan aksi admin tetap di luar filter.
- `tests/ui/verify.mjs`: enam skenario untuk admin/guru pada 320/768/1440px,
  mencakup keyboard Enter/Spasi, retensi tanggal/filter, overflow terbuka, dan
  respons query tanggal serta pencarian ke service fixture yang sudah ada.
- `docs/ui/DESIGN_SYSTEM.md`: aturan accordion dan pemisahan hasil dari filter.

Kedua accordion tertutup saat pertama ditampilkan. Tidak ada perubahan state,
handler filter/tanggal, kontrak API, RBAC, database, atau logika jadwal/honorarium.
Tidak ada dependensi baru. Ikon dekoratif mengikuti reduced motion, dan fokus
keyboard terlihat. Buka/tutup tidak menghapus isian atau memicu mutasi data.

## Verifikasi

- Lint dan TypeScript lulus.
- 30 unit test lulus.
- Production build lulus.
- Suite browser lulus pada 252 kombinasi halaman/role/viewport (320, 375, 767,
  768, 1024, 1440, 1920px), 4 ukuran interaksi dan 1 CRUD existing.
- Enam skenario accordion (admin/guru × 320/768/1440px) lulus, termasuk
  Enter/Spasi, retensi tanggal dan pencarian, serta respons 200 dari service
  fixture untuk perubahan tanggal dan query filter.
- Tidak ada page error, console error tak terduga, atau overflow halaman.

Browser memakai fixture localhost disposable, tidak mengakses akun atau data
produksi. UAT perangkat fisik dan pembaca layar belum dilakukan.
