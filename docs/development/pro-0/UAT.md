# Paket UAT PRO-0 — 1 admin dan 3 guru

## Peserta dan persiapan

Kelompok dipilih pengguna pada sesi PRO-0. Kode anonim: A01 (admin), G01 (guru ponsel), G02 (guru desktop bila tersedia), G03 (guru yang juga menjalankan piket/panitia pada skenario). Nama, perangkat aktual, jadwal sesi dan hasil belum diberikan. Peran piket/panitia ditetapkan oleh penugasan yang sah, bukan role admin tambahan.

Pengelola mengatur empat peserta secara langsung; tidak ada undangan/email yang dikirim otomatis. Identitas pribadi tidak dimasukkan ke Git. Target perangkat merupakan rencana, bukan perangkat yang sudah terbukti tersedia.

Siapkan lingkungan UAT terisolasi dengan akun sintetis dan data yang memadai. Kode fixture browser yang tersedia belum merupakan portal UAT untuk guru; penyediaan akses staging/dataset merupakan prasyarat B-002. Email/job dari dataset uji harus tidak menyasar orang nyata. Jangan meminta peserta mengubah transaksi honor, mengganti petugas nyata, atau mencoba pembatalan pada produksi demi pengujian. Peninjauan akun/slip sendiri secara baca-saja dapat dipisahkan jika disepakati.

Moderator menyiapkan: jadwal pada tanggal WIB yang sah, kegiatan terkonfirmasi, jumlah siswa sesuai, prasyarat jam hadir, kandidat pengganti yang valid, sesi/ruang ujian, slip sintetis final/proyeksi, dan referensi kendala sintetis. Jangan melemahkan guard untuk membuat skenario lulus. Jika prasyarat tidak tersedia, catat **terblokir**, bukan gagal UX dan bukan berhasil.

## Protokol pengamatan

1. Jelaskan tujuan, minta kesediaan peserta, dan gunakan data sintetis. Rekaman/screenshot hanya bila disepakati; jangan merekam password/OTP/reCAPTCHA token.
2. Berikan tujuan tugas tanpa menunjukkan tombol/langkah. Mulai timer ketika peserta memahami tujuan.
3. Catat durasi total tugas, waktu menunggu sistem yang dapat diidentifikasi, kesalahan, bantuan, perangkat, koneksi dan hasil. Jangan mengurangi waktu tunggu dengan perkiraan; jika tidak terukur isi tidak terukur.
4. Jika peserta meminta bantuan, catat sebelum memberi petunjuk. Jangan menyamakan keberhasilan dengan bantuan dan tanpa bantuan.
5. Setelah tugas, tanyakan bagian paling membingungkan dan kemudahan 1–5. Skor ini penilaian peserta, bukan tebakan pengembang.
6. Hentikan bila ada risiko data/akun, ketidaknyamanan, atau hasil transaksi yang belum diketahui. Untuk write tidak pasti, periksa status sumber sebelum mencoba ulang.
7. Sesi pembanding PRO-1 mengulangi tujuan yang sama. Catat perbedaan peserta/perangkat/dataset; jangan memaksakan perbandingan yang tidak setara.

## Sepuluh skenario

| ID | Peserta | Tujuan netral | Prasyarat | Bukti berhasil |
|---|---|---|---|---|
| U01 | G01/G02/G03 | Temukan jadwal mengajar hari ini dan kelas/jam berikutnya | Jadwal sintetis tanggal WIB | Peserta menunjukkan kegiatan yang benar tanpa data guru lain |
| U02 | G01/G02 | Catat pembelajaran untuk satu kegiatan dan pastikan hasilnya | Kegiatan sah, konfirmasi, rekap siswa dan waktu input valid | Jurnal tersimpan sekali, muncul di riwayat, status draft/server dapat dijelaskan |
| U03 | A01 | Tetapkan guru pengganti, ubah penggantinya, lalu batalkan dalam skenario uji | Dua/tiga guru berbeda, kewenangan dan kandidat valid | Riwayat penugasan dan pemilik efektif sesuai tiap langkah; tidak ada kredit ganda |
| U04 | A01/G03 | Konfirmasikan tugas dan jelaskan apa yang masih diperlukan sebelum mencatat kegiatan | Penugasan piket/panitia/KBM dan actor yang diizinkan | Konfirmasi tercatat; peserta membedakan konfirmasi dan jam hadir |
| U05 | G03 | Buat BAP pengawasan yang menjadi tanggung jawab Anda | Pengawas efektif, jam dan rekap ujian lengkap | BAP tersimpan sekali dengan hitungan sesuai sumber |
| U06 | G01/G02/G03 | Temukan slip dan jelaskan asal satu komponen honorarium | Slip sintetis dan izin akun sendiri | Slip/periode benar; titik kebingungan rincian dicatat, tidak menebak nominal |
| U07 | A01 | Telusuri kode bantuan dan tentukan tindak lanjut | Referensi/case sintetis | Case yang benar, status/penanggung jawab/tindakan dapat dipahami |
| U08 | A01 | Temukan tugas paling mendesak dan buka sumber yang perlu diperbaiki | Tugas siap dan tugas berprasyarat sintetis | Sumber/tanggal benar dan alasan blocker dipahami |
| U09 | G01 | Pulihkan draft saat formulir ditutup dan dibuka kembali pada tab yang sama | Draft jurnal/BAP sesuai kebijakan sessionStorage | Draft akun sendiri pulih; peserta tahu belum tersimpan di server |
| U10 | G01/A01 | Hadapi simulasi koneksi terputus setelah menekan simpan | Lingkungan terkontrol yang dapat menyimulasikan ketidakpastian | Tidak mengirim ganda; peserta memeriksa hasil melalui sumber/riwayat |

Skenario tidak harus dibebankan semua kepada semua peserta. Lembar awal memuat 17 percobaan yang sesuai peran; moderator boleh menambah percobaan dengan alasan. Nilai asli kosong sampai sesi dilaksanakan. Tiga langkah substitusi U03 dapat dipecah menjadi U03a/b/c bila dibutuhkan; tetap simpan ID induk untuk perbandingan.

## Metrik dan klasifikasi

Hasil: `berhasil_tanpa_bantuan`, `berhasil_dengan_bantuan`, `gagal`, `terblokir`, atau `belum_diuji`.

- Keberhasilan mandiri = berhasil_tanpa_bantuan / seluruh percobaan yang benar-benar dapat dijalankan; laporkan terblokir terpisah.
- Tampilkan juga hitungan asli dan peserta, jangan mengandalkan persen pada sampel empat orang.
- Median durasi dihitung per tugas/kategori yang setara, bukan dicampur semua tugas.
- Kesalahan: jelaskan apa yang terjadi dan dampaknya; bedakan penolakan aturan bisnis yang benar dengan bug.
- Bantuan: jumlah dan jenis petunjuk, tanpa menyalahkan peserta.
- Pisahkan masalah UX, prasyarat/dataset, koneksi, bug runtime, dan pertanyaan kebijakan.

## Target awal yang perlu disepakati setelah baseline manusia

Tidak ada nilai durasi manusia yang diisi sebagai fakta pada PRO-0 ini. Usulan untuk PRO-1: tidak ada kehilangan data/pengiriman ganda; setiap peserta dapat menemukan alur utama sesuai perannya; target penurunan median durasi dan kebutuhan bantuan ditetapkan sesudah hasil pertama tersedia. Jangan menyatakan target 20%/90% tercapai tanpa denominator dan pengukuran.

## Kebutuhan penyelesaian

Pengelola perlu menetapkan waktu, perangkat empat peserta, lingkungan uji aman dan moderator. Isi `uat-results.csv`, lalu sertakan rangkuman anonim. Hasil tersebut diperlukan untuk menutup PRO-0.4 dan menentukan urutan perbaikan UI berbasis frekuensi nyata.
