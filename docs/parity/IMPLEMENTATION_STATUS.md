# Status implementasi pada Tahap 1.6

| Lingkup | Status | Bukti/batas |
|---|---|---|
| Tahap1.1 fondasi lokal | Teruji lokal | Lint/typecheck/build,9 unit tests, HTTP smoke; tidak deploy |
| Tahap1.2 migrasi/SQL privilege | Teruji lokal WASM | 3 migration,9 tabel identitas,15 function,24 skenario SQL; native/Supabase acceptance tertunda |
| F01 autentikasi/profil | Dikerjakan | Schema dan primitive DB tersedia; Argon2/aktivasi internal teruji; login/session/logout HTTP dibuat dan teruji handler lokal; profil/onboarding/OTP/reset/admin recovery dan adapter email dibuat; delivery produksi menunggu provider |
| F02 dashboard | Kerangka tersedia | Dashboard guru/admin, status modul dan gate business; ringkasan kegiatan/keuangan belum dibuat |
| F03 pengguna | Dikerjakan | Routine create/status DB; belum CRUD/policy API/UI |
| F04–F19 fitur bisnis | Belum dibuat | Schema finance kosong; tidak menyajikan transaksi dummy |
| F20 otomasi/UX | Dikerjakan | Shell responsif, sidebar/disclosure/mobile dialog, session/logout bersama dan feedback tersedia; email produksi/job/export menunggu tahap terkait |
| X01 fondasi lintas domain | Dikerjakan | Metadata migrasi, settings table dan audit dasar; master akademik belum dibuat |
| Native PostgreSQL/Supabase | Fondasi remote terpasang | Enam migrasi dan privilege diverifikasi; dua LOGIN melalui pooler Vercel teruji dengan TLS, adapter auth, rollback dan Argon2id; REST acceptance dan browser interaktif masih tertunda |

Matriks Tahap0.1 dalam docs/reference tetap snapshot perencanaan; status saat ini dicatat di sini. Hasil DB belum berarti T01–T50 lulus end-to-end. Tahap1.3 selesai lokal: 7 tes crypto dan10 skenario akun; lihat docs/verification/Tahap_1_3.md. Tahap1.4: 13 skenario AU dan12 pemeriksaan HTTP; lihat docs/verification/Tahap_1_4.md. Tahap1.5 teruji lokal; lihat docs/verification/Tahap_1_5.md. Delivery email nyata menunggu konfigurasi provider. Tahap2.1 berikutnya: manajemen pengguna.

Tahap1.6: lihat docs/verification/Tahap_1_6.md. Tahap2.1 berikutnya: manajemen pengguna. Pengiriman email dan admin nyata tetap belum diprovision.
