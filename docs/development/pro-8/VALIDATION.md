# Bukti validasi PRO-8

Aplikasi baseline `beafb5f0f3379803fd3b2619c22bda0798aaa4db` (PR77). Seluruh fixture memakai akun/data sintetis. Tidak mencoba write, login akun nyata atau pengiriman email pada produksi. Timestamp JSON UTC; pelaksanaan 26 Oktober 2026 WIB.

| Pemeriksaan ulang | Hasil / bukti |
| --- | --- |
| Lint / typecheck | Lulus lokal, diulang setelah perubahan final. |
| Unit | 172 lulus, 0gagal. |
| Crypto/HTTP | 45 lulus, 0gagal; transport, private session/origin/CSRF, redaksi, ICS escaping/waktu. |
| Integrasi lokal | 407 lulus, 0gagal; PGlite disposable, lintas akun/role, rollback/constraints/final-period/hasil tidak pasti. Bukan bukti concurrency produksi. |
| UI lintas modul | 13 suite lulus, 0exit gagal; PRO-7/manifest produksi lokal diulang lagi setelah catatan PRO-8 dan filter kategori kosong, keduanya lulus. [ui-results.json](ui-results.json). Sembilan suite U01–U10 existing ditambah preferences, PRO-7, shell dan manifest/notes produksi lokal. Waktu suite termasuk startup, bukan durasi peserta. |
| Aksesibilitas ulang | 16kasus, 0overflow, 0pageerror, 0violation axe. [pilot-a11y.json](pilot-a11y.json); selector/Tab dicatat. axe incomplete memerlukan manual review, bukan klaim pembaca layar nyata. |
| Pembanding pilot PRO-0 | Scope/browser/versi axe dan matriks font/viewport sama; baseline juga 0overflow/0violation. Tidak mengklaim penurunan durasi karena workload/source berubah dan tidak ada durasi manusia. |
| Build | Build awal berhasil setelah dependency lokal utuh. Build ulang memerlukan pembersihan cache Turbopack yang rusak (`Loading persistence directory failed`); cache dipindahkan, source tidak diubah untuk menyembunyikan error. Build final lokal berhasil; CI wajib berhasil sebelum merge. |
| Produksi anonim | 18probe lulus sebelum rilis: health200, 17API privat401 + no-store/nosniff/DENY. [anonymous-smoke.json](anonymous-smoke.json). Termasuk tiga endpoint PRO-7. Tidak membuktikan business session/DB readiness. |
| Database produksi baca-saja | 37nama/checksum cocok persis dengan source; owner/search_path/ACL/body RPC PRO-7 cocok; security advisor lints kosong. [database-review.json](database-review.json). Tidak ada migrasi baru. |
| Native CI | Wajib lulus pada commit PR akhir: identity/role isolation/concurrency, kalender/audit native, profil PRO-2 dan encrypted backup/restore disposable. Bukti/run ID mengikuti GitHub Actions PR. Drill bukan backup produksi atau angka RPO/RTO produksi. |

## Pemetaan UAT

U01 jadwal → schedules; U02 jurnal → journals; U03 pengganti → duties/confirmations/exams + integrasi; U04 konfirmasi → confirmations/duties; U05 BAP → exams; U06 slip → finance; U07 kode bantuan → support-cases; U08 tugas → tasks; U09 draft → drafts/exams; U10 hasil tidak pasti → journals/tasks/drafts/exams/finance. Ini mengulang bukti teknis, bukan keputusan manusia untuk 17percobaan yang belum_diuji pada CSV PRO-0.

## Tinjauan keamanan dan privasi

- Custom auth SiM-Guru dipertahankan; tidak memakai anon Supabase sebagai identitas pengguna. SQL guard, role business/worker/auth dan cakupan kalender/history tidak berubah.
- Smoke memverifikasi JSON401 dan no-store tanpa login. Ekspor kalender memerlukan sesi, bukan URL subscription publik. File yang sudah diunduh tetap di luar kendali logout.
- Tidak menambahkan service worker, CacheStorage, queue offline atau persistensi privat baru. Draft/preferensi/read-marker lifecycle dicakup suite existing; logout/401/pergantian akun tidak memakai data scope lama.
- Tidak menulis log/token/kredensial/email/slip/jurnal nyata ke bukti publik. Katalog migrasi dan agregat advisor saja yang diperiksa pada DB produksi. Tidak menambah dependency atau secret/config baru.
- September tetap out-of-scope. Tidak mereset attempts/job untuk mengubah tampilan angka sukses.

## Kriteria rilis dan tindak lanjut

Merge hanya setelah quality dan native-release exact-head hijau. Verifikasi tree hasil merge sama dengan PR, deployment READY pada merge SHA dan alias `sim-guruv2.vercel.app`; ulang health/smoke anonim. Catatan status aktual ada pada PR/Actions/deployment, bukan klaim bahwa seluruh gate manusia selesai. Jika rilis bermasalah gunakan prosedur pada EVALUATION.md.

UAT manusia, pembaca layar/perangkat fisik, inbox pengiriman nyata, backup produksi/RPO/RTO, install OS dan import kalender belum dibuktikan. Tidak ada window pemantauan disepakati. Semua tetap terbuka dengan owner peran dan bukti yang dibutuhkan pada [EVALUATION.md](EVALUATION.md).
