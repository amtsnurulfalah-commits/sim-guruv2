# PRO-5 — Transparansi honorarium dan bantuan kontekstual

Baseline produksi: main `85ce17d46756593ee6e1d9bc60feced757f55e72` (PR74/PRO-4). Pengelola mengizinkan implementasi, merge dan migrasi jika diperlukan pada 26 Oktober 2026 WIB.

## Temuan

1. Engine sudah menyimpan referensi tarif, kebijakan dan rincian sumber; parser UI membuang metadata tarif sehingga versi sumber tidak terlihat.
2. Rincian slip tidak menjelaskan nilai mentah vs pembulatan, batas data dan versi engine secara bersamaan. Referensi pembalikan, koreksi, kegiatan serta konteks kelas/mapel tersimpan tetapi tidak ditampilkan.
3. Tautan bertanggal ke jurnal hanya membuka tab input; riwayat bisa tetap memakai rentang bulan saat ini.
4. Form memiliki validasi/error per field dan kode referensi bantuan, tetapi contoh alasan, aturan angka serta petunjuk jumlah siswa belum dekat dengan isian. Rincian laporan belum memiliki pintasan bertanggal ke sumber.

## Perubahan

- Disclosure **Asal perhitungan** pada rekap dan slip: mode realisasi/proyeksi/final, periode/cutoff, versi rumus/kebijakan, tarif tersimpan, nilai mentah dan hasil settlement engine. Bukan kalkulator frontend.
- **Telusuri sumber**: whitelist referensi ledger/sumber/reversal/koreksi, kelas/mapel/sesi, dan fakta transport dari snapshot. Angka finansial tetap string presisi penuh; rasio tampilan tidak dipakai menghitung ulang. Toggle nominal menyembunyikan nominal tambahan juga.
- Helper presentasi yang sama dipakai PDF untuk label dan referensi. Nilai final dan checksum sumber dipertahankan; parser menerima metadata opsional dan snapshot lama tanpa metadata baru.
- Tautan hanya rute internal yang dikenal dan tanggal valid; tidak memasukkan identitas, alasan atau nominal dalam URL browser. Jurnal menerima `section=history` untuk membuka rentang satu tanggal sumber. Tautan laporan akademik memakai helper yang sama. Otorisasi API/SQL tetap menentukan data yang terlihat; izin laporan bukan izin tambahan untuk kegiatan.
- Tidak mengarang tujuan untuk baris libur/reversal/koreksi yang tidak mempunyai pemetaan halaman pasti. Referensi tetap tersedia untuk koreksi/dukungan; halaman sumber adalah data terkini dan tidak menggantikan snapshot historis.
- Bantuan singkat dan `aria-describedby` pada DataForm; contoh alasan bebas password/OTP, batas angka dan format tanggal; jurnal menjelaskan hadir+absen. Jalur error field/reference existing dipertahankan.

## Database dan batas penerimaan

Tidak ada perubahan schema, routine, API akses atau perhitungan; **tidak memerlukan migrasi**. Tidak membuka data penerima lain, tidak mengubah tarif/ledger/slip, tidak mengirim email produksi.

Penerimaan teknis tercatat pada [VALIDATION](VALIDATION.md). Uji pemahaman oleh 1 admin + 3 guru (PRO-5.8) belum dilakukan; lihat [UAT](UAT.md). Gate PRO-3 dan perangkat fisik PRO-4 tidak dianggap selesai oleh tahap ini.
