# Verifikasi Tahap 2.3 — Kalender dan konteks hari

19 Oktober2026. Full check lolos lint/TypeScript,16 unit,8 crypto dan143 skenario integrasi SQL/HTTP;167 skenario substantif, runner175 termasuk8 parent test, serta build produksi. Log: stage-2.3-check.txt. Tambahan25 integrasi kalender (CA01–CA25) dan3 unit. Setelah menambahkan assertion dashboard memakai resolver yang sama, suite kalender dan lint dijalankan ulang; log stage-2.3-calendar-final.txt (26 termasuk parent, semuanya lolos).

CA mencakup upgrade/no-op/RLS23 tabel, admin/guru/onboarding, Origin/CSRF/method/spoofing, default weekday/no-period, B25/T41 nonholiday, preview read-only, one-use actor/action-bound, stale karena kalender/semester, expiry, libur, CAS, soft delete/restoration/audit, range inklusif dan all-or-nothing, date nyata/ukuran/past, Sunday/explicit dual modes tanpa kredit, prioritas libur, clear, binding semester, parent guard, filter/pagination dataset, fingerprint baru tanpa cache, fail-closed adapter, privilege helper/worker/auth, envelope/no-store/sanitasi dan sesi dicabut. Unit memeriksa batas tengah malam WIB,366hari/leap date dan strict schema mode.

Percobaan awal2 kasus invalid schema gagal pada assertion asynchronous karena metode service melempar Zod secara sinkron. Metode publik diseragamkan menjadi async; suite kemudian lolos. Tes fondasi/masters memperbarui jumlah tabel19→23 dan tetap mewajibkan ENABLE/FORCE RLS pada seluruh tabel; tidak mengurangi pengamanan.

## PostgreSQL produksi

Migrasi `20261019113611_calendar_day_context.sql` diterapkan dengan pemeriksaan8 checksum sebelumnya; ledger menjadi9. Security advisor sebelum/sesudah tanpa temuan. Preview/payload hanya melalui entry point business, helper/worker/auth tidak diberi akses.

Probe native17.11 melalui MCP menggunakan owner internal, hash Argon2id sintetis, BEGIN/ROLLBACK; bukan membership runtime business dan bukan bukti race native multikoneksi. Assertion memeriksa default KBM, ordinary note/T41, preview tanpa perubahan kalender, replay, holiday/delete/default, riwayat, stale commit, rentang/collision tanpa parsial, Sunday/explicit override/no invented exam periods, tanggal lampau dan privilege. Semua selesai; setelah rollback pengguna tetap1, calendar/override/preview masing-masing0, ledger9. Akun admin dan data nyata tidak diubah; tidak ada kalender/libur sintetis tersimpan.

## Batas penerimaan

Belum ada modul penugasan/ujian/keuangan: adapter menyatakan not_installed dan fail-closed bila modul ditambahkan tanpa integrasi. Tidak mengklaim seluruh K09 konflik jadwal atau lock honor final sudah terimplementasi. Auto-jurnal, bonus, posting, reminder/worker bukan cakupan tahap ini. Tidak mengirim email atau memakai credential admin nyata. Browser terautentikasi, mobile/keyboard/fokus dan race native multikoneksi masih acceptance lanjutan setelah onboarding/email selesai.

Status GitHub/CI/deployment dan pemeriksaan HTTPS dicatat setelah source disinkronkan. Liveness bukan bukti CRUD browser penuh.

Source commit `4c3c1167d7a8a6358538b84bb30c1bbe50005477` berada di main GitHub. GitHub Actions run39247782778 success (full check termasuk build). Vercel production `dpl_3EtaRo34sdCSA6cC4hwzJN1qwe25` READY pada region sin1, alias canonical https://sim-guruv2.vercel.app. Ringkasan mesin: stage-2.3-results.json.

Smoke HTTPS canonical:17 pemeriksaan lolos (phase2.3, status kalender,5 GET anonim401/no-store,7 mutasi tanpa sesi/CSRF403, cross-origin403 dan2 halaman admin/modul mengarahkan ke login tanpa pratinjau privat). Bukti: stage-2.3-production-smoke.json. Tidak menggunakan credential admin atau mengubah kalender produksi.
