# Audit Halaman Login SiM-Guru

## Cakupan dan alur

`/login` memeriksa host kanonis dari APP_URL, lalu merender AuthLayout dan
LoginForm. Form meminta prelogin CSRF ke `/api/auth/csrf`, mengirim JSON ke
`/api/auth/login`, dan menuju `/dashboard` untuk sesi bisnis atau `/akun` untuk
onboarding. Cookie sesi HttpOnly tetap ditetapkan server, tidak disimpan di
localStorage atau dibaca JavaScript.

Audit menelusuri halaman/layout, LoginForm, PasswordInput, Brand/Button,
ErrorFeedback, pemetaan field error, requestJson, CSS global, konfigurasi
lingkungan, endpoint/HTTP handler, security/CSRF, LocalAuthService,
PasswordService, serta routine SQL credential/rate-limit/session/audit. Tidak
ada Google Apps Script, Supabase Auth, CRUD, tabel, filter atau modal dalam alur
login ini. Autentikasi tetap internal dengan Argon2 dan PostgreSQL.

## Temuan dan perbaikan

| Temuan / penyebab | Perbaikan |
| --- | --- |
| Dua implementasi pemuatan CSRF, retry dapat tumpang tindih dan init tidak membatalkan fetch | Satu fungsi prepare dengan penguncian request sinkron, AbortController dan pemeriksaan instance/mount; retry hanya tampil setelah pemuatan selesai/gagal |
| Submit hanya dijaga busy state sebelum render | Pending ref mengunci langsung, termasuk double click dan requestSubmit; tetap terkunci selama pengalihan sukses |
| Respons CSRF hanya di-cast sehingga token kosong/undefined dapat dianggap siap | Kontrak respons memeriksa token nonkosong, format aman dan panjang sesuai batas transport; jika invalid form tetap dinonaktifkan dan dapat dimuat ulang |
| Respons login selain dashboard diam-diam dianggap akun, termasuk data malformed | Kontrak redirectTo hanya menerima dua tujuan yang memang dihasilkan backend; respons tidak sesuai menjadi error, tanpa pengalihan eksternal |
| Browser belum memvalidasi aturan login yang sama dengan server | Ekstrak loginSchema murni, gunakan usernameSchema yang sudah ada, validasi sebelum request dan re-export nama lama dari service untuk kompatibilitas |
| Input password memakai px-3 yang dapat menghapus ruang kanan pr-14 milik PasswordInput | Gunakan styling asli PasswordInput sehingga teks tidak tertutup tombol tampil/sembunyikan |
| Password dikosongkan lewat value saja sehingga status tampil dapat tetap terbuka pada percobaan berikutnya | Reset form memakai event native yang sudah didukung PasswordInput, lalu pulihkan username; password kosong dan tersembunyi kembali |
| Salah kredensial generik tidak terhubung ke field; pesan jaringan menyuruh memeriksa riwayat penyimpanan | Tandai kedua field tanpa menebak field mana yang salah; feedback jaringan khusus login menjelaskan status belum pasti dan meminta muat ulang, tanpa replay otomatis |
| Pesan logout/aktivasi terikat sukses pemuatan CSRF dan bercampur dengan error | Pisahkan notice terdefinisi dari error; feedback sukses pengalihan dan pembaruan CSRF jelas |
| Form tidak menyatakan method/action dan tidak memberi petunjuk tanpa JavaScript | Nyatakan POST ke endpoint yang sama sebagai fallback aman dari query URL; petunjuk noscript, tombol tetap disabled sampai CSRF siap; tidak menambah protokol login baru |
| Grid intrinsik, ikon yang dapat menyusut, tautan kecil dan main tidak focusable | Track minmax/min-width 0, wrapping, ikon stabil, spacing responsif, target sentuh minimal 44 px untuk tautan, tabIndex=-1 untuk skip-link |

Kebijakan login tetap menerima password lama yang sah sepanjang 1–128 code point
Unicode. Password tidak di-trim, dan aturan pembuatan password baru tidak
diterapkan secara keliru saat login. Username tetap di-trim dan dinormalisasi ke
huruf kecil. Pesan kredensial tetap generik, sehingga tidak membocorkan keberadaan
atau status akun.

Origin, prelogin cookie, signature/TTL CSRF, rate limit, maintenance, Argon2,
rotasi/revokasi sesi, versi kredensial, onboarding, host kanonis, endpoint dan
struktur database tidak diubah. POST login tidak pernah diulang otomatis.
AuthLayout juga dipakai aktivasi/pemulihan; perubahannya terbatas layout dan
aksesibilitas, tanpa mengubah alur form tersebut.

## Validasi

- Lint, typecheck, dan build produksi lulus.
- 70 unit + 29 crypto + 329 database = 428 pengujian lulus.
- Unit baru memeriksa normalisasi, password Unicode/legacy, batas panjang,
  response malformed, allowlist redirect dan notice yang terdefinisi.
- Integrasi autentikasi yang sudah ada lulus: cookie aman, Origin/CSRF/TTL,
  rate limit akun/IP, respons generik akun invalid/nonaktif, maintenance,
  onboarding, rotasi sesi, expiry dan logout/revokasi.
- `npm run test:ui:login` lulus: 8 lebar layar (280, 320, 375, 767, 768, 1024,
  1440, 1920) × teks 100%/200%; tidak ada overflow viewport/form atau teks
  password di bawah tombol; autocomplete, keyboard, toggle password, loading,
  field validation, invalid credentials, burst submit, CSRF recovery tanpa
  replay, retry preparation, 429, maintenance, network error, response malformed,
  pengalihan onboarding/bisnis, meninggalkan halaman, resize dan orientasi.
- Pengujian yang sama menjalankan build Next.js produksi melalui HTTPS lokal
  dengan sertifikat sementara: SSR/hydration, CSRF asli berstatus 200 dan
  petunjuk/tombol aman saat JavaScript nonaktif. DB dibuat tidak tersedia untuk
  membuktikan persiapan form tidak memerlukan database. Tidak ada POST login
  ke server produksi lokal tersebut.
- Regresi UI seluruh aplikasi lulus: 252 kombinasi tampilan, 4 ukuran interaksi,
  CRUD mata pelajaran, 0 page error dan 0 console error.
- Regresi khusus pemulihan lulus: 12 viewport publik/admin, aktivasi, OTP,
  schema error dan skenario keputusan/serah-terima; 0 page error.
- Screenshot mobile 375 px dan desktop 1440 px diperiksa secara visual.

Untuk menjalankan pengujian khusus, jalankan `npm run build` terlebih dahulu.
Dependency browser memakai konfigurasi UI_PLAYWRIGHT_MODULE dan
UI_BROWSER_EXECUTABLE yang sama dengan pengujian UI lainnya; openssl digunakan
untuk sertifikat sementara dan dihapus setelah selesai.

Pengujian menggunakan data dan kredensial sintetis. Status HTTP gagal yang
sengaja disimulasikan dipisahkan dari error JavaScript/console tak terduga.
Tidak ada login atau perubahan data pada lingkungan produksi. Scroll vertikal
alami tetap tersedia saat layar pendek atau teks diperbesar; kontrol tidak
terpotong oleh container bertinggi tetap.
