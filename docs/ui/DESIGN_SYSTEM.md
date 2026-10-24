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

## Bahasa tindakan dan batas bagian

Teks antarmuka menjelaskan pekerjaan pengguna; nomor tahap, status implementasi,
serta catatan integrasi berada di dokumentasi pengembangan. `/kesiapan` tetap
kompatibel sebagai URL lama, dengan isi **Panduan aplikasi** dan tautan pemulihan
ke `/lupa-password`. Panduan publik tidak menyatakan kesehatan layanan secara langsung.

Bedakan pembuka formulir, pembuatan pratinjau, dan perubahan final. `DataForm`
menggunakan `label` untuk pembuka/judul dan `submitLabel` untuk tombol pengiriman;
nilai bawaan tetap `label` agar pemanggil lama kompatibel. Contoh: **Tambah acara**
→ **Simpan acara**, **Tinjau finalisasi honorarium** → **Buat pratinjau finalisasi**.
Tombol konfirmasi pengguna mengikuti tindakan sebenarnya (arsip/nonaktif/aktivasi),
bukan “Ya, lanjutkan”. Status antrean tidak boleh dinyatakan sebagai email diterima.

Gunakan `surface`/`.ui-panel` yang sudah ada untuk bagian fitur. Judul langsung
`h2`/`h3` memiliki garis bawah; panel dengan `h2` memiliki aksen batas atas. Bagian
khusus pada master, jadwal, serah terima akun, panduan, dan modul dashboard memakai
`.page-section` dengan batas yang sama. Pertahankan jarak antarbagian dan hindari
menambah panel di setiap baris tabel. Informasi aturan panjang yang tidak selalu
diperlukan dapat memakai `<details>` native dengan ringkasan yang jelas.

Keberhasilan memakai `role="status"`, kegagalan memakai `role="alert"`. Peringatan
finalisasi honorarium, pembalikan JTM, perubahan kalender, dan pengiriman email
harus dipertahankan karena menjelaskan akibat tindakan.

## Tombol dan ikon tindakan

Tombol selalu memiliki label berbahasa Indonesia yang menjelaskan tindakan.
Gunakan `ActionIcon` dengan `action` eksplisit bersama `Button` atau token
`ui-action`; jangan menebak ikon dari teks saat runtime. Ikon dekoratif memiliki
`aria-hidden`, tidak dapat menerima fokus, dan tidak mengecil ketika label membungkus.
Tombol `asChild` menempatkan ikon di dalam tautan agar kontrak Radix Slot tetap valid.

Gunakan tambah untuk pembuka pembuatan data, simpan untuk penyimpanan, pratinjau
untuk pemeriksaan dampak, arsip untuk pengarsipan, dan hentikan untuk penghentian
jadwal. Tombol konfirmasi dinamis harus memilih ikon sesuai tindakan yang dipilih.
Tautan ekspor memakai gaya tombol sekunder dan ikon unduh. Tautan navigasi di
paragraf tetap berupa tautan; tidak semua teks tautan harus menjadi tombol.
Target sentuh minimal 44px, focus ring, disabled state, serta reduced motion
mengikuti token yang sudah ada. Hindari animasi dekoratif dan tombol tanpa label
kecuali kontrol ikon yang sudah memiliki nama aksesibel, seperti tutup dialog.

## Susunan Dashboard dan konteks harian

Dashboard menempatkan kartu keamanan akun tepat di atas Konteks hari ini,
diikuti ringkasan kegiatan. Daftar kartu Modul ruang kerja dihapus dari
Dashboard; navigasi sidebar dan katalog pada Panduan aplikasi tetap tersedia.

Konteks hari ini mempertahankan ringkasan tanggal, hari libur, KBM, dan ujian.
Rincian memakai accordion satu bagian berbasis `details`/`summary` native,
tertutup saat pertama tampil. Keyboard Enter/Spasi mengubah keadaan; ikon panah
dekoratif mengikuti keadaan buka dan menghormati reduced motion. Rincian berisi
catatan kalender, semester dan rentang tanggal, pengaturan khusus, status kegiatan,
dan alasan status dari respons API yang sudah ada. Kode versi internal tidak ditampilkan.
Saat muat ulang, data lama dibersihkan, status loading ditampilkan, dan tombol
retry dinonaktifkan selama permintaan berjalan.

## Tabulasi akun dan profil

Gunakan `Tabs` source-owned dengan empat tab Ubah Profil, Ganti Kata Sandi,
Verifikasi Email, dan Pertanyaan Keamanan. Desktop menampilkan empat kolom;
layar kecil dua kolom dengan label tetap terlihat dan target sentuh minimal 48px.
Setiap tab mempunyai ikon dekoratif, status aktif, focus ring, dan hubungan
`tab`/`tabpanel` melalui `aria-controls` dan `aria-labelledby`.

Navigasi memakai roving tabIndex; panah kiri/kanan, Home, dan End memindahkan
fokus serta panel aktif. Satu panel saja terlihat dan dapat dijangkau keyboard.
Panel lain tetap mounted agar draf dan challenge OTP tidak hilang saat berpindah
tab. Tidak menyimpan draf, kata sandi, jawaban, atau kode ke storage browser/URL.

Form profil dan kata sandi memakai `ActionForm inline`; pemanggil lama tanpa
prop inline mempertahankan modal dan dirty guard yang sudah ada. Validasi native,
server, konfirmasi kata sandi, CAS versi profil, CSRF, pengakhiran sesi, dan
verifikasi email tetap mengikuti handler existing. Tab awal akun bisnis adalah
Ubah Profil; onboarding memakai Ganti Kata Sandi. Aksi Selesaikan dan lanjutkan
berada di luar panel agar selalu tersedia dan tetap divalidasi server.

## Accordion jadwal mengajar

Kartu Jadwal pribadi pada tanggal memakai details/summary native; judul kartu
menjadi pemicu dan isi menampung tanggal, konteks hari, daftar jadwal, serta
keterangan. Filter jadwal mingguan memakai accordion terpisah untuk pencarian,
hari, status, rentang berlaku, dan filter relasi khusus administrator.

Keduanya tertutup saat awal. Ringkasan hasil, tabel, pagination, tombol cetak,
muat ulang, dan tambah jadwal tetap di luar accordion filter. Menutup accordion
tidak mereset tanggal atau filter dan tidak mengubah query API. Enter/Spasi,
focus ring, target minimum 48px, ikon panah dekoratif, dan reduced motion
mengikuti pola accordion native yang sudah digunakan Dashboard.

## Navigasi antarmodul tanpa memasang ulang shell

Halaman terproteksi berada di route group `src/app/(workspace)` dengan layout
bersama. URL publik tetap sama; API dan halaman login/aktivasi/pemulihan tetap
pada root. AuthenticatedWorkspace dan SessionBoundary dipasang oleh layout,
bukan oleh setiap page. SessionPanel memakai konteks sesi dari layout tersebut.

Sidebar, topbar, drawer, preferensi ciut, pencarian menu dan pemantau sesi tetap
terpasang ketika konten tujuan berubah. Loading/error di group atau page hanya
mengganti konten utama; gunakan PageSkeleton/ServiceState dengan prop embedded
agar tidak membuat main dan id konten-utama ganda.

Tautan internal memakai next/link. Prefetch menu dimatikan saat awal dan
diaktifkan secara parsial hanya pada menu yang diarahkan pointer, difokuskan
keyboard, atau disentuh pengguna. Rincian perilaku respons klik ada di bawah. Tautan unduhan API dan jangkar field tetap native.
Perpindahan halaman tetap menjalankan pageSession pada server tujuan. Poll sesi,
activity touch, pemeriksaan business/onboarding, maintenance, broadcast logout,
expiry, dan hard redirect pada pergantian identitas tetap dipertahankan.

## Respons klik menu dan loading tujuan

Klik menu menampilkan judul serta kerangka tujuan segera melalui transisi router.
Konten lama tetap mounted tetapi hidden selama transisi, lalu diganti konten
tujuan yang sudah lolos pemeriksaan akses. Gunakan Next Link onNavigate agar
Ctrl/Meta/klik tengah tetap mengikuti perilaku browser. Transisi menentukan akhir
loading; jangan menggunakan timer untuk menyamarkan durasi atau menandai sukses.
Klik terbaru menjadi tujuan yang berlaku; klik menu aktif tidak meminta ulang
halaman dan tetap menutup drawer seluler.

Setiap page terproteksi mempunyai loading boundary yang mengekspor RouteLoading.
RouteLoading menampilkan judul sesuai URL; NavigationLoading menyediakan UI
kerangka yang sama untuk respons klik. Ikon loading dekoratif menghormati
reduced motion dan pesan status diumumkan kepada pembaca layar.

Menu hanya memakai prefetch=auto setelah intent; route dinamis disiapkan sampai
loading boundary. Tidak memakai prefetch=true untuk data seluruh menu. PageSession
dan otorisasi server tujuan tidak dilewati, dan tidak ada cache bisnis baru.

### Tab Jurnal Pembelajaran

Halaman jurnal memakai komponen `Tabs` bersama dengan tiga panel Input, Riwayat/Detail, serta Kebijakan/Pemblokiran. Susunan satu kolom pada ponsel dan tiga kolom mulai `md` menjaga label lengkap terbaca. Accordion filter terletak sebelum tab agar konteks tanggal dan rentang berlaku bersama. Panel tetap mounted untuk mempertahankan isian; editor yang dibuka dari riwayat memilih tab Input terlebih dahulu. Kontrol kebijakan hanya tersedia bagi administrator, sedangkan guru melihat informasi kebijakan. Paginasi dan alasan penghapusan ditempatkan dalam Riwayat. Detail verifikasi: `docs/verification/TABULASI_JURNAL.md`.

### Feedback error yang dapat ditindaklanjuti

Gunakan `ErrorFeedback` untuk ringkasan penolakan, gangguan, atau gagal memuat data. Pesan harus menjelaskan penyebab yang diketahui dan langkah perbaikan; sertakan referensi bantuan bila server memberikannya. Gunakan `FormFeedback` dengan tautan kolom pada DataForm. Jangan menghapus isian setelah penolakan, menampilkan error internal mentah, atau mengirim ulang perubahan secara otomatis saat koneksi putus. Pesan berhasil tetap memakai role status, terpisah dari role alert. Untuk formulir bernama, gunakan detail server untuk menandai dan memfokuskan kolom yang salah. Detail implementasi dan verifikasi: `docs/verification/FEEDBACK_KESALAHAN.md`.

## Fondasi Tahap 1 (24 Oktober 2026)

- `Button` memakai `ui-action` bersama tombol form; varian default/outline memakai token primary/secondary yang sama. Ukuran besar memakai min-height agar label multiline tidak terpotong.
- `StatusBadge({ label, tone })`: tone neutral/success/warning/error, label eksplisit wajib; jangan mengganti status domain/API. Warna selalu dilengkapi teks.
- `Pagination({ page, pageSize, total, onPageChange, disabled, label })`: tombol previous/next, status halaman/jumlah, wrapping mobile. Pemakai harus memberikan integer page/pageSize positif dan total tervalidasi; server/pemakai mengoreksi halaman di luar hasil. Pilot ScheduleManager.
- `useUrlFilters(defaults, rules)`: allowlist per layar, default/rules stabil, validasi schema existing. Pilihan eksplisit push, clamp replace. Data sensitif/free-text/draft tetap lokal. Pilot jadwal memulihkan hari/status/rentang/halaman saja; petunjuk cakupan tampil pada filter. Lihat [paket Tahap 1](../development/stage-1/README.md).
- `DataForm` memvalidasi array kosong pada pilihan wajib days/multi; tautan ringkasan error memfokuskan grup. Tetap gunakan pending guard dan onSave yang reject saat gagal.
- Gangguan body respons API dinormalisasi seperti headers; write tidak diulang otomatis, pembatalan disengaja tetap dibedakan.
