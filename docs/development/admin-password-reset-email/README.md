# Email reset password dari Manajemen Pengguna

## Alur admin dan pemilik akun

1. Admin membuka **Manajemen pengguna**, lalu memilih **Kirim email reset password** pada akun aktif dengan email terverifikasi. Akun yang belum aktif memakai fitur aktivasi yang sudah ada; akun tanpa email terverifikasi memakai pemulihan identitas.
2. Modal menampilkan nama/username dan alamat tujuan yang tersimpan. Admin mengisi alasan dan mengonfirmasi kata sandinya sendiri. Tidak ada isian alamat email pengganti atau kata sandi baru pengguna.
3. Server memeriksa session business/admin, origin, CSRF, payload ketat, rate limit, kata sandi admin, ID/versi target dan kelayakan email. Dalam satu transaksi, fungsi SQL mengunci target dan memakai antrean OTP kanonik, memperbarui versi untuk mencegah pengulangan, serta mencatat admin, target dan alasan.
4. Sesudah transaksi commit, worker khusus mencoba mengirim **pesan tersebut**, memakai pengaturan mail yang sudah ada. Respons membedakan `accepted` (diterima penyedia), `pending`, `failed`, dan `unknown`. Antrean maupun penerimaan penyedia bukan bukti email masuk inbox.
5. Pemilik menerima email berisi OTP dan tautan `/lupa-password#challengeId=...`. Membuka tautan menyiapkan formulir verifikasi; fragment dibersihkan dari alamat browser. Tidak ada OTP/token reset dalam URL, dan tidak ada perubahan kata sandi pada GET.
6. OTP berlaku 10 menit, maksimal lima percobaan. Setelah OTP terbukti, capability reset lima menit digunakan untuk menyimpan kata sandi baru sesuai kebijakan. Password reset hanya sekali pakai; sesi/challenge lama dicabut saat reset selesai. Mengirim email saja tidak mengganti password atau mengakhiri sesi target/admin.

## Kontrak

`POST /api/users/{id}/reset-email`

Body: `{ version, currentPassword, reason }`. `reason` 5–500 karakter; ID berupa UUID; konfirmasi admin mengikuti batas input password yang sama dengan tindakan pengguna lainnya. Field tambahan seperti `email`, callback URL, atau password baru ditolak.

Respons sukses: `{ ok: true, data: { user, delivery: "queued", emailDelivery: "accepted" | "pending" | "failed" | "unknown" }, requestId }`.

OTP, challenge ID internal, ciphertext dan capability reset tidak dikembalikan kepada admin. Provider dipanggil setelah commit, agar kegagalan koneksi tidak menghilangkan antrean yang sah atau menahan lock database. Respons yang hilang tidak diulang otomatis. Versi lama ditolak 409; permintaan ulang kurang dari 60 detik per target ditolak 429. Penolakan target memakai `RESET_EMAIL_NOT_ALLOWED`.

## Penyimpanan dan deployment

Migrasi `20261025075334_admin_password_reset_email.sql` menambahkan satu fungsi `auth_private.users_queue_reset_email`. Tidak menambah tabel, grant tabel, role, policy publik atau akses worker/business/anon. Fungsi memiliki owner dan `search_path` tetap seperti fungsi administrasi kanonik; EXECUTE hanya untuk `sim_guru_auth`, dan admin/session divalidasi lagi di SQL.

Antrean, challenge, AES-GCM, HMAC, batas OTP, dedupe, worker lease, sanitasi log, dan penyelesaian password reset memakai implementasi yang sudah ada. Nilai OTP hanya berada dalam memori pengiriman dan payload terenkripsi; tidak masuk response admin/audit. Audit baru: `users.password_reset_email_queued`.

Terapkan migrasi aditif sebelum kode produksi yang memanggilnya. Catat checksum file ke ledger `sim_guru_migration.schema_migrations` jika migrasi dijalankan melalui adapter Supabase, agar runner aplikasi tidak menerapkan file yang sama lagi. Tidak mengirim email ke pengguna nyata sebagai smoke test.

## Validasi

- `npm run check`: lint, typecheck, 160 unit, 37 crypto/HTTP, 382 hasil integrasi database, build.
- Integrasi khusus menjalankan SQL, hash password, antrean, worker dengan adapter email sintetis, OTP salah/benar, konsumsi sekali, password baru dan pencabutan sesi target. Memeriksa admin/guru/origin/CSRF/method/password/schema, CAS replay, cooldown, target inactive/unverified, grant minimum, audit, serta hasil provider sent/retry/failed/unknown.
- `npm run test:ui:users`: regresi lama serta tombol/eligibility, konfirmasi tanpa mengirim saat dibatalkan, empat ukuran/orientasi modal termasuk 280 px, penerimaan/antrean/gagal/unknown, single-flight dan acknowledgment hilang tanpa email ganda. Error pengiriman ditampilkan sebagai error, bukan sukses hijau.
- `npm run test:ui:forgot-password`: seluruh 48 kombinasi reflow lama, validasi/retry/CSRF/single writes, ditambah tautan email valid yang langsung membuka OTP tanpa meminta pengiriman baru, pembersihan fragment, dan tautan invalid yang dapat dipulihkan, serta pergantian fragment yang tidak boleh ditimpa respons permintaan lama.
- Tidak menggunakan akun/email pengguna nyata, dan tidak mempublikasikan secret atau pesan email asli. UAT inbox fisik pengguna belum dilakukan; delivery receipt adalah status penyedia/antrean.
