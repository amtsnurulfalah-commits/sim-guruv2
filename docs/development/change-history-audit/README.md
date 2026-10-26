# Audit Riwayat Perubahan dan favicon

Baseline: main PR78 `e41efe6b4d84850f1fe1d35ac8ddedcead6875b3`. Instruksi pengelola: audit menyeluruh, refactor kompatibel, perbaiki favicon sebelum merge, lalu merge ke main.

## Alur yang diperiksa sebelum perubahan

`pageSession('/riwayat-perubahan')` → `PersonalWorkspace` → `useReadResource`/`masterRequest` → GET `/api/personal/history` → cookie/business guard/origin → `PersonalService` → `app.personal_history`. SQL membaca audit master/aktivitas existing, maksimal100 dari101 penanda truncated, rentang31hari WIB, admin allowlist/guru scope sendiri atau penugasan terkait; alasan pihak lain disamarkan. Tidak ada CRUD audit pada halaman ini.

Komponen shared kalender/export, guard sesi, parseDTO, polling/focus/online/abort cleanup, PageHeader/Button/FeatureState/ErrorFeedback, token CSS, metadata/root icon/manifest dan pengujian existing diperiksa. Tidak ada modal/dropdown khusus selain select native; referensi audit kini disclosure native `details`.

## Temuan dan tindakan

| Temuan / penyebab | Perbaikan |
| --- | --- |
| Default riwayat memakai rentang kalender: hari ini sampai6hari mendatang. Catatan lampau tidak terlihat secara default. | Riwayat hari ini dan6hari sebelumnya; kalender tetap melihat ke depan. Boundary2000–2199 dijaga. |
| History DTO hanya valid secara bentuk, tidak dicocokkan ke rentang WIB yang diminta; ID duplikat diterima menjadi React keys kembar. | Parser shared history-specific memeriksa tanggal WIB dan ID unik di server/client; hasil salah fail closed. Urutan timestamp terbaru, stable sort mempertahankan urutan sumber untuk tie/submillisecond. |
| Akses `rows[0]!.value` dapat menjadi TypeError500 bila query tidak mengembalikan row. | Nilai kosong masuk validasi DTO dan menghasilkan INVALID_RESPONSE502 terkontrol. |
| Alasan null selalu disebut disembunyikan, termasuk ketika tidak tersedia. Judul journal/schedule selalu “diperbarui” meskipun jenis audit tidak membedakan create/delete. | Salinan alasan dibedakan untuk admin/guru; label jadwal/jurnal netral tanpa mengarang operasi atau before/after. |
| Sampai100kartu sekaligus, UUID selalu dominan, tidak ada pencarian/filter/pagination lokal atau jumlah hasil. | Komponen HistoryList satu sumber,10kartu/halaman, pencarian/jenis pada snapshot yang diizinkan, reset/clamp page, jumlah hasil dan waktu pembaruan; UUID pada details. Truncation100 dijelaskan agar pagination tidak disangka mengakses seluruh audit. |
| Favicon SVG tersedia200, tetapi fallbackICO tidak ada untuk klien yang tidak memakai SVG/metadata. | ICO16/32/48 dari SVG buku existing via sharp+Pillow; Next file-convention `src/app/favicon.ico` dan shortcut metadata. SVG/manifest/Apple icon tetap tersedia. |

Tidak ada migrasi SQL, perubahan izin, raw before/after, finance, penugasan, sesi atau config/secret baru. Cakupan kategori audit dijelaskan, bukan klaim seluruh audit sistem. File ICO bukan identitas/logo baru.

## Validasi aktual

- 173 unit dan46 crypto/HTTP lulus, termasuk WIB00:00/24:00, rentang lampau/boundary, ID duplikat, sort dan missing/out-of-range upstream502.
- 407 integrasi existing lulus lokal. CI native PostgreSQL/role isolation/concurrency dan read model wajib hijau pada exact head sebelum merge.
- UI baru: 2peran×7lebar280–1920×font16/32 =28kasus, tanpa overflow horizontal/pageerror. Mencakup100catatan, search/jenis, pagination reset, tanggal draft/applied, validasi+focus, redaksi, empty, malformed/retry, race/abort, detail dan teksHTML escaped. Axe4.14 untuk guru/admin pada375px/font32:0violation pada cakupan diuji. Pembaca layar/perangkat fisik belum dibuktikan.
- Regresi kalender/release PRO-7 tujuh lebar lulus setelah perubahan shared parser/default. Build produksi lokal lulus; favicon ICO200, header valid3resolusi dan link rel=icon pada head diverifikasi sebelum PR/merge; PNG192/512/manifest dan sesi public notes tetap lulus.
- Lint/typecheck lulus; build lokal memakai cache bersih. Tidak membaca jurnal/slip/email produksi atau menjalankan write produksi.

## Rilis dan rollback

Merge hanya setelah exact-head quality/native hijau, cocokkan tree merge dan deployment SHA/READY/alias. Sesudah rilis, periksa favicon200/MIME dan health; API history anonim tetap401. Status aktual mengikuti PR/Actions/Vercel. Rollback aplikasi ke PR78 atau revert paket; tidak ada DDL/data yang perlu dibatalkan.

Bukti UI aman: [ui-result.json](ui-result.json). Jalankan ulang `npm run test:ui:history` dengan Playwright/Chromium tersedia; tambahkan `HISTORY_AXE_PATH` untuk axe. Paket tidak menutup UAT manusia PRO-8 yang masih terbuka.
