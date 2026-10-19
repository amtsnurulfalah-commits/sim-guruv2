# Kalender dan DayContext — Tahap 2.3

Halaman admin `/admin/kalender` mengelola catatan tanggal, libur, rentang inklusif maksimal366 tanggal, penghapusan logis serta konteks khusus per tanggal. Semua perubahan melalui pratinjau dan konfirmasi. Tidak ada hari libur atau semester contoh yang diisi otomatis. Identitas/password admin yang sudah ada tidak diubah.

## Kebijakan operasional calendar-v1

- Satu entri per tanggal, description dan isHoliday terpisah. Catatan biasa isHoliday=false tidak mematikan kegiatan (B25/T41).
- Resolver default memakai semester yang secara eksplisit aktif, belum diarsipkan dan mencakup tanggal. Tidak memilih semester terbaru sebagai fallback. Konteks khusus dapat memilih semester belum diarsipkan yang mencakup tanggal tersebut, meskipun bukan semester aktif global.
- Tanpa semester yang sesuai, KBM/ujian nonaktif. Hari libur menonaktifkan mode reguler meskipun konteks khusus meminta aktif. Hari Minggu (dayIndex0) default nonaktif; konteks khusus eksplisit dapat meminta mode aktif, tetapi tidak menciptakan penugasan atau hak kredit.
- Default KBM Senin–Sabtu aktif bila semester sesuai dan bukan libur. Default ujian mengikuti periode ujian aktif dari adapter; pada tahap ini modul ujian belum terpasang sehingga daftar tersebut kosong. Mode ujian dapat diminta melalui override, tetapi bukan bukti penugasan/periode ujian atau eligibility.
- Tanggal lampau menurut Asia/Jakarta tidak dapat ditambah/diubah/dihapus melalui jalur biasa. Koreksi historis terotorisasi dan koreksi finansial final tetap alur terpisah pada tahap terkait, bukan bypass boolean force.
- Menghapus catatan/konteks menyimpan tombstone dan menaikkan versi. Menambah ulang satu tanggal memakai versi tombstone dari DayContext. Penambahan rentang hanya untuk tanggal yang belum pernah dicatat; satu benturan membatalkan seluruh rentang, tanpa overwrite diam-diam.

DayContext operasional memuat date, dayIndex, isHoliday, kbmEnabled, examEnabled, activeAcademicPeriod/academicPeriodId, activeExamPeriods/activeExamPeriodIds, override, calendarVersion, overrideVersion, contextVersion, reasons dan policyVersion. UI tidak menyimpulkan libur dari keberadaan catatan/description. contextVersion adalah fingerprint perubahan, bukan credential. Preview virtual dapat mempunyai ID entri baru null; ID tersebut bukan sumber command.

Riwayat kegiatan nanti wajib menyimpan academicPeriodId/contextVersion dan snapshot pada occurrence/command pertama; jangan memakai resolver operasional saat ini untuk menghitung ulang riwayat lama. Dashboard API dan kartu Konteks hari ini memakai layanan/resolver yang sama dengan kalender. Belum ada jadwal, jurnal, reminder atau engine kredit lain yang perlu dimigrasikan pada tahap ini.

## API

| Path | Metode | Kontrak |
|---|---|---|
| `/api/settings/calendar` | GET | dateStart,dateEnd,q,holiday,page,pageSize; filter seluruh dataset; maksimum100/page dan366hari/rentang |
| `/api/settings/calendar/preview` | POST | upsert `{action,date,version,description,isHoliday,reason}`, delete `{action,date,version,reason}`, range `{action,dateStart,dateEnd,description,isHoliday,reason}` |
| `/api/settings/calendar` | POST/PATCH/DELETE | `{previewId}`; upsert/upsert/delete sesuai metode; payload perubahan dibekukan dalam pratinjau |
| `/api/settings/calendar/range` | POST | `{previewId}` dengan action range |
| `/api/settings/calendar/history` | GET | kind calendar/day-context dan date;50 revisi terbaru |
| `/api/settings/day-context` | GET | date; admin |
| `/api/settings/day-context/preview` | POST | override `{action,date,version,academicPeriodId,kbmEnabled,examEnabled,reason}` atau clear `{action,date,version,reason}` |
| `/api/settings/day-context/commit` | POST | `{previewId}` |
| `/api/day-context` | GET | date; sesi business admin/guru |

Seluruh API no-store; Origin, CSRF, onboarding, role dan sesi divalidasi ulang. Actor/role dari browser tidak dipercaya. Mutasi tidak menerima payload ulang pada commit. Rate persistent30/IP dan15/admin per15menit, termasuk preview dan commit. Alasan5–500 karakter. Preview berumur10menit, milik actor, terikat jenis/tindakan, sekali pakai. Kalender/semester berubah setelah preview menghasilkan409; buat pratinjau baru. Kedaluwarsa/actor salah/replay409; tanggal lampau403; invalid422; adapter belum tersedia503. Tidak melakukan auto-retry mutasi.

## Transaksi, audit dan integrasi tahap berikutnya

SQL memperoleh advisory lock global734190/1 sebelum actor/target, sama dengan master/pengguna. Preview memeriksa CAS dan seluruh rentang tanpa mengubah kalender. Commit mengunci preview, memvalidasi actor/expiry/consumption dan revision global, lalu menjalankan ulang validasi dalam transaksi yang sama. Pergantian kalender, override dan semester menaikkan revision; perubahan semester yang membuat override aktif di luar rentang/diarsipkan ditolak. Perubahan yang gagal tidak mengonsumsi preview atau menyisakan batch parsial.

Semua tabel baru ENABLE/FORCE RLS dengan policy owner internal. Runtime business hanya mendapat entry point, tanpa SELECT/DML tabel preview/helper/secret. Audit menyimpan pelaksana, alasan, versi dan nilai sebelum/sesudah di ops.master_revisions serta audit ringkas. Preview disimpan di ops.calendar_previews; pembersihan metadata yang sudah kedaluwarsa/terpakai perlu dimasukkan pada retensi operasional/worker tahap7, tanpa menghapus audit bisnis.

Adapter `app.calendar_dependencies(date)` sekarang mengembalikan assignmentIntegration=not_installed dan daftar periode ujian kosong. Ini bukan klaim pemindaian seluruh konflik lulus. Jika tabel teaching_schedules, activity_occurrences, exam_periods atau honor_periods terpasang tanpa mengganti adapter, pembacaan DayContext serta preview/commit ditolak (fail closed). Migrasi Tahap2.4/3/4/6 wajib menghubungkan adapter dengan pemeriksaan jadwal mingguan dan penugasan bertanggal, konflik resource, snapshot/kehadiran dan lock periode final; gunakan lock yang sama pada mutator sumber dan preview/commit. Adapter harus menghitung periode ujian aktif server-side dan menolak perubahan berdampak final tanpa jalur koreksi sah.

Tahap ini tidak membuat jurnal libur, estimasi/bonus, posting ledger, job/email atau kredit. Satu hak per occurrence tetap kontrak engine6/worker7. Onboarding/email admin nyata masih menunggu konfigurasi; pengujian browser dengan akun business nyata tidak dibuktikan oleh suite handler.
