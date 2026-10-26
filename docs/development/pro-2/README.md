# PRO-2 — Performa dan kapasitas

Scope: riwayat kegiatan/kehadiran besar, konkurensi akun yang sama, serta pemuatan riwayat jurnal. Baseline source `1d4f8217fae38db07440bc9879b32dc624e93855` (sesudah PR71). UAT peserta belum selesai; pengelola menginstruksikan PRO-2 dilanjutkan. Tidak mengklaim metrik tugas manusia atau kapasitas produksi penuh.

## Diagnosis dan keputusan

- `app.activity_read` memanggil `app.actor_is_admin()` pada setiap baris predicate count/page. Helper tersebut melakukan resolve_actor, onboarding/session/maintenance checks; pengulangan pada 12.060 baris memperpanjang transaksi. `lifecycle_self` menahan lock akun/sesi sampai query selesai, sehingga request serentak akun sama dapat menunggu dan terkena lock_timeout3s.
- Migrasi menghitung keputusan admin sekali setelah activity_guard setiap RPC. Guard, account/session locks, row-specific piket/committee predicates, owner/grants, search_path, limit/rentang/filter dan payload tetap. Ini memo lokal transaksi, bukan cache lintas permintaan. Pencabutan/role/status diperiksa ulang pada request berikutnya.
- Riwayat jurnal sebelumnya dipanggil saat halaman Input dibuka dan pencarian berubah walaupun Riwayat tersembunyi. Sekarang dimuat saat tab Riwayat dipilih; debounce/abort/response guard tetap. Refresh Input tidak memuat riwayat kecuali edit/delete memerlukan verifikasi hasil. Hasil lama diinvalidasi setelah refresh; tidak menampilkan snapshot sebagai data baru.
- Tidak menambah indeks sebelum ada bukti rencana/biaya yang mengharuskannya. Tidak menaikkan statement_timeout10s/lock_timeout3s atau menghapus lock untuk membuat profil lulus.

## Bukti dan target

- [browser-results.json](browser-results.json): 20 sampel per varian, peran guru/admin × lebar375/1440 ×5. Dengan latency history terkontrol400ms: p50/p95 kontrol refresh siap 747/830ms →174/249ms; request riwayat tersembunyi20→0. Tidak ada page error/overflow. Ini efek penghapusan dependency yang sengaja disimulasikan, bukan Core Web Vitals/WAN/SSR produksi.
- [wasm-results.json](wasm-results.json): eksplorasi3 sequential reads, sekitar1,1detik →9–31ms. Database terpisah; bukan bukti native concurrency. Tes integrasi terpisah memastikan payload identik pada dataset yang sama serta grant dan batas akun/sesi tetap.
- `scripts/pro2-native-profile.ts`: PostgreSQL disposable loopback yang harus kosong bernama pro2_test,201users/12060attendance, pool4, global first/deep(page400)/filtered,20request per skenario per phase, satu warm-up tidak masuk percentiles. Melalui ActivityService dan adapter bisnis existing dengan timeout asli. Baseline dulu, migrasi, sesudah pada dataset identik; fingerprint hasil harus sama. EXPLAIN ANALYZE BUFFERS count predicate terpisah dicatat untuk diagnosis, bukan dianggap plan lengkap RPC.
- Budget teknis uji: setelah perubahan,0error dan p95<5000ms pada masing-masing workload; lebih ketat daripada statement_timeout10s. p50/p95 menggunakan nearest-rank dari sampel sukses, errors/timeout dicatat terpisah. Budget ini untuk fixture CI, bukan SLO yang sudah diterima pengguna.
- CI native menghasilkan PRO2_PROFILE_RESULT dan artefak JSON; bukti native final dicatat sesudah CI. CPU/RSS adalah proses klien benchmark, bukan CPU PostgreSQL. Wall time memasukkan warm-up; latensi sampel tidak.

## Observasi produksi dan batas scope

Baca-saja pada26Oktober2026WIB: tabel transaksi aktivitas/kehadiran/jurnal masih0baris menurut statistik live. Security advisor tidak melaporkan lint. Performance advisor mempunyai55unindexed-FK dan31unused-index, seluruhnyaINFO. Tidak menghapus/menambah indeks secara massal dari sinyal dataset kecil. Lihat remediation resmi: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys dan https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index.

Metrik produksi existing hanya samples/total/max per menit/modul; tidak dapat menghasilkan p50/p95. Penambahan histogram/observability perendpoint dan pengujian beban produksi ditunda sebagai paket berotorisasi tersendiri. Pada PRO-2 ini beban dijalankan di database disposable; tidak memuat data pribadi atau menjalankan transaksi honor/email produksi. Riwayat/laporan modul lain tidak diubah tanpa bottleneck terukur. Tidak menambah cache data privat, TTL atau invalidasi lintas pengguna.

## Penerapan dan pemulihan

Migrasi `20261026062908_pro2_activity_read_performance.sql` dibuat melalui Supabase CLI2.122.0. Patch menolak body prior yang tidak cocok MD5; function owner/grants dipertahankan. Runtime kompatibel sebelum/sesudah migrasi. Setelah CI/head final dan merge, pengelola sudah mengizinkan penerapan migrasi bila diperlukan; catat custom migration ledger/checksum, metadata routine dan advisor sesudah penerapan.

Jika regresi terjadi, rollback frontend ke release sebelumnya; fungsi baru tetap kompatibel. Rollback SQL hanya bila perlu, dalam transaksi berotorisasi: pulihkan body activity_read prior dengan checksum dan metadata yang diverifikasi. Tidak mengubah ledger bisnis atau menghapus riwayat migrasi yang sudah diterapkan.

## Reproduksi dan tindak lanjut

`npm run test:performance:native` memerlukan PRO2_DATABASE_URL loopback pro2_test kosong. Jangan memakai URL produksi. `npm run test:ui:performance` memakai fixture localhost4319 dan browser eksternal. Jalankan suite UI berurutan. Penerimaan manusia, jaringan/perangkat nyata, workload semester lebih besar serta metrik p95 produksi tetap belum dibuktikan.
