# Backlog PRO-0 dan sasaran pilot

Prioritas awal didasarkan pada dampak, risiko, kekuatan bukti dan dependency. Frekuensi keluhan pengguna **belum diketahui**; tidak diisi dengan angka rekaan. Estimasi usaha adalah ukuran relatif awal (1 kecil, 2 sedang, 3 besar, 5 perlu pemecahan); bukan hari kerja, janji waktu, atau rencana rilis. Pemilik di bawah merupakan fungsi/peran yang perlu ditetapkan ke orang nyata oleh pengelola.

| ID | Prioritas / bukti | Masalah dan cara memeriksa kembali | Paket berikutnya / scope | Target penerimaan | Owner / usaha / dependency |
|---|---|---|---|---|---|
| B-001 | P1, observasi produksi | Job honor failed setelah 5 percobaan, code 42501. Reproduksi baca-saja: agregasi kind/state/attempts/code job gagal; jangan menjalankan ulang transaksi untuk reproduksi | Diagnosis PRO-3 diprioritaskan; telusuri role/grant, guard bisnis dan konfigurasi yang relevan. Penyebab belum ditentukan | Penyebab dan dampak diketahui, perbaikan diuji pada fixture, tindakan produksi berotorisasi dan ledger tidak ganda; bukan sekadar reset attempts | Operator + pengembang; 3; akses diagnosis dan instruksi scope |
| B-002 | P1, gate manusia belum terpenuhi | Kelompok 1 admin + 3 guru disepakati, tetapi perangkat/jadwal/sesi/lingkungan aman belum ditetapkan | Tutup PRO-0.2/0.4 melalui UAT.md dan CSV; siapkan staging/dataset tanpa email nyata | 17 percobaan terjadwal atau alasan blokir tercatat; hasil asli, durasi, bantuan dan temuan tersedia; tidak ada data pribadi di Git | Pengelola + moderator; 2 untuk persiapan, koordinasi belum diestimasi; peserta dan lingkungan uji |
| B-003 | P2, bukti source/dokumen | Checkpoint lama dan beberapa deskripsi baseline 24 Oktober tertinggal dari main PR68; arsip lookup-only dapat disangka kondisi saat ini | PRO-0: paket/indeks program baru, source SHA, batas bukti dan langkah berikutnya | Pekerjaan berikutnya dapat memakai baseline baru tanpa mengulang tahap lama; arsip tetap utuh | Pengembang; 1; ditangani dokumentasinya pada paket ini |
| B-004 | P1 untuk pengukuran, bukan klaim lambat | Metrik produksi minute/module/status hanya samples,total_ms,max_ms; p50/p95 per endpoint tidak tersedia | PRO-2: rancang pengukuran terbatas tanpa payload/identitas, kaji sampling/retensi/akses | p50/p95 terukur dari distribusi/histogram yang tepat, endpoint/workload terpisah; tidak mengambil percentile rata-rata bucket | Pengembang + operator; 3; desain privasi/config dan dataset |
| B-005 | P1, batas bukti | Transaksi produksi sangat sedikit; hasil sekarang tidak mewakili beban penuh | PRO-2: workload representatif terisolasi, profil jadwal/riwayat/filter/pagination | Dataset, concurrence, p50/p95/error/lock dan kondisi uji dicatat; SLO disepakati setelah pengukuran | Pengembang + pengelola; 3; profil pemakaian nyata |
| B-006 | P1 sebelum memperluas beban; bukti historis | Stage-8 mencatat lock_timeout pada riwayat global 12060 baris, 4 request akun sama. Belum direproduksi ulang pada PRO-0 | PRO-2: ulangi kasus pada PostgreSQL disposable, cek query/session lock dan alternatif query/caching scoped | Hasil native aktual sebelum/sesudah; tidak menghapus lock/otorisasi atau menaikkan timeout untuk menyembunyikan masalah | Pengembang; 3; dataset native dan guard regresi |
| B-007 | P1, aksesibilitas belum lengkap | axe pilot tidak melaporkan violation, tetapi incomplete color-contrast/aria-valid-attr-value; Tab baru 8 langkah dan belum pembaca layar/perangkat fisik | PRO-1/PRO-4: periksa dialog, error summary, dropdown, tabs, seluruh alur fokus dan kombinasi rendered | Tidak ada blocker keyboard/alur inti dalam cakupan; hasil manual dicatat, bukan klaim sertifikasi | Pengembang + penguji aksesibilitas; 2; lingkungan/perangkat |
| B-008 | P1, operasi belum terbukti | Job notification completed tidak membuktikan pesan diterima; domain outbox kosong; backup/RPO/RTO produksi belum diperiksa | PRO-3: bukti pengiriman controlled recipient yang diizinkan, konfigurasi scheduler, backup dan restore terisolasi | Bukti terpisah queued/provider/delivery; backup/restore dan penanggung jawab alert tersedia; tidak mengirim email tanpa instruksi penerima | Operator; 3; akses operasional dan cakupan penerima |
| B-009 | P2, hipotesis UX | Jurnal mempunyai filter details, tab input/history/policy dan beberapa lapis pesan; belum diketahui titik kesulitan manusia | PRO-1 pilot jurnal guru; gunakan U02/U09/U10. Jangan menghapus prasyarat bisnis atau memaksa semua form ke modal | Hasil UAT menunjukkan langkah lebih jelas, target durasi/bantuan ditetapkan setelah baseline; regresi draft/konflik tetap lulus | Pengembang + guru; 2; B-002 |
| B-010 | P2, hipotesis UX | Pusat tugas admin memiliki ringkasan/filter/kartu dan deep link; manfaat/prioritas masih perlu dinilai peserta | PRO-1 pilot admin U08: satu tindakan utama sesuai konteks, blocker dan sumber tanggal jelas | Admin menemukan tugas mendesak dan sumber yang benar; tidak ada status selesai manual yang terpisah dari sumber | Pengembang + admin; 2; B-002 |
| B-011 | P2, hipotesis manfaat | Pemahaman rincian slip dan bantuan saat penolakan belum diukur | PRO-5: U06/U07, telusuri sumber komponen dan pesan field existing sebelum menambah UI | Layar/rincian/ekspor konsisten; peserta dapat menjelaskan asal komponen/aksi perbaikan; tidak ada kalkulator frontend kedua | Pengembang + guru/admin; 3; B-002 dan aturan finance |
| B-012 | P3, tahap tambahan belum dipilih | Preferensi/PWA/kalender/riwayat/changelog ada pada roadmap, bukan temuan kebutuhan mendesak yang terukur | PRO-6/7: pilih paket sesuai hasil UAT dan kesiapan cache/audit/sumber | Tiap paket punya scope dan gate sendiri; tidak menduplikasi subsistem atau cache data privat tanpa kebijakan | Pemilik produk + pengembang; estimasi setelah paket dipilih; tahap fondasi |

## Ruang lingkup pilot PRO-1 yang disiapkan

### Guru — mengisi jurnal dan memeriksa hasil

Source utama `src/features/activities/journal-workspace.tsx`, `journal-editor.tsx`, `src/lib/drafts/*`, feedback/field error. Source menunjukkan konteks dan riwayat dimuat melalui lifecycle masing-masing, filter disimpan pada state/URL sesuai implementasi, serta penanganan hasil tidak pasti sudah tersedia. Pemuatan riwayat walaupun tab input aktif adalah kandidat pengukuran, bukan langsung bug: nilai tradeoff cache/transisi harus dibuktikan.

Cakupan pilot: urutan informasi, cara memilih kegiatan, pemahaman prasyarat, ringkasan jumlah siswa, satu tindakan simpan utama, perbedaan draft/server, serta pemulihan setelah konflik/koneksi. Di luar scope: formula kredit, pelonggaran H-1/final-period, perubahan ownership, atau migrasi auth.

### Admin — menemukan prioritas dan menuju sumber

Source utama `src/features/tasks/task-center.tsx`, `task-workspace.tsx`, kontrak/deep link existing. Cakupan pilot: ringkasan ringkas, filter yang mudah ditemukan, status/penyebab blocker, dan tindakan menuju sumber. Di luar scope: engine tugas kedua, pemberian hak baru, atau penandaan selesai yang tidak berasal dari sumber.

## Sasaran yang dapat diputuskan dari baseline sekarang

| Gate | Baseline | Sasaran awal |
|---|---|---|
| Regresi source | CI 597 hasil runner + job native lulus pada snapshot | Tetap lulus pada head perubahan yang dirilis |
| Layout pilot | 0 overflow pada 16 kombinasi default | Tidak menambah overflow/error pada kombinasi yang sama; perluas data/dialog sesuai perubahan |
| Aksesibilitas | 0 axe violation, ada incomplete | Jangan menambah violation; selesaikan review manual yang relevan. Nol otomatis bukan penutupan B-007 |
| Waktu ready localhost | p50 1128/p95 1578 ms, 30 sampel, includes networkidle | Usulan budget regresi p95 <=1973 ms (+25%) hanya pada kondisi setara; ulangi jika ada noise, bukan SLO produksi |
| Tugas manusia | Belum diukur | Target detik/persen ditetapkan setelah UAT awal; tetap nol kehilangan data/pengiriman ganda |
| Kapasitas/SLO produksi | Belum ditetapkan | Tetapkan setelah B-004/B-005 dan pembahasan pengelola; tidak memakai nilai localhost sebagai janji produksi |

Budget +25% adalah usulan toleransi regresi untuk mengawali diskusi, bukan persetujuan pemilik produk atau bukti bahwa kenaikan latency diperbolehkan. Jika lingkungan berbeda, catat ulang baseline, jangan memaksakan angka lama.

## Tindak lanjut setelah snapshot

B-001: ditangani secara operasional pada 26 Oktober 2026 WIB, lihat pembaruan CHECKPOINT.md. B-009/B-010: pilot teknis PRO-1 dimulai atas instruksi pengelola; hipotesis kemudahan belum diterima pengguna. B-002/B-007 tetap memerlukan UAT/pembaca layar/perangkat fisik, bukan ditutup oleh tes otomatis.
