# Checkpoint PRO-0

Tanggal: 26 Oktober 2026 WIB.

## Sumber kebenaran dan scope

Instruksi: “Lanjut jalankan Tahap 0”, mengacu pada roadmap baru PRO-0–PRO-8. Source diperbarui dari main ke `882367b52cf0b69ad743c49878dcf0972c8d3bab` (PR68), tree `2d63248b14f5b0c77af785ec02cbf397fb4b1a92`. Branch pekerjaan: `docs/pro-0-baseline`.

Runtime, SQL/migrasi, konfigurasi produksi, pengiriman, dan data bisnis tidak diubah. Pemeriksaan produksi sebatas snapshot deployment, advisor, agregat volume/metrics/job dan smoke baca-saja. Tidak mengambil kredensial atau identitas pengguna.

## Selesai pada sesi ini

- Kelompok UAT dipilih pengguna: 1 admin dan 3 guru.
- Roadmap terbaru dibaca dari dokumen tersimpan; baseline PR67 dikoreksi ke main PR68.
- CI quality/native pada source dan deployment READY dicocokkan; tidak ada PR terbuka pada snapshot awal.
- Inventaris reproducible: 371 src files, 51 page, 57 API route files, 34 migrasi, 16 feature directories.
- 30 sampel browser: p50 1128/p95 1578 ms; 0 page error/overflow pada fixture.
- 16 kombinasi pilot jurnal guru/pusat tugas admin × 4 lebar × font 100/200%; axe 4.14.0 tanpa violation terlapor, tetap ada incomplete/manual review.
- Sampel kontras token source dan delapan perpindahan Tab per kasus didokumentasikan dengan batas.
- Suite jurnal existing dan tugas existing dijalankan ulang pada API/SQL fixture terkontrol, hasil berhasil.
- Paket 10 skenario dan CSV 17 percobaan, backlog B-001–B-012 serta budget/target awal disiapkan.

## Temuan penting dan keterbatasan

- Job honor failed dengan attempts=5/code42501 perlu diagnosis; tidak di-retry atau dilemahkan guard-nya.
- Data transaksi produksi masih kosong pada snapshot; mean/max request agregat bukan p50/p95/kapasitas produksi.
- UAT manusia, nama/perangkat/jadwal peserta, lingkungan staging aman, pembaca layar/perangkat fisik serta backup/delivery produksi belum terbukti.
- Checkpoint stage-* lama tidak otomatis menggambarkan main terkini. Jangan menghapus sejarah atau mengulang fitur yang sudah tersedia.

## Status akhir

**PRO-0 baseline teknis tervalidasi dan paket UAT siap. PRO-0 secara keseluruhan belum ditutup** sampai hasil peserta dan keputusan target tersedia. Tidak ada penilaian pengguna yang dibuat oleh agen. Tidak memulai implementasi UI PRO-1 pada sesi ini.

Status PR/CI paket dokumentasi mengikuti PR yang dibuat dari branch ini. Merge/deployment baru tidak diklaim sebelum ada bukti. Snapshot CI597 di BASELINE.md merujuk baseline source, bukan otomatis head dokumentasi berikutnya.

## Satu langkah berikutnya

Pengelola menetapkan perangkat/jadwal/moderator serta lingkungan UAT terisolasi untuk A01/G01/G02/G03. Jalankan U01–U10 sesuai pembagian dan isi uat-results.csv; kemudian tetapkan urutan pilot B-009/B-010 serta target durasi/bantuan berdasarkan hasil asli. B-001 dapat didiagnosis sebagai paket operasional terpisah tanpa menunggu perubahan visual, setelah scope penanganannya ditetapkan.

## Pembaruan sesudah baseline

26 Oktober 2026 WIB: B-001 didiagnosis dan ditangani secara operasional atas keputusan pengelola bahwa September tidak diproses. Penyebab awal: RATE_MISSING ditolak guard finance (42501), bukan alasan melonggarkan izin. Job spesifik September dijeda dengan PERIOD_OUT_OF_SCOPE, attempts/history dipertahankan dan satu audit log dicatat. Verifikasi saat penanganan: tidak ada retry eligible, failed honor jobs 0, serta tidak ada slip/ledger/finalisasi/notifikasi September. Tidak ada migrasi atau perubahan tarif. Snapshot baseline di atas tetap dipertahankan sebagai sejarah.

Instruksi selanjutnya “Lanjut jalankan Tahap PRO-1” memulai pilot teknis [jurnal dan tugas](../pro-1/README.md) dengan pengecualian dependency UAT yang dicatat. Hasil peserta PRO-0 tetap belum diisi.
