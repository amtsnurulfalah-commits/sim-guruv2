# UI lebih ringkas dan format angka Indonesia

## Batas perubahan

Presentasi saja. Tidak mengubah schema database, rumus JTM/honor, snapshot final, payload numerik, otorisasi, waktu operasional, atau format CSV mesin. Nilai input tetap mengikuti kontrak form/API. Identifier, versi, NPSN, username, tanggal, waktu, dan nomor referensi tidak diformat sebagai angka.

## Angka

`src/lib/format/number.ts` memformat string desimal secara langsung: `2.0000` → `2`, `2.5000` → `2,5`, `1000.0500` → `1.000,05`. Nol pecahan di ujung dibuang; pecahan bukan nol dan integer besar dipertahankan tanpa konversi ke Number atau pembulatan tambahan. Nilai hilang/tidak valid menjadi tanda pisah, bukan nol rekaan. Angka JS finite dengan notasi eksponen diperluas sebelum diformat.

Dipakai oleh JTM pada jadwal/konfirmasi/jurnal/piket/ujian/acara/laporan/honor, jarak pengguna, tarif dan tunjangan master, statistik layanan, serta pratinjau semester. `formatHonorAmount` dan ringkasan Dashboard menggunakan formatter yang sama; pecahan honor tidak lagi hilang karena split integer. Rasio yang sebelumnya dibulatkan untuk tampilan tetap mengikuti presisi tampilan lamanya.

## Hierarki dan teks

- `HelpDisclosure` native details/summary untuk penjelasan sekunder pada 20 modul dan shared PageHeader. Keyboard Enter/Space, fokus dan sentuhan tetap tersedia; DOM/data tidak dihapus saat ditutup.
- Teks petunjuk tidak dihapus massal. Label form, error, prasyarat kegiatan, peringatan perubahan destruktif, dan persetujuan transaksi tetap terlihat pada tempat pengambilan keputusan.
- Detail tambahan jurnal dilipat; materi, jumlah siswa, kredit dan aksi utama tetap terlihat.
- Instruksi generik modal dipersingkat. Status keamanan Dashboard diringkas.
- Panel menggunakan garis netral, angka tabel/tabular lebih mudah dipindai. Status informatif tidak otomatis diberi warna sukses; pesan sukses eksplisit, toast, error dan warning tetap memiliki semantik sendiri.
- Panduan halaman dapat dicetak walaupun accordion tertutup. Konten pengguna tidak dipotong dengan CSS global atau penggantian DOM otomatis.

## Verifikasi

Jalankan lint/typecheck/build, unit, crypto/export, integration dan suite browser terkait. Unit formatter mencakup integer, pecahan, nol, negatif, angka besar, notasi eksponen dan data tidak valid. Regresi jurnal memeriksa format pada layar, payload tetap canonical, serta pembukaan panduan dengan Enter/Space. Suite browser memakai data sintetis lokal; bukan UAT pengguna atau transaksi produksi.

## Rilis

Tidak memerlukan migrasi atau environment baru. Perubahan siap ditinjau melalui PR; rilis produksi mengikuti persetujuan merge. Rollback aplikasi tidak memerlukan perubahan data.
