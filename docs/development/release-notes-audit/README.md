# Audit Catatan Pembaruan

Baseline main PR80 `05ad45e160ccf0972a645135ef80436170f7ab64`. Pengelola meminta audit menyeluruh, UI responsif, kompatibilitas dan merge langsung setelah validasi. Tanggal:27Oktober2026 WIB.

## Pemetaan sebelum perubahan

Route `/pembaruan` force-dynamic/metadata → ReleasePage → PublicWorkspace/SessionBoundary → context akun → ReleaseNotes dan footer ReleaseNotice. Konten versi bersumber dari katalog statis `src/lib/release/notes.ts`; tidak ada CRUD/API/database catatan. Komunikasi sesi tetap memakai `/api/auth/session` existing, heartbeat/logout dan reset browser existing. Penanda memakai sessionStorage key existing, scope ID+role+version. InstallGuide mendengarkan beforeinstallprompt/appinstalled/display-mode dan memanggil prompt hanya saat klik. Root manifest/icon/favicon, token CSS, feedback dan lifecycle draft/preferensi diperiksa.

## Temuan dan perbaikan

| Temuan | Perbaikan |
| --- | --- |
| State boolean footer diperbarui hanya saat event mark/scope berubah, tidak saat penanda dihapus oleh reset; potensi snapshot scope lama sampai effect berjalan. | Hook useReleaseStatus berbasis useSyncExternalStore, primitive snapshot per scope/version, subscription release-read/preferences-cleared/storage, cleanup lengkap. Format/key existing dipertahankan. |
| Tombol terus aktif sesudah mark; tidak membaca status tersimpan saat reload; pesan lokal dapat terbawa ketika scope berubah. | Status baca bersama halaman/footer, tombol disabled saat read/SSRunknown, konfirmasi read eksplisit; feedback error terikat scope/version. Write dicek kembali sebelum diklaim tersimpan. Storage denied tetap dapat membaca dan retry. |
| Daftar rilis tertunda oleh pemeriksaan sesi meskipun publik. Unknown initial failure berpotensi tampak sebagai anonymous chrome. | Pending fallback hanya menampilkan catatan publik dengan scope null; tidak menawarkan status login palsu atau menandai akun sebelum terverifikasi. Pada gagal sesi catatan tetap terbaca dan tombol retry existing dipertahankan. Komponen sesi tidak diubah. Pemasangan interaktif ditampilkan setelah pemeriksaan sesi terselesaikan. |
| appinstalled disamakan dengan membuka jendela standalone; false query dapat menimpa state, dukungan navigator.standalone/legacy MQL belum ditangani. | Pisahkan installed dan standalone; baca Safari flag dan listener API lama bila diperlukan. Tidak mengklaim tab biasa adalah jendela aplikasi. |
| finally dialog lama selalu membersihkan prompt, termasuk tawaran baru; completion setelah cleanup dapat mengubah state siklus baru. | Ref tawaran aktif, guard pending sinkron, token Symbol per percobaan, invalidasi saat cleanup/appinstalled dan penyelesaian sesuai tawaran. Rejection ditangani dan event malformed diabaikan. |
| Panduan pemasangan lebih dominan daripada catatan; tanggal mentah, tautan berulang dan seluruh arsip terbuka. Katalog/identitas versi terpisah mudah tertinggal. | Versi terbaru paling atas, tanggal Indonesia/WIB, kategori bertipe tanpa casting/heading kosong, arsip details keyboard, satu tautan panduan dan petunjuk instalasi setelah catatan. currentRelease berasal dari entri pertama; catatan27Oktober mencakup perubahan yang dirilis dan paket ini. |

Tidak ada migrasi SQL, perubahan bisnis/izin/auth, dependency/config/secret baru, service worker/offline queue atau persistensi privat baru. Tidak mengirim email atau menjalankan transaksi produksi. Marker lama versi PRO-8 menjadi unread untuk versi terbaru secara sengaja; logout tetap menghapus key existing.

## Validasi

- 174unit,46crypto/HTTP,407integrasi lokal lulus. Unit katalog memeriksa latest identity/versi unik/tanggal valid/isi/urutan.
- Suite release-notes:14kombinasi280–1920px×font16/32,50catatan panjang, empty, arsip Enter/Space, mark/reload/reset event, scope/anonim, storage denied, tawaran baru saat dialog lama selesai, cancelled/rejected/installed-vs-standalone, Safari flag+legacy MQL.0pageerror/overflow; axe pada375px/font32 tidak menemukan violation pada tag WCAG yang diperiksa.
- Regresi PRO-7 kalender/history/read-marker/install dan lifecycle draft/logout lulus. Tidak ada pengiriman ulang offline atau SW/cache privat baru.
- Build produksi lokal lulus. Suite Next start memeriksa catatan ketika sesi tertunda, 503 tanpa anonymous login chrome palsu, lalu anonymous/authenticated state, tujuh lebar, faviconICO/PNG/manifest dan0SW/CacheStorage/pageerror.
- Lint/typecheck lulus. Exact-head CI quality/native harus hijau sebelum merge. Bukti UI aman:[ui-result.json](ui-result.json).

Uji pemasangan OS nyata, browser/perangkat fisik dan pembaca layar belum dilakukan. Event pemasangan diotomasi sebagai simulasi browser, bukan bukti aplikasi sudah terpasang pada perangkat pengguna. UAT manusia PRO-8 tetap terbuka.

## Rilis/rollback

Cocokkan tree/head PR, merge SHA, Vercel READY/alias dan health. Smoke `/pembaruan`200 harus memuat versi terbaru pada HTML publik tanpa kredensial; ini bukan bukti login akun nyata. Tidak ada migrasi/config baru. Rollback ke deployment PR80 atau revert paket; jangan menghapus data audit/finance. Key marker existing tetap kompatibel, identitas versi berbeda hanya membuat status unread.

Jalankan `npm run test:ui:release-notes` dengan Playwright/Chromium; set RELEASE_AXE_PATH jika ingin audit axe. Suite produksi `tests/ui/pro-7-production.mjs` memerlukan build. Hindari menjalankan dua fixture port4319 bersamaan.
