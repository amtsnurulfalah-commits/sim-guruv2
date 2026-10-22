# Audit Kalender Akademik

## Cakupan dan pemetaan alur

Dibaca sebelum perubahan: route admin `/admin/kalender` beserta loading/error/session guard, seluruh CalendarManager, DayContextCard yang menggunakan konteks sama, helper masterRequest dan feedback/field errors, skema kalender/master, semua endpoint kalender, CalendarService/HTTP, migrasi SQL kalender dan penggantian dependency adapter untuk jadwal/kehadiran/ujian, serta pengujian integrasi kalender. Komponen Button, TableRegion, dialog, navigasi dan layout bersama diperiksa untuk kompatibilitas.

Alur baca terdiri dari daftar bulanan dengan pencarian/jenis/pagination, konteks satu tanggal WIB, pilihan semester dengan pencarian/pagination, serta riwayat catatan/konteks. Alur tulis: form → validasi bersama → POST preview → perbandingan sebelum/sesudah → konfirmasi previewId → commit transaksi → muat ulang dan feedback. Tindakan: upsert/delete/range kalender dan override/clear konteks. Backend tetap memeriksa admin, Origin/CSRF, rate, versi entri, masa berlaku/pemilik/jenis preview, dependency dan transaksi atomik.

## A. Temuan

| Temuan dan penyebab | Perbaikan |
| --- | --- |
| Daftar dan konteks dimuat dengan Promise.all dalam effect yang sama. Gagal salah satu menghapus keduanya; mengetik pencarian/pagination juga memuat ulang konteks. | Pisahkan lifecycle, loading/error dan retry daftar dari konteks. Draft editor tidak hilang saat filter daftar berubah. |
| Bentuk response hanya dipercayai sebagai TypeScript type; null/malformed bisa memicu error rendering atau konfirmasi tidak sesuai. | Kontrak runtime untuk daftar, konteks, pilihan semester, preview, commit dan riwayat. Verifikasi tanggal/kind/action, jumlah dan identitas acknowledgement sebelum menganggap berhasil. |
| UI memilih metode commit dari day state terpisah, bukan snapshot preview yang dikonfirmasi. | Endpoint/method diturunkan dari kind/action dan versi before pada preview. Tetap POST/PATCH/DELETE dan endpoint lama. |
| Busy state asynchronous tidak mengunci klik berulang dalam tick yang sama. | Ref sinkron untuk preview/commit; disable interaksi terkait dan tahan Escape selama commit. Abort/guard mounted untuk respons terlambat. |
| Preview kedaluwarsa/stale/terpakai dapat dikonfirmasi terus, dan kehilangan respons commit dapat menimbulkan retry tanpa mengetahui hasil pertama. | Periksa expiry sebelum POST, blokir ulang preview stale/invalid dan hasil tidak pasti; kembali memuat konteks dan petunjuk memeriksa riwayat. Tidak mengulang write otomatis. |
| Validasi form hanya native, sehingga whitespace/rentang terbalik tidak ditunjukkan pada field yang tepat. | Gunakan skema server di frontend, applyFieldErrors, arahkan error rentang ke dateEnd. Alasan/format/tanggal lampau tetap mengikuti aturan backend. |
| `periodId || savedId` mengembalikan semester lama saat pengguna memilih placeholder. Pilihan baru di luar halaman hasil kehilangan option/labelnya; kegagalan lookup disembunyikan. | Bedakan null (gunakan tersimpan) dan string kosong (pengguna mengosongkan). Pertahankan option/label lintas pencarian/pagination, loading/error/retry eksplisit, nonaktifkan semester di luar cakupan tanggal. |
| Riwayat baru dibuka setelah request selesai; respons lama dapat membuka modal kembali, tanpa loading/cancel/snapshot tanggal. | Buka modal segera, snapshot tanggal/jenis, AbortController dan batalkan saat ditutup; loading/error/retry di dalam modal. Null actor/snapshot ditangani aman. |
| Pagination tidak pulih saat jumlah data berkurang. | Arahkan ke halaman terakhir valid dan muat ulang hasilnya; berlaku juga pada pilihan semester. |
| Input/filter, tombol pagination/semester dan teks panjang berpotensi keluar kontainer. Header akun bersama terbukti overflow pada 1024px/teks 200%. | Grid filter responsif, min-width/maximum width yang benar, wrapping tombol/teks, tabel fixed dalam region scroll, modal dibatasi viewport; satu perubahan class pada kelompok tombol akun agar membungkus. |
| Teks halaman menyatakan ujian/keuangan belum terpasang meskipun dependency adapter sudah terintegrasi. | Ganti dengan petunjuk perilaku pengguna yang sesuai: konteks mengatur mode kegiatan, tidak membuat jurnal/bonus otomatis, data terpakai/final tetap dilindungi. |
| Type override.id mengharuskan string meski SQL dry-run belum menghasilkan id tersimpan. | Perbaiki type menjadi string/null dan kontrak preview menerima null; id data tersimpan tetap UUID. |

## B. Perbaikan dan kompatibilitas

Struktur database, migrasi, payload, nama API/fungsi bisnis, role admin, kebijakan hari libur/Minggu, semester, OTP/login, audit history dan integrasi penugasan dipertahankan. Tidak ada perubahan SQL atau database produksi. Aturan rentang tetap maksimal 366 tanggal dan all-or-nothing. Semua operasi tetap melalui preview dan server memeriksa ulang saat commit. Feedback sukses tetap terlihat bila refresh setelah commit gagal.

Modal native dipertahankan agar perubahan minimal; focus/inert/top layer tetap dari browser. Modal dapat scroll vertikal saat konten panjang dan tidak melebihi viewport. Scroll tabel hanya di region tabel. Scroll halaman vertikal normal bukan dianggap error overflow. Judul halaman diselaraskan dengan navigasi Kalender Akademik. Unknown reason code tidak dirender sebagai properti prototype atau data mentah.

## C. Kode final

- `src/features/calendar/calendar-manager.tsx`: pemisahan state/read, validasi, preview/commit, pilihan semester, riwayat dan responsive UI.
- `src/lib/calendar/contracts.ts`: kontrak runtime response dan parser bersama.
- `src/lib/calendar/schemas.ts`: field error rentang dan type id dry-run.
- `src/components/shell/workspace.tsx`: wrapping kelompok tombol akun yang menyebabkan overflow.
- `src/app/(workspace)/admin/kalender/page.tsx`: judul halaman.
- `tests/ui/calendar.mjs`, `tests/unit/calendar-contracts.test.ts`, `tests/unit/calendar.test.ts`: pengujian yang dapat dijalankan ulang.
- `package.json`: perintah `test:ui:calendar`.

## D. Validasi

- Lint, TypeScript, production build dan git diff --check.
- 76 unit + 29 crypto/HTTP + 329 integrasi database: total 434 pengujian.
- UI khusus: ketiga tab × teks 100%/200% × tujuh lebar 280, 320, 375, 768, 1024, 1440 dan 1920 (42 kombinasi). Modal preview diukur pada tujuh lebar dengan dua ukuran teks, termasuk batas viewport dan horizontal reflow.
- Tambah/edit/hapus, rentang dua tanggal dan preview 366 tanggal, override/clear konteks, payload/method/endpoint, klik ganda, busy Escape, tanggal/rentang invalid, lookup error/retry/selected option/placeholder, isolated read errors, malformed response, pagination menyusut, pemilihan ulang tanggal sama, preview expired/stale, commit uncertain, riwayat null/error/kosong/cancel/late response, sukses disertai refresh gagal, resize/orientasi.
- Regresi UI umum 252 kombinasi, empat ukuran interaksi, CRUD; nol page/console error.
- Screenshot mobile dan desktop ditinjau; pengujian memakai browser Chromium dan database disposable/respons sintetis. Perangkat fisik, pembaca layar, native PostgreSQL concurrency suite dan penulisan produksi tidak diuji.

Hasil rinci dan status pemeriksaan akhir juga dicantumkan pada PR. Tidak ada klaim bebas bug untuk skenario yang belum diuji.
