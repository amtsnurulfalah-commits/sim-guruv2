# Audit Persiapan Semester — Oktober 2026

Basis: main setelah PR #56. Halaman admin `/admin/persiapan-semester`.

## Alur dan batas audit

Server page dan API memeriksa sesi/onboarding/admin. Choices memuat semester nonarsip dan 20 bukti penerapan terbaru. POST preview memakai allowlist sourceId/targetId/configuration/reason; rencana kanonik tersimpan terikat aktor, fingerprint sumber/tujuan dan masa berlaku 10 menit. Rencana hanya kelas serta jadwal KBM yang berlaku pada hari terakhir semester sumber; jumlah siswa baru 0.

Commit memakai ID preview, global write guard, row lock, fingerprint dan constraint kanonik. Pembuatan kelas/jadwal dan receipt berada dalam satu transaksi; retry ID yang sudah berhasil mengembalikan receipt semula. Target tidak diaktifkan otomatis. Status dibaca berdasarkan ID dan pemilik preview. Kehadiran, jurnal, konfirmasi, BAP, ledger, slip, hak libur, koreksi, piket, upacara, ujian, acara dan aturan keuangan tidak disalin.

Ditelaah: struktur halaman dan modal, DataForm, Button/Pagination/TableRegion/FormDialog, helper request/error/CSRF, schema, state/lifecycle frontend, server service/HTTP, routine SQL dan tests unit/integrasi/UI. Tidak ada perubahan routine SQL, migrasi, endpoint atau perhitungan bisnis.

## A. Temuan

- Read choices gagal setelah sebelumnya berhasil masih menyisakan readiness lama; data/form lama dapat digunakan kembali.
- Validasi preview hanya membandingkan semester; konfigurasi, graph pemetaan, timestamp dan rentang belum cukup diperiksa.
- Receipt hanya mencocokkan ID mapping; perubahan nama/tingkat/jadwal/JTM dengan ID sama dapat dianggap berhasil.
- Pemeriksaan hasil mengubah preview dan membuka lock sebelum receipt diverifikasi, sehingga status tidak sesuai dapat mengganti rencana yang sudah ditinjau.
- Request preview, commit dan pemeriksaan hasil belum berbagi satu lock/lifecycle; cleanup dan hasil terlambat perlu diselaraskan.
- UI belum memblokir preview kedaluwarsa/yang ditolak usang secara jelas. Checkbox persetujuan lama tetap dapat digunakan setelah pemeriksaan status.
- Trigger otomatis FormDialog konfirmasi dapat membuka modal tanpa rencana. Pesan read pilihan bercampur dengan hasil operasi; receipt sukses dapat hilang saat memulai preview yang kemudian gagal.
- Lookup issue yang bukan milik mapping, teks/rentang panjang, ruang mobile, kondisi kosong dan fokus pagination/modal memerlukan pengamanan/perapian.

## B. Perbaikan

- Read choices mempunyai readiness/error terpisah, invalidasi sebelum reload, cleanup abort dan larangan memakai data stale. Kegagalan reload tidak menghapus bukti commit yang sudah diverifikasi. Pencabutan sesi/admin membersihkan data preview.
- Satu lock dan AbortController untuk preview/commit/check, guard langsung pada handler, status busy konsisten dan perlindungan update sesudah unmount. Tidak ada retry POST otomatis.
- Preview request divalidasi sebelum POST; respons mencocokkan semester, jenis konfigurasi dan rentang choices. Duplicate IDs/sources, referensi kelas, tipe waktu/JTM, timestamp, count dan graph diperiksa. Rencana blocked seperti CLASS_MISSING/PLAN_TOO_LARGE tetap dapat dibaca untuk diagnosis.
- Receipt memverifikasi seluruh field mapping dengan urutan JSON/baris yang netral dan UUID case-insensitive. Status harus mempertahankan ID, expiry dan rencana awal; receipt diperiksa sebelum state berubah. Receipt yang sudah diketahui berhasil tidak boleh mundur menjadi null.
- Status tak pasti mengunci penerapan/new preview sampai pemeriksaan ID yang sama memberikan hasil valid. Pemeriksaan sukses tanpa receipt memerlukan persetujuan ulang. Konflik/stale memerlukan preview baru; expiry memblokir penerapan, termasuk guard jam aktual saat klik. Receipt yang sudah tersimpan tetap dapat dipulihkan sesudah expiry.
- Bukti sukses lama dipertahankan sampai preview baru yang valid diterima. Preview lama yang belum diterapkan dibuang saat meminta rencana baru, sehingga tidak tersalah-terapkan setelah request baru gagal.
- Trigger konfirmasi kosong dihapus; konfirmasi butuh preview valid dan checkbox baru. Fokus diarahkan ke preview, hasil, atau pemicu saat modal ditutup. Label unknown issue memakai fallback aman.
- Header dan disclosure aturan lebih ringkas; konsekuensi utama tetap terlihat. Pemetaan dipaginasi 25 baris, tabel scroll lokal, teks/UUID/rentang panjang wrapping, modal tetap memakai viewport/scroll internal yang ada. Empty state dan instruksi pemulihan diperjelas. Scroll vertikal dokumen tetap normal, bukan clipping konten.

## C. Kode final

`src/features/semester-preparation/workspace.tsx`, `src/lib/semester-preparation/contracts.ts`, dan metadata route `src/app/(workspace)/admin/persiapan-semester/page.tsx`. Service/HTTP/SQL tetap menggunakan implementasi kanonik yang sama.

## D. Validasi

- `npm run check`: lint, TypeScript, unit, crypto/HTTP, seluruh integrasi database dan build produksi.
- Unit: request/sumber-tujuan yang sama, duplicate graph/ID, konfigurasi/rentang/timestamp/waktu/JTM, blocked diagnostics, metadata receipt berubah, status tak cocok/tidak boleh mundur dan choices/history invalid.
- Integrasi: allowlist/role/CSRF/owner isolation, no copy evidence, fingerprint/expiry/policy/collision, late constraint rollback, atomic commit, idempotent retry, history dan target tetap belum aktif.
- Browser: preview form dan konfirmasi, 7 lebar 280–1920, orientation, 200% teks, nama/rentang/ID panjang, 56 pemetaan dengan pagination, pilihan kosong/error/malformed/retry, single-flight preview/commit, config/graph invalid, status plan/receipt/network tak cocok, recovery tanpa hasil dan persetujuan ulang, malformed commit ack, stale preview, unknown issue, expiry dan receipt sesudah expiry, kehilangan ack sesudah commit SQL nyata, history reload dan penolakan guru.
- Regresi `test:ui` dan CI final. Screenshot desktop/mobile ditinjau; document width dan body modal diperiksa. Pengujian memakai identitas/data sintetis localhost, bukan perubahan konfigurasi produksi.
- Setelah merge: deployment commit diperiksa dan smoke anonim memastikan health/proteksi endpoint. Tidak mencakup UAT akun/perangkat fisik; tidak menjalankan penyalinan semester produksi.
