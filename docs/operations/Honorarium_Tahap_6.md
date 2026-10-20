# Honorarium, transport dan bonus libur — Tahap 6.1–6.5

## Fitur dan halaman

| Tahap | Implementasi |
|---|---|
| 6.1 | Hak libur per occurrence KBM/piket/upacara, proyeksi, posting manual idempoten, run/effects, pembatalan dengan reversal, pengecualian beralasan |
| 6.2 | Transport dari satu baris kehadiran guru/tanggal, klip izin, batas rasio 100%, peserta tambahan eksplisit, blok inklusif, pembulatan bulanan tiga titik |
| 6.3 | Engine NUMERIC tunggal untuk realisasi/proyeksi, rekap dan rincian seluruh sumber; tarif/tunjangan efektif, penerima dengan hak termasuk yang sudah tidak aktif |
| 6.4 | Pratinjau finalisasi, pemeriksaan bulan berakhir/kelengkapan, semua slip+lines+outbox atomik, periode nol tetap final, snapshot/checksum immutable |
| 6.5 | Riwayat scoped/pagination/pencarian, PDF, cetak, Excel XLSX seluruh filter, verifikasi publik minimum, permintaan dan settlement koreksi bertahap |

Guru: `/honorarium` dan `/honorarium/riwayat`. Admin: `/admin/honorarium`, `/admin/honorarium/riwayat`, `/admin/honorarium/operasi`. Verifikasi publik: `/verifikasi-dokumen#TOKEN`; token dipindahkan dari fragment ke badan POST dan fragment dibersihkan. URL query tidak dipakai untuk token verifikasi.

## Perhitungan dan keputusan efektif

Engine ada di `finance.calculate`; realisasi, rekap dan snapshot final memakai sumber yang sama. Semua nilai decimal dikirim sebagai string. Pembulatan honor mengajar dilakukan half-up sekali per komponen bulanan. JTM H-1 sudah dibobot pada ledger; engine tidak menerapkan bobot kedua kali.

Tarif per JTM dan tunjangan bulanan memakai versi efektif pada **hari terakhir bulan**. Tunjangan tidak diprorata. Ini pilihan implementasi eksplisit untuk rentang versi yang sebelumnya belum menetapkan aturan dalam satu bulan; label UI dan snapshot menyimpannya. Transport memakai tarif efektif per tanggal. Ketiadaan versi tarif JTM memblokir finalisasi; tarif nol yang disimpan secara eksplisit tetap sah.

Transport: jarak × tarif × min(1, menit efektif / menit jadwal), tanpa faktor pulang-pergi. Settlement bulanan menjumlahkan pecahan rasional tepat dari durasi mikrodetik, jarak dan tarif, dengan reduksi GCD. Konversi 60 desimal baru dilakukan setelah penjumlahan, sehingga kasus 1000/3 + 0.02/3 tepat di333.34 tetap menghasilkan500. Nominal harian yang ditampilkan bukan basis settlement. Formula versi honor-v1.1; bukti numerator/denominator disimpan dalam snapshot. Menit izin diklip ke interval aktual. Jadwal kosong biasa memberi nol; hanya peserta tambahan eksplisit dapat memakai durasi aktual sebagai denominator. Acara mandiri tidak menciptakan tanggal transport. Setelah penjumlahan bulanan: sisa <333,34 turun, 333,34–<666,67 tambah500, sisanya naik1000.

Realisasi memasukkan posting sampai hari ini; hak libur belum diposting ditampilkan terpisah. Proyeksi seluruh periode menambahkan hak tertunda/mendatang tepat satu kali. Dua jadwal pada satu tanggal tetap dua hak. Sumber manual yang sudah memiliki jurnal/posting reguler tidak mendapat bonus kedua. Pembatalan run hanya membalik effects run tersebut, mengembalikan entitlement menjadi pending; tidak ada penghapusan jurnal manual. Pengecualian pending memakai pratinjau dan alasan.

## Finalisasi dan koreksi

Lengkapi identitas sekolah/kepala madrasah, tarif dan tunjangan di data master. Pilih bulan yang sudah berakhir, selesaikan posting/pengecualian libur, buka pratinjau lalu konfirmasikan. Pratinjau terikat actor, fingerprint dan masa10menit. Data berubah → pratinjau ulang. Pengulangan commit yang sama tidak menerbitkan ulang slip.

Mutasi dan finalisasi memakai advisory lock global yang sama, diikuti `finance.period_guards` dan pemeriksaan periode. Satu transaksi menyimpan roster penerima (termasuk nol), identitas sekolah/penerima/penandatangan, tarif, rincian sumber, raw/settled, versi formula/kebijakan, checksum dan antrean notifikasi. Gagal pada slip mana pun membatalkan seluruh transaksi. Periode final tidak dibuka ulang dan snapshot tidak dihitung ulang dari master terbaru.

Guru dapat mengajukan koreksi slip sendiri. Admin membuka slip sumber, mengisi basis benar (JTM, total tunjangan, transport mentah), periode tujuan berikutnya yang terbuka, alasan dan referensi bukti. Pratinjau memakai tarif snapshot asli. Delta diukur terhadap **basis koreksi terakhir**, disimpan sebagai rupiah pada bulan tujuan, bukan JTM yang dikalikan tarif baru. Nominal negatif yang melampaui hak bulan tujuan memblokir finalisasi; tidak ada utang/carry-forward otomatis. Snapshot asli tetap utuh; verifikasi menandai adanya koreksi.

## API dan ekspor

`/api/honorarium/[action]`: GET `read` dengan kind estimate/recap/history/statement/operations; POST preview/commit/holiday/block/request/token; GET pdf/excel dan POST pdf terverifikasi. Mutasi privat memerlukan sesi bisnis internal, Origin, CSRF, payload ketat/batas8KiB dan kuota persisten. Read dan dokumen `no-store`; guru hanya slip miliknya, admin sesuai scope. Ekspor XLSX menelusuri seluruh hasil filter (maks10000) dalam transaksi repeatable-read; semua sel teks menjaga presisi dan mencegah formula injection. PDF/cetak mengambil snapshot final.

POST `verify` bersifat publik, dibatasi30permintaan/IP/menit. Token acak berentropi lebih dari256bit disimpan hanya sebagai SHA256. Respons hanya status, jenis dokumen, periode, sekolah dan nama penerima tersamarkan; tanpa nominal, NIP atau kontak. PDF terverifikasi membuat token melalui POST terautentikasi/CSRF, bukan efek samping GET.

## Batas Tahap 6

Posting libur dan finalisasi saat ini dijalankan manual melalui UI. Jadwal otomatis, retry/worker notifikasi honor dan reminder dilanjutkan Tahap7; antrean `finance.notification_outbox` sudah dibuat. Worker email keamanan/OTP yang ada tetap terpisah. Tidak ada environment baru atau email uji yang dikirim pada tahap ini. CRUD browser akun produksi dan race native dua koneksi belum dinyatakan terverifikasi.
