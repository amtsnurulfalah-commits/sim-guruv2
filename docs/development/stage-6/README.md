# Tahap 6 — Persiapan semester baru

Halaman admin `/admin/persiapan-semester` menyediakan pemilihan semester sumber/tujuan, konfigurasi, pratinjau pemetaan ID/rentang, pemeriksaan bentrok dan penerapan atomik. Tidak ada perubahan mesin honorarium, autentikasi atau alur operasional lama.

## Kontrak 6.1–6.5

| ID | Hasil |
| --- | --- |
| 6.1 | Allowlist: kelas saja, atau kelas beserta jadwal KBM. Kehadiran, occurrence/assignment/konfirmasi, jurnal/BAP, ledger/reversal, slip, koreksi dan hak libur tidak disalin. |
| 6.2 | Pilih dua semester berbeda, konfigurasi dan alasan 5–500 karakter. Hanya admin dengan sesi business sah. |
| 6.3 | ID kelas/jadwal baru dibuat server saat preview dan dipertahankan saat commit. Preview menampilkan ID sumber→tujuan, guru/kelas/mapel, hari/jam/JTM serta rentang baru. |
| 6.4 | Sumber/tujuan tidak diarsipkan; tujuan setelah akhir sumber, belum aktif, mulai setelah hari ini WIB, maksimal 366 hari. Target yang telah berisi kelas/jadwal/tugas/ujian/occurrence ditolak. Periksa guru/mapel aktif, tingkat/paralel kelas, menit/JP, hari tersedia, bentrok guru/kelas/waktu. |
| 6.5 | Global advisory write lock yang sama dengan master/jadwal; fingerprint konfigurasi/dependency; actor-bound preview 10 menit; satu transaksi mencakup kelas/jadwal/audit/receipt. Replay preview yang sudah berhasil mengembalikan receipt asli; preview berbeda setelah target terisi ditolak. |

## Kebijakan penyalinan

- Kelas aktif sumber disalin dengan tingkat, paralel dan nama yang sama. Jumlah siswa tujuan **0**, bukan jumlah siswa semester lama; admin harus memperbaruinya sebelum operasional.
- Jadwal yang disalin adalah konfigurasi **active dan masih berlaku pada hari terakhir semester sumber**. Segmen closed/archived atau yang berakhir sebelum akhir sumber tidak diperpanjang. Tidak ada promosi tingkat/rombel otomatis.
- Rentang jadwal baru adalah seluruh semester tujuan. Hari, jam, JTM dan istirahat dipertahankan hanya bila menit per JP masih sesuai profil saat ini. Jika kebijakan JP berubah, pratinjau diblokir dan admin menyusun jadwal baru melalui modul jadwal.
- Kelas baru melewati trigger validasi/audit master. Jadwal dibangun ulang oleh **`app.schedule_candidate` yang sudah ada** dan melewati trigger bentrok/integritas/audit yang sama. Tidak ada engine jadwal/honor frontend kedua.
- Jadwal piket/upacara, ujian/BAP, acara, kalender, tarif, tunjangan dan konfigurasi operasional tidak disalin pada allowlist awal. Tetap disiapkan melalui modul masing-masing. Guru, akun serta mata pelajaran merupakan referensi global yang digunakan ulang, bukan diduplikasi.
- Semester tujuan tetap **belum aktif**. Admin meninjau kelas, jumlah siswa, jadwal dan konfigurasi lain sebelum mengaktifkannya melalui Data Master. Tidak ada perubahan periode aktif sumber.

## Otorisasi, stale dan retry

Tabel private `ops.semester_preparations` ENABLE/FORCE RLS, hanya policy owner internal. Business tidak dapat membaca tabel atau menjalankan helper basis/plan. Gateway read/preview/commit memeriksa sesi lokal/onboarding/maintenance/admin. GET memakai cross-site read guard; POST origin/CSRF dan rate limit. Preview/query/commit memakai schema Zod strict; browser tidak dapat mengirim rencana bebas pada commit, hanya ID preview server.

Fingerprint hanya memuat konfigurasi dan referensi yang relevan (dua periode/tahun, kelas/jadwal sumber/tujuan, sekolah, guru/mapel terkait, serta flag target terisi). Tidak memuat kredensial atau isi jurnal. Perubahan sumber/target/dependency membatalkan preview. Commit memeriksa ulang fingerprint, expiry, tanggal dan seluruh constraint. Kegagalan setelah kelas pertama dibuat membatalkan seluruh transaksi termasuk audit dan receipt.

Jika koneksi terputus setelah commit, UI mengunci pengiriman baru dan menawarkan **Periksa hasil pratinjau**. Receipt diperiksa terhadap ID/pemetaan yang telah ditinjau sebelum UI menampilkan sukses. Jika belum ada hasil, retry **preview yang sama** aman karena lock dan idempotensi server. Riwayat 20 penerapan terbaru tersedia setelah reload; daftar hanya mengirim ringkasan, bukan seluruh mapping. Receipt/mapping rinci hanya melalui lookup milik actor. Bukti disimpan pada activity revisions/audit serta preparation record.

## UI dan batas

Menggunakan DataForm/FormDialog, Pagination, TableRegion, ErrorFeedback dan Button bersama. Pemetaan 25 baris per halaman; maksimum 500 kelas dan 2.000 jadwal dalam satu rencana. Kondisi loading/error/temuan/konfirmasi/hasil tidak pasti/receipt/riwayat ditangani. Tabel memiliki scroll lokal, teks ID wrapping dan dialog dibatasi viewport.

Pengujian PGlite/Chromium sintetis tidak membuktikan native multi-process concurrency, perangkat fisik, capacity/latency produksi atau UAT sekolah. Bukti dan status rilis aktual pada validation.json dan PR. Tidak menjalankan persiapan semester pada data produksi nyata sebagai smoke test.

## Migrasi dan rollback

Migrasi menambah satu tabel private dan lima fungsi (basis, plan, read, preview, commit), serta dua indeks pada tabel baru. Tidak backfill/salin konfigurasi pengguna atau mengubah routine lama. Produksi harus menerapkan migrasi sebelum aplikasi baru dirilis. Artifact batch rilis memeriksa checksum seluruh 31 migrasi sebelumnya, advisory lock dan timeout, lalu menulis ledger32. Uji batch dilakukan disposable dan normal runner replay harus no-op.

Jika perlu rollback aplikasi, gunakan deployment sebelumnya; schema tambahan boleh tinggal. Jangan menghapus semester/riwayat secara otomatis untuk membatalkan hasil yang telah dipakai. Koreksi konfigurasi melalui modul master/jadwal dengan pemeriksaan referensi yang sudah ada.

## Status migrasi produksi

Pengguna memberi izin eksplisit dan mengonfirmasi koneksi Supabase telah diperbarui. Batch yang sama berhasil diterapkan; ledger32/checksum/RLS/grants/helper/advisor terverifikasi dan hash routine jadwal/honorarium tetap sama. Error requestState dan blok pengulangan sebelumnya terselesaikan setelah pemulihan konektor. Tidak ada konfigurasi semester nyata yang disalin sebagai smoke.

Status merge/deployment akhir mengikuti [PR50](https://github.com/amtsnurulfalah-commits/sim-guruv2/pull/50). Setelah final checks:merge expected-head dan verifikasi produksi READY/health/API anonim401. Tahap7 menunggu instruksi pengguna.
