# Peningkatan tombol dan label tindakan

Branch: `feat/button-clarity`, berbasis `main` pada `86554c9`.

## Hasil audit dan implementasi

Audit JSX mencakup 171 deklarasi tombol pada halaman/komponen aplikasi. Tombol
yang sudah memiliki ikon dipertahankan; tombol teks dilengkapi ikon tindakan
melalui komponen `ActionIcon` bersama. Ikon tidak menggantikan label aksesibel.
Pemilihan ikon eksplisit di pemanggil; tidak ada pencocokan teks saat runtime.

Tombol teks bergaris bawah pada izin/blok jurnal, konteks hari, dan reset pencarian
menggunakan token tombol sekunder yang sudah ada. Ekspor CSV/PDF/Excel memiliki
ikon unduh. Tombol simpan, pratinjau, arsip, riwayat, filter, pagination, dan
konfirmasi lintas modul konsisten. Slot tautan tetap mempunyai satu child.

Label yang diperjelas: Ubah data, Arsipkan data, Simpan perubahan kalender,
Konfirmasi perubahan, Keluar dari akun, Aktifkan/Nonaktifkan blok jurnal.
Teks lain yang sudah menjelaskan fungsi dipertahankan. Tautan navigasi biasa
tetap tautan. Tidak ada perubahan API, RBAC, autentikasi, SQL atau logika bisnis.

Ikon dekoratif tersembunyi dari pembaca layar, tidak menerima fokus, dan tidak
mengecil saat label membungkus. Target sentuh 44px, fokus keyboard, disabled,
serta reduced motion tetap mengikuti sistem desain. Tidak ada dependensi aplikasi baru.

## Verifikasi

- Lint dan TypeScript lulus.
- Unit 30, crypto/adapter/API/export 24, integrasi SQL 325: seluruh 379 lulus.
- Build produksi lulus setelah membuang cache Turbopack lama yang tidak kompatibel.
- Build dan TypeScript diulang setelah penyesuaian akhir dan lulus.
- Hasil browser dicatat setelah proses selesai.
- UAT perangkat fisik dan pembaca layar belum dilakukan.

## File dan alasan perubahan

- `src/components/ui/action-icon.tsx`: pemetaan ikon tindakan reusable.
- `docs/ui/DESIGN_SYSTEM.md`: aturan tombol dan ikon tindakan.
- `src/app/globals.css`: ukuran dan perilaku ikon tombol native.
- `src/app/kesiapan/page.tsx`: konsistensi tombol/tautan tindakan dan aksesibilitas.
- `src/app/modul/[slug]/page.tsx`: konsistensi tombol/tautan tindakan dan aksesibilitas.
- `src/app/not-found.tsx`: konsistensi tombol/tautan tindakan dan aksesibilitas.
- `src/components/feedback/service-state.tsx`: konsistensi tombol/tautan tindakan dan aksesibilitas.
- `src/components/shell/workspace.tsx`: konsistensi tombol/tautan tindakan dan aksesibilitas.
- `src/components/ui/button.tsx`: konsistensi tombol/tautan tindakan dan aksesibilitas.
- `src/components/ui/dialog.tsx`: konsistensi tombol/tautan tindakan dan aksesibilitas.
- `src/components/ui/managed-dialog.tsx`: konsistensi tombol/tautan tindakan dan aksesibilitas.
- `src/features/activities/workspace.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/auth/account-lifecycle.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/auth/admin-recovery.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/auth/login-form.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/auth/session-boundary.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/auth/session-panel.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/calendar/calendar-manager.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/calendar/day-context-card.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/duties/duty-manager.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/finance/finance-manager.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/finance/teacher-picker.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/masters/master-manager.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/migration/manager.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/operations/announcements.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/operations/managers.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/operations/recipient-picker.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/programs/event-manager.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/programs/exam-manager.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/programs/forms.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/schedules/schedule-manager.tsx`: ikon dan label tindakan modul; handler tetap.
- `src/features/users/user-manager.tsx`: ikon dan label tindakan modul; handler tetap.
- `tests/ui/verify.mjs`: penyesuaian ekspektasi label CRUD.
