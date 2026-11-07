# Checkpoint Push Notifikasi SiM-Guru
Diperbarui 7 November 2026 WIB.

## Acuan tetap
- [Roadmap 0–10](Tahapan_Penambahan_Push_Notifikasi_SiM_Guru.md): acuan urutan, dependensi dan acceptance.
- [Hasil Tahap 0](stage-0/README.md) dan [evidence](stage-0/evidence.json).
- Dokumen rancangan asal: Rancangan_Push_Notifikasi_SiM_Guru.md, Library ID libfile_901f0880bef0819198042f0a6e1d797d.
- Dokumen tahapan asal: Library ID libfile_c86a8c696c3881919c271240d8438ea2.
- Repo ini merupakan catatan kelanjutan permanen; jangan mengandalkan ingatan percakapan saja.

## Progres
- 0.1, 0.2, 0.3, 0.5 selesai, baseline e914f6a80d55866306ab52922f903aed0fdf0615.
- 0.4: cohort dan kapasitas awal direncanakan; inventaris perangkat fisik/versi browser dan penerimaan pilot belum terverifikasi. Bukan bukti UAT.
- Tahap 1–10 belum dijalankan.
- Tidak ada migrasi, perubahan aplikasi runtime atau aktivasi push pada batch Tahap 0.
- PR/merge akhir: lihat PR yang menambahkan paket ini dan riwayat Git. Jangan mengasumsikan merge/deployment hanya dari status dokumen.

## Keputusan wajib
PWA + Web Push, perluas inbox existing, pisahkan transport dan siapkan adapter untuk FCM/APNs. Pertahankan auth lokal, guard SQL dan CSRF/Origin. Izin opsional, key terpisah per lingkungan, payload generik, revoke binding backend dan source recheck. Worker email tetap berfungsi.

## Langkah berikutnya
Tahap 1.1–1.5: kontrak event/API, flags, key management dan validasi environment. Baca hasil Tahap 0 terlebih dahulu. Lengkapi inventaris perangkat sebelum pilot/aktivasi, bukan dengan asumsi hasil tes. Setiap batch memperbarui checkpoint, bukti, commit/PR dan batas pengujian.
