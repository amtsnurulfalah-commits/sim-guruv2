# Push Notifikasi — Tahap 0
Tanggal observasi: 7 November 2026 WIB. Baseline main: `e914f6a80d55866306ab52922f903aed0fdf0615`.

## Status dan batas
Tahap 0.1, 0.2, 0.3 dan 0.5 selesai. Tahap 0.4 selesai pada perencanaan cohort/kapasitas awal, tetapi inventaris perangkat nyata, versi browser dan kesediaan penerima pilot masih belum terverifikasi. Jangan menyatakan Tahap 0 seluruhnya selesai tanpa batas ini. Tahap 1 dapat menyiapkan kontrak berdasarkan keputusan berikut; aktivasi/pilot nyata tetap menunggu verifikasi perangkat pada Tahap 9.

Paket ini dokumentasi dan bukti observasi, tanpa perubahan runtime, migrasi, secret, cron atau pengiriman notifikasi. Pemeriksaan produksi hanya membaca metadata dan agregat tanpa nama/email, token, endpoint perangkat atau isi pesan.

## 0.1 — Baseline
Main dan deployment produksi READY `dpl_A7Jt4Encca5NfH7sCM55jj5YKEvG` menunjuk commit baseline yang sama; tidak ada delta sejak audit rancangan. Tree Git diperiksa rekursif; tidak ada AGENTS.md di snapshot repository. Instruksi konteks proyek Rebuilt SiM-Guru tetap berlaku. Workflow quality dan native-release tersedia pada `.github/workflows/quality.yml`.

## 0.2 — Peta alur existing → target
| Alur | Implementasi saat ini | Titik perluasan |
|---|---|---|
| Login/sesi/logout | LocalAuthService → auth_private session_snapshot/logout_with_audit; cookie opaque, token hash | Binding instalasi/revoke server pada transisi sesi; tidak mengganti auth |
| HTTP operations | Origin/CSRF/requireSession/rate limit → OperationsService | Pakai pola sama untuk subscription/test/devices |
| Inbox | NotificationInbox → API operations/inbox → app.notifications_read | Pisahkan pesan dari state delivery email, jaga DTO/pagination/read |
| Preferensi | notification-preferences → app.notification_command | Tambah push/kategori/jam tenang dengan version check |
| Pengingat | ops.run_jobs → ops.reminders → app.task_items → domain_outbox | Producer netral kanal; preferensi email tidak menentukan keberadaan event |
| Penugasan | Trigger ops.activity_notification | Event atomik + source version + pemeriksaan penerima efektif |
| Pengumuman | app.operations_command + announcement_visible + enqueue_announcements | SendPush terpisah; validasi target/masa aktif/version |
| Honor | finance.notification_outbox → ops.run_jobs → domain_outbox | Event ketersediaan generik, detail tetap terautentikasi |
| Worker | Scheduler/tiket → internal/worker → MailAdapter + DomainOutboxWorker | Push transport tersendiri; kegagalan SMTP tidak menghambat push |
| PWA | manifest + register /sw.js scope /; worker hanya navigasi network-only | Tambah push/click pada worker yang sama; tidak cache privat |
| Kewajiban instalasi | InstallRequired pada business guru; admin dikecualikan | Izin push tetap opsional dan terpisah |

Caller sumber: `src/server/auth/service.ts`, `src/server/operations/{http,service,worker,batch}.ts`, `src/features/tasks/notification-inbox.tsx`, `src/lib/tasks/contracts.ts`, `src/app/api/internal/worker/route.ts`, `public/sw.js`, serta migrasi operasi, task center dan finance.

Routine terakhir untuk notifications_read, notification_command, reminders dan domain_claim ada pada `20261024000945_task_center_and_notification_preferences.sql`. domain_finish dan run_jobs berasal dari fondasi operations; scheduler/tiket dari workers stage7. Hash routine aktual, ACL dan search_path tersimpan pada evidence.json; hash merupakan sidik versi observasi, bukan klaim kesetaraan semua routine terhadap source.

## 0.3 — Verifikasi layanan nyata
- Supabase: proyek `sim-guruv2`, ref `aeethjbvdaydzdmqhawt`, ACTIVE_HEALTHY, Singapore, PostgreSQL 17.
- Vercel: proyek `prj_BnkqzwVldBMOTcqeujYSGUMT8pEC`; origin `https://sim-guruv2.vercel.app`; produksi READY pada baseline. Status ini metadata deployment, bukan pengujian login/transaksi nyata.
- Cron `sim-guru-worker` aktif setiap menit dan memanggil `ops.scheduler_tick()`.
- Definisi scheduler menuju origin yang sama pada `/api/internal/worker` dengan tiket sekali pakai; tidak memanggil fungsi penerbit tiket selama audit.
- Heartbeat tiket terakhir: 7 November 2026 21:21:00 WIB, dekat waktu observasi 21:21:34 WIB. Ini bukti tiket digunakan, bukan bukti setiap email diterima pengguna.
- jobsEnabled, mailEnabled dan securityMailEnabled true; maintenance false saat observasi.
- Role owner/business/auth/bootstrap/worker serta role login terkait bukan superuser dan tidak bypass RLS.
- Lima tabel yang diperiksa (app_users, notification_preferences, notification_receipts, domain_outbox, worker_tickets) ENABLE/FORCE RLS. ACL routine yang diperiksa tidak memberi EXECUTE ke PUBLIC; entrypoint business/worker dibatasi.
- Ledger aplikasi `sim_guru_migration.schema_migrations`: **38 nama dan SHA-256 sesuai 38 file SQL baseline**. Identitas blob Git ikut diverifikasi agar newline hasil materialisasi audit tidak dianggap drift.
- Ledger Supabase berisi 34 versi bernomor lain. Itu jalur pencatatan berbeda, bukan bukti empat migrasi aplikasi hilang. Runner `scripts/lib/migrations.ts` memakai ledger aplikasi 38 berkas sebagai sumber pemeriksaan checksum.
- Tidak mengakses nilai environment/secret, isi akun, isi honor atau payload pesan; konfigurasi environment runtime selain observasi ini akan divalidasi pada Tahap 1.

## 0.4 — Pilot dan kapasitas awal
Populasi aktif agregat: **1 admin dan 2 guru**. Usulan cohort awal: satu admin dan dua guru aktif tersebut, dengan persetujuan izin push masing-masing saat fitur tersedia; belum mendaftarkan perangkat atau mengirim pesan.

Outbox yang masih tersimpan saat observasi: 21 state sent, tanpa state antrean/gagal lain pada snapshot. Jendela tujuh hari: 10 pesan (1 Nov:1, 2 Nov:4, 3 Nov:2, 4 Nov:1, 5 Nov:1, 6 Nov:1). Ini volume historis email dalam data yang masih tersimpan, bukan estimasi pasti volume push atau hasil benchmark.

| Target | Skenario minimum | Status inventaris/perangkat |
|---|---|---|
| Admin desktop Chrome/Edge | Izin, test, revoke, multi-window | OS/versi/perangkat aktual belum diketahui |
| Guru Android Chrome PWA | Background, layar terkunci, logout/rebind | Ketersediaan aktual belum diketahui |
| Guru iPhone/iPad Home Screen | Izin, background dan klik login ulang | Ketersediaan aktual belum diketahui |
| Firefox/Safari macOS | Capability detection dan fallback | Tambahan bila tersedia; belum diuji |

Parameter perencanaan: maksimal 5 instalasi/akun, push default off, jam tenang rutin 20.00–06.00 WIB, binding 30 hari, batch awal maksimal 10, timeout provider 5 detik dan maksimal 5 percobaan tunduk TTL. Semua masih konfigurasi awal, bukan preferensi yang sudah dikonfirmasi atau kapasitas terukur. Perangkat/versi yang belum tersedia tidak boleh dilabeli didukung berdasarkan uji sintetis.

## 0.5 — Keputusan rilis pertama
1. PWA + Web Push + VAPID; gunakan inbox yang sudah ada sebagai UI, pisahkan sumber datanya dari outbox email.
2. Bangun adapter transport agar FCM/APNs dapat ditambahkan kemudian; tidak membuat aplikasi native pada batch ini.
3. Prioritas aktivasi bertahap: test perangkat sendiri → pengumuman bertarget → digest tugas. Penugasan/honor/kalender menyusul sesuai Tahap 7 dan source guard.
4. Payload lock screen selalu generik. Penerima dan route ditetapkan server; akses detail diperiksa ulang.
5. Worker push terpisah dengan tiket bertipe push menjadi pilihan awal; kontrak detail pada Tahap 1 dan implementasi Tahap 5.
6. Preview/staging mempunyai key/cohort sendiri; tidak memakai daftar perangkat produksi. Backfill tidak mengirim ulang histori.
7. Logout/rebind/disable harus mencabut binding backend; generation dan status owner diperiksa sebelum send. Paket yang telanjur diterima provider tidak dapat diasumsikan ditarik kembali.
8. Gate aktivasi: tidak ada akses lintas akun, private key tidak terekspos, dedupe/cutover benar, inbox/email tidak regresi, uji perangkat nyata dan rollback/kill switch lulus.

## Risiko dan pekerjaan berikutnya
| Risiko | Tindak lanjut |
|---|---|
| Pengingat terikat preferensi email | Tahap 3 producer netral kanal sebelum push aktif |
| Source tugas berubah setelah enqueue | Tahap 5/7 recheck assignment/deadline/state |
| Sesi berakhir tetapi subscription masih aktif | Tahap 4 binding/revoke/rebind server |
| Batch worker habis oleh SMTP | Tahap 5 transport dan budget terpisah |
| Dua ledger disalahartikan | Gunakan ledger aplikasi/checksum untuk runner repo |
| Perangkat pilot belum diketahui | Lengkapi inventaris nyata sebelum Tahap 9/aktivasi; jangan mengarang hasil |
| Environment/egress belum diperiksa menyeluruh | Tahap 1/4 validasi konfigurasi dan SSRF |
| Sumber dokumentasi terpisah dari repo | Roadmap disalin ke paket ini; checkpoint repo menjadi indeks progres |

## Validasi paket
- Snapshot main/deployment dan 38 blob migrasi diverifikasi.
- Ledger aplikasi: 38/38 nama/checksum cocok; produksi hanya read-only.
- Routine/ACL/RLS dan scheduler/heartbeat dicatat sebagai bukti terukur.
- Periksa tautan relatif, nomor 55 sub-tahap roadmap dan scope diff sebelum merge.
- Tidak ada tes pengiriman OS, migrasi baru atau benchmark kapasitas pada Tahap 0.
- Hasil CI PR diperiksa saat integrasi; tidak menyatakan hasil masa depan sebagai sudah lulus.

## Kelanjutan
Baca CHECKPOINT.md dan roadmap lengkap sebelum batch berikutnya. Kerjakan Tahap 1.1–1.5 sesuai instruksi pengguna. Jangan menjalankan seluruh roadmap sekaligus atau mengaktifkan push produksi hanya karena PR Tahap 0 digabung.
