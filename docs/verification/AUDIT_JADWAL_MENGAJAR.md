# Audit Halaman Jadwal Mengajar

## Pemetaan sebelum perubahan
- Route /jadwal memeriksa sesi lalu merender ScheduleManager sesuai role admin/guru.
- Daftar mingguan: filter → /api/schedules atau /mine; rekap admin → /recaps. Pilihan relasi mengambil master/settings dan pengguna aktif dengan pencarian/pagination.
- Jadwal pribadi: tanggal WIB → /today → DayContext kalender yang sama dengan kegiatan KBM.
- Editor: relasi semester/guru/mapel/kelas + hari/durasi/rentang berlaku → /conflicts (pemeriksaan saja) atau POST/PATCH jadwal (menyimpan).
- Penghentian satu/banyak jadwal memakai previewId → commit atomik, versi jadwal dan revisi kalender. Riwayat berasal dari /:id/history. Cetak mengambil seluruh halaman hasil filter.
- Kode route/API/service, schema, SQL jadwal beserta adapter kalender/kehadiran/piket/finance dan trigger pelindung riwayat diperiksa, termasuk ManagedDialog, TableRegion, requestJson/masterRequest, validasi field, CSS global, dan fixture pengujian.

## Temuan dan perbaikan
1. JTM teks tidak valid dapat melempar exception Decimal sebelum Zod mengembalikan kesalahan field. Perbaiki pipeline: format harus lolos sebelum refine/normalisasi Decimal. Endpoint create dan conflicts kini diuji mengembalikan HTTP 422 VALIDATION_ERROR dengan data.scheduledJtm, bukan INTERNAL_ERROR.
Pesan validasi client bersama juga membedakan batas angka/jumlah dari panjang teks dan mempertahankan penjelasan rentang tanggal yang disetujui. Tidak menyertakan nilai rahasia.

2. Hasil pemeriksaan bentrok tetap tampil saat guru/mapel/kelas/semester/hari berubah. Semua perubahan form membatalkan hasil lama. Simpan tetap diperiksa ulang server. Respons pengaturan sekolah yang terlambat juga tidak dapat menimpa durasi dari pemeriksaan server yang lebih baru.
3. Guard busy berbasis state saja rentan dua event dalam tick yang sama. Tambahkan ref sinkron untuk submit editor, preview, commit, dan cetak. Penutupan modal diblokir selama proses berlangsung.
4. Pilihan relasi menyamarkan error, tidak punya retry/loading, dan label tersimpan terlalu generik. Pisahkan SchedulePicker, tambahkan debounce, abort, retry dan status kosong, pertahankan label tersimpan, reset pagination melalui key parent, serta blokir kelas sebelum semester dipilih. Label alternatif nullable tetap kompatibel dengan DTO master yang ada.
5. Jadwal harian gagal tampak seperti sedang memuat; data tanggal lama dapat tertinggal saat tanggal diganti. Pisahkan loading/error/empty dan retry per bagian; kosongkan data usang saat pergantian tanggal dan abaikan respons yang dibatalkan.
6. Kegagalan rekap menghilangkan daftar yang sebenarnya berhasil dimuat. Pisahkan hasil/error rekap; rekap lama dibersihkan ketika filter berubah. Filter memiliki tombol reset dan batas pencarian sesuai server.
7. Halaman pagination dapat kosong ketika total menyusut. Kembalikan ke halaman terakhir yang masih ada. Pilihan pada baris yang terlihat dibuang jika versinya berubah atau tidak lagi dapat diubah; versi lintas halaman tetap diperiksa backend.
8. Baris berstatus active tetapi masa berlakunya sudah berakhir masih menawarkan edit/penghentian yang pasti ditolak server. Sembunyikan aksi tersebut dan nonaktifkan pemilihannya; riwayat tetap tersedia.
9. Riwayat terbuka setelah request selesai sehingga respons terlambat dapat membuka data yang salah; new_data null dapat menyebabkan dereference error. Buka modal dengan loading, batalkan request saat tutup/ganti target, sediakan retry, dan tangani snapshot null secara aman.
10. Preview penghentian usang tidak memiliki alur kembali yang jelas. Tambahkan kembali ke tanggal/alasan; token invalid/stale/versi konflik dikembalikan ke form untuk membuat preview baru.
11. Respons API hanya dipercaya lewat tipe TypeScript. Tambahkan kontrak runtime daftar/rekap/harian/pilihan/bentrok/preview/riwayat dan error yang dapat ditindaklanjuti.
12. Toolbar/modal/table berpotensi terlalu lebar atau menyisakan ruang kosong besar. Tambahkan wrapping/min-width, grid editor adaptif, kolom pilihan tabel ringkas, label field dan error per field, feedback sukses persisten, empty state, serta modal terbatas viewport. TableRegion tetap dapat digeser dan diakses dengan keyboard.
13. Cetak belum memvalidasi payload halaman sebelum looping dan snapshot lama dapat tertinggal. Validasi setiap halaman, pertahankan deteksi jumlah/ID berubah, batasi jumlah halaman, tangani hasil kosong, dan bersihkan snapshot setelah cetak atau perubahan filter.

Dugaan awal perbedaan format jam mulai tidak terbukti: SQL schedule_dto sudah menghasilkan HH:mm. Kontrak dan format jam backend dipertahankan, termasuk pecahan detik jam selesai dan JTM empat desimal.

## Kompatibilitas
Tidak ada migrasi atau perubahan endpoint/struktur data tersimpan. Hak admin/guru, CSRF/origin/sesi, pembatasan permintaan, pemeriksaan bentrok, snapshot durasi sekolah, tanggal WIB, revisi tanpa menimpa riwayat, penghentian atomik, perlindungan kegiatan/finalisasi honor, audit, dan CAS versi tetap ditangani backend yang sama. Validator JTM hanya memperbaiki jenis penolakan input tidak valid; input yang valid tetap dinormalisasi dengan aturan yang sama.

## Validasi dan batas pengujian
- Lint, TypeScript, production build, unit, crypto/HTTP dan SQL diperiksa. 63 unit + 29 crypto/HTTP + 328 SQL = 420 pengujian lulus.
- UI khusus: admin/guru × 320, 375, 768, 1024, 1440, 1920px; tambah/edit, pencarian/reset, validasi field, hasil bentrok usang, klik ganda, busy/Escape, error/retry pilihan, harian dan rekap, riwayat terlambat/null, pilihan lintas halaman, preview/back/stale/commit, pagination menyusut, kosong/rusak/kedaluwarsa, nama panjang, teks 200%, orientasi, serta cetak 101 baris.
- Regresi UI umum 252 kombinasi, empat lebar interaksi, dan CRUD lulus tanpa page error atau console error. Screenshot desktop/mobile ditinjau, modal dan overflow diukur pada fixture lokal.
- Scroll vertikal halaman, tabel dan modal tetap tersedia untuk konten panjang. Tidak menyembunyikan konten dengan memaksa semua bagian ke satu tinggi layar.

UI menggunakan fixture localhost dengan respons sintetis; pengujian SQL memakai PostgreSQL WASM/PGlite. Tidak ada penulisan atau email produksi. Perangkat fisik, pembaca layar, native PostgreSQL race suite dan hasil kertas printer belum diuji. Pengujian cetak memeriksa pemuatan seluruh baris dan pemanggilan print browser.

Jalankan npm run test:ui:schedules dengan Playwright tersedia, atau isi UI_PLAYWRIGHT_MODULE/UI_BROWSER_EXECUTABLE sesuai lingkungan. Tidak ada dependency runtime baru.
