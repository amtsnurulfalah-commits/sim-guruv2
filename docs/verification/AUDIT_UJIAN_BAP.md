# Audit Ujian dan BAP

Tanggal: 23 Oktober 2026. Cakupan: `/ujian`, `/ujian/bap`, `/ujian/panitia`, `/admin/ujian`; ExamManager, DataForm dan modal dampak, schema/kontrak, ProgramService, handler HTTP dan route, serta SQL master ujian, konfirmasi, substitusi, BAP, penghapusan dan ledger yang dipanggil halaman.

## A. Temuan

- Filter tanggal/periode bisa berubah ketika data lama masih dapat digunakan. Respons baca tidak dibatalkan secara konsisten dan hanya dipercaya melalui type assertion; error lama tidak selalu dibersihkan.
- Semua operasi ditawarkan kepada panitia tanpa memeriksa periode yang menjadi kewenangannya, kelengkapan rekap kelas, pemilik, konfirmasi aktif, keberadaan pengganti dan alokasi. Server menolak tetapi UI belum memberi arahan.
- Preview dibuka sebelum modal formulir selesai ditutup, sehingga dua sistem modal/fokus dapat bertabrakan. Tidak ada penguncian ulang setelah respons commit hilang atau pemeriksaan kedaluwarsa di UI.
- JTM master dikirim sebagai angka JSON, sedangkan JTM occurrence dikirim sebagai teks desimal. Kontrak runtime harus menerima kedua representasi sah tersebut tanpa menjadikan data rusak sebagai nol.
- BAP belum memvalidasi jumlah hadir + absen terhadap peserta di frontend, dan belum menjelaskan syarat konfirmasi, akhir sesi +5 menit WIB serta batas akhir periode. Pengisian ulang setelah respons terputus dapat menjadi duplikasi atau konflik versi.
- Error rentang tanggal/jam pada master tidak menunjuk kolom. Daftar assignment/BAP tidak memiliki pencarian/pagination; baris tombol dan indentasi master perlu penyesuaian untuk layar sempit.
- Pergantian hari ketika editor operasi terbuka memerlukan penanganan khusus agar formulir tetap dapat ditutup dan filter tidak terkunci.

## B. Perbaikan

- Runtime schema board, master, BAP, occurrence, preview operasi dan preview penghapusan; validasi tanggal, akses, periode, identitas dan versi respons. Normalisasi JTM master yang sah; perhitungan konservasi tetap memakai Decimal.
- AbortController dan pemeriksaan abort sebelum setter; data lama dilepas saat filter/reload dimulai; error baca, loading, empty dan retry dipisahkan. Lock sinkron mencegah pengiriman ganda.
- Pilihan operasi mengikuti aturan SQL sebagai panduan UI, termasuk panitia per periode dan kelengkapan kelas wajib. Guru tujuan mengecualikan pemilik asli, pemilik efektif dan pelaku.
- Modal preview khusus memakai FormDialog bersama. Preview ditampilkan setelah modal input ditutup, terikat pada request dan versi yang dipilih, mempunyai TTL dan tidak dapat dikirim setelah kedaluwarsa/pergantian hari. SQL tetap memeriksa ulang actor, fingerprint, versi dan single-use.
- Respons tulis yang gagal atau tidak dapat diverifikasi mewajibkan penutupan editor dan pembacaan status terbaru sebelum kirim ulang; tidak ada retry otomatis mutasi.
- BAP memeriksa bilangan bulat, jumlah peserta, pemilik efektif, konfirmasi dan waktu WIB sebelum kirim; hasilnya diperiksa terhadap occurrence, versi, identitas BAP dan isian. Batas periode final tetap kewenangan SQL.
- Validasi master memberi path kolom untuk tanggal/jam, pemeriksaan tanggal dalam periode dan kelas sesuai semester. Edit yang pasti ditolak karena sumber historis ditandai tidak tersedia.
- Pencarian penugasan/BAP, pagination 12 penugasan dan 20 BAP, wrapping teks panjang, tombol fleksibel dan indentasi master lebih hemat ruang. Notifikasi keberhasilan pratinjau yang berpotensi menutupi modal dinonaktifkan hanya untuk form ujian; status simpan tetap tampil pada halaman.

Alur: filter → pembacaan board tervalidasi → editor dengan konteks board yang tetap → validasi → simpan master/BAP atau preview → tutup input → review dampak → commit → baca ulang. Formulir operasi yang terbuka saat berganti hari tetap dapat ditutup. Perubahan DataForm menggunakan properti opsional; halaman lain mempertahankan perilaku sebelumnya.

## C. Kode final

- `src/features/programs/exam-manager.tsx`
- `src/features/programs/exam-impact-dialog.tsx`
- `src/features/programs/forms.tsx` (opsi status modal, penguncian dan notifikasi)
- `src/lib/programs/exam-contracts.ts`
- `src/lib/programs/schemas.ts`
- Unit: `tests/unit/exam-contracts.test.ts`; integrasi: `tests/integration/programs.test.ts`; browser: `tests/ui/exams.mjs` (`npm run test:ui:exams`). Data dan route uji pada `tests/ui/server.ts` hanya digunakan oleh fixture localhost.

## D. Validasi

- `npm run check`: lint, TypeScript, 107 unit, 32 kripto/HTTP, 333 integrasi PGlite dan build produksi.
- Suite program (24 tes) memeriksa hierarki master/kelas gabungan, otorisasi, duplikasi penugasan, konfirmasi, BAP +5 menit/jumlah/versi, ledger/reversal, konservasi/alokasi/reset, penggantian dan pembatalannya, periode final dan cascade penghapusan dengan riwayat. Suite juga menjaga regresi integrasi kegiatan/acara yang memakai service dan formulir bersama.
- Browser khusus: konfirmasi pengawas; validasi jumlah peserta; create/edit BAP; create/edit/delete periode; preview satu modal, TTL; kegagalan respons commit; response baca rusak dan retry; pencarian; 31 assignment/43 BAP dengan teks panjang; pergantian hari WIB saat modal terbuka.
- Ukuran Chromium: 320×740, 740×320, 768×1024, 1440×1000. Tidak ditemukan page error, horizontal overflow halaman, atau modal di luar viewport. Scroll vertikal normal dan scroll tabel yang dibatasi container tetap tersedia.
- Matriks UI global dijalankan untuk memastikan komponen bersama tidak mengalami regresi (hasil akhir dicatat di PR).

Batas: pengujian mobile menggunakan emulasi Chromium, bukan perangkat fisik. SQL lokal menggunakan PostgreSQL WASM/PGlite, bukan pembuktian konkurensi PostgreSQL native. Tidak ada migrasi SQL baru atau perubahan data produksi dalam audit ini. Aturan otorisasi, kredit, BAP dan penghapusan backend dipertahankan; seluruh mutasi tetap diperiksa server.
