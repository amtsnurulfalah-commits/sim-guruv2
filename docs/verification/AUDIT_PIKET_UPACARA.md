# Audit Piket dan Upacara

Tanggal: 23 Oktober 2026. Cakupan: `/piket`, `/upacara`, `/admin/piket`, `/admin/upacara`, DutyManager, kontrak/validasi, DutyService, handler/CSRF/rate limiter, SQL penjadwalan, otorisasi, preview/commit, substitusi dan konservasi JTM beserta pemanggilnya.

## A. Temuan

- Isian tindakan bisa berubah saat preview sedang diminta; respons terlambat dapat menampilkan preview untuk isian lama. Respons API sebelumnya hanya di-cast tanpa validasi.
- Alasan, nilai JTM dan sebagian isian jadwal terbawa ke editor berikutnya. Batal edit mengubah mode menjadi tambah tanpa membersihkan data, sehingga berisiko membuat jadwal yang tidak disengaja.
- Error/sukses/busy dipakai bersama oleh editor jadwal dan editor tindakan. Data lama masih tampil setelah kegagalan baca; tombol edit jadwal tidak mengikuti status loading.
- Pilihan tindakan belum mengikuti tanggal WIB, pemilik tugas, konfirmasi aktif dan keberadaan pengganti/alokasi. Akibatnya pengguna ditawari tindakan yang pasti ditolak backend.
- Validasi gabungan jadwal tidak menunjukkan kolom penyebab: jam terbalik, rentang tanggal, hari piket tidak ada dalam rentang, tanggal upacara bukan Senin, atau rentang di luar periode.
- Daftar tidak memiliki pencarian/pagination; nama panjang dan baris fleksibel perlu batas lebar. Label textarea yang membungkus nilai isian menyebabkan nama aksesibel tidak stabil.
- Pengiriman ulang setelah respons commit hilang dapat menghasilkan PREVIEW_STALE tanpa menjelaskan bahwa perubahan pertama mungkin sudah tersimpan.

## B. Perbaikan

- Kontrak runtime board/schedule/occurrence/preview, kecocokan tanggal/akses/identitas/versi dan ikatan preview dengan payload. Respons rusak gagal secara terkendali.
- Lock sinkron untuk mencegah double-submit; field dan navigasi dikunci selama request dan review. Preview kedaluwarsa tidak bisa dikomit; SQL tetap memeriksa fingerprint, TTL dan single-use.
- Editor tindakan memakai modal bersama dengan pengelolaan fokus, peringatan membuang draft dan batas viewport. Editor jadwal memakai lifecycle terkontrol; semua draft direset saat ditutup. Error editor dipisah dari error pemuatan.
- Respons tulis yang gagal/tidak dapat diverifikasi mengunci kirim ulang sampai pengguna menutup editor dan membaca status terbaru. Tidak ada retry otomatis untuk mutasi.
- Pilihan tindakan mengikuti aturan SQL sebagai panduan UI; keputusan otorisasi tetap di server. Jenis dan periode tidak dapat diganti saat edit, sesuai aturan SQL.
- Validasi per kolom, batas periode/tanggal WIB dan pemeriksaan Decimal untuk konservasi JTM empat desimal. Aturan bisnis dan struktur API tidak diganti.
- Pencarian dan pagination 12 kegiatan/jadwal, wrapping nama panjang, empty/loading/error state terpisah. Jadwal baru di luar tanggal panel mengarahkan panel ke awal berlakunya agar hasil simpan terlihat.

Alur data: pemuatan board dibatalkan ketika tanggal berubah → kontrak response → daftar → editor snapshot dari board (reload/tanggal tidak dapat diubah dari modal) → validasi → preview → pengecekan request/versi → review terkunci → commit → baca ulang board. Penjadwalan melalui endpoint yang sama; penonaktifan tetap memakai `active`, tanpa menambahkan penghapusan permanen.

## C. Kode final

- `src/features/duties/duty-manager.tsx`
- `src/lib/duties/contracts.ts`
- `src/lib/duties/schemas.ts`
- Tes: `tests/unit/duty-contracts.test.ts`, `tests/integration/duties.test.ts`, `tests/ui/duties.mjs` (`npm run test:ui:duties`). Fixture lokal menambahkan route mutasi dan opsi data uji; tidak menggunakan database produksi.

## D. Validasi

- `npm run check`: lint, TypeScript, 101 unit, 32 kripto/HTTP, 333 integrasi PGlite, production build.
- Integrasi duty yang sudah ada tetap memeriksa 19 skenario: penjadwalan/edit, hak akses, jam masuk, upacara, substitusi/penggantian/pembatalan, jurnal, pembalikan kredit, alokasi pecahan, reset, versi/preview stale, periode final, HTTP/CSRF dan konservasi.
- Browser khusus: create/edit piket, konfirmasi, preview terkunci, kegagalan respons commit, reset draft, validasi Senin dan create upacara, response rusak, pencarian/pagination serta 31 kegiatan dengan nama panjang; viewport 320, 740, 768, 1440. Tidak ada page error atau overflow horizontal yang ditemukan; modal berada dalam viewport.
- Matriks UI global: 252 kombinasi halaman/peran/viewport, termasuk pengujian interaksi komponen bersama.

Batas verifikasi: browser Chromium emulasi desktop/tablet/mobile, bukan perangkat fisik. Integrasi SQL menggunakan PostgreSQL WASM/PGlite; bukan bukti konkurensi PostgreSQL native. Scroll vertikal normal halaman/modal panjang tetap tersedia. Tidak ada migrasi SQL baru dan tidak ada perubahan data produksi pada audit ini. Migrasi Konfirmasi KBM dari pekerjaan sebelumnya merupakan tindak lanjut terpisah.
