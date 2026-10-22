# Audit Data Master — seluruh tujuh kelompok

Cakupan: identitas sekolah, tahun pelajaran, semester, kelas dan standar siswa,
mata pelajaran, tarif, dan tunjangan. Audit menelusuri MasterManager, editor dan
pemilih relasi, transport API/CSRF, shared dialog/table/feedback, schema Zod,
MasterService, HTTP routes, SQL master_list/master_save/master_history, trigger
validasi/audit, serta integrasi pengguna dan halaman yang memakai data master.

## Temuan dan perbaikan

| Temuan / penyebab | Perbaikan |
| --- | --- |
| Status arsip terbawa antar kelompok dan navigasi data turunan | Reset status ke belum diarsipkan bersama reset query/halaman; filter relasi tetap terjaga saat membuka turunan |
| Tombol tambah identitas sekolah memakai total hasil pencarian, padahal tabel singleton | Verifikasi keberadaan sekolah tanpa filter pencarian/status; tambah dinonaktifkan selama verifikasi belum berhasil |
| Pemilih relasi menelan detail error, mempertahankan hasil lama, dan tidak menyediakan retry | ErrorFeedback mempertahankan pesan/kode referensi bantuan, hasil lama dibersihkan saat gagal, retry eksplisit, loading dan pager terkunci saat memuat/gagal |
| Label relasi pilihan baru hilang setelah mencari/berpindah halaman | Simpan label pilihan secara lokal ketika dipilih |
| Editor menawarkan pemindahan induk semester/kelas yang selalu ditolak trigger SQL | Tampilkan relasi tersimpan sebagai informasi tetap; hidden input mempertahankan kontrak payload |
| Validasi lintas field tidak menunjukkan field, belum diperiksa sebelum request | Gunakan schema bisnis yang sama di browser; tambahkan path dateEnd, label, parallelMax, grade, parallel, expectedStudents dan amount; terapkan field error/fokus tanpa menghapus input |
| Penguncian submit hanya bergantung pada render state | Ref sinkron mencegah request mutasi ganda sebelum render berikutnya |
| Riwayat baru dibuka sesudah request selesai sehingga respons terlambat dapat membuka konteks lama | Buka dialog segera dengan loading, simpan kind saat request, abort pada close/unmount/request pengganti, pisahkan error riwayat |
| Tidak ada pemeriksaan bentuk respons runtime | Kontrak baca untuk daftar/riwayat dan kontrak pengguna yang sudah ada untuk pilihan pengguna; respons tak sesuai menjadi error pemuatan |
| Halaman kosong ketika jumlah halaman menyusut | Clamp halaman ke halaman terakhir dan muat ulang dengan nomor yang valid |
| Teks panjang memperlebar tabel/modal; kontrol filter dan tombol sempit | Tabel fixed-layout dalam TableRegion yang dapat digulir; wrapping teks, input fleksibel, tombol wrap, padding modal responsif, batas tinggi/scroll internal dialog arsip |
| Kegagalan refresh sesudah mutasi dapat membingungkan pengguna | Feedback sukses menjelaskan agar memuat ulang daftar tanpa mengulang mutasi |

Tidak ada perubahan endpoint, struktur database, otorisasi, CSRF, optimistic
version check, alasan audit, integrasi backend, atau kebijakan bisnis. Tarif dan
tunjangan tetap memakai versi baru; pengarsipan tetap diperiksa server terhadap
waktu WIB dan relasi. Tidak ada retry otomatis untuk mutasi.

## Validasi

- `npm run lint`: lulus tanpa warning/error lint.
- `npm run typecheck`: lulus.
- `npm test`: 67 lulus; mencakup batas tiap jenjang dan path field invalid.
- `npm run test:crypto`: 29 lulus.
- `npm run test:db`: 329 lulus, termasuk CRUD semua master, relasi, versi,
  overlap, arsip, audit, serta integrasi domain lain.
- `npm run build`: lulus.
- `npm run test:ui:masters`: lulus, 7 kelompok × 6 viewport
  (320, 375, 768, 1024, 1440, 1920); editor, wrapping teks panjang, modal bounds,
  tidak ada overflow halaman/modal, singleton saat filter kosong, reset arsip,
  navigasi anak, relasi induk tetap, validasi client tanpa request, retry pilihan,
  close riwayat saat request tertunda, submit ganda, respons malformed,
  server error dengan referensi bantuan, empty state, resize/orientasi.
- Screenshot editor mobile dan daftar desktop diperiksa secara visual.

Pengujian browser memakai data sintetis dan database disposable. Hasil ini bukan
klaim pengujian langsung terhadap data atau lingkungan produksi. Halaman panjang
dan tabel lebar tetap dapat digulir pada area yang tepat; overflow viewport yang
memotong kontrol dicegah.
