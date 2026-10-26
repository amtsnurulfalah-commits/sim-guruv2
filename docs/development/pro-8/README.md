# PRO-8 — Validasi akhir, rilis dan evaluasi

Tanggal pelaksanaan: 26 Oktober 2026 WIB. Baseline: `beafb5f0f3379803fd3b2619c22bda0798aaa4db` (main, PR77/PRO-7). Pengelola mengizinkan pelaksanaan, merge dan migrasi jika diperlukan.

## Keputusan ruang lingkup

Paket ini mengulang validasi teknis dan menyiapkan evaluasi pengguna. Tidak menyatakan seluruh program diterima oleh pengguna. Tidak ada perubahan skema, aturan honorarium, penugasan, sesi, cron, tarif, email atau ledger. Migrasi tidak diperlukan: 37 migrasi produksi cocok dengan checksum source. Job September yang dikecualikan tetap di luar scope.

Perubahan rilis: runner regresi UI berurutan dengan batas waktu dan bukti JSON, smoke akses anonim diperluas ke kalender/riwayat/ekspor, catatan PRO-8 serta penghilangan kategori catatan yang kosong. Runner memakai suite existing, bukan engine bisnis/test duplikat. Semua fixture write terbatas localhost/PGlite; smoke produksi hanya GET anonim.

## Gate dan status penerimaan

| ID | Status paket | Bukti / batas |
| --- | --- | --- |
| PRO-8.1 | Validasi teknis ulang; UAT manusia terbuka | Skenario U01–U10 dipetakan ke suite existing, 17 percobaan manusia belum dilaksanakan. Durasi/bantuan/skor belum dapat dibandingkan. CSV PRO-0 tidak diisi hasil rekaan. |
| PRO-8.2 | Divalidasi teknis | 172 unit, 45 crypto/HTTP dan 407 integrasi lokal; native PostgreSQL/concurrency/restore di CI wajib hijau pada head akhir. UI melengkapi batas alur, bukan pengganti seluruh izin SQL. |
| PRO-8.3 | Divalidasi pada matriks otomatis; parsial untuk manusia | Pilot 16 kombinasi jurnal/guru dan tugas/admin; 320/375/768/1440px, font16/32px, Chromium153/axe4.14.0. Shell dan suite modul memeriksa orientasi/fokus/keyboard/touch. Pembaca layar nyata dan perangkat fisik belum diuji. |
| PRO-8.4 | Ditinjau teknis | 37 checksum source/produksi cocok, dua RPC PRO-7 owner/ACL/body cocok, security advisor kosong, 18 probe anonim lulus/no-store. Tidak membuktikan semua konfigurasi eksternal, inbox atau seluruh data produksi. |
| PRO-8.5 | Mengikuti PR dan CI | Tidak ada migrasi/config baru. Catatan pembaruan tersedia. Rollback aplikasi ke deployment PRO-7; jangan menghapus migrasi additive 37 atau bukti transaksi. |
| PRO-8.6 | Wajib diverifikasi saat rilis | Cocokkan tree, merge SHA, deployment READY, alias dan GET health; ulang smoke anonim. Bukti aktual mengikuti PR/Actions/Vercel, bukan status checkbox semata. |
| PRO-8.7 | Terbuka | Belum ada periode evaluasi dan petugas yang disepakati. Rencana pada EVALUATION.md; bukan pengamatan yang sudah dijalankan atau otomasi aktif. |

## Menjalankan ulang

1. Checkout commit yang hendak diuji; `npm ci` lalu `npm run check`.
2. Jalankan CI `native-release` untuk PostgreSQL16, concurrency dan restore terenkripsi pada database disposable loopback. Jangan arahkan URL test ke produksi.
3. Setelah build, jalankan `npm run test:ui:pro8`. Sediakan Playwright/Chromium melalui `UI_PLAYWRIGHT_MODULE` dan `UI_BROWSER_EXECUTABLE` bila tidak terpasang pada defaults. `PRO8_REPORT_DIR` mengatur direktori bukti; default sibling `../pro8-ui-evidence`. Runner serial agar server fixture tidak berebut port; batas180detik/suite, exit nonzero bila gagal/timeout. Jangan menjalankan fixture UI lain bersamaan.
4. Kolektor pilot existing `tests/ui/pro-0.mjs`: isi `PRO0_AXE_PATH`, `PRO0_REPORT_FILE`, `PRO0_SOURCE_COMMIT`; browser sama. Hasil otomatis memerlukan tinjauan manual.
5. Smoke baca-saja: `SMOKE_BASE_URL=https://sim-guruv2.vercel.app npm run release:smoke`. Memerlukan akses jaringan; tidak login, mengirim email, atau mencoba write pengguna nyata.
6. Cocokkan hasil dengan [VALIDATION.md](VALIDATION.md), [evaluasi](EVALUATION.md) dan [checkpoint](CHECKPOINT.md). Simpan hanya bukti sintetis/metadata yang aman di Git.

## Batas kesimpulan

Baseline pilot PRO-0 dan ulang PRO-8 sama-sama 16kasus, 0overflow dan 0pelanggaran axe. Ini menunjukkan tidak ada regresi terdeteksi pada cakupan tersebut, bukan peningkatan durasi pengguna atau sertifikasi WCAG. Waktu suite termasuk boot fixture; jangan gunakan sebagai waktu tugas manusia/SLO produksi. Jumlah/konten fixture dan source berubah selama PRO-1–7 sehingga perbandingan performa mentah tidak setara.

Keputusan penerimaan manusia, backup produksi/RPO/RTO, inbox email nyata, pemasangan OS dan impor kalender tetap terbuka. Pengelola telah mengizinkan rilis teknis bertahap; izin itu tidak diartikan sebagai bukti bahwa target manfaat tersebut tercapai.
