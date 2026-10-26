# Validasi PRO-4

26 Oktober 2026 WIB. Data uji sintetis; tidak mengirim email atau transaksi produksi.

| Pemeriksaan | Hasil |
| --- | --- |
| Unit HTTP/kontrak | 165 lulus, 0 gagal; offline POST ditolak sebelum fetch, GET tetap manual, reconnect tidak retry |
| Lint / typecheck | Lulus |
| Build produksi | Lulus setelah membuang cache Turbopack lokal yang rusak; tidak mengubah source untuk menyembunyikan error |
| Crypto/HTTP | Exit 0 |
| Draft | Lulus: restore eksplisit, angka terkontrol, offline sebelum CSRF (0 write), reconnect 0 autosubmit, status belum pasti, akun/TTL/versi, logout/expiry/tab isolation/storage denied; 9 viewport termasuk 375x320 |
| Jurnal | Lulus: 7 lebar, loading/response tertahan, submit ganda, busy close, konflik, penolakan, malformed acknowledgement, putus respons setelah commit sintetis (tetap 1 write), pemulihan manual, receipt sebelum refresh gagal, fokus, landscape/200% teks; 0 page error |
| Jadwal | Lulus 12 kombinasi peran/viewport; stale/preview/double submit, search/page/bulk, long text, orientasi, 101-row print; 0 page error |
| Ujian/BAP | Lulus confirm/draft restore/count/create/edit/uncertain/malformed/paging/WIB; 1440/768/320/740, 0 page error |
| Tugas | Lulus 28 kasus, koneksi lambat/fokus/online coalescing, retry/read, duplicate/uncertain write, filter/page/empty, orientasi/200%; 0 page error/overflow |
| Honor/slip | Lulus preview/expiry/finalize/corrections, uncertainty, private PDF/Excel, history/print; 1440/768/320/740, 0 page error |
| Shell produksi lokal | 56 kombinasi, indikator offline/reconnect, touch, fokus/resize/navigasi, 200% teks; 0 page/console error |
| Database regression | Runner lokal exit 0 tetapi log ringkasan seluruh suite tidak lengkap; jangan menggunakan exit code tersebut sebagai bukti jumlah lulus. CI quality pada head PR harus selesai sebelum merge. |

React review: tidak menambah dependency, mutable request cache, fetch ganda atau global state akun. VisualViewport/listener dibersihkan, koneksi useSyncExternalStore memiliki snapshot server stabil, candidate review memakai identitas kandidat. Kontrak bisnis dan receipt validation dipertahankan.

Tidak memerlukan SQL/migrasi. Rilis tetap mensyaratkan quality/native CI hijau dan produksi READY pada SHA merge. Perangkat fisik, Safari/iOS, keyboard nyata, matriks perangkat pilihan pengguna dan UAT manusia belum diuji/disepakati; PRO-4.7 terbuka. Tidak mengklaim keseluruhan gate selesai.
