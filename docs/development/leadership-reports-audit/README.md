# Audit Laporan Pimpinan — Oktober 2026

Basis main: PR #54. Halaman: `/laporan-pimpinan`.

## Pemetaan alur

Sesi/onboarding/maintenance diverifikasi oleh pageSession dan SessionBoundary. Capabilities laporan berasal dari GET `/api/reports/read?kind=capabilities`; jabatan tambahan tidak memberi akses otomatis. Admin mengelola lingkup akademik/honorarium secara terpisah melalui POST `/api/reports/access`, CSRF, alasan audit dan optimistic version.

Filter laporan: jenis, bulan, guru, mode realisasi/proyeksi, halaman 25 baris. Operations tidak digunakan untuk perhitungan: ReportsService memanggil SQL `app.reports_read`. Akademik membaca occurrence aktif, konfirmasi/jurnal/BAP dan kehadiran sampai cutoff; tidak membentuk jadwal baru. Honorarium memakai `finance.bundle`; periode final membaca snapshot asli `honor_statements`. Ringkasan berlaku atas seluruh hasil filter, bukan halaman aktif. Isu keuangan tetap berlaku untuk seluruh periode.

Ekspor membaca semua halaman dalam REPEATABLE READ, maksimal 10.000 baris, lalu membentuk XLSX teks tanpa formula. Detail modal memakai baris laporan yang sudah divalidasi. Tidak ada penyimpanan catatan akademik/honorarium dari halaman ini; hanya perubahan izin pembaca.

## A. Temuan

- Loading capabilities dan laporan berbagi state: penyelesaian request akses bisa mengakhiri indikator loading laporan terlalu dini.
- Schema respons belum mewajibkan summary/field menurut jenis, timestamp valid dan paginasi lengkap; respons parsial dapat menghasilkan `undefined` atau format nominal yang salah. Mode/pageSize belum dibandingkan dengan filter.
- Reader payload dan hasil POST izin tidak divalidasi. Form memakai default akademik/finance yang tidak mengikuti pengguna terpilih, berisiko mencabut lingkup yang sudah diberikan.
- Kegagalan jaringan/timeout dengan status 0 belum mengunci pengiriman ulang; daftar izin lama dapat tetap digunakan setelah read gagal.
- Modal rincian mempunyai trigger otomatis kosong dan dapat mempertahankan rincian lama ketika capabilities dicabut. Fokus tutup modal belum dikembalikan ke pemicu yang tepat.
- Ringkasan honorarium menambahkan `Rp` padahal formatter sudah menyertakannya. Label masuk-pulang tidak tepat untuk counter SQL yang menghitung catatan pulang.
- Halaman di luar batas tidak kembali ke halaman 1 jika total menjadi 0. Bulan yang dikosongkan diam-diam diabaikan oleh controlled input.
- Ekspor belum menolak halaman lintas filter, duplikasi antarhalaman atau ringkasan berubah. Error unduh bercampur dengan error read. Penjelasan sumber yang panjang dan tabel memerlukan perbaikan ruang/mobile.

## B. Implementasi

- Capabilities memakai hook GET tunggal yang sudah digunakan Dashboard/Pusat Tugas, dengan status/error terpisah. Read laporan tetap dibatalkan saat filter berubah; response lama diabaikan. Perubahan scope menutup/menghapus snapshot dan rincian yang tidak lagi diizinkan.
- Decoder bersama `readReportResponse` memverifikasi bentuk akademik/keuangan, jumlah baris halaman, unique IDs/guru, lingkup guru/tanggal, kind/period/teacher/page/pageSize/mode. Mode final tetap boleh menggantikan realisasi/proyeksi sesuai SQL.
- `ReportAccess` dipisahkan menjadi komponen terfokus. Pemilihan pengguna memuat izin tersimpan; versi yang dibaca dibekukan untuk save. Field dan alasan 5–500 karakter divalidasi. Single-flight POST, acknowledgment `{ok:true}`, lock hasil tidak pasti/konflik, recovery melalui reload dan feedback berhasil-terpisah-dari-read dipertahankan. Background read tidak menimpa draft/versi edit.
- Rincian hanya terlihat untuk snapshot/query yang masih valid. Trigger kosong dihapus dan fokus dikembalikan setelah tutup. Form izin menjaga fokus dan tidak dapat ditutup/dikirim ulang saat write berlangsung.
- Format uang berbasis string menjaga presisi; awalan Rp tunggal. Label pulang disesuaikan dengan definisi counter SQL tanpa mengubah query/perhitungan.
- Input bulan kosong/di luar 2000–2099 memberi feedback dan tidak mengirim query invalid. Pagination mengevaluasi batas minimal halaman 1, termasuk dataset kosong.
- Ekspor memvalidasi tiap chunk dengan decoder yang sama, metadata/summaries konsisten dan unique IDs lintas chunk. Limit 10.000 tetap berlaku. Filter dikunci selama unduh, duplicate download dicegah, request dibatalkan ketika unmount/akses hilang. Kegagalan unduh tidak menghapus laporan yang valid.
- Header, disclosure sumber, tabel fixed dengan scroll lokal/keyboard hint, wrapping nominal panjang, pratinjau nama maksimal tiga baris (nama lengkap tetap tersedia di rincian/Excel), dan modal viewport memakai komponen/style aplikasi yang ada. Scroll vertikal dokumen tetap normal; tidak memakai pemotongan konten untuk menyembunyikan overflow.

Tidak ada perubahan SQL, migrasi, skema data, API valid, rumus, kalender, policy H-1, worker/email atau snapshot final. Perbaikan presentasi tidak menghitung ulang nominal di browser.

## C. Kode

`src/features/reports/workspace.tsx`, `src/features/reports/report-access.tsx`, `src/lib/reports/contracts.ts`, `src/server/reports/service.ts`, route halaman beserta metadata. XLSX writer dan HTTP/CSRF/authorization tetap memakai implementasi lama.

## D. Verifikasi

- Lint, TypeScript, unit, crypto/HTTP, seluruh integrasi database, build produksi dan CI.
- Unit: decoder kind-specific, mismatch filter/mode/pageSize, duplicate teachers/readers, acknowledgment dan nominal string.
- Crypto/server: export tepat 10.000, penolakan 10.001 sebelum halaman lanjutan, RR isolation, chunk duplikat/kosong/lintas filter/mode/summary berbeda.
- Integrasi SQL nyata: scoped grant/revoke/CAS, anti-spoof/session/origin/CSRF, semua halaman dan ringkasan, canonical finance, final snapshot, pembatasan export dan tidak ada write bisnis saat membaca laporan.
- UI: akademik/honorarium/proyeksi; detail/modal; Excel; empty; rapid filters/race/loading; 56 baris dan total menyusut ke 0; 7 lebar 280–1920; nama/nominal panjang; bulan kosong; invalid summary/mode/caps/readers; prefill kedua izin dan frozen version; duplicate submit/download; conflict/network/ack tak valid; pencabutan saat rincian terbuka; guru finance-only dan tanpa akses. Regresi umum `test:ui` turut dijalankan.
- Data dan identitas pengujian sintetis localhost. Screenshot mobile/desktop diperiksa. CI dan merge mengikuti PR. Smoke produksi hanya health dan penolakan anonim; tidak menggantikan UAT akun/perangkat fisik dan tidak melakukan write bisnis baru.
