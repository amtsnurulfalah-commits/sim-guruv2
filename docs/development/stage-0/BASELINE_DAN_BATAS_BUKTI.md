# Tahap 0.3 — Baseline dan batas bukti

Diperiksa ulang **24 Oktober 2026 WIB**, source aplikasi `c3bced20922163d0abddae2358c3450a84437d9d`. Workspace sempat kembali ke snapshot lama saat kelanjutan; hasil di paket ini berasal dari pelaksanaan ulang, bukan menganggap berkas/log yang hilang tetap tersedia.

## Pengujian

| Pemeriksaan | Bukti/batas |
|---|---|
| `npm run check` | Lint, TypeScript, 129 unit + 35 HTTP/crypto + 333 integrasi = **497 hasil runner**, serta build. Bukan 497 alur produksi atau cakupan 100% |
| Migrasi lokal | Suite PGlite memakai 27 file dalam repo; bukan bukti ledger Supabase produksi sama |
| `npm run test:ui` | Matriks lintas halaman admin/guru dan interaksi; hasil akhir pada validation.json. Harness bukan deploy Next/Vercel produksi |
| `npm run test:ui:baseline` | 4 tampilan dan 3 API baca, data sintetis minimal; tidak ada page/console/server error atau overflow dokumen saat pengukuran |
| Tool inventaris | HEAD aktual menggantikan SHA lama yang ditulis tetap; output dapat diarahkan tanpa menimpa bukti historis |

Tes browser khusus audit sebelumnya masih tersedia (termasuk 18 alur Honorarium dan 12 Acara). Itu bukti historis pada source aplikasi yang sama, tidak dihitung sebagai pengujian ulang Tahap 0. Perubahan domain berikutnya harus menjalankan skenario khusus terkait.

## Keamanan: teramati vs belum dibuktikan

| Aspek | Source/tes lokal | Batas Tahap 0 |
|---|---|---|
| Identitas/sesi | Internal Argon2id, cookie, onboarding/business, revocation, CSRF/Origin/rate | Tidak memeriksa secret/config deployment atau perangkat nyata |
| Izin | Gate page/handler/SQL, ownership/CAS/final lock; penolakan role dan direct DML/RLS diuji | Bukan audit ASVS penuh/penetration test/semua urutan actor-action produksi |
| Finansial | NUMERIC, ledger/reversal, final guard, immutable snapshot, correction basis dan atomisitas | Bukan rekonsiliasi data operasional nyata atau persetujuan pemilik data |
| Log | Allowlist metadata/referensi, lookup admin 30 hari, after() best effort | Belum ticket lifecycle; retensi runtime provider dan availability after() produksi tidak diperiksa |
| Worker | Lease/fencing/unknown/retry/reconcile dan switch | Antrean/claim bukan bukti pengiriman/penerimaan inbox atau scheduler produksi |
| Backup | Tool terenkripsi dan snapshot WASM existing | Restore pg_dump/pg_restore native, RPO/RTO dan pemulihan operasional belum dijalankan |
| Migrasi/rilis | Checksum/idempotensi lokal dan quality workflow | Tidak membaca ledger/config database privat produksi pada Tahap 0 |

Gap bukti bukan pernyataan bahwa layanan sedang rusak. Tidak ada credential, isi env, backup atau data pengguna produksi yang dikumpulkan. Adanya migrasi dalam repo, termasuk guard KBM 20261023094531, bukan bukti penerapan pada produksi.

## Aksesibilitas/UI

Source menyediakan focus-visible, label, FormFeedback/aria-invalid, dialog Radix dirty/discard, TableRegion keyboard, reduced-motion dan kontrol sentuh sesuai design system. Matriks UI memeriksa ukuran, keyboard, zoom dan drawer sesuai `tests/ui/verify.mjs`.

Belum ada sertifikasi WCAG 2.2 AA, audit kontras menyeluruh, pembaca layar NVDA/VoiceOver/TalkBack atau perangkat fisik. Modal native/Radix, state filter lokal/URL dan konsolidasi status/format adalah kandidat standardisasi, bukan klaim bug baru tanpa reproduksi.

## Performa lokal

Lihat angka aktual pada [performance.json](performance.json). Node/Chromium, tanggal UTC, metode dan batas disimpan di sana. Pengukuran berurutan memakai 1 warmup + 10 sampel/API dengan p50/p95 nearest-rank. Untuk 10 sampel, p95 sama dengan maksimum; bukan estimasi tail latency produksi yang kuat.

Waktu navigasi sampai siap mencakup networkidle dan aria-busy=false, termasuk jeda networkidle. Bukan LCP/INP/CLS, TTFB SSR atau waktu render murni. Startup mencakup bundling/migrasi/seed sintetis. API harness memanggil service asli tetapi melewati sebagian auth/CSRF/rate layer produksi; pengujian keamanan terpisah.

Tidak mengukur cold start Vercel, TCP/pooler Supabase, koneksi seluler, dataset operasional besar, concurrency atau kapasitas. Angka lokal bukan SLO. Tahap 8.3 menetapkan target dari data representatif dan pengamatan terotorisasi.

## Gap dan backlog

- Dokumen historis/status terkini perlu dibedakan → DOC-01/checkpoint.
- Summary/outbox/finance issues/support lookup sudah ada; hindari subsystem paralel → TASK/NOTIF/HONOR/SUPPORT.
- Suite domain bukan full-chain browser/real-device/native concurrency → QA/SEC/RELEASE.
- Dataset minimal tidak menentukan kapasitas → PERF-01.
- Migrasi/backup tool bukan bukti penerapan/pemulihan produksi → OPS-01/02.

## Reproduksi

```bash
npm ci
npm run audit:inventory -- /tmp/sim-guru-inventory.json
npm run check
UI_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs UI_BROWSER_EXECUTABLE=/path/to/chromium UI_BASELINE_REPORT_DIR=/tmp/sim-guru-baseline npm run test:ui:baseline
UI_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs UI_BROWSER_EXECUTABLE=/path/to/chromium UI_REPORT_DIR=/tmp/sim-guru-ui npm run test:ui
```

Browser disediakan lingkungan, bukan dependency produksi baru. Jalankan browser tests **berurutan** karena direktori build fikstur dibagi. Simpan versi/metode/ringkasan, jangan secret/backup. Baseline script hanya memakai localhost, tanpa opsi URL produksi. Graph lengkap inventaris dapat dihasilkan ulang dengan perintah di atas; JSON paket ini merupakan ringkasan route/domain/tes yang diturunkan dari graph dan scan source.

## Angka pelaksanaan ulang

| API | p50 (ms) | p95 (ms) |
|---|---:|---:|
| `/api/dashboard` | 13.7 | 26.2 |
| `/api/programs/read?domain=events&date=2026-10-24` | 6.8 | 13.9 |
| `/api/honorarium/read?kind=recap&period=2026-10&mode=realized` | 8.7 | 15.9 |

| Tampilan 1440×1000 | Navigasi sampai siap (ms) |
|---|---:|
| dashboard | 867.11 |
| finance | 787.12 |
| events | 787.29 |
| schedules | 882.86 |
