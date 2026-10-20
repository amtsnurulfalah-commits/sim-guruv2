# Verifikasi Tahap 4.1–4.4

Lihat [runbook](../operations/Piket_Upacara_JTM_Tahap_4.md). Migrasi `20261019174518_duties_substitution_jtm.sql` memperluas occurrence/ledger yang ada dan menambah lima tabel FORCE RLS; tidak mengganti atau menghapus data Tahap 3.

`tests/integration/duties.test.ts` memuat upgrade dan D01–D19: jadwal/hari Senin/keunikan, klaim tanpa otoritas, konfirmasi kredit4/5, time-in, hak piket/rekap, penyesuaian/reversal jurnal, multi-alokasi/0.0001/konservasi, remove/reset, substitute/replace failure/cancel scoped, partial piket/capability revocation, preview replay/actor/version dan dua promise bersaing, final guard, privilege denial, HTTP/CSRF/onboarding, H-1 basis dan konflik weekly-vs-dated.

Regresi seluruh modul sebelumnya, lint, typecheck, unit/crypto dan build dijalankan. Jumlah tabel pada assertion keamanan diperbarui dari38 menjadi41 untuk schema app/auth_private/ops; bersama finance total45. Nilai baru tidak menggantikan pemeriksaan role, RLS dan hitungan bisnis.

Probe native dalam `stage-4-native-rollback.sql` harus tetap diakhiri ROLLBACK dan tidak mengirim email. Hasil penerapan, checksum, advisor serta deployment dicatat di `stage-4-results.json`. UAT browser nyata dan race native dua koneksi belum dinyatakan lulus.

Supabase: migrasi ke13 berhasil, checksum cocok, 45 tabel FORCE RLS; advisor keamanan tanpa temuan. Tujuh invariant native pada probe rollback lulus; akun probe tersisa0. Migrasi mengubah routine lama melalui patch body dengan checksum sebelum/sesudah agar payload konektor lebih kecil dan perubahan tidak menduplikasi body tetap; clean install/upgrade/regresi juga diuji dengan bentuk migrasi ini. Build lokal sempat gagal karena cache persistence Turbopack korup; setelah hanya .next/cache dibersihkan, build lulus.
