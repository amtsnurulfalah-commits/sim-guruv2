# Audit keamanan Tahap 8

Cakupan: source main setelah Tahap 7, seluruh 32 migrasi, gateway API, sesi internal dan tool backup/restore. Acuan keluarga kontrol [OWASP ASVS 5.0.0](https://asvs.owasp.org/), bukan klaim sertifikasi/penetration test lengkap. Inspeksi source dan tes negatif melengkapi satu sama lain.

| Kontrol | Source / bukti yang ditinjau | Hasil / batas |
|---|---|---|
| Autentikasi internal | auth/service, passwords, auth/http; crypto/auth-http/lifecycle/accounts tests | Argon2id, respons kredensial generik, rate persisten, CAS/revokasi, onboarding; tidak mengganti dengan SSO/Supabase Auth |
| Sesi | cookie __Host Secure/HttpOnly/SameSite, read_session/resolve_actor/lifecycle_self | Absolut/idle, bukti token hash dan user status/auth_version, context transaction-local; native suite menguji context commit/rollback, revoke dan temp/search_path |
| CSRF, Origin, body | auth/security, gateway modul; integration HTTP tests | POST memerlukan Origin+token terikat sesi; cross-site read ditolak; JSON dibatasi; cookie duplikat ditolak. Worker memakai tiket terpisah sekali pakai |
| Otorisasi | gateway app/auth_private/finance/ops; role/pageSession | SQL tetap sumber izin, ID dari client tidak memberi kewenangan; admin/guru/petugas kontekstual dan laporan pimpinan eksplisit. Menu bukan kontrol keamanan |
| RLS/privilege seluruh schema | tests/integration/release.test.ts dan native DB/race suites | Semua tabel privat FORCE RLS, tanpa grant PUBLIC; seluruh definer pin trusted search_path; tanpa PUBLIC execute. Tidak memperluas grant/API publik |
| Injeksi / ekspor | parameter SQL, sqlJson/typed text, CSV formula escaping, XLSX XML escaping | Identifier dinamis melalui allowlist. Pemeriksaan literal source tidak menemukan eval/new Function/dangerouslySetInnerHTML pada source aplikasi. Bukan bukti semua kelas XSS tersertifikasi |
| Log / rahasia | supportEvent, recordSupportEvent, authResponse/error mapping; accounts HTTP | Caller membuat metadata allowlist, exception/bodies/cookie/URL tidak dicatat. Tidak ada secret/database credential NEXT_PUBLIC pada source. Kredensial produksi tidak diekspor untuk audit |
| Worker / hasil tidak pasti | DomainOutboxWorker, SecurityOutboxWorker, lease/fence SQL, integration operations/mail | Ambiguous SMTP bukan blind retry; restore kini menetralkan sending/unknown dan secret/challenge lama, selain menonaktifkan dispatcher |
| Supply chain | package-lock, npm audit, CI pinned SHAs | Versi paket fixed; audit prod0 temuan pada pelaksanaan ini. GitHub actions v4 dipin ke commit yang diverifikasi dari repository resmi; checkout tidak menyimpan token ke working tree. Audit hanya advisory yang tersedia saat dijalankan |
| Backup / integritas | backup-crypto, restore-inventory, recovery; release.test + native drill | AES-256-GCM context v2 mengikat manifest dan dump; fingerprint seluruh baris, schema/ACL/policy/constraint/index/trigger/default, migrasi dan NUMERIC; legacy tetap dilabeli verifikasi terbatas |

## Temuan dan perbaikan

1. Inventori lama terutama counts/agregat. Pergantian isi dengan jumlah sama atau perubahan grants bisa lolos: format 2 membandingkan digest isi setiap tabel dan metadata skema/ACL yang dinormalisasi, plus ledger migrasi.
2. Manifest inventori/waktu belum diautentikasi bersama ciphertext: context v2 memasukkan checksum metadata ke AES-GCM AAD. Tamper/downgrade/wrong-key/truncation ditolak. Default contextv1 tetap untuk backup legacy; jangan mengklaim pemeriksaan format 2 pada arsip lama.
3. Restore sebelumnya hanya membatalkan pending/retry, meninggalkan lease sending/unknown dan bahan reset/aktivasi. Restore disposable sekarang mencabut sesi, membatalkan antrean aktif, menghapus payload secret dan menandai challenge superseded. Notifikasi finance pending menjadi failed karena enum tidak punya cancelled; ini hanya isolasi hasil restore, bukan mengubah sumber.
4. Native tests sebelumnya opsional/manual. Job native-release kini wajib dijalankan workflow pada push/PR, tanpa produksi/secret: role/session, dua koneksi bersaing, pg_dump terenkripsi → pg_restore → inventori/smoke.
5. Profil awal riwayat seluruh guru dengan12.060 baris dan4 permintaan akun yang sama menemui lock_timeout. lifecycle_self memang mengunci akun/sesi. Batas ini dipertahankan sebagai temuan kapasitas, bukan disembunyikan sebagai SLO berhasil. Profil per-guru dipisahkan dan riwayat global satu request diukur tersendiri. Sebelum menaikkan beban/global paralel, uji dataset operasional dan kaji caching predicate/admin serta query plan dengan regresi otorisasi; tidak mengubah lock/SQL bisnis dalam rilis tooling ini.

## Batas dan tindak lanjut operasional

Tidak ada akses isi akun/keuangan produksi, pengiriman email nyata, scan penyerangan produksi, rotasi credential, freeze produksi atau restore produksi. Pemeriksaan metadata/advisor bersifat read-only; hasil produksi tidak disalin ke artefak CI. Tidak ada migrasi schema pada rilis ini. Pemeriksaan negatif membuktikan kasus yang diuji, bukan semua kemungkinan serangan.

Penerimaan email end-to-end, perangkat fisik/pembaca layar, kapasitas WAN/produksi, backup Storage/secret/provider serta RPO/RTO produksi tetap memerlukan latihan operator yang dijadwalkan dan bukti privat. RPO/RTO drill sintetis bukan jaminan layanan produksi. Rekam perbaikan lanjutan pada backlog; kerentanan kritis baru membatalkan rilis terkait.
