# Verifikasi Tahap 2.1 — Manajemen pengguna

19 Oktober2026. `npm run check` lolos: lint tanpa warning, TypeScript strict,11 unit,8 crypto dan94 skenario integrasi SQL/HTTP serta build Next.js produksi. Total113 skenario substantif; runner melaporkan119 termasuk6 parent test. Log: stage-2.1-check.txt. Tambahan19 skenario US01–US19 memakai hash Argon2id nyata, session lokal dan role runtime sim_guru_auth pada PostgreSQL WASM/PGlite.

Cakupan tambahan: batas admin/guru/onboarding, Origin/CSRF/metode, filter ketat, create aktivasi atomik, rollback enkripsi, uniqueness case-insensitive, DTO tanpa hash, pagination/filter seluruh data, NIP/desimal/normalisasi telepon, konflik versi, reissue membatalkan rahasia lama, kredensial acak TTL24jam, email terverifikasi immutable, pencabutan sesi, admin terakhir yang benar-benar siap, arsip terminal tanpa penghapusan riwayat, nonaktif/aktif, binding target+version pemulihan, penolakan sekali pakai, persetujuan mereset faktor, privilege helper dan penghapusan cookie saat edit diri sendiri.

Migrasi `20261019102819_user_management.sql` diterapkan melalui Supabase MCP, dengan pemeriksaan enam checksum migrasi sebelumnya dan pencatatan checksum migrasi ketujuh. Tidak mengubah migrasi yang sudah diterapkan. Security advisor sebelum/sesudah tanpa temuan.

Probe native PostgreSQL17.11 berjalan dalam BEGIN/ROLLBACK, sebagai sim_guru_owner karena MCP tidak berhak SET ROLE runtime auth. Assertion memeriksa daftar tanpa hash, perlindungan admin terakhir, create pending dengan NIP teks, edit/versi, stale write, larangan aktivasi langsung, reissue, arsip logis/read-only dan privilege worker/business/helper. Semua assertion selesai; akun aplikasi tetap0 setelah rollback. Ini bukan uji race native multi-koneksi. Suite lokal memeriksa role auth sesungguhnya dalam harness.

API mutasi memerlukan password admin saat ini dan audit alasan. Tidak ada pengguna/email nyata dibuat atau dikirim oleh pengujian. Browser CRUD terautentikasi, pengiriman inbox nyata dan acceptance mobile/fokus keyboard masih menunggu akun admin/bootstrap serta layanan email. Pemeriksaan HTTP produksi dicatat terpisah setelah deployment; liveness tidak membuktikan seluruh operasi CRUD.

Source commit `edfe488773b802e15be23f7f20dc320331c89456` sudah berada di main GitHub. GitHub Actions run39239340998 berstatus success. Vercel production `dpl_3NCkFCC1jnNrcT2mMNeBtJz1ajLY` READY pada region sin1. Ringkasan mesin: stage-2.1-results.json.

Smoke HTTPS canonical menghasilkan14 pemeriksaan lulus: phase2.1, status modul, empat GET anonim401/no-store, empat mutasi tanpa sesi/CSRF403, cross-origin403 dan tiga halaman admin/modul mengarahkan ke login tanpa editor privat. Bukti: stage-2.1-production-smoke.json. Pemeriksaan awal skrip gagal karena pencocokan kapitalisasi judul; assertion diperbaiki menjadi case-insensitive dan seluruh pemeriksaan dijalankan ulang.
