# PRO-6 — Preferensi tampilan dan pintasan

Baseline produksi: main `07163de0799482aa8314ccb5aa43430977275480` (PR75/PRO-5). Pengelola mengizinkan implementasi, merge dan migrasi bila diperlukan.

## Pilot dan cakupan

UAT manusia PRO-0/PRO-5 belum tersedia. Tiga pilihan berikut adalah pilot berdasarkan alur existing, bukan preferensi yang diklaim telah disepakati dari UAT:

1. Kepadatan tabel: nyaman (default) / ringkas. Ringkas mengurangi padding tabel pada desktop >=1024px dengan pointer presisi. Ukuran tombol tetap >=44px, tampilan ponsel/touch dan isi data tetap mengikuti komponen existing.
2. Jumlah tugas: 10/20/50 per halaman Pusat tugas. Default20 dipertahankan; ringkasan dashboard tetap5. Ini pagination hasil API existing di client, tanpa refetch atau API/count baru. Pergantian ukuran mengembalikan halaman1 dan clamp existing tetap berlaku.
3. Maksimal4 pintasan dari registry menu existing yang diizinkan. URL berasal dari registry role/capability, bukan dari storage. Pin yang tidak sedang diizinkan tidak ditampilkan dan tidak menghabiskan slot pilihan yang terlihat.

Filter tanggal, semester, identitas guru, pencarian bebas, isi draft dan izin tidak disimpan sebagai preferensi baru. Filter favorit bertanggal/semester menunggu bukti UAT. Fondasi URL/back-forward, draft akun, notifikasi dan sidebar collapse existing dipertahankan.

## Penyimpanan dan pemulihan

Satu envelope berversi pada sessionStorage, scope ID akun+peran. Hanya density/taskPageSize/pin slug yang lolos allowlist/ukuran/duplikasi. Reload tab yang sama memulihkan pilihan; tidak menjanjikan sinkron lintas tab/perangkat. Reset mengembalikan tiga pilihan tersebut dan menghapus envelope. Sidebar collapse tetap memakai preferensi perangkat existing dengan tombolnya sendiri.

Logout sukses, broadcast logout, sesi expired/401 dan perubahan akun/peran menggunakan lifecycle cleanup existing bersama draft. Scope berbeda/versi lama/JSON rusak menghapus envelope dan kembali ke default. Provider keyed scope mencegah flash preferensi akun lama. Ref menyatukan update beruntun dan invalidation mencegah load tertunda menimpa clear. Storage diblokir tetap memberi UI yang usable dan pesan bahwa perubahan hanya berlaku selama kunjungan.

Preferensi tidak menentukan role, izin laporan, eligible actions, SQL scope, data yang diambil atau payload transaksi. Tidak ada token/password/OTP disimpan. Tidak ada perubahan database atau migrasi.

## Penerimaan

Lihat [VALIDATION](VALIDATION.md) dan [CHECKPOINT](CHECKPOINT.md). Pemilihan manfaat oleh 1 admin+3guru belum diuji: ukur kemudahan menemukan pintasan, pilihan jumlah baris, kenyamanan density desktop/mobile dan pemahaman cakupan tab/reset. PRO-6.1 tetap gate manusia terbuka; tidak mengklaim penerimaan penuh dari fixture. Gate PRO-3/PRO-4/PRO-5 sebelumnya tetap mengikuti catatannya.
