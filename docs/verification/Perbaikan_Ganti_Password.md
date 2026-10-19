# Perbaikan ganti password — 19 Oktober 2026

Gejala produksi: ganti password mengembalikan409 CONFLICT dengan pesan data berubah/username-email sudah digunakan. Password lama tetap valid dan sesi tidak diakhiri karena transaksi gagal. Log PostgreSQL menunjukkan40001 pada guard set_password_after_verification.

Penyebab: layanan mengirim JSON.stringify(payload) sebagai parameter biasa pada query ::jsonb. Postgres.js memperoleh tipe jsonb dari server dan melakukan serialisasi lagi. Database menerima scalar string, bukan object; ekstraksi credentialVersion/oldHash menjadi null sehingga CAS dengan benar menolak perubahan. Pengujian PGlite langsung sebelumnya melewati serializer driver dan tidak menangkap masalah ini.

Perbaikan: SqlJsonParameter/sqlJson menandai payload secara eksplisit. Executor Postgres.js bersama mengirim JSON yang sudah dienkode sebagai parameter text OID25, lalu cast ::jsonb pada SQL mem-parsing sekali. Nilai tetap dibind sebagai parameter, tidak dirangkai ke SQL. PGlite test adapter memakai kontrak yang sama. Runtime, native CLI dan worker berbagi executor. Semua pemanggil payload SQL JSON pada akun, pengguna, master, kalender dan jadwal disesuaikan karena memakai jalur yang sama. Serialisasi HMAC, ciphertext dan HTTP tidak diubah. Tidak memerlukan migrasi database, perubahan password akun nyata, pengurangan CAS, atau konfigurasi email.

Uji baru password-transport.test.ts menjalankan PGlite melalui socket TCP lokal + Postgres.js3.4.9 dengan prepare:false dan adapter runtime asli; autentikasi memakai role sim_guru_auth, bukan bypass otorisasi. Empat skenario:

1. Jalur lama sengaja direproduksi: VERSION_CONFLICT dan rollback tanpa pencabutan sesi.
2. Objek/nested data, array, scalar string, null dan string decimal tetap utuh.
3. Password saat ini salah dan konfirmasi tidak cocok ditolak tanpa mutasi.
4. Handler HTTP ganti password onboarding mengembalikan200, menghapus cookie, mencabut dua sesi, menolak login password lama, menerima password baru tanpa melewati onboarding email; penyimpanan pertanyaan keamanan lewat JSON juga berhasil.

PGlite socket memverifikasi protokol dan serializer; bukan bukti native race dua koneksi. Pengujian seluruh aplikasi mencakup205 skenario substantif,215 hasil runner termasuk10 induk. Log lengkap ada di password-fix-check.txt. Seluruh data uji berada di database lokal in-memory. Uji native remote dalam BEGIN/ROLLBACK juga memverifikasi routine dasar, tanpa mengubah akun nyata. Pembuatan akun uji persisten di produksi ditolak pemeriksaan otomatis dan tidak dilakukan; tidak dicoba lewat jalur lain.

Hasil CI/deployment dan pemeriksaan HTTPS sesudah push dicatat pada password-fix-results.json. CRUD/ganti password memakai kredensial pengguna nyata belum dijalankan oleh agen; pengguna dapat mencoba ulang sendiri setelah deployment selesai.

Source commit08017aa37da5fb7133324325b9afc103aff3cea6 dipush ke main. Deployment dpl_Ay1JLSgsfin7urzXtDBLeDA6USb1 READY di https://sim-guruv2.vercel.app. Seluruh20 pemeriksaan HTTPS lulus, termasuk profile tanpa sesi401 dan change-password/security-question tanpa CSRF403 no-store. GitHub Actions39280861515 masih queued tanpa runner ketika bukti ini disimpan; tidak diklaim lulus. Pemeriksaan lokal npm run check sudah selesai dengan exit0.
