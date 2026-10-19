# Tahap 3.1–3.6 — Kegiatan, kehadiran, siswa dan jurnal KBM

Autentikasi tetap milik SiM-Guru, tanpa Central SSO/Supabase Auth. Semua tanggal operasional memakai Asia/Jakarta. Migration `20261019170744_attendance_journals_stage3.sql` menambahkan 15 tabel internal, sehingga total menjadi 40 tabel FORCE RLS (termasuk dua tabel finance). Tidak ada data guru, kehadiran atau jurnal produksi sintetis yang disimpan.

| Tahap | Implementasi | Halaman |
|---|---|---|
| 3.1 Occurrence dan konfirmasi | Occurrence unik jadwal/tanggal, snapshot jadwal/kelas/DayContext, assignment pemilik asli/efektif, klaim mandiri tanpa kredit, konfirmasi/cabut per kegiatan oleh admin, version check | `/kegiatan` |
| 3.2 Kehadiran harian | Satu guru/tanggal, jadwal/aktual/provenance, template KBM/UJIAN, pratinjau/penerapan template bertanggal, tambahan peserta beralasan, manual/koreksi admin | `/kehadiran`, `/admin/jadwal-kehadiran`, `/admin/kehadiran-harian` |
| 3.3 Izin dan riwayat | Interval keluar/kembali non-overlap, klip terhadap aktual, rasio maksimal 1, riwayat pribadi, ekspor penuh CSV/PDF | `/kehadiran-saya` |
| 3.4 Rekap siswa | Hadir/sakit/izin/alpa, kelas/periode/tanggal unik, standar jumlah, progres berbasis himpunan kelas wajib, riwayat penginput | `/absensi-siswa/input`, `/absensi-siswa/riwayat` |
| 3.5 Ledger JTM | Posting KBM per sumber/revisi, reversal tepat sekali, append-only, FK sumber dan validasi tanda/nilai, guard bulan final | melalui jurnal dan API ledger |
| 3.6 Jurnal KBM | Hari H/H-1, konfirmasi occurrence wajib, validasi standar dan rekap, materi/catatan, edit/hapus/CAS, histori paginasi/pencarian/filter guru/tanggal, ekspor penuh | `/jurnal`, `/admin/jurnal` |

## Alur admin dan guru

1. Lengkapi guru, periode, kelas, mata pelajaran dan jadwal KBM. Occurrence dibuat idempotent ketika halaman tanggal hari H atau H-1 dibuka. Snapshot yang sudah tercipta dilindungi; perubahan yang akan menghapus atau mengganti sumbernya ditolak. Jadwal/periode/kalender yang belum dipakai tetap mengikuti aturan tahap sebelumnya.
2. Admin membuat template jam masuk/pulang. Pilih tanggal dan template, buat pratinjau, periksa peserta, lalu konfirmasi penerapan. Peserta berasal dari guru aktif pada jadwal KBM efektif, bukan seluruh akun. Jam aktual yang sudah ada tidak ditimpa. Pratinjau terikat aktor, template, daftar peserta, konteks dan versi kehadiran; TTL 10 menit dan sekali pakai.
3. Guru mencatat jam masuk miliknya sesuai waktu server, tidak lebih awal dari jadwal. Pulang nonadmin baru setelah jadwal pulang +5 menit; nilai pulang dibatasi jadwal dan tidak sebelum masuk. Admin dapat mengoreksi jam lampau dengan alasan melalui form manual. Guru tanpa penugasan ditambahkan admin sebagai peserta tambahan yang sah; akun admin sendiri tidak menjadi peserta guru.
4. Admin mengonfirmasi masing-masing kegiatan KBM. Klaim guru sendiri tidak mengonfirmasi, memberi kredit, atau membuka hak mengelola guru lain. Konfirmasi yang memiliki jurnal aktif tidak dapat dicabut sebelum dependensinya ditangani.
5. Admin mengisi rekap siswa hari ini. Semua hitungan integer nonnegatif, total positif dan cocok dengan standar kelas jika diatur. Rekap kelas tambahan tidak menggantikan kelas wajib yang belum diisi. Perubahan rekap yang bertentangan dengan jurnal aktif ditolak.
6. Guru pemilik efektif mengisi jurnal kegiatan terkonfirmasi. Hari H berbobot 100%; H-1 memerlukan flag aktif dan konfirmasi occurrence kemarin. Kredit H-1 = round-half-up(basis × 0.8, 1); misalnya 3 menjadi 2.4000. Bobot tetap saat edit. Tanpa rekap, jumlah tetap diperiksa terhadap snapshot standar kelas dan UI menyatakan rekap belum tersedia.
7. Edit/hapus jurnal dibatasi pemilik/admin, memerlukan versi dan alasan. Edit membalik posting lama lalu memposting revisi dalam transaksi sama. Hapus memberi reversal dan soft delete; audit/jurnal/ledger lama tetap disimpan. Periode final menolak mutasi langsung.

## Kontrak endpoint aktual

Seluruh endpoint memerlukan sesi business valid dan memeriksa ulang bukti sesi di SQL. GET menolak pembacaan cross-site; POST wajib Origin dan CSRF sesi. Respons JSON memakai envelope bersama dan `Cache-Control: no-store`. Role/actor, kredit JTM, bobot dan tanggal server tidak diterima sebagai klaim browser. Payload strict Zod; SQL memeriksa ulang kepemilikan, versi, waktu, relasi dan invariannya.

Registry konkret menggantikan registry konseptual di rancangan 0.3:

| Metode | Path | Payload / query |
|---|---|---|
| GET | `/api/activities/occurrences`, `/eligible` | `date` ISO, default hari ini WIB |
| GET | `/api/activities/attendance`, `/students`, `/journals`, `/ledger` | `from,to,page,pageSize`; attendance/journals mendukung `userId`, journals mendukung `q` |
| GET | `/api/activities/options`, `/templates`, `/blocks` | tanpa query; templates/blocks hanya admin |
| GET | `/api/activities/students-progress` | `date`, admin |
| POST | `/api/activities/claim`, `/confirm`, `/revoke` | `occurrenceId,version,reason` |
| POST | `/api/activities/template-save`, `/template-delete` | `dayIndex,type,version,reason`; save menambah `timeIn,timeOut` |
| POST | `/api/activities/template-preview`, `/template-apply` | preview: `date,templateId`; apply: `previewId,reason` |
| POST | `/api/activities/manual` | `userId,date,scheduledIn,scheduledOut,actualIn,actualOut,extra,version,reason`; jam nullable |
| POST | `/api/activities/in`, `/out` | `attendanceId,version,reason` |
| POST | `/api/activities/leave`, `/delete-leave` | `attendanceId,version,reason`; leave: `leaveTime,returnTime`; delete: `leaveId` |
| POST | `/api/activities/students-save` | `classId,date,hadir,sakit,izin,alpa,version,reason` |
| POST | `/api/activities/journal-create` | `occurrenceId,material,present,absent,notes,reason` |
| POST | `/api/activities/journal-edit`, `/journal-delete` | `journalId,version,reason`; edit menambah `material,present,absent,notes` |
| POST | `/api/activities/h1`, `/block` | h1: `enabled,reason`; block: `id?`, `subjectId,dateStart,dateEnd,message,active,version,reason` |
| GET | `/api/activities/export` | `kind=attendance|journals`, `format=csv|pdf`, filter riwayat; ekspor seluruh hasil, bukan halaman layar |

Suffix `/eligible` dan seterusnya pada tabel selalu berada di bawah `/api/activities/`. Rentang riwayat maksimal 366 tanggal inklusif; pageSize maksimal 100. Ekspor lebih dari 10.000 baris ditolak agar rentang dipersempit. CSV mengutip newline/koma/tanda kutip dan menetralkan formula spreadsheet. PDF memakai font DejaVu tertanam dengan lisensi disertakan. Ekspor membaca satu snapshot repeatable-read dan menerapkan scope pemilik pada setiap batch.

Versi awal create memakai `version="0"` untuk rekap, template dan kehadiran manual baru. Versi update berasal dari respons daftar; versi konflik selalu ditolak tanpa silent overwrite. Duplicate journal menghasilkan 409 dan tidak menggandakan kredit. Semua mutasi domain menggunakan urutan advisory lock yang sama dengan perubahan akun/master, diikuti guard bulan dan lock baris. Finalisasi Tahap 6 harus mengunci `finance.period_guards` yang sama dan mengisi `finalized_at`; bukan membuat jalur finalisasi yang melewati guard ini.

Batas rate khusus kegiatan: per 15 menit 1000 request/IP, 300 mutasi/akun, 30 ekspor/akun; HMAC identitas rate dan counter persisten. Kuota OTP/pemulihan tetap terpisah.

## Batas integrasi yang sengaja dinyatakan

- Modul piket, upacara, substitusi penuh/partial serta penyesuaian JTM masuk Tahap 4; ujian/panitia/pengawas masuk Tahap 5. Pada Tahap 3 baru admin yang menjadi petugas pengelola konfirmasi/rekap/jam guru lain; guru tetap mempunyai jalur pribadi. Tidak ada hak piket/panitia palsu dari klaim sendiri. Template UJIAN dapat disimpan, penerapannya ditolak sampai adapter penugasan ujian tersedia.
- Kredit sumber ledger saat ini KBM dan reversal. Tahap berikutnya memperluas jenis sumber beserta FK, conservation dan guard yang sama. Honor/slip final belum diimplementasikan.
- Hari kalender/override yang sudah memiliki occurrence/kehadiran dilindungi secara konservatif dengan `ACTIVITY_REFERENCED`, termasuk perubahan deskripsi. Alur koreksi lintas domain dan preview dampak lanjutan harus ditambahkan sebelum aturan ini dilonggarkan.
- PGlite mengantre transaksi pada satu engine. Uji dua promise membuktikan duplicate/atomic behavior pada engine itu, bukan bukti race dua koneksi PostgreSQL native. UAT browser dengan akun guru/admin nyata dan race native dua koneksi masih perlu bukti tersendiri.
