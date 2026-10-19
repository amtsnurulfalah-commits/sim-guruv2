# Migrasi identitas — Tahap 1.2

Tiga migrasi berurutan: role/schema → tabel identitas → routine privat dan policy. SQL diterapkan oleh runner dalam satu transaksi dengan lock dan checksum; jangan menjalankan berkas satu per satu tanpa transaksi karena memakai SET LOCAL ROLE.

```bash
npm run db:migrate
npm run db:migrate -- --apply
```

Perintah pertama hanya menampilkan rencana, tanpa koneksi. `--apply` membutuhkan MIGRATION_DATABASE_URL administratif yang dipilih operator. Remote juga membutuhkan `--allow-remote`; tidak ada fallback ke DATABASE_URL/AUTH_DATABASE_URL. Migrasi tidak pernah membuat LOGIN/password DB atau menghubungi produksi secara otomatis. Jangan mengubah file yang sudah diterapkan: runner menolak checksum berbeda. Buat migrasi tambahan.

Role group NOLOGIN: sim_guru_owner, sim_guru_business, sim_guru_auth, sim_guru_bootstrap, sim_guru_worker. Login DB nyata dibuat terpisah oleh administrator proyek dan hanya menjadi member satu group runtime yang sesuai. Owner/bootstrap bukan role runtime aplikasi. Credential business dan auth harus berbeda; URL harus mengarah database aplikasi yang sama.

Empat schema domain: app, auth_private, finance, ops. Finance/worker belum mendapat tabel/permission bisnis; semua fitur keuangan tetap tahap berikutnya. sim_guru_migration adalah metadata runner yang hanya dapat diakses administrator migrasi. Default PUBLIC EXECUTE function dicabut secara global untuk role pemilik khusus aplikasi, bukan hanya per-schema. Object milik role/proyek lain tidak diubah.

Schema app/auth_private/finance/ops tidak boleh masuk daftar exposed schemas PostgREST. Auth lokal tidak menghasilkan JWT Supabase Auth; auth.uid() tidak dipakai. Service-role yang melewati RLS tidak digunakan sebagai koneksi runtime database. Tidak ada endpoint browser yang mengakses tabel langsung.

Lihat docs/operations/Database_Tahap_1_2.md untuk batas privilege, jalur provisioning serta cara uji lokal/native. Jangan menggunakan routine issue_session/set_password_after_verification sebagai endpoint publik: routine tersebut mempercayai layanan auth server yang wajib memverifikasi password dan rate limit pada 1.3–1.4.

Tahap1.5 memakai file 14digit hasil `supabase migration new account_lifecycle` (CLI2.121.0). Runner menerima versi lama12digit dan versi CLI14digit; file historis tidak diubah.
