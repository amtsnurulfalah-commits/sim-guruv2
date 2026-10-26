# Evaluasi dan pekerjaan yang belum tertutup

Tidak ada jadwal, pengingat atau pemantauan otomatis yang dibuat oleh paket ini. Periode evaluasi belum disepakati; usulan awal adalah 7 hari operasional setelah sesi UAT pertama, menunggu keputusan pengelola. Nama petugas dan tanggal mulai/akhir wajib dicatat sebelum pengukuran.

| ID / prioritas | Pekerjaan dan owner peran | Bukti selesai |
| --- | --- | --- |
| UAT-01 / P1 | Pengelola + moderator: jadwalkan 1admin/3guru, lingkungan sintetis dan perangkat representatif | Ulang U01–U10 sesuai UAT PRO-0; 17 percobaan dicatat asli atau alasan blokir, durasi kerja/wait/bantuan/skor, perangkat/koneksi dan denominator. Jangan memakai data/transaksi produksi sebagai fixture. |
| BKP-01 / P1 | Operator: bukti backup produksi privat dan retensi | Lokasi privat, waktu backup, usia, retensi dan hasil pemeriksaan; arsip/kunci tidak masuk Git. |
| BKP-02 / P1 | Pengelola + operator: RPO/RTO, pemilik kunci dan quiet window | Kesepakatan tertulis dan drill terkontrol sesuai runbook PRO-3; bukti native sintetis bukan pengganti. Jangan menghentikan cron produksi tanpa jadwal yang disepakati. |
| MAIL-01 / P1 | Pengelola + operator: tentukan penerima uji dan izin pengiriman nyata | Inbox/hasil penerima diverifikasi, bukan hanya SMTP accepted atau worker success. Tidak mengirim email dari paket PRO-8 ini. |
| A11Y-01 / P1 | Moderator + pengguna: keyboard dan pembaca layar nyata | Jalur jurnal/tugas, modal dan error terbaca, fokus kembali, pembesaran/orientasi pada perangkat fisik; masalah direproduksi tanpa PII. |
| CAL-01 / P2 | Guru + moderator: kalender dan pemasangan | Install/launch/update pada perangkat sasaran; impor ICS tanggal/WIB, pengganti/pembatalan, pemahaman snapshot dan penghapusan impor lama. |
| UX-01 / P2 | Pengelola: manfaat preferensi dan rincian honor | U06/U08 dan preferensi dipahami; bandingkan kondisi/perangkat setara; jangan menganggap checkbox fitur sebagai bukti manfaat. |
| OBS-01 / P1 | Operator: evaluasi operasional selama window yang disepakati | Catat per hari jumlah request/error per kategori, volume pengguna/tugas dan job sukses/gagal/tertunda; bedakan paused out-of-scope dan gangguan aktif. Gunakan agregat tanpa jurnal/slip/token/email. |

## Aturan menilai

- Keberhasilan mandiri: hitungan tugas selesai tanpa bantuan / percobaan yang bisa dijalankan; tampilkan blocked terpisah. Durasi median per skenario dan kelas perangkat; kondisi berbeda dinyatakan tidak sebanding.
- API: p50/p95 per endpoint dan kelas ukuran data/jaringan; denominator error harus sama periode/kelas request. Angka lokal tidak menjadi target kapasitas produksi.
- Integritas: tidak ada kehilangan data, duplikasi submit, kebocoran antar-akun atau selisih honor yang tidak terjelaskan pada sampel yang diuji. Jika ditemukan, hentikan alur terkait, simpan referensi bantuan yang aman dan telusuri sumber sebelum retry.
- Pekerjaan antrean: queued/accepted/sent/inbox dibedakan. Paused September tidak diaktifkan kembali untuk memenuhi angka sukses.
- Setiap temuan mempunyai langkah reproduksi, dampak, prioritas, owner, bukti dan tindakan. Jangan publikasi PII atau secret.

## Pemulihan rilis

Operator memeriksa deployment/commit dan health sebelum rollback. Jika masalah terkait PRO-8, gunakan deployment PRO-7 (`beafb5f0f3379803fd3b2619c22bda0798aaa4db`) melalui alur Vercel berotorisasi atau revert PR PRO-8; verifikasi READY/alias/health dan akses anonim kembali. Tidak memerlukan rollback database. Jangan menghapus fungsi migrasi37, ledger atau audit; snapshot final dan transaksi pengguna tetap dipertahankan.

Jika sumber masalah belum jelas atau hasil write tidak pasti, jangan mengirim ulang otomatis. Periksa sumber/riwayat dan laporkan kode bantuan. RPO/RTO/quiet window mengikuti PRO-3, bukan angka hasil fixture.
