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
