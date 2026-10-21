# Perbaikan INTERNAL_ERROR saat edit jadwal piket

Akar masalah: finance.final_guard() mengakses NEW.state secara langsung saat trigger dijalankan untuk duty_schedules, yang memiliki kolom active dan tidak memiliki state. PostgreSQL menghasilkan 42703 (record new has no field state).

Migrasi duty_final_guard_record_shape mengganti pembacaan status opsional dengan (to_jsonb(NEW)->>'state') IS DISTINCT FROM 'archived'. Untuk jadwal mengajar, semantik state archived tetap sama. Untuk piket, pembacaan kolom opsional tidak lagi menghasilkan exception. Perhitungan rentang tanggal terdampak, advisory lock, FINAL_PERIOD, trigger, role dan hak akses dipertahankan.

Verifikasi: lint dan git diff --check lulus. Seluruh 46 tes integrasi piket dan honorarium lulus. Tes regresi menambahkan edit piket pada periode terbuka, penolakan edit saat period_guard final, dan keberhasilan edit setelah periode dibuka kembali di fixture lokal.

Migrasi diterapkan ke produksi pada 21 Oktober 2026. Verifikasi produksi menguji trigger pada tabel temporer yang menyalin satu jadwal piket, mengubah hari menjadi Jumat, lalu rollback. Jadwal pengguna asli tidak diubah. Advisor keamanan setelah migrasi: tidak ada temuan. UAT melalui sesi admin belum dilakukan; admin dapat mencoba kembali perubahan jadwal yang sebelumnya ditolak.
