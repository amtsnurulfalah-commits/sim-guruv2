# Status implementasi pada Tahap 2.3

| Lingkup | Status | Bukti/batas |
|---|---|---|
| Tahap1.1 fondasi lokal | Teruji lokal | Lint/typecheck/build,9 unit tests, HTTP smoke; tidak deploy |
| Tahap1.2 migrasi/SQL privilege | Teruji lokal WASM | 3 migration,9 tabel identitas,15 function,24 skenario SQL; native/Supabase acceptance tertunda |
| F01 autentikasi/profil | Dikerjakan | Schema dan primitive DB tersedia; Argon2/aktivasi internal teruji; login/session/logout HTTP dibuat dan teruji handler lokal; profil/onboarding/OTP/reset/admin recovery dan adapter email dibuat; delivery produksi menunggu provider |
| F02 dashboard | Kerangka tersedia | Dashboard guru/admin, status modul dan gate business; ringkasan kegiatan/keuangan belum dibuat |
| F03 pengguna | Tersedia dan teruji | API/UI admin, daftar/filter/pagination, profil/peran/status/arsip, aktivasi dan keputusan pemulihan; penerimaan browser akun nyata masih menunggu onboarding/email |
| Master sekolah/akademik/tarif/tunjangan (X01, F19/F16 sebagian) | Tersedia dan teruji | API/UI, validasi jenjang/relasi/semester aktif, versi efektif dan audit; bukan kalkulasi honor final |
| Kalender/DayContext (F17 sebagian) | Tersedia dan teruji | Catatan/nonlibur/libur/rentang, resolver, preview/commit, audit dan dashboard; auto-jurnal/bonus/worker serta adapter penugasan/finance menyusul |
| F04–F19 fitur bisnis lainnya | Belum dibuat | Jadwal KBM menyusul2.4; schema finance kosong, tanpa transaksi dummy |
| F20 otomasi/UX | Dikerjakan | Shell responsif, sidebar/disclosure/mobile dialog, session/logout bersama dan feedback tersedia; email produksi/job/export menunggu tahap terkait |
| X01 fondasi lintas domain | Dikerjakan | Metadata migrasi, settings dan audit; master akademik tersedia, kalender/DayContext tersedia; snapshot honor/adapter penugasan menyusul |
| Native PostgreSQL/Supabase | Fondasi remote terpasang | Sembilan migrasi dan privilege diverifikasi; dua LOGIN melalui pooler Vercel teruji dengan TLS, adapter auth, rollback dan Argon2id; REST acceptance dan browser interaktif masih tertunda |

Matriks Tahap0.1 dalam docs/reference tetap snapshot perencanaan; status saat ini dicatat di sini. Hasil DB belum berarti T01–T50 lulus end-to-end. Tahap1.3 selesai lokal: 7 tes crypto dan10 skenario akun; lihat docs/verification/Tahap_1_3.md. Tahap1.4: 13 skenario AU dan12 pemeriksaan HTTP; lihat docs/verification/Tahap_1_4.md. Tahap1.5 teruji lokal; lihat docs/verification/Tahap_1_5.md. Delivery email nyata menunggu konfigurasi provider. Tahap2.1: lihat docs/verification/Tahap_2_1.md. Tahap2.2: lihat docs/verification/Tahap_2_2.md. Tahap2.3: lihat docs/verification/Tahap_2_3.md. Berikutnya2.4 jadwal KBM.

Tahap1.6: lihat docs/verification/Tahap_1_6.md. Tahap2.1: lihat docs/verification/Tahap_2_1.md. Tahap2.2: lihat docs/verification/Tahap_2_2.md. Tahap2.3: lihat docs/verification/Tahap_2_3.md. Berikutnya2.4 jadwal KBM. Admin bootstrap telah dibuat19Oktober2026. Onboarding lengkap dan email nyata masih menunggu konfigurasi layanan email.
