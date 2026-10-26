# Validasi PRO-2

## Pengukuran native final

Source runtime `dec80470d6bd0ac25c4e10afd36aff1ae0b79109`; PostgreSQL16.15 pada runner Ubuntu24.04. [CI run40281970845](https://github.com/amtsnurulfalah-commits/sim-guruv2/actions/runs/40281970845), native job121437049038 berhasil. Lihat [native-results.json](native-results.json).

Dataset yang sama sebelum/sesudah: 201 akun, 12.060 kehadiran, tiga workload, masing-masing20 request per phase dengan concurrency4 melalui business-role ActivityService/adapter existing. Satu warm-up per workload tidak masuk percentile. Timeout tetap statement10s/lock3s. Payload/fingerprint first/deep/filtered identik pada request sukses. Tidak menjalankan beban pada produksi.

| Workload | Sebelum: sukses /20 | Sebelum: error | Sebelum p50/p95 sukses (ms) | Sesudah: sukses /20 | Sesudah: error | Sesudah p50/p95 (ms) |
|---|---:|---:|---:|---:|---:|---:|
| Global halaman1 | 15 | 5 lock timeout | 4591 /6935 | 20 | 0 | 14 /24 |
| Global halaman400 | 5 | 15 lock timeout | 5141 /5169 | 20 | 0 | 24 /45 |
| Filter satu akun | 20 | 0 | 58 /112 | 20 | 0 | 28 /43 |

Error sesudah0/60 request terukur; semua workload mencapai budget fixture p95<5000ms. Percentile sebelum **hanya sampel sukses**, bukan bukti latensi semua request; kegagalan tidak disembunyikan dalam percentile. Sampel20 per workload kecil; bukan sertifikasi kapasitas produksi.

EXPLAIN ANALYZE BUFFERS count predicate representatif: execution2371,784→1,667ms. Ini query diagnostic terpisah dalam konteks sintetis terverifikasi, bukan plan semua isi RPC. Plan menunjukkan biaya predicate berulang; tidak ada indeks baru atau penghapusan indeks. CPU/RSS JSON merupakan proses benchmark klien dan wall time mencakup warm-up; tidak mengklaim CPU server atau disk produksi telah diukur.

## Pengujian lokal

| Pemeriksaan | Hasil |
|---|---|
| Lint/typecheck/build | Lulus |
| Unit | 164 lulus |
| Crypto/HTTP | Exit0 |
| Integrasi database final | 395 lulus,0 gagal; termasuk4 tes PRO-2 |
| Kesetaraan SQL | First/deep page, total, payload, owner/grants/search_path identik; boundary guru/foreign filter dan revoked session lulus |
| Jurnal UI | 7 lebar, modal/CRUD/H-1/block, validasi, double-submit, konflik/uncertain/recovery/CSV, serta0 fetch riwayat tersembunyi lulus |
| Draft UI | Restore/isolasi akun-tab/offline/TTL/logout/session/storage lulus |
| Kehadiran UI | Manual/leaves/template, uncertain-write, CSV/PDF, malformed/range/pagination/WIB rollover lulus |
| Browser comparison | 20 sampel per variant; hidden history20→0, refresh-ready p50/p95747/830→174/249ms;0 page error/overflow |

Browser comparison sengaja memberi delay history400ms sama di kedua varian. Ini membuktikan penghapusan dependency tersembunyi; bukan Core Web Vitals atau waktu tugas manusia. Sampel default tanpa data riwayat; suite UI menguji alur data/modal secara terpisah. UAT peserta, pembaca layar/perangkat fisik dan WAN/SSR produksi belum diukur.

## Kesiapan migrasi

File kanonis `20261026062908_pro2_activity_read_performance.sql`.
SHA256: `00c13defcdadd94244a13791f7c34ae8bb759a5220c4bc4ffafa7fb451a583b8`.
Body MD5 sebelum: `2f61143c2f5217c557670c801f354023`; sesudah yang diharapkan: `67408d8d3e552ce8cca5e0a973c95215`.

Preflight produksi baca-saja cocok dengan body prior, owner sim_guru_owner, SECURITY DEFINER/search_path pg_catalog dan execute hanya owner/business. Canonical ledger34; penerapan diharapkan35. Tidak ada perubahan data/table/indeks, permission, timeout, formula, email atau job.

Migrasi dijalankan setelah merge/head final berhasil sesuai otorisasi pengelola. Bungkus canonical SQL dan insert custom ledger/checksum dalam transaksi apply_migration dengan migration advisory lock; tolak bila preflight berubah. Sesudahnya periksa body/ACL/ledger checksum dan security advisor. Status penerapan/rilis aktual harus diverifikasi dari ledger dan deployment/PR72; kesiapan bukan bukti sudah diterapkan.
