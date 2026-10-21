# Audit dan refactoring Dashboard

## Cakupan dan alur

Halaman route → pageSession → dashboardDto → DashboardView. Layout AuthenticatedWorkspace/SessionBoundary menjaga sesi dan shell; halaman tetap memeriksa akses server. LiveSummary membaca /api/dashboard melalui masterRequest, DayContextCard membaca /api/day-context, Announcements membaca /api/operations/announcements dan mengirim dismiss dengan CSRF serta versi. Endpoint Dashboard memverifikasi origin dan sesi business sebelum menjalankan CalendarService.context dan app.dashboard_summary. SQL summary membaca penugasan efektif, jadwal terencana, kehadiran, honor, hak libur dan ringkasan khusus admin.

Berkas layout, shell, error/loading boundary, CSS global, MetricCard, FeatureState, parser API, skema kalender dan operasi, serta SQL sumber ringkasan ikut diperiksa. Dashboard tidak mempunyai CRUD jadwal, modal, form, tabel atau filter sendiri; fitur tersebut diakses melalui navigasi modul. ModuleCards tetap dipertahankan karena dipakai halaman panduan kesiapan. Tidak ada integrasi Google Apps Script pada alur Dashboard ini.

## Temuan dan perbaikan

1. Empty state hanya memeriksa tasks, sehingga dapat menyatakan tidak ada penugasan meskipun planned berisi jadwal. Kondisi kosong kini memeriksa keduanya; jadwal dan penugasan digabung secara kronologis dengan key terpisah.
2. Respons summary tidak diperiksa saat runtime. Summary hilang dapat menimbulkan loading tanpa akhir; field salah dapat menyebabkan exception render. Respons kini divalidasi dengan Zod dan kegagalan memberi pesan serta retry. Konteks dan pengumuman juga memvalidasi field yang digunakan UI.
3. Tanggal server-render dan request saat mount bisa tertinggal saat tab melewati tengah malam WIB. Hook Dashboard mengecek tanggal setiap 60 detik saat terlihat, saat focus dan visibilitychange; pergantian tanggal memasang ulang panel dengan pembatalan GET lama. Tidak ada polling data lintas halaman atau perubahan sesi.
4. Dismiss pengumuman tidak memiliki pengunci sinkron; klik berulang dapat mengirim lebih dari satu POST. Muat ulang daftar pascadismiss juga dapat mengembalikan state usang dan error lama tidak dibersihkan. Kini satu write berjalan pada satu waktu; tombol disabled; setelah sukses hanya item dengan id dan versi yang sama yang dihapus lokal, ada feedback sukses, dan setState setelah unmount dicegah. CSRF, pemeriksaan server, versi dan hak canDismiss tetap berlaku. Tidak ada retry write otomatis.
5. Error konteks sebelumnya menghilangkan detail respons dan kode referensi. Kini panel error mempertahankan pesan bantuan; pengumuman juga mempunyai retry baca, loading dan feedback sukses.
6. Tiga kartu ringkasan dipaksa berjajar mulai lebar sm; kartu akun guru memakai grid dua kolom sehingga menyisakan ruang kosong. Breakpoint diubah menjadi satu/dua/tiga kolom; kartu akun guru mengisi lebar tersedia. Spacing dan pembungkusan teks dirapikan secara lokal tanpa CSS global baru.
7. Kode jenis kegiatan mentah ditampilkan kepada pengguna dan tugas tidak berurutan; label diterjemahkan, jam diringkas HH:mm, daftar diurutkan serta dipaginasi 8 baris agar data besar tidak membuat DOM dan halaman terlalu panjang. Status terencana/terkonfirmasi/jurnal tetap dibedakan. Semua baris tetap dapat diakses melalui pagination.
8. Pembacaan konteks dan summary di endpoint sebelumnya berurutan walau independen. Keduanya kini dimulai paralel setelah autentikasi. Kontrak response lama tetap tersedia; date ditambahkan secara kompatibel. Pembacaan konteks terpisah di frontend tetap dipertahankan untuk retry panel yang independen dan kompatibilitas API.

9. Stress test teks 200% dan catatan kalender sangat panjang tanpa spasi mengungkap overflow pada rincian accordion: pembungkusan break-word tidak menurunkan intrinsic minimum sel grid. Rincian kini memakai overflow-wrap:anywhere dan sel grid min-w-0. Perubahan lokal ini tidak menyembunyikan konten dengan overflow:hidden.

## Batas perubahan

Tidak mengubah tabel, SQL bisnis, perhitungan honorarium, aturan kalender, RLS, role, otorisasi, endpoint, atau shell navigasi. Perubahan berfokus pada Dashboard dan komponen yang dipakainya. Tidak menghapus fitur ruang kerja lain atau menambahkan modul baru.

Normal page scrolling vertikal tetap tersedia. Sasaran overflow adalah tidak ada elemen keluar container, clipping atau gulir horizontal halaman; bukan memaksa seluruh konten masuk satu tinggi viewport.

## Validasi

- Lint, TypeScript, git diff --check dan production build lokal: lulus.
- Unit: 48 lulus; crypto/HTTP: 29 lulus; integrasi SQL: 327 lulus (404 total).
- Regresi browser penuh: 252 kombinasi halaman/role/viewport, interaksi pada 4 lebar layar dan 1 alur CRUD; nol page errors dan console errors.
- Browser khusus Dashboard pada kode akhir: 12 kombinasi admin/guru dengan 320/375/768/1024/1440/1920 px; data kosong, planned-only, 101 tugas/pagination, orientasi 844×390 dan 375×812, teks 200%, nama/catatan tanpa spasi panjang, loading, respons malformed, HTTP 503 dengan referensi, retry ringkasan, retry konteks independen, klik dismiss ganda dan rollover WIB/focus: lulus tanpa page error atau overflow horizontal. HTTP 503 sintetis memang menghasilkan console network error yang diharapkan; tidak dihitung sebagai exception JavaScript.
- Screenshot desktop dan ponsel diperiksa; identitas visual hijau tetap dipertahankan. Perbaikan overflow ekstrem diverifikasi ulang pada fixture final.
- Suite UI penuh awal dihentikan untuk menambahkan timeout pengujian dan log progres opsional; suite lengkap berikutnya berhasil. Skenario stress tambahan pertama menemukan overflow accordion, kemudian diperbaiki dan suite Dashboard akhir lulus.
 Fixture UI menggunakan data sintetis lokal; tidak mengirim email atau mengubah data produksi. UAT perangkat fisik dan screen reader nyata tidak termasuk pengujian otomatis.
