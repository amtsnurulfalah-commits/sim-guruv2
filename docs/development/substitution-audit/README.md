# Audit penugasan dan pengganti

## Cakupan dan alur

Ditelaah: DutyManager, ExamManager, ExamImpactDialog/DataForm, kontrak/input Zod, endpoint HTTP dan service duties/programs/activities, seluruh definisi/patch SQL terkait penugasan efektif, bentrok, attendance/rekap siswa, jurnal/BAP, ledger/reversal, periode final, dan tes unit/integrasi/native yang terkait.

| Fitur                          | Sumber dan kontrol                                                                                                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guru piket                     | duty_schedules mingguan → ensure_occurrences → activity_assignments; konfirmasi admin menghasilkan basis 4 JTM. Hak operator piket memerlukan konfirmasi dan jam masuk.                                                          |
| Guru piket pengganti           | substitusi/replace/cancel pada occurrence PIKET, menggunakan effective_user_id; konfirmasi ulang diperlukan. Piket tetap non-eksklusif terhadap KBM sesuai kebijakan lama.                                                       |
| Guru KBM pengganti             | occurrence KBM dengan pemilik asli dan efektif; kandidat diperiksa terhadap jadwal/penugasan/alokasi yang relevan. Pergantian membersihkan konfirmasi, klaim dan jurnal aktif serta membalik kredit; kehadiran harian tetap ada. |
| Panitia ujian                  | exam_committee_assignments → exam_sync; cakupan operator menurut tanggal/periode, konfirmasi dan ketentuan rekap/jam masuk yang sudah ada. Tugas eksklusif dan non-eksklusif tetap dibedakan.                                    |
| Panitia ujian pengganti        | mesin substitusi yang sama; hak operator lama hilang saat diganti, pengganti mendapatnya setelah konfirmasi. Kredit lama dibalik, bukan ditambah ke pemilik baru.                                                                |
| Pengawas ruang ujian pengganti | sumber pengawas/sesi/ruang → occurrence efektif; BAP hanya milik pengawas efektif. Pergantian mengunci BAP lama, membalik kredit dan mengharuskan konfirmasi/BAP baru.                                                           |

Semua mutasi memakai sesi server, pemeriksaan actor/ownership/today-only, alasan, global advisory write lock, CAS/version, periode final, dan audit. Preview bersifat actor-bound, memiliki fingerprint/expiry dan bukan otorisasi mutasi; commit memeriksa ulang. Ledger tetap append-only dengan reversal dan conservation guard.

## Bug yang direproduksi sebelum perbaikan

1. **Bentrok piket lolos jika jadwal target belum materialized.** Preview sudah dibuat, admin lain membuat jadwal mingguan untuk kandidat, lalu commit pengganti diterima karena pemeriksaan hanya melihat occurrence yang sudah terbentuk. Dua piket efektif dapat muncul setelah board dibaca.
2. **Arah sebaliknya juga lolos.** Jadwal piket baru bisa dibuat untuk guru yang sudah menjadi pengganti efektif piket lain pada tanggal tersebut.
3. **Bentrok palsu pada jendela mingguan.** Dua rentang beririsan pada hari yang bukan hari piket ditolak, meskipun seluruh tanggal piket sebenarnya berbeda.
4. **Sinkronisasi ujian menimpa pengganti hari berjalan.** Perubahan nama guru asal mengubah snapshot proyeksi. Menyimpan master ujian lain kemudian bisa mengembalikan assignment yang belum dikonfirmasi ke guru asal sementara baris substitusi masih aktif; pada assignment terkonfirmasi bisa menolak penyimpanan master lain. Risiko berlaku bagi panitia dan pengawas, termasuk BAP/kredit terkait.

Tes baru D20–D22/E13 gagal pada kode lama; hasil tes disimpan sebagai bukti lokal. Tidak mengubah tes lama agar menerima perilaku salah.

## Perbaikan

Migrasi additive `20261025142235_substitution_consistency_guards.sql` memperbaiki tiga routine yang ada:

- `app.stage4_duty_candidate`: kandidat piket juga diperiksa terhadap jadwal mingguan aktif yang belum terbentuk. Pemilik mingguan yang sudah dialihkan ke pengganti lain pada tanggal itu tetap boleh menggantikan tugas lain.
- `app.duty_schedule_save`: validasi terhadap penugasan piket efektif yang sudah ada; rentang mingguan memakai `schedule_weekday_exists` pada irisan tanggal, seperti validasi jadwal mengajar yang sudah ada.
- `app.exam_sync`: assignment yang sudah berada pada hari berjalan tetap merupakan bukti historis dan tidak disinkron ulang hanya karena metadata master berubah. Snapshot masa depan tetap diperbarui; sesi masa depan tetap dapat dipindahkan ke hari ini melalui API yang sudah divalidasi.

Tidak mengubah jadwal, alokasi, nilai ledger, BAP, atau penugasan produksi yang tersimpan secara massal. Tidak ada perubahan UI/API, kolom/tabel, dependency, formula honorarium, ataupun perluasan hak akses. Routine diganti secara terbatas dengan precondition `PRIOR_ROUTINE_MISMATCH` agar pemasangan berhenti bila definisi dasar tidak cocok. Migration lama tidak diubah.

## Validasi

- D20–D24: jadwal baru sesudah preview, bentrok arah sebaliknya, irisan tanggal tanpa weekday bersama, pemilik yang sudah dialihkan, atomic failure, serta owner/search_path/grants.
- E13: panitia dan pengawas pengganti bertahan sebelum maupun sesudah konfirmasi; BAP aktif, versi assignment dan kredit tetap sama saat master lain disimpan; cancel tetap membalik kredit/mengunci BAP.
- E14: edit sesi masa depan ke hari ini tetap menyinkronkan occurrence.
- E15: siklus panitia confirm → substitute → confirm → replace → confirm → cancel → reconfirm; peralihan hak operator dan net kredit, serta rantai riwayat pengganti.
- Regresi lama: KBM pengganti, bentrok lintas tugas, self-operation, scope aktor, periode final, H-1, partial allocation dan conservation, cleanup jurnal/BAP, waktu/jumlah BAP, HTTP/session/CSRF, dan rollback.
- Native NR03/NR04 memakai dua koneksi PostgreSQL berbeda: dua penugasan berebut satu pengganti; serta commit pengganti melawan pembuatan jadwal. Tepat satu permintaan harus berhasil dan kredit akhir tidak menjadi ganda. Suite ini sudah termasuk job CI native yang ada.
- Pengujian lokal PGlite memakai tanggal/sesi/akun sintetis. Sandbox lokal hanya memetakan UID0 sehingga tidak dapat menjalankan server native sebagai user non-root; pengujian native masih menunggu runner CI PostgreSQL dan belum diklaim lulus dari PGlite.

## Pemeriksaan produksi yang hanya baca

Security advisor tidak melaporkan lint. Pemeriksaan agregat saat audit menemukan nol substitusi aktif yang pemilik efektifnya tidak cocok, nol grup piket efektif ganda, dan nol BAP aktif milik pengguna yang berbeda dari penugasan efektif. Ini hanya tiga pemeriksaan invarians, bukan klaim seluruh data produksi sempurna. Tidak membaca/mempublikasikan identitas pengguna.

Baseline routine produksi saat audit (owner sim_guru_owner, search_path=pg_catalog):

| Routine               | md5 body                         |
| --------------------- | -------------------------------- |
| duty_schedule_save    | 2a10e58200ef3f58fa321be7ae48d521 |
| exam_sync             | 06ea4904ac20be628fc8299c3fcc63b1 |
| stage4_duty_candidate | 5d44fa777b0ff37779733d450cc88991 |

## Penerapan

Migrasi produksi belum dijalankan dalam audit ini. Sebelum menerapkan, cocokkan baseline/checksum, gunakan transaksi dan lock migrasi kanonis `(734190,0)`, jalankan file migrasi utuh, lalu catat nama/checksum SHA256 dalam `sim_guru_migration.schema_migrations` pada transaksi yang sama. Ikuti mekanisme migrasi repositori; jangan menjalankan ulang migration lama atau mengedit ledger secara terpisah.

Sesudah penerapan, periksa ledger migrasi, routine owner/search_path/ACL, security advisor, serta tiga invarians agregat di atas. Tidak perlu environment/dependency baru. UAT memakai akun/skenario sintetis; jangan melakukan percobaan penggantian pada penugasan dan honorarium pengguna nyata untuk smoke test.

Hasil lokal: `npm run check` lulus (160 unit, 37 crypto, 390 database/PGlite; lint, typecheck, dan build produksi berhasil). Suite terfokus duties/programs lulus 53/53. Publikasi PR tertahan persetujuan pengunggahan GitHub; NR03/NR04 belum dijalankan di CI native.
