# Audit Sidebar, Navbar, dan Footer

## Pemetaan alur sebelum perubahan

Dibaca: Workspace, Breadcrumbs, NavigationLoading, Brand/Button, registri modulesFor/canViewModule, AuthenticatedWorkspace/PublicWorkspace/GuideWorkspace, SessionBoundary, styling global dialog/responsif/print, header/footer Beranda dan AuthLayout, endpoint/kontrak capabilities laporan, fixture UI dan fixture Next navigation.

- SessionBoundary mengelola verifikasi sesi, heartbeat, expiry, konfirmasi logout, dan pembersihan draft. Workspace menerima sesi terverifikasi dan callback logout; tidak membuat autentikasi alternatif.
- Menu inti mengikuti status sesi/scope; modul berasal dari registri kanonis dan role. Guru memeriksa kemampuan laporan melalui GET /api/reports/read?kind=capabilities.
- Pencarian menu dan preferensi collapse adalah state tampilan. Hanya preferensi layout disimpan ke localStorage; kegagalan storage diabaikan dengan aman.
- Next Link/onNavigate/useTransition memberi feedback tujuan segera dan navigasi tanpa reload shell; usePathname menentukan active state dan breadcrumb.
- Drawer native dialog memiliki inertness/focus trap/Escape bawaan. CSS global sudah mengunci scroll body saat dialog terbuka, sehingga tidak ditambahkan lock/listener kedua.
- Sidebar desktop menggulir sendiri; konten dokumen tetap dapat menggulir secara alami. Beranda publik dan layout autentikasi memiliki header/footer khusus yang sudah responsif, dan tidak dirombak.

## Temuan dan perbaikan

1. **Jumlah hasil pencarian tidak mencakup menu inti/Panduan.** Data menu inti kini digunakan bersama untuk render dan hitungan, sehingga pencarian Dashboard/Panduan tidak lagi melaporkan nol hasil saat tautannya ada.
2. **Hasil pencarian tersembunyi di kelompok yang ditutup.** Kelompok hasil dibuat terbuka saat query berubah; pencarian tidak memindahkan fokus dari input. Label, ikon, kelompok, URL dan handler tetap sama.
3. **Drawer memakai pengurangan tinggi header konstan.** Header dapat lebih tinggi pada teks 200%. Drawer kini flex column dengan tinggi viewport dinamis dan body min-height0 yang menggulir pada sisa ruang.
4. **Ruang drawer terlalu sempit pada280px/teks200%.** Header dapat menghabiskan sebagian besar tinggi dan label tautan lebih tinggi dari body. Drawer memakai sampai22rem, atau lebar viewport penuh jika diperlukan. Pengujian membuktikan tautan Panduan terakhir dapat digulir hingga terlihat penuh.
5. **Fokus setelah penutupan dapat ditarik kembali ke trigger saat navigasi.** Satu close-event handler memulihkan fokus sesuai sebab: trigger untuk tutup/Escape/backdrop, konten untuk navigasi/resize. Aria-expanded mengikuti dialog; perubahan pathname juga menutup drawer. Tekan-lepas di backdrop menutup; drag dari konten menuju backdrop tidak menutup secara tidak sengaja.
6. **Hasil capabilities lama bisa dipakai setelah route berubah atau respons gagal/malformed.** Hasil ditandai account/path/retry, divalidasi dengan capabilitiesSchema yang ada, dan callback lama dibatalkan. Link laporan tidak ditampilkan sampai pemeriksaan baru berhasil. Kegagalan mendapatkan feedback dan tombol Periksa izin laporan; penolakan valid tetap bukan error. Breadcrumb memakai kemampuan laporan yang sama, termasuk guru yang diberi akses.
7. **Footer halaman pendek berhenti setelah konten.** Kolom shell kini flex dengan tinggi minimum viewport, main mengambil sisa ruang dan footer berada di akhir. Footer tetap dalam normal flow dan tidak menutupi konten panjang.
8. **Identitas navbar terpotong satu baris; target logo sidebar di bawah44px.** Nama dapat menempati dua baris dengan title lengkap; logo memiliki target minimal44px. Label/ikon dan penekanan menu aktif tetap jelas. Chevron kelompok mengikuti keadaan terbuka/tertutup.

Tidak ada perubahan schema/API, fungsi bisnis, role/izin server, penugasan, atau lifecycle sesi. Penyaringan menu bukan pengganti otorisasi backend. Tidak ada dependency aplikasi atau CSS global baru.

## Validasi

- `npm run test:ui:shell`:56 kombinasi admin/guru/onboarding/anonim ×7 viewport280–1920px termasuk landscape × teks100/200%. Memakai build produksi Next.js dan sesi/data sintetis.
- Geometri dokumen/navbar/footer/drawer, tautan terakhir, hitungan dan kelompok pencarian, peran/onboarding, collapse dan reload, storage diblokir, Escape/backdrop/drag, focus trap/restore, breakpoint/path cleanup, touch.
- Laporan: grant valid,503, DTO malformed, deny, retry, delayed response lama, dan breadcrumb guru berizin. Tidak ada permintaan logout atau mutasi bisnis dalam suite shell.
- Fixture capabilities Panduan/404 disesuaikan agar memuat admin boolean sesuai kontrak server; malformed tetap diuji secara sengaja dalam suite shell.
- `NAV_FIXTURE_PRODUCTION=1 npm run test:navigation`: App Router nyata, pending feedback, klik terbaru menang, shell tetap terpasang, hanya data tujuan, back/forward, filter URL, drawer dan guard expiry.
- Regresi Panduan (16 kombinasi) dan404 (32 kombinasi) termasuk sesi/keyboard/draft/expiry. Regresi UI umum digunakan untuk memeriksa dampak shell lintas fitur.
- Lint, typecheck,160 unit test dan build produksi; CI lengkap menjadi gate sebelum merge.

Scroll vertikal untuk konten/menu panjang adalah perilaku yang disengaja; tidak disembunyikan demi meluluskan tes overflow. Pengujian memakai Chromium otomatis/data sintetis, bukan UAT akun produksi atau perangkat fisik. Tidak memerlukan migrasi database atau environment baru.
