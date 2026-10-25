# Audit Dashboard — Oktober 2026

## Alur dan batas perubahan

`pageSession` memverifikasi sesi/onboarding sebelum Server Component membentuk DTO Dashboard. `DashboardView` mengikuti tanggal WIB melalui `useDashboardDay`. Pusat tugas, konteks kalender, pengumuman dan ringkasan menggunakan endpoint masing-masing; kegagalan satu widget tidak menghapus widget lain. Ringkasan SQL tetap `app.dashboard_summary`, termasuk seluruh dependency kalender/keuangan intrinsiknya. Pengumuman hanya mendukung penutupan pribadi melalui POST berversi dan CSRF; editor kegiatan berada pada halaman sumber.

Ditelaah: route Dashboard/API, DTO dan session boundary, LiveSummary, DayContextCard, TaskCenter, Announcements, kontrak Zod, helper request/error, navigasi bertanggal, MetricCard/Button/FeatureState/Pagination, styling global, SQL summary, serta pengujian unit/integrasi/browser yang berhubungan.

## A. Temuan

- Endpoint ringkasan memanggil konteks kalender opsional yang tidak dipakai LiveSummary; kegagalannya memblokir ringkasan meski widget kalender memuat sendiri.
- Respons ringkasan hanya divalidasi bentuknya; tanggal, akun dan peran aktif belum dicocokkan. Konteks hari dan pusat tugas ringkas juga belum menolak tanggal envelope yang berbeda.
- Ringkasan tidak memperbarui diri saat tab aktif kembali, sementara pusat tugas memiliki refresh yang membatalkan request lama pada setiap event. Fokus/visibility beruntun dapat mengulang read lambat.
- Pengumuman terpasang dalam dua cabang loading/data ringkasan, sehingga refresh mereset state dan dapat membatalkan penutupan yang berlangsung.
- Jam yang mustahil, JTM bukan angka dan ID berulang lolos schema ringkasan; label jurnal dapat diterapkan pada jenis kegiatan yang tidak memerlukannya.
- Toolbar pada ponsel menghimpit judul dengan tombol refresh. Tugas ringkas belum memanfaatkan grid layar besar; tidak ada aksi cepat dari sapaan Dashboard.

## B. Perbaikan

- Opsi aditif `?section=summary` menghilangkan enrichment kalender yang tidak dipakai. Kontrak default lama, autentikasi, onboarding, anti cross-site dan SQL bisnis tetap berlaku.
- DTO menyertakan ID pengguna; parser memverifikasi tanggal envelope/summary, ID/peran pengguna dan lingkup admin. Tanggal konteks dan pusat tugas pada Dashboard dicocokkan dengan hari aktif.
- `useReadResource` mengelola satu read aktif per widget, timeout melalui helper lama, cleanup abort/listener/timer, refresh fokus/online/visible/60 detik. Snapshot valid tetap terlihat selama refresh; error/kontrak tidak sesuai menutup data lama dan memberi jalur retry.
- Pengumuman dipasang sekali di luar lifecycle ringkasan. Mounted ref mengikuti lifecycle komponen; perubahan tanggal menunda read ketika write berlangsung, kemudian membaca ulang setelah write selesai. Tidak ada retry POST otomatis.
- Validasi jam/JTM/ID, label jurnal untuk KBM/pengawas ujian, link kegiatan bertanggal. Format uang tetap berbasis string untuk menjaga presisi nominal besar.
- Sapaan dengan warna identitas lama, aksi cepat jadwal/kehadiran/jurnal, toolbar vertikal di mobile, grid tugas responsif, status refresh dan wrapping teks panjang. Pagination delapan agenda dan lima tugas ringkas tetap dipertahankan.

## C. Kode final

Implementasi ada di `src/features/dashboard`, `src/features/calendar/day-context-card.tsx`, `src/features/tasks/task-center.tsx`, `src/features/operations/announcements.tsx`, `src/lib/feedback/use-read-resource.ts`, `src/lib/dashboard/summary.ts`, dan `src/server/dashboard`.

Tidak ada perubahan schema/migrasi, rumus honorarium, hak akses, struktur penyimpanan atau fitur bisnis yang dihapus. GET lama tetap kompatibel; ID DTO dan mode summary-only bersifat aditif.

## D. Validasi

- `npm run check`: lint, TypeScript, unit, crypto/HTTP, integrasi database dan build produksi.
- `npm run test:ui:dashboard`: admin/guru; lebar 280, 320, 375, 768, 1024, 1440, 1920; keyboard disclosure, data kosong/terjadwal saja/101 baris, pagination, 200% teks, nama/deskripsi panjang, orientasi, loader, malformed/503/retry, akun/tanggal salah, fokus beruntun, jaringan gagal, penutupan pengumuman bersamaan refresh, pergantian hari WIB.
- Regresi `test:ui:tasks`, `test:ui:announcements`, dan `test:ui` untuk komponen bersama.
- Pemeriksaan screenshot desktop/mobile dan ukuran dokumen memastikan tidak ada horizontal overflow pada skenario yang diuji. Scroll vertikal dokumen tetap normal agar konten panjang dapat diakses.
- Pengujian memakai database dan identitas sintetis localhost; tidak menggantikan UAT akun/perangkat fisik. Hasil CI final dan status merge mengikuti PR, tanpa memasukkan data produksi ke dokumentasi.
