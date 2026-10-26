# PRO-1 — Pilot penyederhanaan UI/UX

Tanggal: 26 Oktober 2026 WIB. Paket: PRO-1.1–1.10 pada jurnal guru dan pusat tugas admin. Dasar source main PR68 + dokumentasi PRO-0 PR69 (masih terbuka saat pekerjaan dimulai).

Instruksi pengelola untuk memulai PRO-1 digunakan untuk melanjutkan pilot teknis meskipun UAT PRO-0 belum selesai. Hasil peserta, target durasi tugas dan penilaian kemudahan tetap **belum diukur**. Perluasan ke seluruh modul menunggu penerimaan pilot; tidak menganggap bukti fixture sebagai UAT manusia.

## Temuan dan perubahan

- Header jurnal/tugas berbeda pola, tools terpisah dari konteks. `PageHeader` menyatukan judul, deskripsi ringkas dan tools sekunder; pekerjaan utama tetap dekat data.
- Panel bertingkat dan border heading berulang menambah kepadatan visual. `.ui-workspace-pilot` mengurangi elevasi dan garis berulang secara opt-in. Token warna, field, button, tab, dialog dan pagination existing dipakai kembali tanpa mengganti identitas aplikasi.
- Selector global menganggap setiap `p[role=status]` sebagai sukses. Pada pilot, jumlah/pemuatan memakai gaya netral, hasil belum pasti/perlu pemeriksaan memakai warning, dan penyimpanan terkonfirmasi tetap sukses. Status tetap memakai teks dan live region.
- Ringkasan tanggal/filter jurnal sebelumnya hilang saat disclosure tertutup. Summary sekarang memuat tanggal input, rentang riwayat dan indikator filter aktif; tidak menambah state/filter kedua.
- Tombol pengisian jurnal menjadi tindakan utama. Kartu kegiatan menyatakan Siap diisi, Perlu prasyarat atau Tersimpan; penjelasan kendala dan seluruh aturan server dipertahankan.
- Pusat tugas membedakan Belum ada tugas aktif dari Tidak ada tugas yang cocok. Jumlah tugas kosong tidak diklaim sebagai semua pekerjaan selesai.
- Editor jurnal dikendalikan dari luar `FormDialog` tanpa trigger Radix. Fokus kini dikembalikan ke tombol asal bila masih tampak/aktif, atau judul halaman jika sumber hilang/nonaktif setelah simpan/hapus/pergantian tab. Dialog singkat, validasi, dirty-discard, draft dan uncertain-write tetap dipertahankan; tidak menambah wizard atau form kedua.

## Pola penerapan

1. Satu h1: konteks → judul → deskripsi singkat; tools sekunder di kanan desktop, membungkus pada mobile.
2. Ringkasan relevan → tindakan utama → filter → hasil. Jangan menambahkan ringkasan kosong untuk memenuhi pola.
3. Satu tombol utama per konteks. Sumber tugas tetap tautan per kartu; jangan menambah status penyelesaian manual.
4. Gunakan komponen Button, ui-control, Tabs, FormDialog, StatusBadge, Pagination existing. Tindakan berbahaya mempertahankan dampak dan konfirmasi/alasan audit.
5. Detail lanjutan memakai disclosure/tab existing; label tanggal aktif tetap terlihat.
6. Status netral/sukses/perhatian/error berbeda makna; jangan menyimpulkan sukses hanya dari role=status. Error tetap ErrorFeedback; gagal membaca tidak menampilkan empty state.
7. Tidak menambah animasi; reduced-motion global existing tetap berlaku. Fokus keyboard nyata diperiksa pada tutup/simpan, bukan hanya warna outline.

## Matriks adopsi

| Cakupan | Status | Batas |
|---|---|---|
| Jurnal guru dan admin | Pilot teknis | Input/riwayat/kebijakan, modal, filter dan feedback; UAT guru belum |
| Pusat tugas admin dan guru | Pilot teknis | Halaman penuh, ringkasan/filter/kartu/pagination; UAT admin belum |
| Widget tugas dashboard | Kompatibilitas | Panel compact dipertahankan; tidak disebut redesign dashboard |
| FormDialog bersama | Tambahan callback opsional | Hanya jurnal memasang callback fokus; konsumen lain tidak berubah |
| Modul lain | Belum diadopsi | Token existing tetap; perlu audit dan penerimaan terpisah |

Tidak ada perubahan SQL/API, payload, formula JTM/honor, autentikasi, permission, migrasi atau konfigurasi produksi. PR pilot ditumpuk pada branch PR69 agar dokumentasi baseline tidak diduplikasi dalam diff pilot. Tidak ada instruksi merge pada permintaan PRO-1 ini.

## Validasi

Lihat [VALIDATION.md](VALIDATION.md). Perintah browser menggunakan Playwright/Chromium eksternal, API/DB fixture disposable; tidak mengirim email atau memodifikasi produksi.

## Langkah berikutnya

Jalankan U02/U08/U09/U10 dari paket PRO-0 dengan 1 admin + 3 guru. Isi hasil asli dan bandingkan waktu/bantuan dengan baseline pengguna; tinjau fokus memakai pembaca layar/perangkat fisik. Putuskan perluasan modul berdasarkan temuan tersebut. PRO-1 belum ditutup sebagai penerimaan seluruh aplikasi.
