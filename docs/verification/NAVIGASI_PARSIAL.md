# Navigasi parsial dengan layout bersama

Branch `fix/persistent-navigation`, berbasis `main` pada `fceeeac`.

## Temuan dan perbaikan

Sebelumnya setiap page memasang AuthenticatedWorkspace/SessionBoundary sendiri,
sehingga navigasi Next pun memasang ulang shell dan memeriksa sesi dari awal.
Sejumlah tautan antarmodul juga memakai anchor yang melakukan navigasi dokumen.

Halaman terproteksi dipindahkan ke `src/app/(workspace)` dengan layout bersama;
seluruh URL dan pageSession beserta parameter aksesnya dipertahankan. Perubahan
pada page hanya menghapus pembungkus shell lokal dan memakai state embedded.
Halaman akun menggunakan konteks sesi dari shell, tanpa pembungkus sesi kedua.

Tautan internal kini memakai Next Link dan prefetch=false. Sidebar/topbar/main,
pencarian menu, drawer, dan preferensi ciut tetap hidup saat halaman berganti.
Loading/error mengganti konten saja. Unduhan API dan tautan jangkar tetap anchor.
Tidak ada cache data bisnis atau sesi baru, perubahan database, API, maupun RBAC.

## Pemeriksaan akses

- pageSession tetap dijalankan oleh setiap halaman server, termasuk admin=true,
  business=false untuk akun, canonical host dan redirect onboarding.
- SessionBoundary yang sama tetap memeriksa sesi berkala/fokus, melakukan touch
  aktivitas, menangani maintenance, expiry, logout dan perubahan identitas.
- Halaman akun/profil/onboarding tetap dapat dibuka dengan sesi onboarding.
- Hard reload/redirect setelah perubahan kredensial atau identitas tetap berlaku.

## Verifikasi yang dijalankan

- Lint dan TypeScript lulus.
- Unit 30, crypto/adapter/API/export 24, SQL integration 325: seluruh 379 lulus.
- Production build lulus setelah mengganti cache Turbopack lokal yang tidak kompatibel.
- Suite UI existing (mode interaksi) lulus pada 4 ukuran interaksi dan 1 CRUD;
  tidak ada page/console error. Matriks seluruh halaman tidak diulang pada perubahan ini.
- Pengujian Next App Router asli memakai shell/layout produksi dan halaman probe
  sintetis: satu permintaan dokumen awal, elemen sidebar/topbar/main tetap
  tersambung setelah navigasi, hanya endpoint data tujuan diminta, pencarian dan
  ciut bertahan, halaman akun/Back bekerja, drawer ponsel menutup, dan sesi 401
  membuang pohon terproteksi lalu mengarah ke login. Tidak ada page error.

Fixture Next berjalan pada port dan direktori output unik untuk menghindari
konflik proses/lock dev. Permintaan ganda React Strict Mode di development
hanya diterima jika menuju endpoint tujuan yang sama. Fixture tidak memakai
akun, token, database atau email produksi dan bukan pengujian RBAC server Next
produksi; aturan server tidak diubah dan integrasi auth/database diuji terpisah.
Perangkat fisik, pembaca layar, dan UAT akun produksi belum diuji.

## File dan pengoperasian

- `src/app/(workspace)/**`: pemindahan halaman tanpa perubahan URL, layout/loading/error bersama.
- `src/components/shell/authenticated-workspace.tsx`: shell persisten dan konteks sesi.
- `src/features/auth/session-panel.tsx`: konsumsi konteks, tanpa shell/sesi kedua.
- `src/components/feedback/service-state.tsx`: mode embedded untuk area konten.
- Komponen shell/fitur dan halaman publik bertaut: Next Link, prefetch=false.
- `tests/navigation/**`: fixture Next serta pengujian retensi shell dan request.
- `tests/ui/navigation-stub.tsx`: tidak meneruskan prop prefetch ke anchor DOM.
- `package.json`: perintah test:navigation (browser disediakan dari environment).
- `.gitignore`, `eslint.config.mjs`, `tsconfig.json`: mengabaikan keluaran build
  fixture yang dihasilkan, tetap memeriksa source test dan aplikasi.

Jalankan `npm run check`, lalu `npm run test:navigation` dengan
UI_PLAYWRIGHT_MODULE dan UI_BROWSER_EXECUTABLE yang menunjuk instalasi browser
uji eksternal. Mode UI interaksi existing memakai UI_INTERACTIONS_ONLY=1.

## Penyempurnaan respons klik

Aturan prefetch=false pada laporan ini adalah snapshot PR #15. Penyempurnaan
berikutnya mengaktifkan partial prefetch hanya berdasarkan intent menu dan
menambahkan respons klik/loading tujuan. Lihat [Respons navigasi](RESPONS_NAVIGASI.md).
