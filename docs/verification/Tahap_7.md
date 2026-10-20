# Verifikasi Tahap 7.1–7.5

Implementasi mencakup pengumuman bertarget dan berversi, CTA aman, penutupan per pengguna, maintenance segera/terjadwal, blok acara per jenis, antrean domain terpisah dari keamanan, retry/fencing/rekonsiliasi, scheduler menit, pekerjaan keuangan atomik, serta dashboard bersumber data sebenarnya.

Suite khusus mencakup 15 skenario substantif: RLS/privilege, sasaran dan privasi, versi/dismissal, validasi CTA/tanggal, pengecualian penutupan, default nonaktif dan deduplikasi, adapter SMTP sintetis, fencing/lease, batas percobaan, maintenance, tiket sekali pakai, monitoring tanpa payload sensitif, isolasi worker, dashboard tanpa mutasi GET, dan dispatch tanpa SMTP. Pengujian memakai PostgreSQL WASM disposable, sesi internal nyata dan adapter email sintetis; tidak mengirim email pengguna.

Regresi seluruh aplikasi dijalankan melalui `npm run check`. Verifikasi produksi mencakup migrasi incremental dengan pemeriksaan seluruh checksum sebelumnya, RLS/advisor, rilis GitHub/Vercel dan pemeriksaan HTTP tanpa kredensial pengguna. Pengiriman email nyata dan UAT browser akun produksi merupakan pemeriksaan terpisah; hasil uji sintetis tidak dianggap bukti penerimaan Gmail.

Panduan pengoperasian dan aktivasi terdapat di [runbook operasional](../operations/Operasional_Tahap_7.md).
