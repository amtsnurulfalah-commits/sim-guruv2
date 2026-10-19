# Master sekolah dan akademik — Tahap 2.2

Halaman `/admin/master` dan seluruh `/api/settings/:group` hanya dapat digunakan admin dengan sesi business dan onboarding lengkap. Tidak ada identitas sekolah, tahun aktif, tarif, tunjangan atau data transaksi yang diisi otomatis. Bootstrap admin tidak melewati verifikasi email/pertanyaan keamanan.

## Urutan pengisian

1. Isi identitas sekolah/madrasah: nama, alamat, NPSN teks8digit opsional, jenjang, kelas paralel, batas paralel, menit per JTM dan kepala sekolah opsional. Kepala sekolah harus pengguna aktif dengan additional_role KEPALA_SEKOLAH. Jenjang SD/SMP/SMA/SMK merepresentasikan MI/MTs/MA/MAK. Default pada formulir hanya membantu input, bukan data produksi tersimpan.
2. Buat tahun pelajaran berlabel dua tahun berurutan dan rentang tanggal eksplisit. Rentang tahun yang belum diarsipkan tidak boleh bertumpang tindih.
3. Buat semester1/2 dalam rentang tahun. Semester dalam tahun yang sama tidak boleh bertumpang tindih. Penetapan semester aktif menonaktifkan semester sebelumnya dalam transaksi yang sama, menaikkan versi keduanya dan mencatat audit. Tidak ada fallback memilih semester terbaru jika tidak ada yang aktif.
4. Buat kelas pada semester tertentu: nama, jenjang, tingkat1–12, huruf paralel, standar jumlah siswa. SD/MI tingkat1–6 maksimal28 siswa/paralelD; SMP/MTs tingkat7–9 maksimal32/paralelK; SMA/MA tingkat10–12 maksimal36/paralelL; SMK/MAK tingkat10–12 maksimal36/paralelX. Kelas paralel terisi minimal15;0 diperbolehkan. Kelas baru mengikuti konfigurasi sekolah. Batas tersebut adalah kebijakan aplikasi sumber, bukan pernyataan regulasi terkini.
5. Isi mata pelajaran. Nama dinormalisasi dan unik tanpa membedakan huruf besar/kecil. Pilihan relasi dicari di server dan dipaginasi; tidak terbatas hanya pada halaman pertama data master.
6. Isi versi tarif per JTM (`base_salary` sumber berarti tarif per JTM, bukan gaji pokok) dan tarif transportasi per km. Rupiah berupa string integer0–999999999; tarif transport aktif harus positif. Tidak ada kalkulasi honor atau penggandaan faktor transport pada tahap ini.
7. Isi tunjangan per penerima aktif dan nama tugas, nominal bulat serta rentang tanggal eksplisit. Beberapa tugas berbeda dapat berlaku bersamaan pada satu pengguna.

## Kontrak API

Group: `school`, `academic-years`, `academic-periods`, `classes`, `subjects`, `rates`, `allowances`.

| Metode | Path | Kontrak |
|---|---|---|
| GET | `/api/settings/:group` | q,page,pageSize,parentId,archived; default20, maksimum100; filter seluruh dataset; no-store |
| POST | `/api/settings/:group` | `{version:"0",reason,data}`; id tidak diterima |
| PATCH | `/api/settings/:group` | `{id,version,reason,data}`; data lengkap sesuai schema group |
| DELETE | `/api/settings/:group` | `{id,version,reason}`; arsip logis, tidak ada hard delete |
| GET | `/api/settings/:group/history/:id` |50 revisi terbaru dengan actor/alasan/nilai sebelum-sesudah |

`parentId` memfilter tahun untuk semester, semester untuk kelas, penerima untuk tunjangan. UI menyediakan tombol Buka semester/Buka kelas dan Hapus filter relasi. Status archived=false default; true atau kosong untuk arsip/semua. Pagination stabil menurut nama/label dan ID. Pencarian memperlakukan persen sebagai karakter literal.

Mutasi memakai Origin canonical, CSRF sesi dan validasi ketat Zod. ID actor/peran dari browser tidak dipercaya. Setiap perubahan memerlukan alasan5–500 karakter dan CAS versi. Konflik versi/keunikan/rentang mengembalikan409, input/domain422, sesi401, izin403, data hilang404. Jangan mengulang mutasi secara otomatis setelah konflik; muat ulang dan periksa nilai terbaru. Pembatasan persistent30/IP dan15/admin per15menit.

## Riwayat dan tanggal efektif

Tarif dan tunjangan disimpan sebagai versi tetap dengan tanggal awal/akhir inklusif dan terbatas. Pembuatan tidak boleh berlaku surut menurut Asia/Jakarta. Tidak ada PATCH nominal/rentang yang menimpa versi lama. Untuk rencana yang salah, arsipkan versi mendatang sebelum mulai berlaku dan buat rentang pengganti. Versi yang sudah berlaku hari ini/lampau tidak dapat diarsipkan. Koreksi historis melalui alur koreksi/keuangan pada tahap berikutnya, bukan mengubah master secara diam-diam.

Rentang aktif tarif sejenis tidak boleh bertumpang tindih. Tunjangan dicek berdasarkan penerima dan nama tugas kanonis; dua tugas berbeda boleh bersamaan. Serialisasi advisory lock dijalankan sebelum lock actor/target sehingga dua mutasi tidak dapat sama-sama lolos pemeriksaan overlap. Pengarsipan menyimpan riwayat. Tahun/semester yang masih memiliki anak belum diarsipkan ditolak; identitas relasi tahun pada semester dan semester pada kelas tidak dipindahkan lewat edit. Arsip bersifat terminal pada API ini; identitas sekolah tidak dapat diarsipkan.

Setiap tabel memakai ENABLE/FORCE RLS dan policy internal owner. Role business hanya memperoleh EXECUTE tiga entry point; tidak mendapat SELECT/DML tabel, akses hash atau helper. SQL membaca ulang sesi lokal dan izin admin. Trigger menyimpan revisi utuh master di ops.master_revisions serta ringkasan audit; tidak menulis password/token. Migrasi tidak mengubah data pengguna yang ada. Keuangan final/snapshot, kalender/DayContext, jadwal dan unggah Storage tetap pada tahap terkait.
