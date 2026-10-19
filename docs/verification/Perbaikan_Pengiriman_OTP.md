# Verifikasi perbaikan pengiriman OTP

Lint, typecheck,21unit +8crypto +186integrasi =215skenario substantif;226 hasil runner termasuk11 induk. Pengujian OTP baru OD01–OD09 memverifikasi: konfigurasi hilang503 tanpa membuat challenge; pengiriman challenge baru bukan pesan lama; kode mock yang terkirim dapat diverifikasi; cooldown/replay; retry_wait; failed; unknown; challenge superseded/kedaluwarsa; privilege; error worker tidak membocorkan data. Semua jaringan email memakai adapter mock lokal, bukan inbox pengguna.

Build lokal sempat gagal membaca cache persistence Turbopack. Setelah .next/cache dibersihkan, build bersih lulus. Log lengkap ada pada otp-fix-check.txt, otp-fix-build-clean.txt dan otp-fix-dispatch.txt.

Migrasi security_otp_dispatch diterapkan dengan10checksum sebelumnya diverifikasi. Ledger sekarang11 migrasi domain;25tabel tetap ENABLE/FORCE RLS; advisor security tanpa temuan. Provisioning LOGIN worker terpisah dari migrasi domain. Metadata role membuktikan hanya anggota worker, bukanowner/superuser/createdb/createrole/bypassRLS, tidak dapat membaca kredensial dan dapat memanggil claim terarah.

Probe PostgreSQL remote dalam BEGIN/ROLLBACK memverifikasi queue→claim challenge spesifik→penolakan claim ganda→ack→penghapusan secret, tanpa menghubungi provider atau menyisakan fixture. Probe TCP worker dari lingkungan lokal tertahan DNS EAI_AGAIN; probe dari deployment Vercel kemudian lulus menggunakan LOGIN worker nyata melalui pooler, dengan verifikasi TLS dan tanpa perubahan data. Hasilnya ada pada otp-fix-worker-runtime-probe.json.

Production Environment Variables telah menampung WORKER_DATABASE_URL sebagai sensitive dan MAIL_PROVIDER=resend. MAIL_API_KEY/RESEND_API_KEY serta MAIL_FROM masih belum tersedia; klaim pengiriman email nyata tetap false. Endpoint menampilkan layanan email belum siap sampai konfigurasi sah dipasang. Provideraccepted bukan bukti inboxdelivered; tidak ada bypass verifikasi email atau OTP plaintext pada respons.

Hasil source/deployment/CI/HTTPS dicatat setelah push pada otp-fix-results.json. Konfigurasi dan batas operasional: ../operations/Pengiriman_OTP.md.

Source0c41b68864683719ca0124f22d85d3ed0adec054 sudah dipush. Deployment dpl_AZZH9WJX5UX4ViTe2moT52ezPWfY READY; build menjalankan probe worker read-only sebelum build Next.js. Semua8 HTTPS smoke lulus. GitHub Actions39284404574 masih queued ketika bukti disimpan; tidak diklaim lulus. MAIL_API_KEY/RESEND_API_KEY dan MAIL_FROM belum dipasang setelah pemeriksaan metadata terakhir.
