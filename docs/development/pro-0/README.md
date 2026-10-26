# PRO-0 — Baseline, UAT, dan sasaran

Program baru PRO-0–PRO-8, bukan pengulangan Tahap 0–8 terdahulu. Dijalankan 26 Oktober 2026 WIB berdasarkan `Roadmap_Pengembangan_Lanjutan_SiM_Guru.md` yang disusun pada percakapan pengguna.

**Status: baseline teknis dan paket UAT tersedia; penerimaan PRO-0 masih menunggu hasil 1 admin + 3 guru.** Tidak mengklaim observasi pengguna, durasi tugas manusia, pembaca layar, atau perangkat fisik telah dilakukan.

## Berkas acuan

- [Baseline dan batas bukti](BASELINE.md).
- [Rencana UAT siap digunakan](UAT.md) serta [lembar hasil manusia dan validasi teknis terpisah](uat-results.csv).
- [Backlog prioritas, target, dependency, estimasi](BACKLOG.md).
- [Checkpoint dan langkah berikutnya](CHECKPOINT.md).
- [Inventaris mesin](inventory.json), [profil browser](browser-performance.json), [aksesibilitas pilot](pilot-a11y.json), [sampel kontras token](token-contrast.json).
- [Roadmap lengkap program baru](../pro-roadmap/ROADMAP.md). Roadmap lama dan paket stage-* adalah bukti historis yang tetap dipertahankan.

## Status sub-tahap

| ID | Hasil aktual | Status |
|---|---|---|
| PRO-0.1 | Source/main PR #68, CI, deployment dan PR terbuka diperiksa; inventaris diperbarui | Selesai untuk snapshot |
| PRO-0.2 | Pengguna memilih 1 admin + 3 guru; kode peserta dan pembagian peran disiapkan | Kelompok disepakati; identitas/perangkat/jadwal sesi belum ditetapkan |
| PRO-0.3 | Sepuluh skenario, prasyarat, metrik dan lembar hasil siap | Selesai untuk persiapan |
| PRO-0.4 | Profil browser sintetis dijalankan; metrik tugas manusia tetap kosong | Menunggu UAT nyata |
| PRO-0.5 | Inventaris, CI, profil localhost dan agregat produksi baca-saja dicatat | Parsial: belum ada kapasitas/beban representatif/SLO produksi |
| PRO-0.6 | 16 kasus layout/axe, delapan langkah Tab per kasus dan kontras token diperiksa | Parsial: dialog/alur lain, pembaca layar dan perangkat fisik belum lengkap |
| PRO-0.7 | Backlog ber-ID dan target teknis/proposal target UAT disiapkan | Selesai untuk prioritas awal; frekuensi/target UAT perlu hasil peserta |

## Cakupan perubahan

Dokumentasi dan pengumpul bukti development saja. Tidak mengubah source runtime, schema, konfigurasi, pengingat/email, penugasan nyata, atau perhitungan honorarium. Tidak membuat akun produksi atau menjalankan ulang pekerjaan honorarium. Permintaan merge/deploy tidak diasumsikan dari instruksi menjalankan baseline.

## Reproduksi teknis

Gunakan dependency lock repo dan Node 24. Tentukan path Playwright/Chromium/axe pada lingkungan development. Paket axe dipakai pada runner pengujian, bukan ditambahkan sebagai dependency runtime.

```bash
node scripts/pro0-inventory.mjs docs/development/pro-0/inventory.json
UI_PROFILE_FILE=/absolute/path/browser-performance.json node tests/ui/release-profile.mjs
PRO0_SOURCE_COMMIT=<source-sha> PRO0_AXE_PATH=/absolute/path/axe.min.js PRO0_REPORT_FILE=/absolute/path/pilot-a11y.json node tests/ui/pro-0.mjs
node tests/ui/journals.mjs
node tests/ui/tasks.mjs
```

Jika Playwright atau browser tidak ada pada dependency lokal, gunakan `UI_PLAYWRIGHT_MODULE` dan `UI_BROWSER_EXECUTABLE` untuk menunjuk instalasi development. Jalankan suite UI berurutan karena fixture memakai port 4319. Collector menyimpan temuan sebagai baseline, bukan menghapus/menyembunyikannya supaya laporan lulus.
