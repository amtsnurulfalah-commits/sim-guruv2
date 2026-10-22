# Audit Halaman Pemulihan Akun (Lupa Password)

## Cakupan dan alur

Audit mencakup route publik `/lupa-password`, struktur AuthLayout, RecoveryForm, ActionForm/AccountActionScope/Field/PasswordInput, feedback dan validasi bersama, helper HTTP, handler lifecycle, service forgot/verifyOtp/reset, serta fungsi SQL challenge dan invalidasi sesi. Semua bagian tersebut dibaca sebelum perubahan. Alur aktivasi dan halaman Akun ditinjau sebagai pemakai komponen bersama.

Alur email: username dan metode → CSRF prelogin → forgot-password → acknowledgement generik/challenge → OTP → reset-otp → bukti reset dalam memori → reset-password → acknowledgement loginRequired → login. Metode admin/security berhenti pada acknowledgement generik dan pemeriksaan identitas admin. Jawaban keamanan tidak mengizinkan reset langsung. Tidak ada tabel, dropdown bertingkat, pencarian atau pagination pada halaman publik; daftar permintaan admin diuji sebagai regresi terkait.

## Temuan dan perbaikan

| Masalah dan penyebab | Perbaikan |
| --- | --- |
| Form permintaan tetap dapat diajukan setelah OTP menghasilkan bukti reset; permintaan baru dapat membatalkan bukti aktif. | Kunci form identitas selama tahap kata sandi, ringkas dalam details, sediakan Mulai ulang pemulihan. Identitas pemilik challenge ditampilkan sebagai snapshot. |
| Challenge/proof lama tetap tertinggal ketika pengajuan ulang gagal atau respons hilang. | Buang state OTP/proof sebelum pengajuan baru; gunakan masa tunggu konservatif ketika hasil pengajuan tidak pasti. Tidak mengulang POST otomatis. |
| Verifikasi OTP dapat sudah mengonsumsi kode ketika respons jaringan rusak. | Hapus OTP/proof usang pada network/timeout/5xx atau respons malformed, arahkan meminta kode baru setelah masa tunggu. |
| Respons reset tidak diperiksa sebelum redirect sukses. | Kontrak runtime mengharuskan loginRequired: true. Respons malformed/5xx/jaringan menghasilkan panel hasil tidak pasti dan tautan login tanpa status sukses palsu. |
| Bukti reset kedaluwarsa atau sudah digunakan masih menyisakan form yang tidak dapat berhasil. | CHALLENGE_INVALID menghapus bukti dan menjelaskan cara mulai kembali, termasuk referensi bantuan bila tersedia. |
| Gagal menyiapkan CSRF belum dibedakan dari kegagalan write. | Validasi CSRF memakai schema login bersama; FORM_NOT_READY menjelaskan belum ada POST. Bukti reset tetap dapat digunakan setelah preflight gagal. |
| Masa tunggu hanya diperiksa saat klik tanpa hitung mundur yang jelas; respons 429 belum memengaruhi countdown. | Countdown 60 detik yang diperbarui setiap detik; hormati Retry-After; bersihkan interval ketika tidak diperlukan atau unmount. |
| Jawaban keamanan tetap terlihat/tersimpan dalam input setelah acknowledgement. | Reset native form mengosongkan dan menyembunyikan rahasia, lalu pulihkan username/metode/keterangan nonrahasia. |
| Batas input 128 UTF-16 unit lebih kecil dari dukungan server 128 Unicode code point. | Maxlength password publik 256 unit; schema server tetap membatasi 128 code point dan konfirmasi harus sama. |
| Respons terlambat dapat mengubah state atau menampilkan toast setelah komponen ditutup. | AbortController per ActionForm, AbortSignal diteruskan pada alur publik, guard mounted, serta cleanup timer/fokus. Callback lama tetap kompatibel. |
| Error generik tidak membawa fokus ke petunjuk; form tidak menyatakan metode POST. | Fokus ke ringkasan jika tidak ada field error; field error tetap fokus ke isian. Method POST eksplisit dan kontrol SSR dinonaktifkan sampai siap, disertai noscript. |
| Padding panel bertingkat mempersempit form pada 280px dengan teks 200%. | Style datar hanya pada form publik; layout pengguna lain mempertahankan default. Tahap vertikal di layar sangat sempit, teks wrapping, tombol penuh di mobile. |

## Kompatibilitas

Endpoint, payload, skema data, kebijakan password, Argon2, cookie HttpOnly, pemeriksaan Origin/CSRF dan rate limit backend dipertahankan. OTP tetap 10 menit/maksimal lima percobaan, bukti reset lima menit dan sekali pakai. Reset berhasil tetap mengakhiri seluruh sesi lama. Tidak ada rahasia ke URL atau storage browser. Respons pengajuan tetap generik agar tidak mengungkap keberadaan akun.

Tidak ada migrasi, penulisan database produksi, pengiriman email nyata, atau perubahan akun produksi selama audit. Integrasi SQL menggunakan database disposable dan browser memakai respons sintetis. Scroll vertikal normal untuk konten panjang dipertahankan; sasaran adalah tidak ada konten terpotong atau overflow horizontal halaman.

## Validasi

- Lint, TypeScript, production build dan git diff --check lulus.
- 72 unit, 29 crypto/HTTP dan 329 integrasi database lulus: total 430.
- Pengujian baru `test:ui:forgot-password`: 48 kombinasi (8 lebar 280–1920 × teks 100%/200% × 3 tahap). Pemeriksaan lebar halaman dan form terlihat, metode admin/security, rahasia clear/conceal, double submit, countdown/resend, 429, identitas snapshot, konfirmasi password, respons malformed/network/503 di setiap endpoint, proof invalid, CSRF malformed/network tanpa POST, hasil tidak pasti, storage, restart, orientasi dan redirect sukses. Nol page error.
- Regresi pemulihan/aktivasi: 12 viewport publik/admin, daftar 100/kosong/malformed, keputusan/serah terima, OTP/reset dan aktivasi invalid lulus.
- Regresi Akun: 12 kombinasi role/viewport, draft/keyboard/onboarding, penguncian antarform, refresh gagal setelah commit, OTP dan pergantian password lulus.
- Regresi login: 16 kombinasi viewport/teks, SSR/hydration dan endpoint CSRF asli melalui HTTPS lokal; fallback Lupa Password tanpa JavaScript memuat petunjuk dan tombol disabled.
- Regresi UI umum: 252 kombinasi tampilan, empat ukuran interaksi dan CRUD; nol page/console error.
- Screenshot mobile dan desktop diperiksa. Perangkat fisik, pembaca layar dan provider email produksi belum diuji.

## Kode final

- `src/features/auth/recovery-form.tsx`: state, feedback dan layout publik.
- `src/features/auth/account-lifecycle.tsx`: kontrak CSRF, kontrol form dan cleanup request.
- `src/lib/accounts/schemas.ts`, `src/lib/feedback/catalog.ts`: acknowledgement dan petunjuk baru.
- `tests/ui/forgot-password.mjs`, `tests/unit/recovery-contracts.test.ts`, `tests/ui/login.mjs`: pengujian regresi yang dapat dijalankan ulang.
