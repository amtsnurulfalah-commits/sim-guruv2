# Verifikasi Tahap 3.1–3.6

Implementasi mencakup occurrence/assignment/claim/confirmation, attendance/templates/previews/leaves, student recaps/progress, typed KBM/reversal ledger, journal eligibility/CRUD/history/exports. Lihat [runbook](../operations/Kehadiran_Jurnal_Tahap_3.md).

## Pengujian lokal

- Upgrade dari sebelas migrasi, clean install semua migrasi, rerun checksum idempotent; identitas lama tetap ada, seluruh 40 tabel domain FORCE RLS.
- `tests/integration/activities.test.ts`: 28 skenario A01–A28. Scope guru, klaim tanpa kredit, konfirmasi/version, snapshot protection, template preview one-use/stale, jam/provenance/extra, izin overlap/adjacent/clip/delete, kelengkapan kelas wajib vs kelas tambahan, rekap/jurnal count, duplikat, reversal edit/hapus, blok langsung, H/H-1/H-2/future, final guard, raw DML/helper denial, full export 151 baris dan kuota bisnis terpisah.
- `tests/crypto/activity-export.test.ts`: CSV injection/quoting serta PDF multi-page. Dua PDF 110 baris diekstrak dengan pdftotext untuk memastikan baris terakhir ada dan halaman awal dirender/diperiksa visual; font DejaVu ditanam agar spasi/glyph konsisten.
- Regresi modul autentikasi, akun, OTP Gmail, pengguna, master, kalender dan jadwal dijalankan. Assertion jumlah tabel/menu lama diperbarui mengikuti objek/modul baru; assertion izin, skenario bisnis dan hasil hitungan tetap dipertahankan.
- Lint, typecheck dan build Next.js dijalankan. Log hasil akhir disimpan bersama bukti.

## Batas bukti

Tidak menggunakan kredensial akun produksi, tidak mengirim email, dan tidak menyimpan test user produksi. Pengujian WASM/promise parallel bukan uji native dua koneksi. UAT browser dengan akun nyata, pengujian petugas piket/panitia (modul berikutnya), realisasi honor/slip dan finalisasi periode belum dinyatakan lulus.

Migrasi remote berhasil: 12 migrasi, 40 tabel FORCE RLS, checksum cocok, security advisor tanpa temuan. Tujuh pemeriksaan PostgreSQL native untuk sesi, extra attendance, cap rasio, klip izin, overlap, satu baris per tanggal dan versi konflik lulus dalam transaksi rollback; akun probe tersisa 0. Hasil dicatat dalam `stage-3-results.json`. Deployment diperiksa terpisah setelah push. Tidak mengartikan build/health sebagai bukti CRUD browser berakun nyata.
