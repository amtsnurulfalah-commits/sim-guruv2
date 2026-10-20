# Audit dan perbaikan codebase SiM-Guru — 20 Oktober 2026

## A. Executive summary

Dasar audit: main `7f5c6cc38979917e25a759105c92c74054846ae3`. Pekerjaan berada pada branch `audit/codebase`; laporan ini tidak menyatakan perubahan sudah berada di production.

Inventaris AST mencakup 292 file TypeScript/TSX/MJS dalam src, scripts, dan tests: 232 file sumber, 46 page, 50 route API, serta 23 migration SQL. Hasil rinci dan hubungan import ada pada `codebase-audit-inventory.json`; ulangi dengan `node --import tsx scripts/audit-codebase.ts`.

Pemeriksaan struktural mencakup seluruh file dalam inventaris. Peninjauan manual terarah mencakup autentikasi/session/CSRF, lifecycle akun/OTP, adapter SMTP/outbox, batas API dan validasi, service transaksi/ekspor, form/dialog, serta pergantian laporan migrasi. Suite integrasi menjalankan seluruh modul bisnis. Ini bukan klaim setiap baris kode telah diperiksa manual, seluruh kemungkinan bug ditemukan, atau sertifikasi keamanan.

Lima masalah terkonfirmasi diperbaiki tanpa mengganti autentikasi internal, kontrak API, skema database, environment, atau dependensi. Satu utilitas yang terbukti tidak terpakai dihapus. Tidak ada perubahan data, konfigurasi, migration, atau pengiriman email production selama audit.

### Peta arsitektur dan batas kritis

| Area | Alur dan invariant yang dipertahankan | Verifikasi |
|---|---|---|
| UI dan routing | App Router → SessionBoundary/Workspace → fitur; form mempertahankan isian ketika gagal | Inventaris 46 page, lint/tipe, matriks browser |
| Auth | Cookie host-only → origin + CSRF → internal auth service → routine privat; Argon2id, sesi onboarding terpisah | Auth HTTP, lifecycle, crypto, transport Postgres.js |
| Database | SqlDatabase + parameter terikat → routine SQL dengan validasi sesi/role, RLS, transaksi/CAS | PGlite, 23 migration, otorisasi lintas pengguna dan least privilege |
| Pengguna/master/kalender/jadwal | Role admin, versi data, preview terikat actor, riwayat terlindungi | Suite users/masters/calendar/schedules |
| Kehadiran/jurnal/piket/ujian/acara | Scope pemilik, tanggal WIB, validasi rekap, posting/reversal JTM atomik | Suite activities/duties/programs |
| Honorarium | NUMERIC eksak, final immutable, koreksi/periode terkontrol; ekspor terotorisasi | Suite finance dan dokumen CSV/PDF/XLSX |
| Email dan worker | Commit challenge/outbox sebelum dispatch; worker-only claim; lease/fencing; unknown tidak dianggap sent | SMTP mock, OTP dispatch, operations |
| Migrasi/backup | Staging privat, checksum, rekonsiliasi, readiness gates; tanpa aktivasi kredensial lama | Suite migration, restore WASM terisolasi |
| Deployment | Konfigurasi Next/Vercel, validasi env, TLS PostgreSQL, dependency lock | Build produksi lokal, env tests, npm audit |

## B. Bug fix report

| No. | Modul/file | Masalah dan tingkat risiko | Root cause | Perbaikan | Status |
|---|---|---|---|---|---|
| B01 | features/auth/account-lifecycle.tsx — ActionForm | Sedang: dua requestSubmit sinkron dapat menjalankan perubahan akun dua kali | State busy baru terlihat setelah render berikutnya | Ref pending dipasang sebelum await dan dilepas di finally; busy tetap untuk UI | Diperbaiki; regresi browser |
| B02 | server/mail/security-outbox.ts — deliverOne | Sedang: exception adapter ditandai failed walaupun penerimaan provider mungkin sudah terjadi | Kegagalan persiapan pesan dan transport ditangkap satu catch | Exception transport menghasilkan unknown; pesan invalid tetap failed; lease tetap difinalisasi | Diperbaiki; regresi sebelum/sesudah |
| B03 | server/mail/security-outbox.ts — deliverOne | Rendah: expiresAt tak valid dapat lolos pemeriksaan kedaluwarsa | Date invalid menghasilkan NaN, dan perbandingan NaN <= now bernilai false | Tolak waktu non-finite sebelum mengirim | Diperbaiki; kasus invalid/expired/wrong-origin/sent |
| B04 | features/migration/manager.tsx — pemilihan batch | Sedang: kegagalan membaca batch B dapat menampilkan temuan batch A di bawah batch B | selected berubah sebelum fetch berhasil, report lama masih tersimpan | Publikasikan selected dan report bersama setelah pembacaan berhasil | Diperbaiki; regresi browser dengan HTTP 503 sintetis |
| B05 | server/finance/http.ts — validasi action | Rendah: nama properti prototype lolos validasi command dan diproses sebagai aksi | Operator in ikut membaca properti warisan object | Object.hasOwn memeriksa registry command milik sendiri | Diperbaiki; constructor/toString/__proto__/aksi tak dikenal ditolak 405 sebelum service |

Tidak ada bukti eskalasi hak akses dari B05; pemeriksaan sesi/CSRF dan SQL tetap ada. B03 merupakan pertahanan terhadap metadata korup, bukan bukti input publik dapat mengubah timestamp outbox.

### Dugaan yang tidak terbukti

Batas ekspor kehadiran/jurnal sempat dicurigai meloloskan halaman terakhir. Pengujian kode awal untuk 0, 10.000, 10.001, 10.100, dan 10.101 baris membuktikan limit sudah bekerja. Tidak ada perubahan service ekspor; pengujian batas dipertahankan. Dugaan ini tidak dihitung sebagai bug.

## C. Dead code elimination report

| No. | File/komponen | Jenis | Bukti dan pemeriksaan dampak | Tindakan | Status |
|---|---|---|---|---|---|
| D01 | src/lib/dates.ts | Modul/helper tidak digunakan | Graf AST import/re-export/require/import literal seluruh src/scripts/tests; penelusuran nama/path; bukan route Next, script, registry atau RPC; tidak ada side effect maupun referensi config/dokumentasi; dynamic import yang ditemukan hanya browser runner eksternal | Hapus file dan dua export lokalnya | Selesai; lint/tipe/build/regresi tetap diperiksa |
| D02 | src/server/db/transaction.ts | Kandidat tanpa incoming import | Tidak dipakai jalur runtime saat ini, tetapi API helper didokumentasikan dalam Database_Tahap_1_2.md sebagai pola transaksi dan context | Pertahankan; keputusan penghapusan API dokumentasi belum cukup terbukti | Belum dihapus |
| D03 | Route Next, migration SQL, routine SQL, script operasional, fallback Resend, konfigurasi storage | Berpotensi tampak tidak direferensikan | File-based routing, SQL RPC, CLI/operator dan pilihan provider tidak seluruhnya tampak pada graf TS | Pertahankan; tidak melakukan pruning otomatis | Dipertahankan |

Graf import adalah alat menemukan kandidat, bukan izin penghapusan. Tidak ada tabel, kolom, migration, endpoint, env, atau dependency dihapus.

## D. Refactoring dan optimasi

Perubahan sengaja terbatas: synchronous submission gate; pemisahan error persiapan pesan dari hasil transport; pengikatan identitas batch dengan report; dan pemeriksaan registry yang eksplisit. Tidak ada perubahan arsitektur atau klaim peningkatan performa terukur. Penghapusan utilitas tanggal mengurangi permukaan pemeliharaan; tidak diklaim mengurangi bundle karena modul tersebut memang tidak terhubung.

Checklist React diterapkan: ref untuk status sinkron, state untuk rendering, tidak menambah conditional hook, cleanup async yang ada tetap dipertahankan, dan pembaruan batch/report dalam satu kelanjutan promise. Tidak ada dependensi runtime atau pengujian baru yang diinstal ke manifest proyek.

## E. Changed files

| Kelompok | File | Alasan |
|---|---|---|
| Added | scripts/audit-codebase.ts | Inventaris import/dependensi dan kandidat secara read-only, dapat diulang |
| Added | tests/crypto/audit-regressions.test.ts | 11 kasus outbox, registry API, dan batas ekspor |
| Added | docs/verification/AUDIT_CODEBASE.md | Laporan A–G dan batas bukti |
| Added | docs/verification/codebase-audit-inventory.json | Peta file, incoming imports dan dynamic import |
| Added | docs/verification/codebase-audit-browser.json | Bukti teks matriks browser dan regresi |
| Modified | src/features/auth/account-lifecycle.tsx | B01 |
| Modified | src/features/migration/manager.tsx | B04 |
| Modified | src/server/mail/security-outbox.ts | B02–B03 |
| Modified | src/server/finance/http.ts | B05 |
| Modified | tests/ui/harness.tsx, tests/ui/verify.mjs | Reproduksi form akun dan pergantian batch dengan kegagalan request |
| Deleted | src/lib/dates.ts | D01 |

## F. Testing dan verification

| Pemeriksaan | Hasil | Batas bukti |
|---|---|---|
| ESLint dan TypeScript | Lulus | Kode aktual, termasuk script dan test baru |
| Unit | 29 lulus | Schema, env, tanggal WIB, desimal, migrasi, navigasi, kontras dasar |
| Crypto/adapter/API/ekspor | 24 lulus | Termasuk 11 kasus audit baru; transport email berupa mock |
| Integrasi database | 325 lulus | PostgreSQL WASM/PGlite; termasuk Postgres.js melalui TCP fixture; bukan native PostgreSQL Supabase |
| Browser | 174 kombinasi tampilan lulus | 29 pasangan view/peran × lebar 320/375/767/768/1024/1440; fixture lokal |
| Interaksi browser | 4 lebar + CRUD master + 2 regresi audit lulus | Focus/dirty guard/form error/native dialog/navigation; create/update/archive master via service nyata pada database fixture |
| Production build | Lulus | Build Next lokal; bukan deployment production |
| Dependency audit | npm audit --omit=dev: 0 vulnerability | Hanya advisory yang dikenal registry pada saat audit; bukan bukti bebas kerentanan |
| Email riil | Tidak dijalankan | Tidak mengirim OTP ke pengguna atau memodifikasi setelan provider |
| UAT akun produksi, screen reader, perangkat fisik | Tidak dijalankan | Matriks browser sintetis tidak menggantikan UAT |
| Native PostgreSQL/pooling/race/pg_dump restore | Tidak dijalankan | Memerlukan database disposable dan izin/koneksi khusus; WASM bukan bukti konkurensi native |

Bukti sebelum/sesudah: tiga kasus backend baru gagal pada source main awal (B02, B03, B05), lalu lulus pada perbaikan. Batas ekspor lulus pada kedua versi dan tidak menjadi perubahan produksi. Dua regresi browser juga gagal pada source awal masing-masing B01 dan B04, lalu lulus pada perbaikan: dua submit dalam satu JavaScript task serta respons gagal batch B. Satu log resource HTTP 503 yang sengaja dipicu diuji eksplisit; error browser tak terduga tetap harus nol.

Catatan lingkungan: percobaan build dengan node_modules symlink di luar root Turbopack ditolak resolusinya. Instalasi lokal di dalam root memperbaiki hambatan lingkungan tanpa mengubah next.config atau dependensi aplikasi. Percobaan formatter lewat npx --no-install tidak menemukan executable; formatter cache lokal kemudian digunakan. Kegagalan buatan pada test pre-fix bukan kegagalan kode final.

## G. Remaining issues dan risk assessment

1. Audit struktural dan regresi tidak menjamin seluruh bug ditemukan. Peninjauan manual bukan pemeriksaan setiap baris SQL/TS; matriks di atas menyatakan cakupan aktual.
2. Helper transaksi D02 tetap memerlukan keputusan API/dokumentasi sebelum dihapus.
3. Test UI mengimpor esbuild dan postcss yang tersedia transitif pada lockfile sekarang. Ketergantungan transitif ini merupakan risiko pemeliharaan tooling ketika dependency diperbarui; tidak mengubah runtime aplikasi dan tidak ditambah dependensi baru dalam audit ini.
4. Konsistensi PostgreSQL native, konkurensi pooler, email Gmail sungguhan, serta UAT admin/guru tetap harus diverifikasi pada staging khusus sebelum menyimpulkan kelayakan operasional penuh.
5. Status unknown pada email memerlukan rekonsiliasi operator; tidak boleh diperlakukan sebagai sent atau diulang otomatis tanpa bukti. Perbaikan ini mempertahankan batas tersebut.
6. Branch/PR hasil audit disiapkan untuk review. Merge main dan deployment production tidak dilakukan dalam pekerjaan audit ini.
