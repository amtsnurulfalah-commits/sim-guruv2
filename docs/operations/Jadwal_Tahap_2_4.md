# Jadwal KBM — Tahap 2.4

`/jadwal` menampilkan jadwal pribadi dan jadwal hari ini untuk sesi bisnis. Admin dapat mengelola jadwal seluruh guru, mencari, memfilter, melihat rekap, mencetak seluruh hasil filter dan audit. Belum ada konfirmasi kegiatan, jurnal, substitusi, eligibility H-1 atau perhitungan honor.

Filter tahun ajaran menelusuri semester terkait. Cetak mengambil seluruh halaman sesuai filter; perubahan jumlah/duplikasi selama pengambilan ditolak untuk dimuat ulang.

Jadwal mingguan mengikat guru aktif, kelas, mata pelajaran dan semester. Kelas wajib berada pada semester yang sama. Rentang berlaku inklusif maksimal 366 hari berada dalam semester dan mengandung hari mingguan yang dipilih. Waktu akhir dihitung server: waktu mulai + JTM × menit per JTM sekolah + istirahat. JTM memakai numeric(12,4), terpisah dari durasi; waktu memiliki presisi empat desimal detik. Tidak boleh melewati tengah malam.

Bentrok guru ATAU kelas pada semester/hari dan rentang berlaku beririsan ditolak. Interval waktu setengah terbuka: jadwal bersebelahan diperbolehkan. Pemeriksaan bersifat konservatif, tetap menolak bentrok mingguan meskipun kalender sementara mematikan KBM. Dengan demikian mengaktifkan kembali KBM tidak membuka bentrok laten. Pratinjau bentrok hanya informasi; penyimpanan memeriksa ulang dalam transaksi.

Jadwal mendatang dapat direvisi dengan CAS versi. Jadwal yang sudah berjalan direvisi ke depan: versi lama ditutup sehari sebelum mulai versi pengganti, dengan tautan replaces_id. Nama guru/kelas/mapel/semester disimpan sebagai snapshot. Perubahan master tidak menulis ulang snapshot. Jadwal berakhir, ditutup atau diarsipkan tidak dapat diedit melalui jalur biasa. Penghentian sejak tanggal mendatang memangkas rentang atau mengarsipkan jadwal yang belum dimulai, tanpa menghapus riwayat.

## API

| Path | Metode | Akses dan fungsi |
|---|---|---|
| `/api/schedules` | GET, POST | Admin: daftar berfilter/pagination dan tambah |
| `/api/schedules/[id]` | PATCH, DELETE | Admin: revisi CAS dan penghentian bertanggal |
| `/api/schedules/[id]/history` | GET | Admin: audit |
| `/api/schedules/conflicts` | POST | Admin: pemeriksaan tanpa mutasi |
| `/api/schedules/recaps` | GET | Admin: jumlah baris dan total JTM seluruh hasil filter |
| `/api/schedules/mine` | GET | Hanya jadwal pemilik sesi |
| `/api/schedules/today` | GET | Hanya jadwal pemilik sesi yang sesuai DayContext, hari dan masa berlaku |
| `/api/schedules/bulk-delete/preview` | POST | Admin: pratinjau penghentian maksimal 100 ID unik |
| `/api/schedules/bulk-delete` | POST | Admin: commit previewId |

Rekap adalah jumlah baris jadwal sesuai filter, bukan realisasi mingguan/bulanan, presensi atau honor. Seluruh API no-store. Mutasi memeriksa Origin, CSRF, sesi, onboarding dan role, dengan rate limit persisten 30/IP dan 15/admin per 15 menit. Actor dari payload tidak dipercaya. Alasan wajib; error tidak membocorkan SQL.

Preview massal terikat actor, berumur 10 menit, sekali pakai, dan terikat revisi global. Perubahan jadwal/kalender/master terkait membuat preview usang. Commit menguji ulang seluruh item dan membatalkan seluruh batch bila satu item gagal. Advisory lock global 734190/1 sama dengan master dan kalender, ditambah CAS serta trigger validasi bentrok/durasi.

Dua tabel baru memakai FORCE RLS. Runtime hanya dapat memanggil entry point; helper dan tabel tidak dapat diakses langsung. Audit memakai ops.master_revisions. Penutupan semester/kelas/mapel yang merusak referensi jadwal ditolak. Retensi metadata preview masuk pekerjaan operasional tahap berikutnya.

Adapter kalender sekarang mendukung teaching_schedules dengan assignmentIntegration=teaching_ready. Hari libur mematikan daftar hari ini tanpa menghapus jadwal mingguan. Adapter tetap fail closed bila modul occurrence/ujian/keuangan dipasang tanpa integrasi berikutnya. Snapshot occurrence dan lock finansial belum tersedia.

Uji lokal mencakup bentrok, batas interval, pecahan JTM, snapshot, revisi maju, hak akses dan rollback batch. Skrip `npm run test:schedules:native` memerlukan database lokal disposable kosong berakhiran `_test`; dua koneksi native belum dijalankan karena lingkungan melarang pergantian UID untuk memulai PostgreSQL. Uji ini tidak dijalankan terhadap produksi. CRUD browser dengan admin bisnis nyata tetap menunggu onboarding/email lengkap.
