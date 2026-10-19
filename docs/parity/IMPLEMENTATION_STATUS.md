# Status implementasi pada Tahap 1.4

| Lingkup | Status | Bukti/batas |
|---|---|---|
| Tahap1.1 fondasi lokal | Teruji lokal | Lint/typecheck/build,9 unit tests, HTTP smoke; tidak deploy |
| Tahap1.2 migrasi/SQL privilege | Teruji lokal WASM | 3 migration,9 tabel identitas,15 function,24 skenario SQL; native/Supabase acceptance tertunda |
| F01 autentikasi/profil | Dikerjakan | Schema dan primitive DB tersedia; Argon2/aktivasi internal teruji; login/session/logout HTTP dibuat dan teruji handler lokal; onboarding lengkap/recovery menyusul |
| F02 dashboard | Belum dibuat | Beranda saat ini hanya status pembangunan |
| F03 pengguna | Dikerjakan | Routine create/status DB; belum CRUD/policy API/UI |
| F04–F19 fitur bisnis | Belum dibuat | Schema finance kosong; tidak menyajikan transaksi dummy |
| F20 otomasi/UX | Dikerjakan | Shell/feedback dasar; email/job/export belum dibuat |
| X01 fondasi lintas domain | Dikerjakan | Metadata migrasi, settings table dan audit dasar; master akademik belum dibuat |
| Native PostgreSQL/Supabase | Fondasi remote terpasang | Migrasi dan privilege diverifikasi melalui MCP; koneksi TCP/pooler dan REST acceptance belum selesai |

Matriks Tahap0.1 dalam docs/reference tetap snapshot perencanaan; status saat ini dicatat di sini. Hasil DB belum berarti T01–T50 lulus end-to-end. Tahap1.3 selesai lokal: 7 tes crypto dan10 skenario akun; lihat docs/verification/Tahap_1_3.md. Tahap1.4: 13 skenario AU dan12 pemeriksaan HTTP; lihat docs/verification/Tahap_1_4.md. Tahap1.5 berikutnya: onboarding lengkap dan pemulihan akun.
