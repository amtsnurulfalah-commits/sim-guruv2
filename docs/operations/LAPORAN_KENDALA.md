# Laporan Kendala

## Alur admin

1. Buka Administrasi → Laporan Kendala (`/admin/laporan-kendala`). Hanya akun admin dengan sesi business aktif yang diizinkan; pemeriksaan dilakukan kembali oleh database.
2. Minta kode referensi lengkap, waktu kejadian (WIB), halaman, tindakan dan pesan/tangkapan layar. Jangan meminta kata sandi, OTP, jawaban keamanan atau tautan aktivasi.
3. Masukkan UUID referensi, lalu pilih **Cari laporan**. Hasil menampilkan waktu WIB, modul, kode kesalahan, status HTTP dan panduan penanganan.
4. Cocokkan panduan dengan konteks pengguna; perbaikan hak akses atau kebijakan tetap melalui fitur resmi. Pencarian tidak memberi izin untuk mengubah data.
5. Verifikasi ulang dengan pengguna. Bila status simpan belum pasti, periksa riwayat sebelum mengirim ulang.

## Data yang direkam

`handleAuthRequest` mencatat metadata allowlist untuk kegagalan yang ditanganinya: requestId, occurredAt, module, code, status. Handler modul dan ekspor kegiatan memasok nama modul statis. Tidak merekam body, query string, cookie, kredensial, nilai isian, IP, stack trace atau pesan database mentah. Tidak mengaitkan laporan dengan identitas pengguna; admin mencocokkan konteks melalui pelapor.

Log terstruktur runtime `support.request_failed` ditulis langsung dengan referensi yang sama dengan respons. Next.js `after()` mencoba menyimpan ke `ops.support_events` setelah respons sehingga tidak menambah waktu tunggu pengguna. Bila database gagal, log `support.persistence_failed` menyertakan referensi saja; respons asli dipertahankan. Tidak ada retry transaksi pengguna dan tidak ada antrean retry pencatatan.

Akses tabel langsung ditolak bagi role autentikasi dan bisnis. Role autentikasi hanya dapat memanggil fungsi pencatatan terbatas. Role bisnis hanya dapat memanggil fungsi pencarian yang memeriksa sesi dan role admin. Tabel privat memakai ENABLE/FORCE RLS dan kebijakan owner internal mengikuti pola repo; fungsi definer memiliki search_path tetap dan EXECUTE publik dicabut. Fungsi hanya menyimpan metadata terstruktur, bukan SQL dinamis.

## Retensi dan hasil kosong

Pencarian dibatasi 30 hari terakhir; catatan lebih lama dibersihkan saat pencatatan berikutnya (bukan penjadwal harian). Saat tidak ada kegagalan baru, catatan lama mungkin masih tersimpan secara fisik tetapi tidak dapat dicari oleh aplikasi.

Penyimpanan terjadi setelah respons sehingga hasil mungkin belum langsung tersedia. Cari ulang setelah beberapa saat. Kode dari sebelum fitur aktif tidak bisa direkonstruksi. Gangguan sebelum mencapai server, error render di luar handler, maupun proses yang berhenti sebelum after selesai dapat tidak tersedia dalam tabel.

Admin teknis dapat mencari UUID di runtime logs Vercel, dengan waktu kejadian dan modul. Log `support.request_failed` memberi metadata yang sama; tidak menyediakan stack trace mentah. Jika database tidak menyimpan catatan, log runtime menjadi cadangan sesuai retensi penyedia. Hasil kosong bukan bukti pengguna keliru.

## Rilis

Terapkan migrasi `support_reports` dari folder supabase/migrations menggunakan alur migrasi proyek sebelum merilis kode ke produksi. Migrasi menambahkan tabel, indeks, RLS dan dua fungsi dengan grant terbatas; tidak mengubah tabel bisnis yang ada. Tanpa migrasi, pencatatan runtime tetap ada tetapi pencarian admin belum dapat berjalan.

Kode referensi contoh dalam pengujian adalah fixture sintetis pada database lokal sekali pakai, bukan rekaman insiden produksi. Tidak ada email atau data pengguna produksi yang ditulis oleh pengujian.

## Verifikasi perubahan

- Lint dan TypeScript lulus; production build lokal lulus.
- 44 unit, 29 crypto/HTTP, dan 326 integrasi SQL lulus (399 total).
- Integrasi baru mencakup lookup admin, penolakan guru/sesi invalid, penolakan SELECT langsung, role bisnis tidak dapat menulis log, UUID tidak valid, hasil kosong, deduplikasi dan retensi 30 hari.
- Pengujian HTTP memastikan requestId log sama dengan referensi respons dan metadata tidak memuat exception mentah.
- Browser fixture lokal memverifikasi pencarian berhasil, UUID salah, referensi tidak ditemukan, layanan pencarian HTTP 503 dan tampilan 375/768/1440 px tanpa page error/overflow. Screenshot ponsel diperiksa.
- Pemeriksaan RLS lama menyesuaikan jumlah tabel dari 64 menjadi 65 dan daftar modul admin dari 15 menjadi 16; pemeriksaan pembatasan akses tetap dijalankan. Native PostgreSQL opsional tidak termasuk suite npm run test:db; tidak diklaim lulus.
- UAT produksi dan pengiriman after() di deployment Vercel belum diverifikasi; database produksi belum dimigrasikan oleh perubahan ini. Pencatatan database bersifat best effort dengan log runtime sebagai cadangan.
