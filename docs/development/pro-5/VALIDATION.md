# Validasi PRO-5 — 26 Oktober 2026 WIB

Semua fixture sintetis. Tidak ada transaksi/email produksi, tarif baru atau migrasi database.

| Pemeriksaan | Hasil |
| --- | --- |
| Unit | 168 lulus / 0 gagal; metadata snapshot lama/baru, presisi nilai final, mode, whitelist rute/tanggal/referensi/reversal/sequence/fakta transport |
| Crypto/HTTP/export | 43 lulus / 0 gagal; PDF tidak memutasi snapshot, OOXML tetap menyimpan nominal sebagai teks dan mencegah formula injection |
| Finance SQL khusus | 27 lulus / 0 gagal (PGlite/TAP); finalisasi, immutable snapshot/ledger, koreksi/delta, replay, periode tertutup, ownership guru, HTTP/export/rate limit |
| Finance UI | Lulus: asal perhitungan final, tarif, source reference/fallback, conceal nominal, preview/finalize/correction, PDF/Excel/history, uncertainty; 320/768/1440 serta landscape740, 0 page error/overflow |
| Jurnal UI | Lulus suite existing termasuk double submit/slow/conflict/lost receipt/draft; link `date=2090-01-05&section=history` membuka tab riwayat dan request from=to=2090-01-05 |
| Laporan UI | Lulus 7 lebar 280–1920, 200% teks/modal, source-date link, capability refresh/revoke/finance-only, projection/exact money, paging/exports; 0 page error |
| Lint / TypeScript | Lulus |
| Build | Kompilasi lokal berhasil; pemeriksaan quality pada head PR harus selesai sebelum merge |
| PDF visual | Render pdftoppm/pdftotext satu halaman A4: teks terbaca, tidak terpotong, total25300, JTM2.4000, teachingRaw24000.3000000, transportRaw333.34000000000000000000001, delta-200, ref/sequence/formula/checksum cocok dengan fixture |

Tidak melakukan aritmetika uang baru di frontend. Nilai tampilan dan PDF memakai snapshot yang sama; helper label/konteks/referensi dipakai bersama. Referensi yang tidak memiliki pemetaan halaman pasti tidak diberi tautan tebakan. Destination API tetap menerapkan sesi, role, pemilik dan periode.

Kriteria rilis: CI quality (unit/crypto/seluruh integrasi/lint/type/build) dan native-release hijau pada head yang di-merge; verifikasi tree merge, produksi READY dan SHA/alias. Rincian hasil aktual dapat diperiksa pada PR/Actions.

UAT pemahaman pengguna PRO-5.8 belum dilakukan, bukan dianggap lulus dari pengujian otomatis. Perangkat fisik/Safari/keyboard nyata dan gate backup/inbox PRO-3 tetap mengikuti catatan tahap terkait.
