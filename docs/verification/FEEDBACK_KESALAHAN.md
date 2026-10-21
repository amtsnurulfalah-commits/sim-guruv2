# Feedback kesalahan dan permintaan ditolak

## Perubahan perilaku

1. Error API diterjemahkan melalui penanganan bersama: ringkasan, isian terkait, langkah perbaikan, batas percobaan jika tersedia, dan nomor referensi bantuan dari server.
2. Validasi Zod/aturan kata sandi menghasilkan `error.fieldErrors` yang sejak awal bersifat opsional dalam kontrak. Hanya batasan dan pesan yang disetujui yang dikirim; tidak ada nilai kata sandi, OTP, jawaban keamanan, query SQL, konfigurasi, atau stack trace.
3. Konfirmasi kata sandi, urutan jam pulang/kembali, dan rentang berlaku jadwal mempunyai lokasi validasi eksplisit. Aturan penerimaan data tidak diubah.
4. DataForm menampilkan error server pada isian dan tautan ringkasan. Formulir akun dan pengguna yang memiliki nama kontrol diberi `aria-invalid`, deskripsi error dan fokus ke kolom terkait; penanda hilang saat isian diperbaiki. Nilai tidak direset saat penolakan. Login tetap mengosongkan kata sandi setelah percobaan sesuai perilaku keamanan sebelumnya.
5. Panel error bersama dipakai pada modul kegiatan, piket, ujian/acara, master, jadwal, kalender, pengguna, honorarium, migrasi, operasional dan dialog formulir. Pesan multiline mempertahankan label kolom dan petunjuk perbaikan.
6. Koneksi gagal dan timeout dibedakan. Tindakan penyimpanan yang kehilangan respons diberi status belum pasti: periksa riwayat sebelum mengirim ulang. Tidak ada pengiriman ulang otomatis.
7. Unduhan CSV/PDF kegiatan dan Excel/PDF honorarium memeriksa respons terlebih dahulu. Penolakan tetap ditampilkan di halaman; pengguna tidak diarahkan ke JSON. Berkas berhasil diunduh melalui browser. Tidak mengubah endpoint ekspor atau hak akses.
8. Sesi tetap gagal tertutup: 401 mengarahkan ke login, pengamanan akun tetap diperiksa, scope dan perubahan identitas tetap dipantau. Penolakan logout tampil dalam dialog yang tetap terbuka agar dapat diperiksa atau dicoba kembali. Polling sukses tidak menghapus pesan penolakan logout.
9. Profil yang gagal dimuat menyediakan panel error dan tombol coba kembali.

## Berkas dan alasan

| Area | Berkas | Alasan |
| --- | --- | --- |
| Penanganan bersama | src/lib/feedback/api-error.ts, catalog.ts, form-fields.ts | Normalisasi API/jaringan, petunjuk perbaikan, label kolom, unduhan, dan penanda kontrol. |
| Validasi server | src/server/auth/http.ts, validation-feedback.ts | Mengisi fieldErrors secara aman pada validasi; status HTTP dan kode error yang ada dipertahankan. |
| Lokasi validasi | src/lib/accounts/schemas.ts, activities/schemas.ts, schedules/schemas.ts | Mengaitkan ketidaksesuaian antar-isian dengan kolom yang dapat diperbaiki, tanpa mengubah predikat validasi. |
| Komponen | src/components/feedback/error-feedback.tsx, feature-state.tsx, service-state.tsx; src/components/ui/dialog.tsx, form-feedback.tsx | Panel konsisten, multiline, aria alert dan fokus pada error dialog. |
| Permintaan | src/features/masters/api.ts; users/api.ts; auth/account-lifecycle.tsx, login-form.tsx, session-boundary.tsx | Menggunakan normalisasi dan mempertahankan CSRF, timeout, serta pembatalan request. |
| Formulir | src/features/programs/forms.tsx; users/user-manager.tsx | Mengaitkan detail error server dengan isian. |
| Modul | activities/workspace.tsx; duties/duty-manager.tsx; calendar/calendar-manager.tsx; schedules/schedule-manager.tsx; masters/master-manager.tsx; migration/manager.tsx; programs/event-manager.tsx, exam-manager.tsx; finance/finance-manager.tsx, teacher-picker.tsx, verify-document.tsx; operations/announcements.tsx, managers.tsx, recipient-picker.tsx | Mengganti pesan error polos dengan panel bersama; penanganan ekspor di kegiatan/keuangan dan permintaan verifikasi dokumen ikut diperbaiki. Semua path modul relatif src/features. |
| Pengujian | tests/unit/api-feedback.test.ts; tests/crypto/feedback-http.test.ts; tests/ui/verify.mjs | Kontrak error, keamanan pesan, jaringan/timeout, form dan unduhan. |

## Verifikasi

- Lint dan TypeScript: lulus pada kode akhir.
- Unit: 43 lulus; crypto/adapter/HTTP: 28 lulus; integrasi SQL: 325 lulus (396 total).
- Production build lokal: lulus dengan cache bersih. Cache Turbopack lama dua kali gagal dibuka dengan pesan persistence directory; cache dipindahkan tanpa mengubah konfigurasi aplikasi dan build akhir berhasil.
- Browser suite penuh: 252 kombinasi halaman/role/viewport, empat lebar interaksi, satu skenario CRUD; nol page errors dan console errors.
- Suite interaksi akhir: lulus, nol page errors dan console errors. Termasuk penolakan validasi dengan referensi, penanda kolom, nilai tetap tersimpan, penanda hilang saat diketik, penolakan ekspor tanpa navigasi, dan CSV berhasil diterima browser.
- Pemeriksaan visual screenshot error akun 375 px: teks dan referensi membungkus dalam kartu, penanda kolom terlihat, formulir tetap dapat diperbaiki.
- Fixture Next.js production-build untuk navigasi: lulus; shell tetap mounted dan sesi kedaluwarsa tetap dialihkan ke login, tanpa page errors.
- git diff --check: lulus.

Dua percobaan awal skenario browser baru memakai locator label global dan mendapati kontrol bernama sama pada panel tab tersembunyi. Locator diperbaiki dengan scope panel aktif; suite akhir lulus. Pengujian browser penolakan menggunakan envelope error sintetis berstatus HTTP 200 agar tidak menimbulkan console error HTTP yang memang diharapkan; pengujian unit/HTTP terpisah memverifikasi status 401/403/409/422/429/500/502 sebenarnya.

Fixture memakai data sintetis; tidak mengirim email atau menulis database produksi.

## Batas

Pesan spesifik mengikuti informasi yang diberikan server. Error aturan bisnis yang belum mengirim lokasi kolom menampilkan ringkasan dan langkah perbaikan sesuai kode, tanpa menebak kolom yang salah. Kontrol tanpa atribut name tetap memperoleh ringkasan berlabel, namun belum diberi penanda per kolom oleh helper. UAT akun pengguna produksi, perangkat fisik, dan screen reader nyata belum dilakukan.
