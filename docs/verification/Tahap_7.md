# Verifikasi Tahap 7.1–7.5

Implementasi mencakup pengumuman bertarget dan berversi, CTA aman, penutupan per pengguna, maintenance segera/terjadwal, blok acara per jenis, antrean domain terpisah dari keamanan, retry/fencing/rekonsiliasi, scheduler menit, pekerjaan keuangan atomik, serta dashboard bersumber data sebenarnya.

Suite khusus mencakup 16 skenario substantif: RLS/privilege, sasaran dan privasi, versi/dismissal, validasi CTA/tanggal, pengecualian penutupan, default nonaktif dan deduplikasi, adapter SMTP sintetis, fencing/lease, batas percobaan, maintenance, tiket sekali pakai, monitoring tanpa payload sensitif, isolasi worker, dashboard tanpa mutasi GET, dan dispatch tanpa SMTP. Pengujian memakai PostgreSQL WASM disposable, sesi internal nyata dan adapter email sintetis; tidak mengirim email pengguna.

`npm run check` lulus: 22 unit, 13 crypto/export, 313 runner database, lint, TypeScript dan build. Total 348 runner termasuk 16 parent suite. Verifikasi produksi mencakup migrasi incremental dengan pemeriksaan seluruh checksum sebelumnya, RLS/advisor, rilis GitHub/Vercel dan pemeriksaan HTTP tanpa kredensial pengguna. Pengiriman email nyata dan UAT browser akun produksi merupakan pemeriksaan terpisah; hasil uji sintetis tidak dianggap bukti penerimaan Gmail.

Panduan pengoperasian dan aktivasi terdapat di [runbook operasional](../operations/Operasional_Tahap_7.md).

Tiga migrasi incremental diterapkan tanpa mengubah checksum migrasi lama. Pengingat menggunakan DayContext kanonis dan membentuk penugasan normal pada worker, sehingga tidak bergantung pada pengguna membuka halaman kegiatan. Kalender nonlibur tidak menonaktifkan KBM; jurnal acara tetap diperiksa saat non-KBM. Database memiliki 74 tabel FORCE RLS. Advisor mencatat satu WARN metadata ekstensi pg_net, dijelaskan di runbook.

Pengujian produksi menemukan timeout pada klaim paralel melalui pool satu koneksi. Batch kini berurutan, berhenti saat antrean kosong dan membatasi awal pengiriman ke anggaran waktu request. Uji regresi OP16 memeriksa tidak ada klaim tumpang tindih serta penghentian sesuai anggaran. Redirect halaman terlindungi dapat berbentuk HTML streaming NEXT_REDIRECT; skrip smoke mengenali bentuk tersebut.
