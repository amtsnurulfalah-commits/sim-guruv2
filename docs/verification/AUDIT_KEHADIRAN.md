# Audit Halaman Kehadiran

Tanggal: 23 Oktober 2026. Cakupan: `/kehadiran`, `/kehadiran-saya`, `/admin/kehadiran-harian`, `/admin/jadwal-kehadiran`; ActivityWorkspace, input/riwayat, modal manual/izin/pola/pratinjau, schema, ActivityService/handler HTTP, export CSV/PDF, SQL kehadiran dan perluasan hak piket/panitia serta konsumen durasi efektif untuk transport.

## A. Temuan

1. Koreksi manual mengambil versi dari halaman riwayat yang sedang dimuat. Catatan yang tidak masuk filter/pagination dianggap belum ada (`version: 0`), sehingga koreksi gagal atau berisiko memakai konteks yang salah.
2. Alasan dipakai bersama oleh izin, koreksi dan pola. Pembatalan/editor berikutnya tidak mereset semua state. Target/versi editor ikut bergantung pada data daftar yang berubah.
3. Pemilihan pola penerapan terhubung dengan `revealKey` editor pola, sehingga memilih pola justru membuka formulir edit. Pilihan hari/konteks dapat memakai versi pola lain tanpa memuat jam yang sesuai.
4. Data lama masih terlihat ketika baca gagal/berubah. Pilihan guru, template dan riwayat dimuat berurutan dan saling menghalangi. Response API tidak divalidasi sebelum dipakai (`Number(...).toFixed` dapat menampilkan NaN).
5. Tombol masuk/pulang/izin ditawarkan pada tanggal atau kondisi yang pasti ditolak SQL. Tidak ada pencegahan double-submit sinkron, pemeriksaan preview TTL di UI, maupun pemulihan aman ketika respons tulis hilang.
6. Hapus izin/pola menggunakan konfirmasi native dengan alasan tetap; modal lain memakai lifecycle dan state kesalahan bersama sehingga feedback dapat tersasar.
7. Layout tombol unduhan/pagination/teks panjang dan modal perlu pembatasan lebar serta wrapping. Pemisahan input harian dari filter riwayat belum jelas.
8. Batas ekspor 10.000 diperiksa setelah kondisi selesai: hasil lebih dari 10.000 dapat lolos pada batch terakhir. Batch kosong dengan total belum tercapai juga tidak memiliki penghenti progres.

## B. Perbaikan

- `ActivityWorkspace` menjadi dispatcher; implementasi Kehadiran dipisahkan menjadi workspace, editor dan kontrak. Kode monolit lama yang tidak lagi dipanggil dihapus, tanpa menggandakan alur mutasi.
- Tab input harian dan riwayat mempunyai loader, filter, pagination, error/empty state dan abort sendiri. Metadata guru serta pola dimuat independen. Respons terlambat dibatalkan/diabaikan dan daftar lama dilepas ketika filter berubah.
- Modal koreksi memakai snapshot catatan yang dipilih. Untuk input manual melalui pemilihan guru/tanggal, lookup khusus langsung ke API memeriksa keberadaan dan versi catatan, terlepas dari filter/pagination riwayat. Submit dikunci selama lookup atau jika lookup gagal. Nilai null tidak diubah menjadi jam default saat mengedit catatan lama.
- Setiap modal mempunyai alasan, nilai, status dan validasi sendiri; draft baru tidak mewarisi draft sebelumnya. Modal tetap dapat ditutup saat tanggal WIB berganti; operasi hari sebelumnya tidak bisa dikirim.
- Kontrak runtime memeriksa bentuk DTO, identitas/versi, rentang/page filter, nilai durasi/rasio finite, peserta preview unik, TTL dan perlindungan jam aktual. Hasil tulis diperiksa terhadap aksi/isian, termasuk penambahan/penghapusan izin.
- UI mengikuti tanggal WIB, jam mulai dan aturan pulang +5 menit untuk guru. Admin tetap memiliki koreksi manual pada tanggal lampau yang belum dikunci. Hak operasional piket/panitia tetap tersedia sesuai scope baca; SQL tetap memutuskan target tugas yang memerlukan admin dan periode keuangan final. Metadata DTO tidak memuat semua jenis penugasan, sehingga UI tidak menggantikan otorisasi SQL.
- Pemilihan pola penerapan terpisah dari editor. Edit hari/konteks memuat pola dan versinya yang benar. Preview mempunyai modal tersendiri, konteks tetap, waktu kedaluwarsa dan daftar peserta. Tidak ada retry otomatis untuk mutasi.
- Respons tulis yang tidak dapat dipastikan, konflik versi atau respons rusak mengunci pengiriman ulang sampai pengguna menutup modal dan memuat status terbaru. Kesalahan isian tetap bisa diperbaiki tanpa kehilangan draft.
- Hapus izin/pola memakai modal aplikasi dan alasan eksplisit. Fokus kembali ke pemicu, modal mengikuti viewport, tombol membungkus, dan teks panjang tetap dapat dibaca melalui scroll normal.
- Ekspor memakai seluruh filter riwayat dan otorisasi server yang sama, bukan halaman aktif saja. Batas 10.000 ditegakkan sebelum hasil diterima; batch tanpa progres dihentikan. Perubahan pembatas batch juga melindungi pemanggil ekspor jurnal yang memakai service bersama.

Alur data: metadata independen + daftar harian/riwayat → kontrak response → pilihan snapshot → lookup khusus bila input manual baru → validasi → mutasi tunggal → verifikasi hasil → pembacaan ulang. Penerapan pola melalui preview terikat tanggal/pola, review peserta, kemudian commit single-use di SQL. API, struktur penyimpanan, perhitungan durasi/rasio dan integrasi transport dipertahankan.

## C. Kode final

- `src/features/activities/workspace.tsx`
- `src/features/activities/attendance-workspace.tsx`
- `src/features/activities/attendance-editor.tsx`
- `src/lib/activities/attendance-contracts.ts`
- `src/lib/activities/schemas.ts` (pesan validasi manual per kolom)
- `src/server/activities/service.ts` (batas/progres ekspor)
- Unit/integrasi: `tests/unit/attendance-contracts.test.ts`, `tests/crypto/attendance-export-boundary.test.ts`, `tests/integration/activities.test.ts`.
- Browser: `tests/ui/attendance.mjs` (`npm run test:ui:attendance`); fixture localhost opt-in pada `tests/ui/server.ts`.

## D. Validasi

- `npm run check`: lint, TypeScript, 116 unit, 35 kripto/HTTP, 333 integrasi PGlite, dan build produksi.
- Integrasi kehadiran yang ada tetap memeriksa template distinct/single-use/stale, satu catatan harian, provenance admin, scope pengguna, CAS, interval terpotong/bersebelahan/overlap, penghapusan izin, peserta tambahan, periode final dan ekspor seluruh halaman. Suite piket/panitia serta transport tetap dijalankan.
- Browser khusus: koreksi di luar filter riwayat dengan versi yang benar; buat izin, penolakan overlap, hapus izin; pencatatan masuk/pulang dengan waktu server; save/apply/delete pola; pergantian konteks pola; jam aktual tetap tersimpan setelah penerapan; respons manual yang benar-benar disimpan server tetapi diputus sebelum diterima browser; CSV/PDF nyata; rentang invalid; DTO rusak; pagination; pergantian hari WIB saat editor terbuka.
- Viewport Chromium: 320×740, 740×320, 768×1024 dan 1440×1000, termasuk 25 catatan dengan nama panjang. Tidak ditemukan page error, NaN rendering, overflow horizontal halaman atau modal keluar viewport.
- Matriks UI global dijalankan untuk memeriksa regresi halaman dan komponen bersama; hasil akhir dicatat di PR.

Batas: mobile diuji melalui emulasi Chromium, bukan perangkat fisik. Integrasi SQL memakai PostgreSQL WASM/PGlite; bukan bukti konkurensi PostgreSQL native. Scroll vertikal normal untuk konten panjang tetap tersedia. Tidak ada migrasi SQL baru atau perubahan data produksi dalam audit ini.
