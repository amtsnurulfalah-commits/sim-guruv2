# Tahap 4 — Penanganan kendala dan pemantauan

Program pengembangan profesional, 24 Oktober 2026 WIB. Scope 4.1–4.6, basis main PR #47 `e8891eacf2570386adc7a6c66e95e730fd153929`.

## Alur penanganan

Pencarian referensi UUID existing dipertahankan. Admin membuat laporan dari metadata yang masih tersedia, menuliskan konteks pengguna, dan menetapkan pelapor hanya setelah identitasnya dikonfirmasi. UUID bukan bukti bahwa suatu akun adalah pemilik permintaan: logger lama memang tidak menyimpan identitas. Pelapor boleh belum diketahui dan dapat diperbarui melalui tindakan khusus yang diaudit.

Status: Baru → Ditinjau → Diproses / Menunggu informasi → Selesai. Diproses dan Menunggu informasi dapat saling berpindah; Selesai dapat dibuka kembali ke Baru dengan alasan. Perubahan penanggung jawab pada status terbuka diperbolehkan. Selain Baru, laporan memerlukan admin aktif sebagai penanggung jawab. Penutupan memerlukan hasil perbaikan dan bukti verifikasi bersama pengguna, bukan sekadar tombol selesai.

Riwayat menyimpan pelaksana, waktu WIB, transisi, alasan/catatan internal, penanggung jawab dan konteks pelapor sebelum/sesudah, serta hasil dan bukti keputusan saat itu. Membuka/menutup kembali laporan tidak menimpa bukti keputusan lama. UPDATE riwayat ditolak; penghapusan hanya melalui retensi. Guru dan peran runtime lain tidak dapat membaca kasus/catatan maupun menjalankan pengelolaannya.

Satu UUID mengarah ke satu laporan. Admin dapat menghubungkan kejadian lain dengan modul/kode sama dan alasan; setiap referensi asli disalin sebagai metadata, bukan diganti dengan satu ID kelompok. Perbedaan kode tetap ditangani sebagai laporan terpisah. Kesamaan modul/kode bukan kesimpulan akar penyebab yang sama. Ringkasan 30 hari menghitung UUID unik dari log dan referensi tertaut sehingga tidak menggandakan kejadian.

Daftar dipaginasi SQL 20 baris, difilter status dan dicari melalui judul/modul/kode atau UUID referensi tersimpan. Tombol pencarian penanganan tersedia setelah lookup UUID, termasuk jika raw log sudah kedaluwarsa. Referensi tertaut tetap dapat ditemukan selama masa retensi laporan.

## Kewenangan, kontrak dan retry

- Autentikasi internal existing, guard server/origin/CSRF/rate/no-store dipertahankan. Case gateway memverifikasi admin lagi di SQL, tidak mempercayai role/actor dari body.
- Empat tabel private ENABLE/FORCE RLS: `ops.support_cases`, `ops.support_case_references`, `ops.support_case_history`, `ops.request_metrics`. Runtime tidak memiliki SELECT/DML langsung. Helper purge/text tetap private; auth hanya dapat mencatat agregat metrik yang dibatasi.
- Mutasi memakai version CAS dan operationKey UUID. Key/payload sama mengembalikan hasil yang sama; key sama dengan payload berbeda ditolak. Global write lock existing melindungi create/link/status dan keputusan bersaing. Status ditolak tanpa perubahan parsial.
- Form menahan pengiriman ganda. Kesalahan validasi dapat dikoreksi dalam form; hasil jaringan/5xx/konflik yang belum pasti mengunci write sampai reload status. Filter/read dibatalkan saat konteks berubah; hasil yang tidak sesuai pilihan ditolak.
- `GET /api/operations/support-cases?kind=list&page=1&q=&status=`; `kind=detail&id=UUID`; `GET /api/operations/support-monitor`.
- `POST /api/operations/support-case`: `operation=create|context|update|note|link|purge`, `operationKey`, `reason`, ditambah field sesuai Zod `src/lib/operations/support-cases.ts`. Mutasi entity memakai ID/version; penyelesaian memakai resolution/verification.
- Bukti/konteks/catatan adalah teks internal, tidak mengeksekusi HTML/URL. Pola kredensial, OTP/token assignment, bearer/private key dan URI database ditolak di Zod dan SQL. Ini tidak dapat mendeteksi semua rahasia arbitrer; jangan memasukkan rahasia dalam catatan.
- Audit bisnis jangka panjang hanya mendapat action/entity/actor/version/count dan alasan generik. Catatan bebas tidak disalin ke audit tersebut sehingga retensi kasus tidak disabotase oleh salinan teks lain.

## Pemantauan yang benar-benar diukur

Wrapper `handleModuleRequest` mengukur durasi server endpoint modul yang melaluinya. Penyimpanan memakai `after()` existing, best effort; kegagalan pencatatan tidak menggagalkan bisnis. Bucket menit per modul/status class hanya menyimpan jumlah sampel, total ms dan maksimum ms (clamp 0–600000 ms). Tidak menyimpan URL, IP, actor, cookie, body, exception, kredensial atau waktu jaringan. Login/endpoint yang tidak melalui wrapper bukan bagian sampel. Tidak ada klaim p95, Core Web Vitals, latensi job atau kapasitas produksi. Nol sampel ditampilkan sebagai belum ada sampel.

Dashboard pemantauan admin menampilkan:

- Kegagalan job, pengiriman domain/keamanan `failed`/`unknown`, antrean siap kirim dan umur tertua; tidak menampilkan body, email, token, payload keamanan atau rahasia worker.
- Heartbeat dari tiket worker yang dipakai; bukan bukti semua job/delivery sukses. Dispatch nonaktif ditampilkan agar tidak disalahartikan sebagai kegagalan.
- Waktu API per modul pada 1 jam terakhir dan pengelompokan error 30 hari.
- Ambang awal: job gagal >0, pesan failed/unknown >0, antrean siap kirim ≥15 menit, heartbeat hilang/stale ≥15 menit jika fitur worker aktif, dan rata-rata API ≥2 detik dengan ≥10 sampel/jam. Peringatan memiliki petunjuk dan tautan pemeriksaan, bukan pemicu retry/email otomatis. Sesuaikan kebijakan lanjutan setelah memperoleh baseline nyata.

Retry/reconcile tetap menggunakan operasi existing. Status unknown tidak dikirim ulang otomatis. Antrean bukan bukti email diterima. Tidak ada email eksternal/SMTP, retry job, perubahan scheduler atau finalisasi honor yang dijalankan saat validasi rilis.

## Retensi yang diuji

- Metadata error mentah dan bucket metrik DB: 30 hari.
- Kasus selesai, referensi dan riwayat internal: 365 hari setelah closed_at terakhir. Kasus terbuka dipertahankan. Bukti tertaut tetap ada setelah raw log 30 hari hilang.
- Metadata kedaluwarsa tidak tersedia melalui lookup; detail/list kasus selesai di luar 365 hari ditolak meskipun belum dibersihkan fisik.
- Purge berjalan best effort saat pencatatan error atau bucket metrik pertama serta melalui tindakan admin dengan konfirmasi/alasan. Per batch: maksimal 5000 raw event, 5000 bucket, 100 kasus selesai; FK cascade menjaga tidak ada orphan. Purge memakai lock tersendiri dan dapat diulang. Aplikasi yang tidak mendapat aktivitas memerlukan tindakan purge operator/admin; tidak mengklaim SLA penghapusan fisik tepat pada detik batas.
- Retensi ini milik database aplikasi. Retensi log runtime eksternal Vercel mengikuti pengaturan provider dan tidak diubah tahap ini. Audit bisnis/keamanan umum bukan target purge kasus.

## Source dan rilis

Migrasi `20261024062231_support_case_lifecycle_and_monitoring.sql`, precondition fingerprint logger lama, baru empat tabel dan tiga gateway bisnis. Mengganti recorder error dengan purge bounded yang mempertahankan metadata allowlist; tidak mengubah finance engine, sesi/role atau worker claim/retry/delivery.

UI utama: `case-workspace.tsx`, terintegrasi di `support-reports.tsx`. Kontrak tunggal Zod, service/gateway existing. Lihat [validation.json](validation.json) dan status PR untuk bukti rilis. Validasi lokal sintetis bukan bukti penerapan migrasi, UAT produksi, native race, beban produksi atau delivery nyata.

Berikutnya Tahap 5 — laporan kepala madrasah, setelah rilis ini dan instruksi pengguna. Izin pembaca laporan harus eksplisit; jabatan tambahan tidak otomatis mendapat akses seluruh data.

## Status rilis PR #48

Kode `d0c9a9f90a8507d7a02c20982c9fc81c637095e5`: CI run `40072027592` success, preview `dpl_G4WfwCN5evbwrTV7S5njaHzbd61v` READY. [PR #48](https://github.com/amtsnurulfalah-commits/sim-guruv2/pull/48) terbuka dan belum di-merge.

Dua percobaan penerapan exact batch melalui konektor Supabase mengembalikan `Invalid or expired requestState`. Pemeriksaan metadata setelahnya memastikan ledger tetap29, tabel kasus/metrik belum ada dan checksum Tahap4 belum tercatat. Tidak ada klaim bahwa auto-review menolak: hasil yang diterima adalah error konektor/request state, bukan alasan penolakan risiko. Tidak mengeksekusi via jalur lain. Izin eksplisit produksi yang terbaru menyebut Tahap3; minta konfirmasi langkah produksi Tahap4, lalu periksa konektor/baseline, apply batch, cek ledger30/RLS/grants/advisor, merge setelah checks dan verifikasi produksi. Frontend tidak di-merge sebelum gateway tersedia.
