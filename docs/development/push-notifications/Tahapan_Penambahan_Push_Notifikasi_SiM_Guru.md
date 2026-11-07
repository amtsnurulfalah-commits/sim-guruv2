# Tahapan Penambahan Push Notifikasi SiM-Guru

Versi: 1.0  
Tanggal: 7 November 2026, WIB  
Proyek: Rebuilt SiM-Guru  
Repositori: `amtsnurulfalah-commits/sim-guruv2`  
Acuan: `Rancangan_Push_Notifikasi_SiM_Guru.md`  
Baseline audit terdahulu: `e914f6a80d55866306ab52922f903aed0fdf0615`  
Status: **Rencana implementasi; seluruh pekerjaan di bawah belum dijalankan melalui dokumen ini.**

## A. Sasaran dan batas implementasi

Menyediakan Web Push pada PWA SiM-Guru agar notifikasi dapat tampil melalui sistem perangkat, dengan pusat pesan permanen, hak akses yang konsisten, dan pengiriman yang dapat dipantau. Email tetap menjadi kanal pendamping.

Istilah push pada tahapan utama berarti **PWA + Web Push standar + VAPID**. Aplikasi Android/iOS native dengan FCM/APNs merupakan perluasan opsional pada bagian L. Penambahan fitur tidak mengubah aplikasi menjadi APK atau aplikasi App Store secara otomatis.

Prinsip yang berlaku di setiap tahap:

1. Ikuti autentikasi lokal, opaque session cookie, CSRF, Origin dan fungsi PostgreSQL aplikasi. Jangan mengganti jalur tersebut menjadi Supabase Auth atau memakai `auth.uid()` tanpa perubahan arsitektur tersendiri.
2. Pisahkan pesan/inbox dari delivery email dan push. Pengguna yang mematikan email tetap dapat menerima push jika mengaktifkannya.
3. Tulis event bersama transaksi bisnis; lakukan jaringan ke provider setelah transaksi selesai.
4. Tentukan penerima di server dan periksa kembali relevansinya sebelum mengirim.
5. Izin push bersifat pilihan pengguna. Kewajiban instalasi PWA guru tidak berarti izin push boleh dipaksakan.
6. Gunakan service worker `/sw.js` yang sudah ada. Pertahankan network-only untuk data privat dan perlindungan pekerjaan formulir.
7. Status provider menerima pesan berbeda dari tampil, diklik dan dibaca. Jangan menjanjikan pengiriman exactly-once.
8. Pisahkan lingkungan, kunci dan penerima staging/produksi. Histori, preview dan hasil restore tidak boleh memicu pengiriman produksi.

## B. Peta tahapan dan dependensi

| Tahap | Fokus | Prasyarat | Hasil utama |
|---|---|---|---|
| 0 | Validasi baseline dan keputusan | Dokumen rancangan | Pemetaan sumber, risiko dan konfigurasi aktual |
| 1 | Kontrak serta konfigurasi | Tahap 0 | Kontrak event/API, feature flag dan pengelolaan kunci |
| 2 | Database dan otorisasi | Tahap 1 | Skema aditif, routine dan hak akses terbatas |
| 3 | Pemisahan inbox dari email | Tahap 2 | Inbox independen kanal dan migrasi histori |
| 4 | API dan lifecycle perangkat | Tahap 2–3 | Subscribe, revoke, preferensi dan isolasi akun |
| 5 | Transport dan worker push | Tahap 3–4 | Antrean, adapter, scheduler dan retry |
| 6 | PWA dan antarmuka pengguna | Tahap 4–5 | Aktivasi izin, notifikasi sistem dan klik aman |
| 7 | Integrasi modul bisnis | Tahap 3–6 | Event relevan dari modul existing |
| 8 | Monitoring dan pemulihan | Tahap 5–7 | Kontrol admin, alarm, retensi dan runbook |
| 9 | Verifikasi menyeluruh dan pilot | Tahap 0–8 | Bukti pengujian dan keputusan kelayakan rilis |
| 10 | Peluncuran bertahap | Tahap 9 lulus | Aktivasi produksi terukur dan serah terima |

Nomor sub-tahap dapat dipakai sebagai unit penugasan, misalnya “Jalankan Tahap 0.1–0.5”. Perubahan boleh digabung ke branch utama dengan fitur nonaktif setelah pemeriksaan terkait lulus; aktivasi produksi mengikuti Tahap 10. Dokumen ini sendiri tidak menjalankan merge atau deployment.

## C. Rincian pelaksanaan

### Tahap 0 — Validasi sumber dan kondisi operasional

**Tujuan:** memastikan rancangan diterapkan terhadap kode dan layanan yang benar-benar digunakan.

- [ ] **0.1 — Perbarui baseline.** Ambil commit terbaru, baca instruksi repositori, petakan perubahan sejak baseline audit, dan catat branch/commit yang menjadi dasar implementasi.
- [ ] **0.2 — Telusuri alur yang berhubungan.** Periksa auth/session/logout, operations, notification inbox, preferensi, PWA, producer pengingat, pengumuman dan honor. Catat caller serta versi fungsi SQL terakhir; jangan mengubah migrasi lama yang sudah diterapkan.
- [ ] **0.3 — Verifikasi layanan secara read-only.** Identifikasi proyek DB dan deployment yang tepat, role/grant, migrasi terpasang, scheduler, tiket worker, URL callback dan heartbeat. Bedakan definisi di repositori dengan status aktif produksi.
- [ ] **0.4 — Tetapkan kebutuhan pilot.** Inventaris perangkat/browser guru dan admin, kategori pesan, volume harian, jumlah perangkat per akun, kebutuhan jam tenang dan penerima pilot.
- [ ] **0.5 — Tetapkan batas rilis pertama.** Putuskan Web Push sebagai jalur utama, kriteria penerimaan, pemisahan lingkungan, kebijakan logout/rebind dan daftar event yang diaktifkan lebih dahulu.

**Keluaran:** catatan baseline, peta alur existing→target, inventaris routine/scheduler, matriks perangkat dan daftar risiko nyata.

**Kriteria lulus:** seluruh titik perubahan teridentifikasi; tidak ada ketidakjelasan proyek produksi atau jalur autentikasi; kebutuhan native tambahan dicatat terpisah.

### Tahap 1 — Kontrak, konfigurasi dan pengelolaan kunci

- [ ] **1.1 — Definisikan kontrak event.** Tetapkan event key, kategori, source type/id/version, recipient, waktu, expiry, route key dan payload minimal. Pisahkan kejadian bisnis, pesan inbox dan percobaan delivery.
- [ ] **1.2 — Definisikan kontrak API/DTO.** Gunakan Zod dan konvensi respons existing. Tetapkan struktur subscribe, daftar perangkat, unsubscribe, test, preferensi, pagination dan error; user/role penerima bukan input otorisasi dari browser.
- [ ] **1.3 — Tambahkan feature flag.** Pisahkan enabled untuk registrasi, produksi event/fan-out dan pengiriman; sediakan kill switch delivery serta pembatasan cohort pilot. Default pengiriman nonaktif.
- [ ] **1.4 — Siapkan VAPID dan enkripsi.** Buat kunci per lingkungan, private key hanya server, key id untuk rotasi, dan secret enkripsi endpoint/auth. Tentukan prosedur pergantian kunci dan pemulihan tanpa menulis secret ke repo/log.
- [ ] **1.5 — Validasi konfigurasi.** Perluas schema environment, `.env.example` berisi placeholder, dan pemeriksaan startup. Pastikan fitur off tidak menyebabkan email/auth atau build gagal karena secret push belum tersedia.

**Keluaran:** kontrak TypeScript/Zod, daftar environment, kebijakan flag/kunci dan spesifikasi state delivery.

**Kriteria lulus:** private key tidak masuk bundle browser; konfigurasi lintas lingkungan terpisah; fitur off kompatibel dengan aplikasi existing.

### Tahap 2 — Database, constraint, RBAC dan RLS

- [ ] **2.1 — Tambahkan event dan inbox.** Buat migrasi aditif untuk `ops.notification_events` dan `app.notifications`, referensi sumber, recipient FK, timestamps, expiry dan unique key dedupe.
- [ ] **2.2 — Tambahkan perangkat dan subscription.** Buat `app.push_installations` serta `ops.push_subscriptions`, binding generation, pencabutan, key id dan endpoint hash unik per lingkungan. Simpan endpoint/auth terlindungi; label perangkat tidak boleh menjadi identitas tepercaya.
- [ ] **2.3 — Tambahkan delivery dan preferensi.** Buat `ops.notification_deliveries`; perluas preferensi existing dengan push, kategori, jam tenang dan optimistic version. Pertahankan nama/kontrak email lama. Tambahkan jalur kompatibilitas receipts.
- [ ] **2.4 — Batasi akses.** Terapkan ENABLE/FORCE RLS sesuai model peran lokal; REVOKE akses tabel/fungsi yang tidak perlu; batasi business/worker ke routine yang dibutuhkan. Fungsi privileged memakai search_path tetap dan pemeriksaan actor/ownership/admin yang sesuai.
- [ ] **2.5 — Verifikasi migrasi.** Uji fresh install, upgrade dari snapshot existing, rollback transaksi, constraint, index, role business/auth/worker dan PUBLIC. Tinjau query antrean serta inbox dengan data representatif.

**Keluaran:** migrasi baru, routine terbatas, index, matriks grant dan bukti uji database.

**Kriteria lulus:** guru A tidak dapat mengakses data B; worker tidak memperoleh akses bisnis umum; migrasi menjaga data/kontrak lama; fungsi privileged tidak terbuka ke PUBLIC.

### Tahap 3 — Pisahkan inbox dan email dengan transisi aman

- [ ] **3.1 — Buat producer netral kanal.** Hasilkan event untuk penerima yang sah tanpa memfilter berdasarkan preferensi email. Event dan transaksi sumber harus atomik; event duplikat tidak menghasilkan pesan ganda.
- [ ] **3.2 — Buat fan-out idempotent.** Event menghasilkan inbox sekali dan delivery per kanal/per perangkat. Baca preferensi tiap kanal secara mandiri; tidak ada subscription aktif bukan alasan menghapus inbox.
- [ ] **3.3 — Migrasikan histori dan receipts.** Tentukan cutover marker, mapping ID outbox lama→notification baru, serta backfill bertahap yang dapat dilanjutkan. Tandai histori agar tidak menghasilkan delivery baru. Rekonsiliasi total, unread dan timestamp baca.
- [ ] **3.4 — Alihkan pembacaan API inbox.** Pertahankan pagination, filter unread, aksi read dan DTO yang dipakai UI. Pisahkan label status pesan dari status transport; sumber yang tidak lagi dapat diakses tidak boleh membuka detail sensitif.
- [ ] **3.5 — Rekonsiliasi pengiriman email.** Pada rilis pertama pertahankan worker email existing melalui bridge dengan dedupe key yang stabil. Pastikan tepat satu producer delivery email per event. Hentikan jalur lama hanya sesudah hasil rekonsiliasi benar.

**Keluaran:** inbox independen, bridge email, skrip backfill/reconcile dan catatan cutover.

**Kriteria lulus:** email off+push on tetap dapat membuat delivery push; keduanya off tetap menghasilkan inbox; histori tidak terkirim ulang; receipts/unread terjaga; tidak ada email ganda saat transisi.

### Tahap 4 — API subscription dan lifecycle akun/perangkat

- [ ] **4.1 — Implementasikan API aman.** Tambahkan config, subscribe, unsubscribe dan devices mengikuti sesi business, Origin, CSRF, body limit, rate limit serta respons no-store existing. Mutasi revoke dibuat idempotent.
- [ ] **4.2 — Validasi endpoint dan kunci.** Batasi format/ukuran subscription, HTTPS dan port; tolak URL berkredensial, redirect dan tujuan jaringan privat/metadata. Tetapkan provider yang diizinkan dari pengujian aktual dan kontrol egress/DNS untuk mencegah SSRF/rebinding.
- [ ] **4.3 — Implementasikan binding dan rebind.** Gunakan owner dari sesi server, generation dan bukti instalasi yang tervalidasi. Installation id hanya locator. Menerima endpoint yang sama saja tidak cukup untuk memindahkan kepemilikannya ke akun lain. Batasi perangkat aktif secara transaksional.
- [ ] **4.4 — Hubungkan pencabutan backend.** Integrasikan logout perangkat, logout semua jika tersedia, pergantian akun, disable/hapus akun dan expiry binding. Revoke dan logout perlu hasil server yang konsisten; kegagalan unsubscribe browser tidak boleh mempertahankan binding server. Jika operasi revoke gagal, jangan menyatakan perangkat sudah terputus; masa berlaku binding menjadi perlindungan tambahan untuk klien yang tidak kembali online.
- [ ] **4.5 — Tambahkan preferensi dan test.** Perluas endpoint preferensi dengan version check; test menggunakan template tetap untuk perangkat sendiri dengan cooldown dan kuota. DTO perangkat tidak memuat endpoint/auth/kunci privat.

**Keluaran:** handler/service/kontrak push, lifecycle hook akun dan pengujian isolasi pengguna.

**Kriteria lulus:** data pemilik tidak dapat dipalsukan; tidak ada raw-send API terbuka; subscribe/revoke berulang aman; disable akun membatalkan delivery belum terkirim.

### Tahap 5 — Adapter transport, antrean dan scheduler

- [ ] **5.1 — Tambahkan adapter Web Push.** Verifikasi versi library saat implementasi, pasang dengan lockfile, batasi payload, timeout dan klasifikasi error. Pisahkan transport dari aturan bisnis.
- [ ] **5.2 — Implementasikan claim/finish.** Gunakan lease, SKIP LOCKED, unique delivery dan compare-and-set saat penyelesaian. Jaringan provider berjalan di luar transaksi DB. Periksa generation/owner, expiry dan relevansi sumber sebelum send.
- [ ] **5.3 — Implementasikan retry dan pembatalan.** Tangani endpoint 404/410, 429/Retry-After, 5xx, payload salah dan error VAPID. Timeout ambigu diberi unknown dengan kebijakan retry terbatas. Batalkan delivery yang tidak lagi valid atau habis TTL.
- [ ] **5.4 — Integrasikan pemicu worker.** Utamakan worker push tersendiri dengan tiket sekali pakai berjenis push; jika berbagi endpoint, buat anggaran adil dan isolasi kegagalan SMTP. Sesuaikan batch/timeout dengan batas runtime dan pool satu koneksi; jangan mengasumsikan concurrency DB tersedia.
- [ ] **5.5 — Uji ketahanan antrean.** Jalankan dua worker, scheduler berulang, lease kedaluwarsa, provider lambat, jaringan putus dan backlog representatif. Pastikan log tersanitasi dan tidak ada push produksi dari preview/restore.

**Keluaran:** adapter, worker, routine claim/finish, scheduler dan bukti fault injection.

**Kriteria lulus:** antrean pulih tanpa kehilangan event; duplikasi dibatasi/dapat ditelusuri; error push tidak mematikan email keamanan; accepted tidak dilabeli read/delivered-to-device.

### Tahap 6 — Service worker dan UI/UX

- [ ] **6.1 — Tambahkan aktivasi berbasis aksi pengguna.** Feature-detect kemampuan, tampilkan penjelasan singkat, minta izin dari klik eksplisit, tunggu registration siap dan subscribe memakai VAPID public key.
- [ ] **6.2 — Perluas `/sw.js`.** Tambahkan push handler dengan event.waitUntil, parsing defensif, payload versioned, showNotification dan tag stabil. Sediakan fallback generik untuk payload tidak lengkap. Pertahankan navigasi network-only.
- [ ] **6.3 — Implementasikan klik aman.** Tutup notifikasi, fokus/buka window origin yang sama menuju route allowlist atau `/notifikasi`. Periksa login dan hak sumber saat membaca detail; jangan memasukkan token sesi ke URL/payload atau mengikuti URL eksternal.
- [ ] **6.4 — Perluas `/akun` dan `/notifikasi`.** Tambahkan preferensi kategori, jam tenang, daftar perangkat, test dan revoke. Sediakan state unsupported, perlu instalasi, izin default/denied, granted-belum-subscribe, aktif, offline, loading dan error.
- [ ] **6.5 — Rekonsiliasi dan aksesibilitas.** Periksa getSubscription/izin saat aplikasi dibuka; dukung rotasi/reinstall tanpa hanya mengandalkan subscriptionchange. Uji keyboard, screen reader, fokus, mobile dan update SW saat formulir belum tersimpan.

**Keluaran:** UI pengaturan, runtime subscription dan service worker yang diperluas.

**Kriteria lulus:** penolakan izin tidak memblokir pekerjaan; tidak ada prompt berulang; klik tidak membocorkan data lintas akun; tidak ada cache privat atau reload paksa; notifikasi OS terbukti muncul pada perangkat pilot.

### Tahap 7 — Integrasi event bisnis

- [ ] **7.1 — Pengumuman.** Tambahkan SendPush terpisah dari SendEmail; gunakan aturan target existing, masa aktif dan versi. Bedakan save draft, publish, update serta broadcast ulang eksplisit agar edit kecil tidak menjadi spam.
- [ ] **7.2 — Pengingat tugas.** Gunakan proyeksi `app.task_items`; pilih tugas actionable dan deadline valid. Terapkan digest, jam tenang, konteks hari kerja/libur dan dedupe per penerima/periode. Jangan membuat ledger penyelesaian baru yang menyimpang dari sumber tugas.
- [ ] **7.3 — Penugasan dan pengganti.** Hubungkan perubahan KBM/piket/ujian/acara yang relevan; pemberitahuan kepada penerima lama dan baru mengikuti transaksi. Cek kembali kepemilikan efektif sebelum send.
- [ ] **7.4 — Honor serta kalender/jadwal.** Kirim pemberitahuan ketersediaan slip/koreksi tanpa nominal; perubahan jadwal/kalender hanya ke pihak terdampak. Gabungkan perubahan massal bila tepat dan batalkan versi lama.
- [ ] **7.5 — Terapkan kebijakan kategori.** Atur expiry, urgency, jam tenang dan batas frekuensi per event. Kategori mendesak dan bypass jam tenang harus eksplisit. Uji sumber selesai, dialihkan, dibatalkan, dinonaktifkan atau periode ditutup setelah enqueue.

**Keluaran:** producer event per modul, template generik, resolver route dan matriks penerima.

**Kriteria lulus:** rollback transaksi tidak meninggalkan event; penerima sah dan pesan relevan; tidak ada honor/data siswa sensitif pada lock screen; satu perubahan tidak menghasilkan broadcast berulang.

### Tahap 8 — Monitoring, retensi dan prosedur pemulihan

- [ ] **8.1 — Tambahkan panel operasional admin.** Tampilkan panjang/umur antrean, heartbeat, accepted/retry/failed/unknown/expired serta endpoint dicabut dalam bentuk agregat. Gunakan otorisasi admin existing.
- [ ] **8.2 — Tambahkan tindakan terkontrol.** Pause/resume, retry yang sah dan rekonsiliasi unknown harus memiliki audit alasan dan idempotency. Jangan mengirim ulang accepted atau pesan expired secara massal.
- [ ] **8.3 — Tambahkan alarm independen.** Alarm worker macet, antrean tua dan error VAPID sistemik harus mempunyai kanal selain push yang sedang dipantau. Atur cooldown agar gangguan tidak menghasilkan banjir pesan.
- [ ] **8.4 — Terapkan retensi.** Cleanup log, inbox dan subscription revoked dilakukan bertahap sesuai kebijakan; hindari orphan receipts/FK. Sertakan penghapusan akun, masa berlaku binding, backup dan restore dengan worker awal nonaktif.
- [ ] **8.5 — Latih pemulihan.** Simulasikan provider gagal, secret salah, rotasi VAPID, scheduler berhenti dan rollback deployment. Pastikan kill switch menghentikan delivery baru tanpa merusak inbox/email.

**Keluaran:** panel monitoring, audit aksi, cleanup job dan runbook insiden/rotasi/rollback.

**Kriteria lulus:** kegagalan dapat dideteksi dan dipulihkan; log tidak berisi secret; restore tidak mengirim pesan lama; inbox tetap berfungsi saat push dipause.

### Tahap 9 — Verifikasi menyeluruh dan pilot

- [ ] **9.1 — Validasi kode dan database.** Jalankan lint, typecheck, unit/integration serta build sesuai scripts aktual. Sertakan pengujian kepemilikan, privilege, CSRF, SSRF dan migrasi. Jangan menganggap test fixture sebagai bukti konfigurasi produksi.
- [ ] **9.2 — Validasi alur bisnis dan kanal.** Uji semua kombinasi email/push, task selesai sebelum send, pengganti berubah, holiday, announcement expiry serta baca pesan lintas perangkat. Rekonsiliasi inbox lama dan baru.
- [ ] **9.3 — Validasi perangkat nyata.** Catat OS/browser/versi, status instalasi dan izin pada Android, desktop serta iPhone/iPad yang tersedia. Uji foreground, background, layar terkunci, offline→online, logout/rebind dan klik saat sesi habis. Platform belum diuji dicatat sebagai belum terverifikasi.
- [ ] **9.4 — UAT pilot terbatas.** Libatkan satu admin dan beberapa guru terpilih; pakai pesan uji yang dapat dikenali. Catat hasil per skenario, latensi event→accepted, temuan UX dan kegagalan yang dipengaruhi perangkat.
- [ ] **9.5 — Tutup temuan dan putuskan rilis.** Perbaiki bug, ulangi skenario terdampak dan dokumentasikan batas yang masih ada. Setiap temuan kebocoran lintas akun, pengiriman ulang histori atau secret terekspos memblokir aktivasi produksi sampai selesai.

**Keluaran:** laporan pengujian, matriks perangkat, hasil UAT, daftar temuan dan keputusan go/no-go.

**Kriteria lulus:** seluruh skenario wajib lolos atau batas dukungannya dinyatakan jelas; tidak ada temuan pemblokir; uji nyata membuktikan alur event→worker→OS→klik→data yang terotorisasi.

### Tahap 10 — Peluncuran dan serah terima

- [ ] **10.1 — Persiapkan produksi.** Cocokkan commit, migrasi, key id, origin, endpoint scheduler, tiket worker, cohort dan kill switch. Ambil checkpoint pemulihan yang dapat digunakan.
- [ ] **10.2 — Terapkan migrasi aditif dan kode dengan flag off.** Jalankan smoke test auth/inbox/email. Pastikan tidak ada send akibat backfill, cutover atau scheduler duplikat.
- [ ] **10.3 — Aktifkan cohort kecil.** Aktifkan registrasi serta delivery hanya bagi pilot; pantau backlog, error per provider, binding dan laporan pengguna dalam periode observasi yang ditetapkan sebelum aktivasi.
- [ ] **10.4 — Perluas bertahap.** Tambah cohort berdasarkan metrik dan hasil observasi, bukan persentase tanpa bukti. Jika muncul masalah pemblokir, pause delivery dan lakukan rollback kompatibel; pertahankan data serta akses inbox.
- [ ] **10.5 — Serahkan dokumentasi dan tutup rilis.** Perbarui README, panduan admin/guru, daftar halaman/hak akses bila tersedia, release notes dan checkpoint. Catat commit/migrasi/deployment, status fitur dan batas dukungan sebenarnya.

**Keluaran:** catatan rilis, bukti smoke/UAT produksi, konfigurasi operasional dan panduan pengguna.

**Kriteria lulus:** delivery produksi stabil pada cohort yang diaktifkan; admin dapat mengoperasikan pause/retry/monitoring; pengguna dapat mengelola izin/perangkat; tidak ada perubahan kontrak lama yang belum direkonsiliasi.

## D. Matriks pengujian minimum

| Kelompok | Kasus penerimaan |
|---|---|
| Kanal | Email off/push on; email on/push off; keduanya on; keduanya off; tanpa perangkat aktif; izin ditolak. Inbox tetap ada. |
| Kepemilikan | Guru A tidak bisa melihat/mencabut perangkat B; userId/role palsu; rebind endpoint tanpa bukti; klik notifikasi A saat login B. |
| Sesi | Logout perangkat, logout semua bila tersedia, disable akun, idle/expired session, revoke browser gagal dan device offline. |
| Transaksi | Rollback sumber tidak membuat event; duplicate event/fan-out/scheduler tidak membuat pesan atau email ganda. |
| Antrean | Worker bersaing, lease hilang, timeout ambigu, 404/410, 429, 5xx, salah VAPID, payload besar, TTL dan backlog. |
| Sumber | Tugas selesai, penugasan dialihkan, periode final, hari libur, pengumuman nonaktif dan versi jadwal berubah. |
| PWA | Instalasi existing, subscribe ulang, update SW, beberapa window, formulir belum tersimpan, offline fallback dan permission revoked. |
| Privasi | Secret/endpoint tidak muncul di bundle/log/DTO; payload generik; route aman; akses sumber diperiksa ulang. |
| Lingkungan | Preview/staging tidak mengirim ke pengguna produksi; restore/backfill tidak mengaktifkan pengiriman lama. |
| Regresi | Login, email keamanan, pengumuman, inbox/unread, tugas, jurnal, kehadiran, honor dan kewajiban instalasi PWA guru. |

Uji keamanan berfokus pada ancaman konkret dari endpoint jaringan, hak akses dan perangkat bersama. Bukti otomatis dilengkapi uji OS nyata; hasil accepted di server tidak cukup untuk mengklaim pesan tampil pada perangkat.

## E. Parameter awal yang perlu dikonfirmasi melalui pengukuran

| Parameter | Nilai awal usulan | Ketentuan |
|---|---|---|
| Instalasi aktif per akun | Maksimal 5 | Dapat dikonfigurasi; uji dua registrasi bersamaan. |
| Push default | Nonaktif | Aktif setelah pilihan pengguna dan izin perangkat. |
| Jam tenang rutin | 20.00–06.00 WIB | Dapat diubah; jika penundaan melewati expiry, batalkan. |
| Masa berlaku binding | 30 hari sejak penggunaan tervalidasi | Tidak disamakan dengan idle session; evaluasi terhadap kebutuhan pengguna. |
| Batch awal worker | Maksimal 10 delivery | Harus mengikuti budget runtime; bukan kewajiban menghabiskan batch. |
| Timeout provider | 5 detik/permintaan | Lease harus cukup untuk operasi dan penyelesaian; ukur kondisi nyata. |
| Batas percobaan | Maksimal 5 | Tunduk TTL, error permanen dan Retry-After. |
| Test notifikasi | Cooldown 60 detik | Tambahkan kuota harian dan rate limit akun/IP. |
| Payload plaintext | Target di bawah 2 KB | Sisakan overhead enkripsi; tanpa detail bisnis sensitif. |
| Sasaran latensi pilot | p95 event→accepted ≤120 detik | Saat provider sehat dan beban terukur; bukan jaminan tampil. |
| Retensi awal | Delivery log 30 hari; inbox 90 hari | Sesuaikan kebijakan madrasah dan kebutuhan audit sebelum cleanup aktif. |

Semua angka pada bagian ini adalah konfigurasi awal dari rancangan, bukan hasil benchmark atau jaminan layanan.

## F. Peta berkas implementasi

| Area | Lokasi existing atau usulan | Perubahan |
|---|---|---|
| Service worker | `public/sw.js` | Push/click, payload defensif dan route aman |
| Runtime PWA | `src/features/pwa/runtime.tsx` | Rekonsiliasi registration/update tanpa kehilangan pekerjaan |
| Pengaturan push | Usulan `src/features/notifications/` | Kontrol izin, preferensi dan perangkat |
| Kontrak | Usulan `src/lib/notifications/` dan kontrak tasks existing | Schema Zod, DTO dan kategori |
| API | Usulan `src/app/api/push/` | Config, subscribe, unsubscribe, devices dan test |
| Backend | Usulan `src/server/notifications/` | Service, adapter, worker dan klasifikasi error |
| Auth | `src/server/auth/` dan lifecycle akun existing | Pencabutan binding pada transisi akun |
| Operations | `src/server/operations/` | Fan-out, bridge email, monitoring dan scheduler |
| Worker route | Existing `src/app/api/internal/worker/route.ts`; route push tambahan bila dipilih | Isolasi tiket, transport dan budget |
| Inbox | `src/features/tasks/notification-inbox.tsx`, API operations existing | Inbox baru dengan kontrak lama kompatibel |
| UI akun/admin | `/akun`, `/notifikasi`, halaman operasional existing | Preferensi, perangkat, status dan tindakan |
| Database | `supabase/migrations/` | Migrasi baru; tidak menimpa migrasi terpasang |
| Konfigurasi | Schema env existing, `.env.example`, package/lockfile | Kunci, flag dan dependensi server |
| Pengujian/dokumentasi | Struktur tests/docs existing | Bukti integrasi, UAT dan runbook |

Lokasi berlabel usulan belum dianggap ada. Sesuaikan penamaan setelah Tahap 0 tanpa menggandakan abstraksi yang sudah tersedia.

## G. Aturan pengerjaan setiap batch

1. Nyatakan sub-tahap yang dikerjakan dan dependensi yang sudah lulus.
2. Periksa source serta versi routine terkini sebelum mengedit.
3. Buat perubahan minimal yang memenuhi kontrak dan kompatibilitas.
4. Jalankan pemeriksaan yang relevan; gunakan database disposable/staging untuk uji mutasi, bukan data produksi sebagai fixture.
5. Simpan bukti hasil dan batas pengujian. Jangan mencentang selesai hanya karena file telah dibuat atau build lulus.
6. Perbarui checkpoint dan status tahapan. Jika scope berubah, catat dampak pada migrasi, rollout dan kriteria penerimaan.
7. Siapkan PR dengan masalah, perilaku akhir, perubahan skema, validasi dan risiko. Merge/deployment mengikuti instruksi operasional yang berlaku saat pelaksanaan.

Format laporan per batch:

```markdown
## Laporan Tahap [nomor]
- Status: belum dimulai / berjalan / terhambat / selesai.
- Baseline dan commit hasil:
- Sub-tahap yang diselesaikan:
- Perubahan kode/database/konfigurasi:
- Pemeriksaan yang dijalankan dan hasil:
- Uji perangkat nyata yang dilakukan:
- Risiko atau batas yang masih ada:
- Status PR, migrasi dan deployment:
- Dependensi serta pekerjaan berikutnya:
```

## H. Strategi rollback

| Kondisi | Tindakan |
|---|---|
| Delivery bermasalah | Matikan pengiriman push; pertahankan inbox dan email. |
| Registrasi/rebind bermasalah | Matikan registrasi baru dan revoke binding terdampak; perbaiki sebelum reaktivasi. |
| Salah penerima | Pause delivery segera, revoke binding terdampak dan selidiki resolver/generation; jangan mengandalkan penarikan paket yang sudah di provider. |
| Kunci VAPID salah | Pause kanal/provider terdampak, pulihkan konfigurasi key id yang cocok dan rekonsiliasi status unknown. |
| Regresi UI/SW | Rollback kode dengan kompatibilitas payload/skema; hindari memaksa reload pekerjaan pengguna. |
| Regresi migrasi/inbox | Gunakan jalur kompatibilitas dan mapping cutover yang sudah diuji; jangan DROP tabel pengguna untuk rollback. |

Setelah rollback, uji login, inbox, receipts dan email; verifikasi ulang backlog sebelum membuka delivery. Paket yang sudah diterima provider dapat tetap tiba, sehingga payload generik wajib sejak awal.

## I. Checklist penutupan fitur

- [ ] Inbox independen dari status dan preferensi email.
- [ ] Semua perangkat terikat pada owner yang benar dan dapat dicabut.
- [ ] Logout/rebind/disable akun terlindungi pada backend.
- [ ] Queue, retry, expiry dan unknown dapat dioperasikan.
- [ ] Hak akses database/API telah diuji, bukan hanya disimpulkan dari UI.
- [ ] PWA existing dan pekerjaan formulir tidak mengalami regresi.
- [ ] Event bisnis ditujukan kepada pihak yang masih berhak.
- [ ] Tidak ada data sensitif pada lock screen atau secret di log/bundle.
- [ ] Pilot perangkat nyata memiliki bukti hasil.
- [ ] Scheduler, key, origin dan lingkungan produksi sudah cocok.
- [ ] Kill switch dan rollback sudah diuji.
- [ ] Panduan guru/admin serta catatan rilis diperbarui.

## J. Urutan batch yang dapat langsung dipakai

| Batch | Sub-tahap | Fokus |
|---|---|---|
| 1 | 0.1–0.5 | Baseline dan keputusan |
| 2 | 1.1–1.5 | Kontrak, flag dan environment |
| 3 | 2.1–2.5 | Database dan privilege |
| 4 | 3.1–3.5 | Pemisahan inbox/email |
| 5 | 4.1–4.5 | API dan lifecycle perangkat |
| 6 | 5.1–5.5 | Transport dan worker |
| 7 | 6.1–6.5 | PWA dan UI |
| 8 | 7.1–7.5 | Integrasi bisnis |
| 9 | 8.1–8.5 | Monitoring dan pemulihan |
| 10 | 9.1–9.5 | Verifikasi dan pilot |
| 11 | 10.1–10.5 | Rollout dan serah terima |

## K. Acuan dan pemeliharaan dokumen

Dokumen ini menguraikan rancangan terlampir menjadi tahapan pekerjaan. Tidak dilakukan audit ulang repositori atau layanan produksi ketika menyusun tahapan ini. Temuan arsitektur merujuk baseline audit terdahulu; Tahap 0 wajib menyelaraskannya dengan kondisi saat implementasi.

Dokumen acuan: `Rancangan_Push_Notifikasi_SiM_Guru.md`. Dokumentasi vendor, versi dependensi, batas platform dan opsi deployment harus diverifikasi ketika langkah implementasi yang terkait dijalankan. Catat revisi bila kontrak, nama tabel, jalur worker atau kebijakan keamanan berubah.

## L. Tahap opsional — Aplikasi Android/iOS native

Dilaksanakan hanya jika kebutuhan APK/App Store atau integrasi native secara eksplisit dipilih. Bukan prasyarat untuk menyelesaikan Web Push.

- [ ] **N.1 — Studi klien mobile.** Pilih Capacitor/React Native/Flutter sesuai kebutuhan; analisis distribusi, sesi, deep link dan kemampuan perangkat.
- [ ] **N.2 — Kontrak autentikasi mobile.** Rancang penyimpanan kredensial/sesi yang aman dan origin mobile tanpa melonggarkan CSRF/Origin global aplikasi web.
- [ ] **N.3 — Token dan adapter.** Tambahkan instalasi/token FCM/APNs serta transport native, memakai event/inbox dan resolver penerima yang sama.
- [ ] **N.4 — Lifecycle serta pengujian.** Terapkan rotasi token, logout, switch akun, cold start, background dan izin OS; uji pada Android/iOS nyata.
- [ ] **N.5 — Distribusi bertahap.** Siapkan signing, build, kanal distribusi, panduan pengguna dan monitoring terpisah.

Backend Next.js, PostgreSQL, Argon2 dan worker tetap berjalan di server; tidak ikut menjadi paket aplikasi mobile secara otomatis.
