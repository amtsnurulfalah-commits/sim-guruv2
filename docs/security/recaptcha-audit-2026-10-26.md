# Audit reCAPTCHA SiM-Guru — 26 Oktober 2026

Baseline: main `0c3323750656b20663c6361bd90c001430994b7e` (PR #66 dan #67 sudah tergabung). Cakupan: konfigurasi publik/server, loader Google, siklus widget, form login, validasi transport, middleware HTTP, rate limit, verifikasi Google dan tes regresi.

| Temuan | Dampak sebelumnya | Perbaikan |
|---|---|---|
| CAPTCHA diam-diam nonaktif saat hanya key disetel | Site/Secret Key lengkap tanpa flag tidak melindungi login | Key lengkap otomatis aktif bila flag belum diatur; key sebagian fail-closed; false eksplisit tetap dihormati |
| Callback pemuatan memakai satu nama global | Skrip setelah timeout dapat memanggil callback retry baru; API bootstrap parsial dianggap siap | Callback unik tiap pemuatan, settle-once, berbagi promise in-flight, retry setelah gagal |
| Widget dibuat ulang tiap request login | Widget/iframe/provider client bertambah sepanjang sesi login gagal berulang | Gunakan reset widget yang sama; remount hanya saat site key berganti atau pemulihan widget diperlukan |
| Token/status lama saat widget diganti | Parent dapat mempertahankan token yang tidak lagi mewakili widget aktif | Kosongkan token pada setup/cleanup/attempt; callback terlepas diabaikan; handler parent terbaru melalui ref |
| Konfigurasi CAPTCHA tidak diperiksa env:check | Audit auth dapat tampak valid padahal key/flag tidak lengkap | Cek state CAPTCHA pada lingkup auth/all tanpa mencetak key |

## Bagian server yang diperiksa

Origin/CSRF mendahului login, pembatasan sumber persisten mendahului panggilan Google, dan CAPTCHA mendahului pencarian/hash kredensial/penerbitan sesi. POST siteverify tetap HTTPS/no-store/tanpa redirect dengan timeout. Hostname harus persis APP_URL; missing/expired/duplicate/invalid token, key rusak, JSON rusak, status upstream gagal dan jaringan gagal ditolak. Secret hanya di server, token di memori; tidak ada bypass baru atau migrasi database.

Dokumentasi acuan: https://developers.google.com/recaptcha/docs/display dan https://developers.google.com/recaptcha/docs/verify. Token single-use dan masa berlaku provider ditegakkan oleh Google; tidak menambah cache token lokal atau retry otomatis siteverify yang dapat memakai token sama dua kali.

## Validasi

- Unit konfigurasi, transport dan loader: mencakup key tanpa flag, partial key, token berbatas, timeout + late callback serta bootstrap parsial.
- Tes server/crypto: POST/hostname/error/config/token, rate limit sebelum provider, tidak mengakses kredensial ketika CAPTCHA ditolak.
- Integrasi HTTP: respons aman/no-store/requestId, tanpa cookie sesi/perubahan kredensial pada CAPTCHA gagal.
- Browser sintetis: lima viewport (280/320/375/768/1440), teks 200%, expired/error/reset, jumlah widget tetap satu setelah login gagal, reset gagal menolak login, retry pulih.
- Lint, typecheck, unit/crypto, integrasi database dan production build dijalankan; hasil akhir dicatat pada PR.

Tidak menyelesaikan CAPTCHA nyata secara otomatis. Uji browser memakai provider/token sintetis dan database uji terisolasi; belum membuktikan key/domain Google produksi benar. Smoke challenge nyata dilakukan setelah deployment oleh pengguna. `RECAPTCHA_ENABLED=false` harus diganti true bila proteksi hendak aktif walaupun key sudah terisi.
