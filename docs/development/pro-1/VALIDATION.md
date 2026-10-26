# Validasi PRO-1

26 Oktober 2026 WIB. Berlaku pada tree PR pilot, bukan klaim deployment produksi.

| Pemeriksaan | Hasil aktual |
|---|---|
| ESLint / typecheck / build produksi | Lulus |
| Unit | 164 lulus, 0 gagal |
| Crypto/HTTP | Perintah test:crypto exit 0 |
| Integrasi database PGlite | 391 lulus, 0 gagal |
| Jurnal browser existing + assertion fokus | Lulus; 7 lebar, semua tab/modal, create/edit/delete/H-1/blok, invalid count/blank, double submit, konflik, draft/recovery, gagal refresh, CSV, pagination, role guru, touch/landscape/200% |
| Pusat tugas browser | Lulus; 28 kombinasi, search/status/jenis, reset, clamp pagination, refresh/focus/online, loading/error/empty, malformed/retry, deadline/source date, inbox/preferences, WIB rollover |
| Pilot a11y/layout | 16 kombinasi: jurnal guru/tugas admin × 320/375/768/1440 × font16/32; 0 page error, 0 document overflow, 0 axe violation |
| Visual | Tangkapan 375 dan 1440 kedua pilot ditinjau; header/tools membungkus, status netral, filter/ringkasan dapat dibaca |
| Profil fixture | 30 sampel; p50 699ms/p95 926ms; 0 page error/overflow |
| Human UAT / pembaca layar / perangkat fisik | Belum dilakukan |
| CI head final / preview | Periksa checks PR; hasil dicatat terpisah setelah publikasi |

Artefak: [pilot-a11y.json](pilot-a11y.json), [browser-performance.json](browser-performance.json). Collector PRO-0 dipakai kembali untuk kondisi yang sama; penambahan screenshot opsional tidak mengubah pengukuran default. Metadata laporan diberi label PRO-1, source menunjuk tree PR.

Batas: axe masih mempunyai incomplete `color-contrast` dan `aria-valid-attr-value`, memerlukan tinjauan manual. Hasil otomatis bukan sertifikasi WCAG atau tes seluruh aplikasi. Urutan Tab collector hanya delapan langkah; suite jurnal menguji pemulihan fokus saat tutup/simpan secara terpisah.

Profil browser memakai localhost, database disposable kecil, dan networkidle 500ms. Baseline PRO-0 p50/p95 1128/1578ms; run PRO-1 699/926ms berada di bawah usulan budget fixture 1973ms. Mesin/cache/proses dapat memengaruhi hasil: **tidak menyimpulkan peningkatan kausal atau SLO produksi**, dan tidak mengganti ukuran durasi tugas manusia.

Satu build awal gagal akibat cache Turbopack `.next` yang tidak utuh dari sesi sebelumnya. Cache dipindahkan ke luar repo dan build ulang bersih berhasil. Executable Chromium lama gagal sebelum tes; executable fresh dari paket yang sama 153.0.0 berhasil. Keduanya masalah lingkungan uji, bukan hasil lulus yang disembunyikan.

Tidak ada akses tulis bisnis produksi, email, migrasi atau perubahan konfigurasi pada tahap ini. Konten panjang boleh menggulir vertikal secara alami; kriteria overflow adalah tidak keluar/terpotong viewport atau membutuhkan scroll horizontal halaman tanpa sengaja.

Untuk menjalankan ulang: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:crypto`, `npm run test:db`, `npm run build`; kemudian suite `tests/ui/journals.mjs`, `tasks.mjs`, `pro-0.mjs` dan `release-profile.mjs` secara berurutan (port4319 bersama). Set UI_PLAYWRIGHT_MODULE/UI_BROWSER_EXECUTABLE sesuai instalasi browser; collector memerlukan PRO0_AXE_PATH/PRO0_REPORT_FILE dan profil UI_PROFILE_FILE. Jangan arahkan fixture ke produksi.
