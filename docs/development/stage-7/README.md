# Tahap 7 — Draft otomatis dan pengalaman mobile

24 Oktober 2026 WIB. Scope roadmap 7.1–7.5; dependency Tahap 1–2. Tahap 6 sudah merged PR #50, main `8dc29ca7027838d46b409e1cc6511330aa57a73b`, migrasi produksi ledger32 dan deployment READY telah diverifikasi pada rilisnya.

## Keputusan penyimpanan dan kontrak

Draft **sessionStorage per tab**, bukan database/server, localStorage bersama, service worker atau antrean offline. Tidak ada migrasi produksi. Penyimpanan ini mempertahankan input pada reload tab yang sama, membatasi paparan pada perangkat bersama dan tidak membutuhkan perubahan kontrak API. Penutupan tab, kebijakan browser/private mode dan penghapusan storage dapat menghilangkan draft. Browser tertentu memulihkan sessionStorage saat memulihkan tab: TTL dan pengamanan akun tetap berlaku.

- 7.1: envelope format1, account/module/entity/basis. Create jurnal diikat ke occurrence; edit diikat ke journal ID dan versi sumber. BAP diikat ke occurrence, sumber/versi BAP, penugasan, jumlah siswa, konfirmasi dan akhir periode. Pemulihan hanya mengisi field allowlist; ID, versi dan kewenangan tetap dari respons server terbaru.
- 7.2: status lokal, waktu WIB dan notifikasi storage gagal. Save sinkron saat input/change; render status ditunda ke task berikutnya agar tidak mendahului delegated onChange React pada input angka terkontrol. Ref form memastikan listener dipasang setelah isi portal benar-benar mount; cleanup melepas semua listener. Tidak ada autosubmit.
- 7.3: Pulihkan eksplisit, Lihat isian, Hapus draft lokal. TTL24 jam sejak edit terakhir; draft rusak, kedaluwarsa atau format tidak cocok dipurge. Draft dihapus setelah hasil save terverifikasi, Buang perubahan, logout berhasil/401/expired, pesan logout antartab, halaman login dan pergantian akun. Penghapusan lokal tidak menghapus jurnal/BAP server. Hapus draft tidak mengosongkan form yang sedang diketik; input berikutnya membuat draft baru.
- 7.4: basis sumber berubah memblokir restore langsung, tetapi teks aman tetap bisa ditinjau/dicopy ke formulir baru. Mengganti kegiatan membersihkan isian lama dan memilih namespace draft kegiatan baru. Sebelum write, draft ditandai uncertain; setelah ack valid draft dihapus. Respons hilang/timeout/konflik/invalid/gagal tak dikenal tetap memerlukan pemeriksaan riwayat dan konfirmasi eksplisit sebelum restore. Penolakan API yang pasti mengembalikan status editing. Validasi/eligibility/locking/ledger existing tetap otoritatif di server; draft tidak memberi izin melewati batas tanggal/konfirmasi/finalisasi atau memakai versi lama.
- 7.5: menggunakan kartu dan dialog responsif existing, panel draft membungkus teks panjang dan tombol, status koneksi, form panjang scroll di body dialog dan footer tetap dapat dicapai; summary BAP memiliki target sentuh44px/fokus keyboard. Matriks portrait/landscape termasuk resize dengan draft terisi.

## Allowlist dan privasi

Jurnal: material≤2000, present/absent≤4 karakter, notes≤2000, reason≤500. BAP: present/absent≤4, notes≤1000. Draft boleh belum valid agar input parsial tidak hilang; form/API tetap memvalidasi sebelum save. Tidak ada password, CSRF/session token, kredensial, cookie, lampiran, ledger atau payload hidden yang disalin. Scope berisi akun dan metadata sumber agar konflik bisa dideteksi. Nilai diperlakukan sebagai data tidak tepercaya, panjang/schema/TTL dicek saat read, ditampilkan sebagai teks React, bukan HTML.

Draft bukan backup atau transaksi offline. Tidak ada sinkronisasi antarperangkat. Tab baru independen; browser yang menggandakan tab dapat menyalin snapshot sessionStorage awal, lalu tiap tab terpisah. Logout memakai BroadcastChannel existing; bila tidak tersedia, pemeriksaan sesi berkala menghapus draft tab lain saat401/login. Storage yang ditolak/quota penuh menampilkan kegagalan tanpa menggagalkan pengisian atau validasi server. Jangan menutup formulir tersebut tanpa menyimpan/salin isian penting.

## Source dan validasi

`src/lib/drafts/storage.ts`, `src/features/drafts/form-draft.tsx`; integrasi JournalEditor, DataForm khusus BAP, SessionBoundary dan LoginForm. DataForm modul lain tidak mengaktifkan draft. Tidak ada perubahan SQL/engine honor/API.

Unit storage menguji isolasi, allowlist, versi/basis, TTL/future/malformed/oversized, account switch/logout dan storage gagal. Browser `test:ui:drafts` menguji reload, angka terkontrol,8viewport/orientasi, offline/no-autosubmit, uncertain write/review, success-purge, konflik sumber,TTL,account switch,tab isolation,discard/login purge dan storage denied. Regresi jurnal dan ujian/BAP memakai fixture disposable; BAP reload/restore mengalir ke validasi dan save server existing. Hasil aktual pada validation.json.

PGlite/Chromium adalah bukti sintetis, bukan UAT perangkat fisik/pembaca layar atau kapasitas produksi. Tidak mengirim jurnal/BAP nyata saat smoke produksi. PR/checks/merge dan deployment aktual diverifikasi sebelum dinyatakan rilis. Tahap8 belum dijalankan.

## Panduan singkat

Pilih kegiatan lalu isi jurnal, atau buka Isi/Ubah BAP. Status draft menunjukkan waktu simpan di tab ini. Setelah reload, buka kegiatan/formulir yang sama, tinjau lalu pilih Pulihkan draft. Jika sumber berubah, gunakan teks draft sebagai referensi dengan data terbaru. Jika hasil kirim belum pasti, periksa riwayat sebelum mengirim kembali. Logout dan Buang perubahan menghapus draft lokal.
