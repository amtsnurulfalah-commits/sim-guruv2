# Pedoman antarmuka SiM-Guru

Gunakan komponen source-owned di `src/components/ui` dan token di `src/app/globals.css`. Identitas memakai hijau pinus, permukaan putih, latar abu dingin, teks gelap, radius 8–20px dan spacing 4/8/12/16/24/32px. Gunakan semantic primary/muted/accent/destructive, bukan warna fitur tersendiri. Tipografi menggunakan font sistem tanpa unduhan font eksternal.

## Layout dan navigasi

Workspace menyediakan sidebar sticky desktop (dapat diciutkan dan preferensinya tersimpan), drawer modal mobile, topbar, breadcrumb, konten maksimum1440px dan footer. Konten memakai `min-width:0`; tabel lebar harus berada dalam `overflow-x-auto` dengan label yang menjelaskan tabelnya. Navigasi aktif memakai path terpanjang yang cocok untuk subhalaman. Sidebar hanya menampilkan modul dari role/scope sesi yang sudah ada; ini tidak menggantikan pemeriksaan server.

Susun halaman: breadcrumb → judul/deskripsi → aksi utama → filter/search → isi → informasi tambahan. Jaga satu h1. Target sentuh minimal44px dan fokus keyboard terlihat. Gunakan `control`, `primaryAction`, `secondaryAction`, `surface` dari ui/styles untuk komponen fitur lama; Button/Card untuk komposisi baru. Hindari menambahkan tinggi/warna tombol yang bertentangan.

## FormDialog dan DataForm

FormDialog mengikuti pola source komponen shadcn dengan Radix Dialog. Radix menjaga focus trap, portal, inert background dan pemulihan fokus. Body scroll internal; header/footer tetap terlihat. Layar kecil menggunakan hampir seluruh layar, desktop terpusat. Escape/klik backdrop mengikuti guard yang sama dengan Batal; busy mencegah tutup. Perubahan belum tersimpan membutuhkan keputusan eksplisit, fokus ditahan dalam pilihan konfirmasi. `onDiscard` dipakai editor controlled untuk mereset draft lokal.

DataForm menyediakan label/required, native constraint+Zod lokal dan penerusan validasi server; checkbox multi/hari tetap menghasilkan array yang sama. Ref pending mencegah dua submit sebelum render berikutnya. Setelah berhasil, modal ditutup dan data terkait diperbarui oleh handler fitur, tanpa full page reload. Handler `onSave` HARUS reject ketika gagal. `formRun` pada ujian/acara/finance meneruskan error; jalur tombol biasa mempertahankan feedback yang sudah ada. Jangan menangkap error lalu menganggap form berhasil.

`openOnMount` untuk editor yang diberi key entity; `onDismiss` membersihkan pemilihan edit. FormDialog `revealKey` harus berubah pada setiap perintah edit, termasuk entity yang sama. Gunakan `success/error/busy` untuk form controlled dengan konfirmasi hasil; jangan menganggap tutup modal sebagai bukti keberhasilan database.

Untuk dialog native yang sudah ada, gunakan ManagedDialog; penutupan yang diminta pengguna harus memakai `requestDialogClose`. Penutupan setelah simpan sukses boleh `.close()`. Guard tidak boleh menonaktifkan preview dampak, CAS/version, final lock, alasan audit atau otorisasi.

## Feedback dan aksesibilitas

ToastRegion menerima pesan sukses singkat melalui `notifySuccess`; pesan tidak boleh berisi password/OTP/token, URL privat atau rincian keuangan pribadi. Error tetap di form agar dapat diperbaiki tanpa kehilangan isian. Gunakan FeatureState untuk loading/error dengan retry, EmptyState untuk daftar kosong, aria-live/role status untuk hasil dan role alert untuk kegagalan. Jangan menyampaikan status hanya melalui warna. Semua gambar dekoratif/ikon diberi aria-hidden, kontrol ikon diberi nama.

Gunakan reduced-motion. Pertahankan `lang=id`, skip link dan target `konten-utama`. Autocomplete username/current-password/new-password tetap sesuai. Jangan mencegah paste password atau menyimpan faktor autentikasi ke localStorage. Perubahan UI tidak mengubah sesi, CSRF, Origin, RBAC atau validasi server.

## Pengujian

`npm run check` memeriksa lint, typecheck, unit, crypto, integrasi dan production build. Fikstur `tests/ui/server.ts` hanya di localhost dengan PostgreSQL WASM disposable; tidak memakai production URL, akun nyata atau email. Server fixture menguji rendering/payload UI terhadap service yang sudah ada, bukan pengganti pengujian middleware HTTP atau autentikasi produksi. Jalankan browser uji melalui `tests/ui/verify.mjs` dengan Playwright/Chromium eksternal (`UI_PLAYWRIGHT_MODULE`, `UI_BROWSER_EXECUTABLE`, opsional `UI_BROWSER_ARGS`, `UI_REPORT_DIR`). Binary browser bukan dependensi aplikasi.

Viewport matriks:320,375,767,768,1024,1440px; periksa overflow halaman, error JS, role guru/admin, dialog, dirty close, gagal simpan, pemulihan fokus dan navigasi. Bukti UAT perangkat nyata/pembaca layar tetap dicatat terpisah dari hasil browser otomatis. Jangan menyebut sertifikasi WCAG penuh hanya berdasarkan hasil otomatis.

## Master Design System — adaptasi UI UX Pro Max

Pedoman ini tetap menjadi satu sumber keputusan desain SiM-Guru. Tidak dibuat design system paralel atau disalin seluruh library referensi. Adaptasi memakai referensi `nextlevelbuilder/ui-ux-pro-max-skill` commit `56ea9cf174ed86786187daa9de0e6247cb0747e4`; hasil generator/pencarian asli disimpan di `references/pro-max-research.json`, disertai lisensi MIT sumber.

### Arah dan penalaran

Profil: administrasi pendidikan untuk guru/admin, data padat, tugas harian dan transaksi yang perlu ketelitian. Arah visual: Modern Enterprise SaaS Dashboard, gaya Minimalism & Swiss Style. Generator dijalankan dengan variance 3, motion 2, density 8. Pencarian awal `education administration dashboard` tidak mendapat identitas product/reasoning yang cocok (General + LMS); hasil tersebut tidak dijadikan master. Pencarian ulang `enterprise saas dashboard` menghasilkan product/reasoning `SaaS (General)`, style `minimalism-and-swiss-style`, tipografi `Enterprise SaaS Mobile (Plus Jakarta Sans)` dan dense spacing 2–32px. Ini kecocokan kelas produk SaaS, bukan profil khusus SIM sekolah.

| Hasil referensi | Keputusan SiM-Guru | Alasan |
|---|---|---|
| Minimalism & Swiss Style, density 8 | Diterapkan pada hierarki metrik, sidebar tenang, tabel kompak, spacing yang konsisten | Membantu pemindaian data tanpa mengecilkan target sentuh |
| Palet SaaS biru/oranye; hasil awal LMS teal | Identitas hijau pinus tetap dipakai | Tidak ada bukti warna baru lebih baik; kontras identitas lama sudah terukur |
| Plus Jakarta Sans | Prinsip sans-serif mudah dibaca diterapkan melalui font sistem existing | Tanpa unduhan font atau dependensi eksternal baru; metrik tabular untuk angka |
| Hero + Features + CTA | Hanya relevan pada beranda publik existing | Tidak dipaksakan ke dashboard/form administrasi |
| GSAP scroll reveal; if_data_heavy glassmorphism | Tidak diterapkan | Bukan kebutuhan operasional; permukaan opak dan CSS feedback sederhana lebih sesuai |
| Icon library Phosphor/Heroicons | Lucide existing dipertahankan | Satu keluarga ikon, tidak menambah library; semantik aria dari dataset tetap diterapkan |
| Waffle/gauge untuk progres | Native progress + angka pembilang/penyebut | Data hanya satu rasio, ruang sempit dan nilai eksak lebih penting; tanpa grafik atau KPI rekaan |

### Token dan perilaku

Primary `#126656`, accent `#e7f3ee`, foreground `#172c36`, surface putih dan latar `#f4f7f9` tetap. Input menjadi `#7d909c` agar batas kontrol mencapai ≥3:1 pada card/background. Feedback memakai `success-surface/success-border` dan `error-surface/error-border`, dipasangkan dengan foreground semantik. Sidebar `surface-sidebar` dan hover `surface-hover` menambah kedalaman tanpa kaca dekoratif.

Motion fast 160ms, standard 220ms, easing `cubic-bezier(0.2,0,0,1)`; feedback press mengubah brightness, tidak memindahkan layout. Modal memakai fade tanpa transform agar posisi terpusat Radix tidak ditimpa animasi. Reduced motion tetap menonaktifkan gerak non-esensial. Heading memakai text balance; body line-height 1.6; metrik memakai tabular numerals. Gutters 16px mobile / 32px tablet / 40px desktop, content maksimal 1440px. Kepadatan konten tidak menurunkan kontrol di bawah 44 CSS px.

### Komponen dan pola baru

- **TableRegion**: satu wrapper bernama untuk tabel master, pengguna, kalender, jadwal, ujian, dan tiga tabel honorarium. ResizeObserver mendeteksi overflow; hanya ketika overflow, region masuk urutan Tab dan menampilkan petunjuk gulir. Tabel tetap HTML table; tidak diganti grid ARIA. Fokus/keyboard, scrollbar native, sticky header dan area maksimal 42rem; print menghapus batas tinggi dan sticky. Tidak menyembunyikan kolom/data.
- **MetricCard**: judul ringkas, ikon dekoratif, nilai utama dan konteks/tautan. Dipakai untuk kehadiran, honor berjalan, dan kegiatan tercatat; server tetap sumber nilai. Progres menampilkan jumlah terkonfirmasi/total dan native progress bernama; 0 tugas tidak ditampilkan sebagai pencapaian 100%.
- **FormFeedback**: ringkasan gagal di awal form dan fokus setelah submit gagal. Tiap issue lokal mempunyai tautan ke field, aria-invalid, pesan inline, dan aria-describedby. Native validation tetap berlaku; pesan lokal tidak menggantikan aturan server. Error backend umum tetap ringkasan karena kontrak existing tidak menyediakan pemetaan field rinci.
- **PasswordInput**: tombol tampil/sembunyi dengan nama, aria-pressed dan aria-controls. Nilai tetap di elemen input; autocomplete, paste, FormData dan pengosongan password setelah upaya login tetap mengikuti alur existing. Tidak menyimpan kata sandi ke state/storage. Field akun memakai label eksplisit dengan htmlFor/id, terpisah dari wrapper input dan tombol.
- **Pencarian menu**: filter lokal atas modul yang sudah lolos modulesFor(role). Mencari judul/grup, hasil kosong dan reset jelas. Bukan pencarian data global. Collapse membersihkan query agar ikon modul tidak menghilang tanpa kontrol pencarian. Input bukan bukti otorisasi; server tetap memeriksa akses.

### Override sesuai konteks

Login/aktivasi/pemulihan tetap AuthLayout; password visibility diterapkan pada form autentikasi dan lifecycle akun. Dashboard menonjolkan ringkasan tugas dan nominal berjalan; kartu akun/pemulihan ditempatkan berdampingan pada desktop. Data manager menjaga filter dan pagination existing. Modal DataForm/FormDialog tetap untuk input kontekstual; kalender, pemilihan penerima, operasi honorarium, dan migrasi kompleks tidak dipaksa menjadi modal.

Topbar tidak sticky pada layar ≤767px agar tidak menutup ruang kerja pendek/lanskap. Desktop menjaga topbar dan scroll-padding fokus. Drawer tetap dialog native. Footer modal memperhitungkan safe-area bawah. Breadcrumb anak memiliki target minimum 44px. Forced colors mempertahankan outline fokus dan penanda navigasi aktif. Mode gelap tidak ditambahkan karena belum menjadi desain aplikasi yang diverifikasi.

### Quality gates adaptasi

Jalankan `npm run check`, matriks browser dan skenario Pro Max dalam `tests/ui/verify.mjs`: password visibility, pencarian sesuai role, ringkasan error/fokus/tautan field, keyboard scroll tabel, lanskap/reduced motion, pembesaran teks 200%, dan drawer melalui pointer sentuh emulasi. Bedakan hasil emulasi dari perangkat fisik serta pembaca layar. Panduan dataset Next 16.2/React 19.2 dipakai hanya pada pola yang sesuai stack aktual Next 16.4.2/React 19.3.1.
