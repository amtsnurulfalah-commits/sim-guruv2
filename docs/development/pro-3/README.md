# PRO-3 — Keandalan operasional

Baseline: main `22b764a05c4498c40c3564160deaf9d9cc620327` setelah PRO-2/PR72. Pengelola mengizinkan implementasi, merge dan migrasi bila diperlukan. Paket ini memperbaiki kontrol operasional yang terbukti, tanpa menambah scheduler/email engine/backup engine duplikat.

## Temuan dan perbaikan

1. Scheduler finance hanya melewati completed/attempts≥5. Job paused dengan attempts<5 masih bisa dijalankan. Guard sekarang melewati paused juga; keputusan September yang sudah dijeda tidak diubah.
2. Kegagalan terminal setelah retry ke-5 tidak selalu memiliki waktu selesai; antrean keamanan tidak mempunyai kolom waktu terminal. Tambahkan completed_at nullable dan catat hanya ketika hasil terminal diketahui. Tidak mengisi waktu historis dengan tanggal rilis. Lease salah/kedaluwarsa tetap ditolak; missing/null lease pada security finish tidak boleh dianggap berhasil.
3. Tiket worker terpakai merupakan heartbeat, bukan job sukses. Pemantauan sekarang memisahkan heartbeat, job notifikasi sukses terakhir, penerimaan server email terakhir, status cohort email24jam dan proporsi gagal dari hasil pasti. Status unknown dipisahkan. Tidak menyebut SMTP accepted sebagai masuk inbox.
4. Alert antrean kini memperhitungkan kanal aktif: domain ditahan selama maintenance; email keamanan tetap diharapkan bila kanalnya aktif. Antrean yang sengaja dijeda tidak menimbulkan QUEUE_DELAY. JOBS_STALE menandai heartbeat segar tetapi job notifikasi tidak berhasil≥15menit.
5. Alert menampilkan peran penanggung jawab dan langkah penanganan. Ini bukan penunjukan orang nyata atau pembuatan case otomatis. Admin menggunakan lifecycle laporan kendala existing untuk owner/note/verifikasi.
6. Halaman operasional menampilkan kode hasil job dan waktu selesai, serta label penerimaan server yang lebih tepat. Payload/secret pesan tidak ditampilkan.
7. Restore quarantine sekarang menghapus tiket worker selain mencabut sesi, menjeda job/email dan menetralkan antrean. CLI backup terenkripsi dan native restore existing dipakai kembali; tidak membuat jalur restore produksi otomatis.

## Bukti produksi baca-saja

Snapshot 26 Oktober 2026 WIB: cron scheduler aktif1, jadwal setiap menit;1440 eksekusi cron succeeded dalam24jam pada snapshot awal. Pada07:23:09UTC scheduler terakhir07:23:00UTC dan job notifikasi berhasil07:23:00UTC. Kanal jobs/mail/security aktif, maintenance nonaktif. Ada7 pesan keamanan dengan state sent dan4 cancelled, domain outbox0. Ini status aplikasi, bukan bukti penerima membaca/menerima di inbox. Tidak membaca alamat, payload, token, key atau password.

Storage mempunyai0bucket/0object dan referensi foto eksternal0 saat pemeriksaan. Cakupan backup objek tetap harus ditambahkan bila fitur mulai menyimpan objek. Security advisor tidak melaporkan lint sebelum perubahan. Tidak mengirim email nyata, memaksa job honor, atau membekukan produksi pada tahap ini.

## Matriks PRO-3

| ID | Status paket | Bukti / batas |
|---|---|---|
| 3.1 | Terverifikasi pada scope source + snapshot | Worker/tiket90detik, cron1menit, lease2menit, capped retry, dedupe dan quarantine existing; snapshot di atas |
| 3.2 | Teknis tersedia; penerimaan inbox terblokir | Sender acceptance/retry/unknown diuji adapter terkontrol; status sent produksi teramati. Butuh penerima yang ditetapkan dan instruksi pengiriman untuk bukti inbox |
| 3.3 | Regresi diperiksa | T03/T04 tasks: digest dedupe dan pembatalan saat sumber selesai; OP08/OP09 fencing/unknown/retry; PRO-3 paused/terminal timestamp |
| 3.4 | Diimplementasikan | Monitoring admin, kode hasil job dan pemisahan level bukti |
| 3.5 | Peran/runbook tersedia | Ambang15menit existing dipakai kembali; personel/eskalasi dan evaluasi noise perlu pengelola |
| 3.6 | Cakupan/prosedur tersedia; backup produksi terblokir | Runbook DB/objek/config/secret, enkripsi dan usulan retensi; belum ada verifikasi arsip produksi bertanggal |
| 3.7 | Drill native disposable wajib lulus | CI pg_dump/restore riil, manifest/isi/schema/ACL/migrasi/isolation diperiksa; bukan restore produksi |
| 3.8 | Pengukuran sintetis + usulan | RPO/RTO produksi belum disepakati/diukur; jangan menutup tahap penuh hanya dari drill |

Lihat [runbook](RUNBOOK.md) dan [checkpoint](CHECKPOINT.md). Bukti native runtime tersedia di [VALIDATION.md](VALIDATION.md) dan native-recovery-results.json; CI head final menjadi gate merge. Merge/penerapan diverifikasi melalui PR paket, ledger dan deployment aktual; jangan menganggap rencana sebagai hasil produksi.
