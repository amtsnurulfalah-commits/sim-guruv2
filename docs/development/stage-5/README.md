# Tahap 5 — Laporan pimpinan

Cakupan 5.1–5.5: `/laporan-pimpinan` menyediakan ringkasan akademik (KBM, konfirmasi, jurnal, pengawasan/BAP, masuk dan masuk-pulang), honorarium, rincian sumber, filter bulan/guru, realisasi/proyeksi hak libur, serta ekspor Excel seluruh hasil filter.

## Kamus indikator dan batas cakupan

| Indikator | Pembilang / denominator | Sumber dan aturan |
| --- | --- | --- |
| Konfirmasi KBM | Konfirmasi aktif / KBM terbentuk | Occurrence tidak dihapus, pemilik efektif; kalender KBM saat laporan dibaca |
| Jurnal KBM | Jurnal tidak dihapus / KBM terbentuk | Bukan hanya kegiatan yang sudah eligible diisi; tidak menyatakan mutu pembelajaran |
| BAP | Pengawasan dengan BAP aktif milik penugasan efektif / pengawasan terbentuk | EXISTS mencegah penggandaan; locked merupakan arsip cleanup penugasan, bukan kelengkapan aktif |
| Masuk | Baris dengan jam masuk / baris kehadiran tercatat | Bukan seluruh guru × hari wajib hadir |
| Masuk-pulang | Baris dengan jam pulang / baris kehadiran tercatat | Constraint sumber memastikan jam masuk sebelum pulang |
| Honorarium terbuka | Total seluruh penerima hasil filter | `finance.bundle` → `finance.calculate`; SQL NUMERIC, transport dan koreksi yang sama dengan Honorarium |
| Honorarium final | Total snapshot penerbitan hasil filter | Snapshot asli; koreksi masuk periode tujuan, tidak menulis ulang final |

Bulan 2000–2099; sumber bertanggal dalam bulan sampai min(hari ini WIB, akhir bulan). Tidak mematerialisasi occurrence, tidak menambah/membalik ledger dan tidak mengubah kehadiran saat laporan dibaca. Catatan belum terbentuk tidak boleh dianggap tidak ada jadwal. Kalender di sumber akademik adalah konteks saat dibaca, bukan snapshot laporan historis. Kelengkapan administrasi **bukan penilaian kinerja**.

Proyeksi mengikuti mesin yang ada: menambah hak libur pending, bukan mengarang seluruh jadwal masa depan. Temuan finance berlaku pada seluruh periode, termasuk ketika satu guru dipilih. Filter kelas tidak disediakan karena transport/tunjangan bulanan tidak boleh dialokasikan ke kelas dengan engine kedua. Nama di final tetap nama snapshot penerbitan.

## Otorisasi dan operasi admin

- Admin memiliki akses kedua lingkup. Guru tidak mendapat hak lintas akun dari jabatan tambahan kepala sekolah.
- Admin membuka **Izin pembaca laporan → Atur izin laporan**, memilih pengguna aktif, menentukan izin akademik dan honorarium secara terpisah, serta mencatat alasan. Pencabutan: pilih tidak diizinkan pada lingkup terkait.
- `app.report_readers` private, ENABLE/FORCE RLS, tanpa akses tabel langsung business/auth/worker. Gateway memeriksa sesi internal, onboarding, maintenance dan izin setiap read/export. Helper rowset tidak diberi EXECUTE kepada business.
- Pengubahan izin admin-only, serialize dengan global write lock, expected version/CAS dan audit. Tidak menaikkan role pengguna. Tidak otomatis memberi izin kepada akun produksi.
- Navigation guru disaring capability; halaman direct-link tanpa izin menjelaskan cara meminta izin. Ini bukan batas keamanan: API/SQL tetap menolak data dan ekspor.
- Ekspor hanya sumber metadata yang diperlukan, tidak membawa password/token, NIP, jarak rumah, isi jurnal, catatan BAP/izin atau catatan koreksi. Download XLSX inline strings tanpa formula, macro atau hubungan eksternal.

## Konsistensi dan UX

Ringkasan menghitung seluruh rowset filter, bukan halaman aktif. Rincian/pagination berasal dari rowset yang sama. Ekspor membaca ulang sumber terkini dalam satu transaksi REPEATABLE READ dan menyertakan waktu baca, filter, definisi, ringkasan dan temuan; perubahan setelah tampilan awal dapat membuat ekspor lebih baru, bukan jaminan snapshot permanen. Maksimum 10.000 baris; lebih besar ditolak, bukan terpotong diam-diam.

Respons lama dibatalkan saat filter berubah; tampilan/ekspor menunggu kecocokan query. Nominal tetap string desimal dari SQL, pemformatan bukan engine kedua. Kartu, tabel dengan viewport scroll lokal, dialog bersama, loading/error/kosong, fokus dan tombol mobile memakai komponen fondasi. Tidak mengubah engine finance, jadwal, jurnal, BAP atau kehadiran lama.

## Rilis dan validasi

Migrasi: `20261024104102_leadership_reports.sql`. Penambahan satu tabel dan tiga fungsi gateway/helper. Tidak backfill transaksi atau memberikan izin otomatis. Migrasi harus diterapkan sebelum kode baru dipromosikan. Jika rollback aplikasi diperlukan, rollback deployment ke rilis sebelumnya; tabel/izin aditif dapat tetap ada, jangan menghapus ledger/snapshot.

Bukti tes dan status rilis aktual ada pada `validation.json` dan checkpoint. PGlite/Chromium sintetis tidak menggantikan native concurrency, perangkat fisik, UAT kepala madrasah, capacity produksi atau uji pembaca layar. Tahap 6 tidak dijalankan oleh rilis ini.

Temuan lanjutan: pembacaan readiness Tahap 3 masih menerima BAP locked sebagai bukti; tindak lanjut perlu ditinjau terpisah pada pengujian lintas modul Tahap 8, tanpa mengubah engine/readiness di PR laporan ini.
