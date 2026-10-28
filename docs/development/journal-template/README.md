# Integrasi template jurnal mengajar

## Cakupan

Empat teks terpisah (maksimal 2000 karakter per field): `learningObjectives`, `obstacles`, `followUp`, `reflection`. Form baru meminta tujuan pembelajaran; edit jurnal lama tidak mewajibkan melengkapi field baru. API tetap menerima payload lama tanpa field tambahan agar tab/klien lama tidak rusak. Field yang tidak dikirim saat edit dipertahankan; string kosong secara eksplisit mengosongkan field.

Materi, catatan, jumlah siswa, alasan, identitas occurrence/assignment, kepemilikan guru efektif, konfirmasi, H/H-1, blok mapel, optimistic version, periode final, formula `app.jtm_basis`, dan transaksi reversal/reposting ledger dipertahankan. Data historis tidak disimpan ulang atau dihitung ulang oleh migrasi. Audit old/new mencakup field baru melalui journal_dto.

## Presentasi dan ekspor

- Form dan detail responsif; petunjuk membedakan kendala, tindakan, dan evaluasi.
- Draft menambahkan field baru, tetap membatasi akun/entity/TTL, dan mengenali format field jurnal lama. Basis yang berubah tetap memerlukan pemeriksaan pengguna.
- Batas body 100 KB hanya untuk create/edit jurnal, untuk menampung Unicode/JSON escaping semua isian; endpoint lain tetap 8 KB.
- DTO menyertakan waktu kegiatan dan label periode dari snapshot occurrence; sekolah dari profil saat pembacaan/ekspor, dilabeli eksplisit sebagai identitas saat ekspor.
- PDF A4 landscape memakai tabel per guru/mapel/bulan/periode, hari dihitung dari tanggal WIB, header berulang dan sel panjang diteruskan ke halaman berikutnya. CSV mempertahankan formula escaping serta kolom lama dan baru.
- Nomor jam ke belum memiliki sumber kanonis: ekspor menampilkan waktu mulai–selesai dan kredit JTM tanpa menebak nomor jam.
- Pengesahan menampilkan nama pemilik dan waktu pengiriman WIB; tidak mengklaim sebagai paraf gambar atau tanda tangan elektronik tersertifikasi.
- Pencarian tetap materi/catatan sesuai label dan kontrak lama; tidak diam-diam memperluas pencarian.

## Validasi lokal

- Lint, typecheck, production build.
- 176 unit; 47 crypto/HTTP/export; 408 integration (PGlite).
- Tambahan integrasi: isi baru tersimpan, audit mencatat refleksi, klien lama tidak menghapus isi, net JTM tetap sama.
- Suite jurnal: 7 ukuran layar 280–1920, touch/landscape/200% text, CRUD, race/conflict, lost-response recovery, permission, malformed data; nol pageerror.
- Suite draft: penyimpanan/pemulihan refleksi, konflik basis, TTL, offline, penolakan storage, akun dan logout.
- PDF normal dan teks panjang dirender dan diperiksa visual; tanggal 14 Juli 2026 menjadi Selasa.
- Belum menggantikan UAT guru pada perangkat fisik atau authenticated production UAT; tidak membuat jurnal sintetis di produksi.

## Rilis dan rollback

Migrasi: `20261028121442_journal_learning_reflection.sql`. Terapkan sebelum kode baru. Migrasi additive dengan default kosong, batas panjang, checksum guard fungsi lama, owner/ACL/search_path tetap. Gunakan ledger migrasi aplikasi beserta checksum SHA256 yang sesuai file. Jangan ubah migrasi lama.

Rollback aplikasi ke versi sebelumnya tetap bisa membaca DTO dan menulis jurnal tanpa menghapus empat field. Pertahankan kolom baru; jangan drop kolom atau menghapus data pengguna sebagai rollback. Periode honorarium final dan job honor September tidak disentuh.
