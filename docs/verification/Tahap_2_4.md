# Verifikasi Tahap 2.4 — Jadwal KBM

Implementasi: CRUD jadwal mingguan, filter guru/mapel/kelas/hari/tahun/semester dan pencarian, pagination, rekap seluruh filter, cetak seluruh halaman, jadwal pribadi/hari ini, deteksi bentrok guru/kelas, penghentian massal preview/commit dan audit.

- Lint dan typecheck lulus. Suite lengkap:20 unit +8 crypto +173 integrasi =201 skenario substantif; runner210 termasuk9 induk. Setelah penambahan filter tahun/cetak, lint/typecheck dan30 skenario jadwal dijalankan ulang dan lulus.
- Build pertama gagal membaca cache persistence Turbopack lokal. Setelah cache dibersihkan, build produksi bersih lulus; tidak ada perubahan konfigurasi produksi untuk melewati error.
- Sepuluh checksum migrasi sesuai sumber. Migrasi teaching_schedules menambah2 tabel; total25 tabel domain ENABLE/FORCE RLS. Security advisor sesudah migrasi tanpa temuan.
- Probe PostgreSQL17 remote memakai owner internal dalam BEGIN/ROLLBACK: derived duration2.4000JTM +5menit, bentrok, adjacency, CAS, filter tahun/rekap, bulk commit/replay dan privilege runtime lulus. Tidak menguji jalur HTTP business dengan admin nyata. Data fixture di-rollback.
- SC01–SC30 mencakup upgrade inkremental, scope sesi, Origin/CSRF, validasi relasi/waktu, bentrok dan batas interval, revisi maju/snapshot, DayContext/libur, preview usang, actor/TTL/replay, least privilege dan fail closed modul masa depan. Fault injection pada item kedua bulk membuktikan item pertama dan consumption preview ikut rollback.
- `test:schedules:native` menyediakan NR01/NR02 dua koneksi dengan dua admin berbeda. Belum dijalankan: lingkungan menolak pergantian UID untuk memulai PostgreSQL lokal. PGlite maupun probe native berurutan tidak dianggap bukti race native lulus.

Batas: onboarding/email admin nyata belum lengkap; CRUD browser admin belum dibuktikan. Belum ada occurrence, konfirmasi, jurnal, substitusi, eligibility H-1, bonus libur atau posting honor. Bentrok mingguan ditolak secara konservatif meskipun KBM sementara nonaktif. Rekap berbasis baris jadwal, bukan realisasi presensi/honor. Rincian operasional: ../operations/Jadwal_Tahap_2_4.md.

Source commit `8f7efcc99cb382dd036006fa3537c8be8c619907` dipush ke main. GitHub Actions39252448971 lulus seluruh npm run check pada source final. Deployment `dpl_DwnS4NWv1HLRpaRMLZLkY3zzCz3P` READY pada https://sim-guruv2.vercel.app. Bukti rinci: stage-2.4-results.json dan stage-2.4-production-smoke.json.

Seluruh17 pemeriksaan HTTPS produksi lulus: health/kesiapan200, enam API anonim401 no-store, enam mutasi tanpa CSRF403, cross-origin403 dan dua halaman mengalihkan ke login. Tidak memakai credential admin dan tidak mengubah data domain.
