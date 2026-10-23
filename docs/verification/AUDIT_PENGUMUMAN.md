# Audit Halaman Pengumuman

## Cakupan dan alur

Audit mencakup route admin `/admin/pengumuman` dan guard sesi, AnnouncementManager, form DataForm lama dan field bersama, RecipientPicker, Announcements di dashboard, requestJson/masterRequest, validasi/feedback, OperationsService/HTTP/endpoints, SQL visibility/dismiss/save/queue serta worker pengiriman. Hubungan frontend, API dan aturan penyimpanan dipetakan sebelum refactoring; dependensi queue/worker juga diperiksa untuk memastikan kompatibilitas.

Admin memuat seluruh pengumuman dari `manage`, memilih membuat atau mengedit berdasarkan id/version, memilih penerima dan pengecualian, lalu POST `save`. Server memeriksa sesi admin, Origin/CSRF, rate limit, schema dan versi sebelum transaksi/audit. Pembaca dashboard hanya menerima pengumuman yang sesuai status/tanggal/sasaran dan belum ditutup pada versi tersebut; `canDismiss` ditentukan server. POST `dismiss` terikat pengguna/versi dan tidak menghapus pengumuman global. Email/pengingat tetap memakai antrean dan worker yang sudah ada.

## A. Temuan

| Masalah dan penyebab | Perbaikan |
| --- | --- |
| URL tidak valid dapat mencapai `new URL()` pada refinement Zod dan melempar TypeError, bukan error validasi. | Tangani constructor URL dengan aman; input invalid menjadi penolakan validasi dan menunjukkan field URL. Aturan HTTP/HTTPS, tanpa kredensial/whitespace tetap sama. |
| Satu refinement lintas field menghasilkan error pada root, sehingga pengguna tidak tahu isian yang perlu diperbaiki. | Issue terarah untuk tanggal akhir, pasangan CTA, overlap pengecualian dan versi. Frontend menggunakan schema server dan pesan custom statis yang dipercaya. |
| Form generik membatasi judul 120/isi 1.000/URL 120, padahal schema mendukung 200/5.000/2.000. | Form Pengumuman memakai batas aktual server, tanpa mengubah default form fitur lain. |
| Pilihan pengguna berada di luar form dan tidak ikut disabled saat menyimpan; editor dapat berpindah saat request berjalan. | Satu form semantik dengan fieldset terkunci, snapshot payload, ref pending sinkron dan guard pembatalan/unmount. Seluruh tombol picker bertipe button. |
| Save diikuti await load pada satu jalur error; refresh gagal dapat terlihat seperti save gagal dan memicu pengiriman ulang. | Pisahkan acknowledgement save dari refresh. Setelah save terkonfirmasi, reset editor dan pertahankan pesan sukses meski daftar gagal dimuat. Retry hanya GET. |
| Response hanya dipercayai sebagai TypeScript type; initial fetch tidak memiliki loading/error/retry yang memadai. | Kontrak runtime manage/save/visible/dismiss/recipient, loading dan reload eksplisit, pemeriksaan id/versi acknowledgement, serta penolakan response malformed yang jelas. |
| Kehilangan response write dapat diikuti POST create ulang tanpa mengetahui hasil sebelumnya; editor versi lama juga dapat terus ditolak. | Kunci write bila hasil tidak pasti atau VERSION_CONFLICT. Bedakan pesan konflik data dari hasil tidak pasti. Pengguna memuat ulang dan memeriksa daftar; reset draft setelah read berhasil. Tidak ada replay POST otomatis. |
| Picker tidak membersihkan error lama, tidak membedakan loading/kosong, dan tidak memiliki retry; pagination tidak pulih saat total turun. | Debounce dan cancellation, loading/error/empty/retry, halaman valid, label pilihan lintas pencarian/halaman, serta batas 1.000 pilihan mengikuti schema. |
| Daftar seluruh isi tanpa filter/pagination membuat penggunaan data banyak sulit. | Filter judul/isi dan status serta pagination lokal 20 item. Endpoint dan response server tidak diubah. Halaman yang menyusut dihitung ke halaman valid. |
| Sasaran pengguna disebut mengutamakan peran meskipun SQL memakai pengguna tertentu sebagai pengganti role. | Petunjuk diperjelas sesuai business rule; hak menutup admin dan pengecualian tetap diputuskan server. |
| CTA dashboard memiliki area sentuh kecil, wrapping kata panjang terbatas dan dismiss acknowledgement tidak divalidasi. | Minimum target 44px, wrapping aman, kontrak URL/versi/canDismiss dan acknowledgement aktual `{}`, serta AbortSignal pada write. |

## B. Kompatibilitas dan UI/UX

AnnouncementManager dipisah ke file khusus lalu diekspor ulang dari modul lama; tidak ada implementasi duplikat. OperationsManager dan default DataForm fitur lain tidak diubah. Field/form dan feedback yang sudah ada dipakai kembali. Opsi pesan custom pada validator bersama default-nya false sehingga pemakai lama tetap berperilaku sama.

Form tetap inline seperti sebelumnya. Informasi inti menggunakan grid responsif, pilihan penerima diringkas dalam details yang dapat dibuka lewat keyboard/touch, tombol mudah disentuh, teks panjang membungkus, serta empty/loading/error/success state eksplisit. Tidak ada tabel/modal pada halaman ini yang perlu dipertahankan atau diganti. Scroll vertikal normal untuk konten panjang tetap tersedia; tidak ada clipping atau penyembunyian konten demi menghilangkan overflow.

Judul/isi tetap teks biasa, termasuk markup yang ditampilkan literal. Role, sasaran khusus, tanggal inklusif WIB, status aktif, dismiss per pengguna/versi, pengecualian, prioritas, CTA, email/pengingat H-3/H-2/H-1, audit, optimistic version, CSRF/Origin, rate limit, queue/lease dan larangan retry email ambigu dipertahankan. Tidak ada migrasi atau penulisan database/email produksi.

## C. Kode final

- `src/features/operations/announcement-manager.tsx`: editor dan daftar admin.
- `src/features/operations/managers.tsx`: ekspor kompatibel AnnouncementManager, OperationsManager dipertahankan.
- `src/features/operations/recipient-picker.tsx`: lookup, pilihan lintas halaman, retry/loading dan penguncian.
- `src/features/operations/announcements.tsx`: pembaca dashboard dan dismiss.
- `src/lib/operations/announcement-contracts.ts`, `src/lib/operations/schemas.ts`: kontrak runtime dan validasi yang aman.
- `src/lib/accounts/client-validation.ts`, `src/lib/feedback/catalog.ts`: pesan field yang jelas tanpa mengubah default pemakai lama.
- `tests/ui/announcements.mjs`, `tests/unit/announcement-contracts.test.ts`, `tests/integration/operations.test.ts`, `tests/ui/dashboard.mjs`: pengujian yang dapat dijalankan ulang.

## D. Validasi

- Lint, TypeScript, production build dan diff check.
- 79 unit + 29 crypto/HTTP + 329 integrasi database: total 437 lulus. Run awal memiliki subtest keuangan F20 rate-limit gagal (beserta parent suite); pengujian ulang terpisah lulus 25/25, lalu suite database penuh terakhir lulus 329/329. Status CI GitHub dan preview deployment mengikuti pemeriksaan pada PR.
- Browser khusus: tujuh lebar 280, 320, 375, 768, 1024, 1440, 1920 × teks 100%/200% (14 kombinasi), dengan picker terbuka dan nama panjang. Pemeriksaan halaman/form tidak melebar keluar viewport.
- Create/edit/cancel/nonaktif, konten 200/5.000/2.000, validasi URL/tanggal/CTA/overlap, penerima lintas pencarian/pagination/retry, lock serentak dan burst submit, email/reminder payload, success+refresh failure, VERSION_CONFLICT, response malformed/koneksi putus, recovery tanpa replay, daftar 45/kosong/filter/pagination menyusut, resize/orientasi, touch details, dashboard canDismiss/CTA 44px/double dismiss.
- Regresi dashboard: 12 kombinasi role/viewport serta alur disclosure, data banyak, retry, pergantian tanggal WIB dan dismiss.
- Regresi UI umum: 252 kombinasi, empat ukuran interaksi dan CRUD; nol page/console error.
- Screenshot desktop dan mobile ditinjau. Fixtures sintetis dan database disposable; perangkat fisik, pembaca layar dan pengiriman SMTP produksi belum diuji.
