# Baseline aktual dan batas bukti PRO-0

## Snapshot sumber dan rilis

- Source: `882367b52cf0b69ad743c49878dcf0972c8d3bab`, merge PR #68; tree `2d63248b14f5b0c77af785ec02cbf397fb4b1a92`.
- PR terbuka: tidak ditemukan saat pemeriksaan awal. Periksa ulang sebelum bekerja karena snapshot ini dapat berubah.
- Deployment kanonis READY pada commit yang sama: `dpl_61e49q7DMYxc8wTtED2FUbntic7Y`.
- Quality CI run `40251706952`, job `121344830711`: 164 unit, 42 crypto/HTTP, 391 integrasi, semuanya lulus; lint, typecheck dan build berhasil. Total 597 hasil runner, bukan 597 skenario bisnis independen.
- Job native-release pada run yang sama berhasil. Workflow mencakup PostgreSQL asli, isolasi role/konkurensi serta backup/restore disposable. Ini bukti runner sintetis, bukan restore produksi.

Roadmap percakapan memakai PR #67 sebagai baseline; PR #68 sudah ditemukan di main dan dipakai pada pengukuran ini. PR #68 mengubah aktivasi/retry/lifecycle reCAPTCHA: jangan mengembalikan implementasi panel ke versi PR #67 ketika mengerjakan UI berikutnya.

Checkpoint lama masih berpusat pada Tahap 0–8 sebelumnya dan sebagian deskripsi historis belum mencerminkan modul baru. File tersebut adalah arsip konteks, bukan inventaris terkini. Acuan program baru adalah paket PRO ini.

## Inventaris source

| Ukuran | Hasil |
|---|---:|
| File dalam src | 371 |
| Halaman page.tsx | 51 |
| File route API | 57 |
| Migrasi SQL | 34 |
| Direktori feature | 16 |

Hitungan halaman termasuk beranda root dan alias route. File route bukan jumlah action API; beberapa memakai dispatcher dinamis. Pemindaian awal sempat melewatkan beranda root sehingga menghitung 50 halaman; collector sudah dikoreksi dan hasil final 51.

Pemakaian pola pada file TSX feature: 4 dialog native, 8 ManagedDialog, 16 FormDialog, 24 kemunculan ui-panel, dan 24 details. Angka ini merupakan petunjuk adopsi komponen; bukan bukti bahwa komponen tersebut salah, duplikat, atau harus diganti serentak.

## Fitur yang dipertahankan/dipakai kembali

| Kemampuan | Source acuan | Keputusan |
|---|---|---|
| Auth internal, onboarding, reCAPTCHA | server/auth, features/auth | Pertahankan cookie/CSRF/rate/guard, tidak mengganti autentikasi |
| Pusat tugas dan prioritas | features/tasks/task-center.tsx, task-workspace.tsx | Gunakan sumber tugas existing; jangan membuat daftar selesai terpisah |
| Inbox/preferensi notifikasi | features/tasks, lib/tasks | Perluas bila dibutuhkan, bukan membuat subsystem baru |
| Jurnal dan draft | features/activities/journal-workspace.tsx, journal-editor.tsx, lib/drafts | Pilot guru; periksa tanggal, prasyarat, konflik dan hasil simpan tidak pasti |
| Pengganti piket/KBM/panitia/pengawas | server/duties, server/programs, migration substitution_consistency_guards | Pertahankan effective assignment dan reversal |
| Honor/kesiapan/koreksi | server/finance, features/finance | Gunakan engine dan snapshot yang sama |
| Laporan pimpinan | server/reports | Indikator existing; kelengkapan bukan penilaian kinerja |
| Persiapan semester | server/semester-preparation | Gunakan preview/commit existing |
| Kendala dan monitoring | server/support, operations; migration support_case_lifecycle_and_monitoring | Lifecycle sudah ada, jangan mengikuti deskripsi lookup-only pada arsip lama |
| Backup/restore/runbook | scripts/release-native-drill.ts, docs/development/stage-8 | Verifikasi operasional; jangan menganggap kode otomatis mengaktifkan backup produksi |

## Pengukuran browser lokal saat ini

Source yang sama, Chromium fixture localhost + PGlite, data sintetis kecil:

- 30 sampel: dashboard/jurnal/riwayat, viewport 320 dan 1440, lima pengulangan per kombinasi.
- p50 kesiapan halaman: **1128 ms**; p95: **1578 ms**.
- JavaScript page error: **0**; overflow horizontal halaman: **tidak ditemukan** pada sampel ini.
- Waktu mencakup networkidle sekitar 500 ms; bukan durasi pengguna menyelesaikan tugas, SSR Next.js produksi, Core Web Vitals, WAN, atau kapasitas serentak.
- Hasil stage-8 lama memakai lingkungan/waktu/data berbeda. Perbedaan nilai historis tidak langsung membuktikan regresi atau perbaikan.

## Aksesibilitas pilot

Dijalankan 16 kombinasi: jurnal guru dan pusat tugas admin × 320/375/768/1440 px × font root 16/32 px. axe-core 4.14.0 memakai tag WCAG 2 A/AA, 2.1 AA dan 2.2 AA. Hasil: tidak ada pelanggaran otomatis terlapor, tidak ada overflow halaman dan tidak ada page error.

Namun axe mencatat pemeriksaan **incomplete** untuk color-contrast dan aria-valid-attr-value pada sebagian konteks. Hasil ini memerlukan peninjauan manual; bukan klaim patuh WCAG. Sampel token source yang dihitung terpisah: body/background 13,46:1; muted/card 5,92:1; white/primary 6,86:1; error/card 6,51:1; border input/card 3,31:1. Sampel tersebut tidak mencakup semua keadaan aktual, overlay, iframe Google, atau kombinasi warna komponen.

Collector juga merekam delapan perpindahan Tab per kasus. Ini hanya bukti awal fokus berpindah pada tampilan default, bukan pembuktian urutan fokus seluruh alur atau pengujian pembaca layar. Pilot default memakai data minimal; pengujian data banyak/modal/hasil tidak pasti dirujuk ke suite jurnal dan tugas terkontrol serta UAT berikutnya.

## Observasi produksi baca-saja

Pemeriksaan dilakukan 26 Oktober 2026 WIB; tidak membaca identitas, isi jurnal, nominal honor, secret, atau payload pesan.

- Data kegiatan, jurnal, absensi, BAP dan substitusi belum terisi pada snapshot. Ini membuat latency teramati tidak representatif untuk beban madrasah penuh.
- Ledger migrasi berisi 34 entri. Pemeriksaan keamanan advisor tidak mengembalikan lint pada saat diperiksa; bukan jaminan seluruh keamanan/otorisasi sempurna.
- Tersedia metrik agregat modul selama tujuh hari. Struktur hanya menyimpan samples/total_ms/max_ms per menit/modul/kelas status. **p50/p95 produksi tidak dapat dihitung dari agregat ini.** Jangan menghitung percentile dari rata-rata bucket atau menyebut mean sebagai p95.
- Contoh sukses yang teramati: dashboard mean 352,65 ms/max 862 ms dari 31 sampel; operations mean 180,48 ms/max 1003 ms dari 96 sampel. Sampel kecil, best-effort, mencampur aksi per modul, serta tidak mencakup latensi browser/jaringan. Ini pengamatan, bukan SLO atau sertifikasi performa.
- Kelas 4xx tidak boleh dianggap seluruhnya bug: dapat berasal dari penolakan akses, validasi, dan smoke anonim yang memang diharapkan.
- Pekerjaan notifikasi mempunyai bukti selesai terbaru. Antrean domain kosong; hal ini tidak membuktikan email diterima penerima nyata.
- Ditemukan **satu job honor berstatus failed, attempts=5, code=42501**. Kode saja belum menentukan apakah sebabnya role/grant, guard bisnis, atau konfigurasi. Tidak di-retry, tidak diubah, dan tidak dibypass pada PRO-0; diagnosis diprioritaskan pada B-001.
- Backup terjadwal, objek/lampiran, secret/provider, kapasitas produksi serentak dan RPO/RTO produksi **belum diverifikasi** pada program ini.

## Batas keputusan

Belum ada hasil empat peserta UAT, durasi tugas manusia, frekuensi kebingungan, pembaca layar, perangkat fisik, atau beban produksi besar. Tidak ada temuan UX yang diklaim sebagai keluhan pengguna tanpa observasi. Proposal penyederhanaan UI pada backlog masih hipotesis yang diuji melalui UAT, bukan alasan mengubah seluruh aplikasi sekaligus.
