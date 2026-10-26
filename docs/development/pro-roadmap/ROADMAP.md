# Roadmap Pengembangan Lanjutan SiM-Guru

> Program penyempurnaan pengalaman pengguna, performa, dan kesiapan operasional.
> Dokumen ini merupakan acuan pekerjaan; keberadaan rencana tidak berarti fitur telah diterapkan.

## 1. Identitas dan status dokumen

| Aspek | Keterangan |
|---|---|
| Versi | 1.1 — checkpoint PRO-0 |
| Tanggal penyusunan | 26 Oktober 2026, WIB |
| Aplikasi | SiM-Guru |
| Repositori | `amtsnurulfalah-commits/sim-guruv2` |
| Acuan kebutuhan | Seluruh saran pengembangan pada percakapan sebelum dokumen ini |
| Baseline aktual PRO-0 | Main PR #68, commit 882367b52cf0b69ad743c49878dcf0972c8d3bab; lihat ../pro-0/CHECKPOINT.md |
| Status program ini | **PRO-0 baseline teknis tersedia; UAT manusia menunggu pelaksanaan** |
| Penomoran | `PRO-0` sampai `PRO-8`, terpisah dari Tahap 0–8 pembangunan ulang dan roadmap profesional terdahulu |
| Pemilik keputusan produk | Admin/pengelola madrasah |
| Pelaksana teknis | Pengembang/agen yang melanjutkan pekerjaan |

Dokumen ini menyatukan rekomendasi prioritas, pembaruan UI/UX, dan fitur tambahan. Gunakan bersama dokumen pengembangan di repositori, terutama `docs/development/ROADMAP_PENGEMBANGAN.md`, `CHECKPOINT.md`, serta hasil audit modul terkait. Bila isi dokumen historis berbeda dengan source atau kondisi rilis, catat perbedaannya sebelum mengambil keputusan.

**Dokumen ini tidak memerintahkan pelaksanaan seluruh tahap sekaligus, tidak menetapkan jadwal rilis, dan bukan izin otomatis untuk migrasi database atau perubahan produksi.** Pelaksanaan mengikuti instruksi pengguna dan persetujuan yang berlaku untuk cakupan pekerjaan tersebut.

## 2. Tujuan dan prinsip pengembangan

Hasil yang dituju:

1. Guru dan admin menyelesaikan tugas rutin lebih cepat, dengan lebih sedikit kesalahan dan kebutuhan bantuan.
2. Tampilan konsisten, profesional, modern, dan mudah dipahami pada desktop maupun ponsel.
3. Aplikasi tetap responsif ketika data bertambah dan beberapa pengguna bekerja bersamaan.
4. Penugasan, JTM, BAP, kehadiran, dan honorarium dapat ditelusuri tanpa menciptakan sumber perhitungan baru.
5. Pengiriman pengingat, pekerjaan terjadwal, backup, dan pemulihan mempunyai bukti operasional yang dapat diperiksa.
6. Fitur tambahan dibangun setelah alur utama dan prasyaratnya terbukti siap.

Prinsip yang wajib dipertahankan:

- Prioritaskan stabilitas, kompatibilitas, dan kemudahan menyelesaikan pekerjaan sebelum dekorasi.
- Pertahankan stack Next.js App Router, TypeScript, Tailwind, komponen shadcn/Radix, Zod, Supabase PostgreSQL, dan Vercel yang digunakan aplikasi.
- Autentikasi tetap internal SiM-Guru; jangan mengubahnya menjadi Central SSO atau Supabase Auth sebagai efek samping pekerjaan UI.
- Pertahankan kewenangan admin/guru dan petugas kontekstual menurut penugasan, tanggal, serta periode. Menyembunyikan tombol bukan pengganti validasi server.
- Gunakan komponen, pusat tugas, notifikasi, outbox/worker, draft, audit, laporan, dan engine honorarium yang sudah tersedia. Telusuri implementasinya sebelum menambah modul baru.
- Jangan mengubah aturan JTM, pembulatan, reversal ledger, snapshot final, atau koreksi tanpa kebutuhan bisnis dan pengujian yang jelas.
- Gunakan WIB untuk tanggal, waktu, tenggat, dan penyajian jadwal.
- Jangan menganggap hasil uji sintetis sebagai UAT pengguna nyata, keberhasilan pengiriman email, atau bukti kapasitas produksi.
- Informasi pribadi, kredensial, token, serta dokumen finansial tidak dimasukkan ke screenshot publik, log, atau laporan pengujian.

## 3. Peta cakupan seluruh saran

| Kode saran | Saran | Prioritas | Tahap utama |
|---|---|---|---|
| S-01 | Uji penggunaan bersama guru dan admin | P1 | PRO-0 |
| S-02 | Penyederhanaan tampilan secara menyeluruh | P1 | PRO-1 |
| S-03 | Peningkatan kecepatan berdasarkan data produksi | P1 | PRO-2 |
| S-04 | Kesiapan operasional yang terverifikasi | P1 | PRO-3 |
| S-05 | Penyempurnaan pengalaman mobile | P1 | PRO-4 |
| S-06 | Transparansi perhitungan honorarium | P2 | PRO-5 |
| S-07 | Bantuan sesuai konteks pekerjaan | P2 | PRO-5 |
| S-08 | Personalisasi ringan | P2 | PRO-6 |
| S-09 | PWA yang dapat dipasang | P3 | PRO-7.1 |
| S-10 | Kalender pribadi terpadu dan ekspor | P3 | PRO-7.2 |
| S-11 | Riwayat perubahan yang mudah dipahami | P3 | PRO-7.3 |
| S-12 | Catatan pembaruan aplikasi | P3 | PRO-7.4 |
| UX-01 | Hierarki judul → ringkasan → tindakan → filter → data | P1 | PRO-1 |
| UX-02 | Warna bermakna, disertai teks/ikon | P1 | PRO-1 |
| UX-03 | Modal untuk tindakan singkat; halaman untuk pekerjaan panjang | P1 | PRO-1 dan PRO-4 |
| UX-04 | Animasi seperlunya dan pengurangan gerakan | P1 | PRO-1 |
| UX-05 | Aksesibilitas nyata: keyboard, fokus, pembaca layar, pembesaran, kontras | P1 | PRO-0, PRO-1, PRO-4, PRO-8 |

P1 merupakan fondasi yang didahulukan. P2 memperdalam manfaat fitur utama. P3 merupakan pengembangan tambahan setelah prasyarat siap. Pekerjaan kritis keamanan, integritas data, atau kehilangan data selalu didahulukan meskipun ditemukan pada tahap berikutnya.

## 4. Urutan dan ketergantungan tahap

| Tahap | Fokus | Prasyarat | Hasil utama |
|---|---|---|---|
| PRO-0 | Baseline, UAT, dan penetapan sasaran | Dokumen ini dan source aktual | Temuan pengguna, baseline, backlog terukur |
| PRO-1 | Penyederhanaan UI/UX | PRO-0 | Pola halaman dan komponen konsisten |
| PRO-2 | Performa dan kapasitas | Baseline PRO-0; alur penting telah dipilih | Perbaikan bottleneck yang terukur |
| PRO-3 | Pengiriman, pekerjaan otomatis, backup/pemulihan | Inventaris dan akses operasional yang sah | Bukti kesiapan operasional dan runbook |
| PRO-4 | Pengalaman mobile dan koneksi tidak stabil | PRO-1; temuan PRO-0 | Alur ponsel yang nyaman dan hasil simpan jelas |
| PRO-5 | Transparansi honorarium dan bantuan kontekstual | PRO-1; sumber data/izin tervalidasi | Rincian dapat ditelusuri dan tindakan perbaikan jelas |
| PRO-6 | Preferensi dan pintasan pribadi | PRO-1 dan PRO-4 | Personalisasi ringan tanpa mengubah akses |
| PRO-7 | PWA, kalender, riwayat, catatan pembaruan | PRO-1–PRO-6 diterima atau pengecualian dicatat | Fitur tambahan yang benar-benar bermanfaat |
| PRO-8 | Validasi akhir, rilis, dan evaluasi | Tahap yang hendak dirilis | Bukti penerimaan serta rencana tindak lanjut |

Urutan default: **PRO-0 → PRO-1 → PRO-2 → PRO-3 → PRO-4 → PRO-5 → PRO-6 → PRO-7 → PRO-8**. Pemeriksaan aksesibilitas, keamanan, pengujian, dan dokumentasi dilakukan di setiap tahap, bukan ditunda sampai PRO-8. Tahap dapat dirilis bertahap setelah memenuhi gate yang relevan.

Tidak menetapkan estimasi hari/minggu sebelum inventaris dan baseline selesai. Pada akhir PRO-0, pecah pekerjaan menjadi paket kecil dengan penanggung jawab, estimasi usaha, ketergantungan, dan kriteria selesai. Batas tanggal rilis diputuskan setelah paket tersebut disepakati.

## 5. Tahap PRO-0 — Baseline, UAT, dan sasaran

**Tujuan:** memahami kesulitan pengguna yang nyata dan menentukan tolok ukur sebelum melakukan perubahan.

### Pekerjaan

- [ ] **PRO-0.1** Periksa main, PR terbuka, deployment, checkpoint, serta implementasi fitur yang sudah ada. Catat pekerjaan lama yang tidak perlu diulang.
- [ ] **PRO-0.2** Pilih peserta UAT yang mewakili guru, admin, dan petugas kontekstual yang relevan; sertakan pengguna ponsel dan desktop. Jumlah peserta ditetapkan bersama pengelola.
- [ ] **PRO-0.3** Susun tugas UAT: mencari jadwal, mengisi jurnal, menunjuk/mengganti/membatalkan pengganti, konfirmasi tugas, mengisi BAP, melihat slip, dan menelusuri kendala.
- [ ] **PRO-0.4** Ukur keberhasilan, durasi, kesalahan, kebutuhan bantuan, perangkat, serta kondisi koneksi. Bedakan waktu kerja pengguna dan waktu menunggu server.
- [ ] **PRO-0.5** Catat baseline waktu respons API, pengalaman halaman, ukuran data, jumlah pengguna serentak, dan keberhasilan pekerjaan terjadwal yang dapat diakses secara sah.
- [ ] **PRO-0.6** Uji keyboard, fokus, pembesaran teks, kontras, serta alur pembaca layar. Gunakan WCAG 2.2 AA sebagai sasaran evaluasi, bukan klaim sertifikasi otomatis.
- [ ] **PRO-0.7** Prioritaskan temuan berdasarkan dampak, frekuensi, risiko, dan usaha. Tetapkan target sesudah baseline tersedia.

### Hasil yang diserahkan

- Inventaris kondisi aktual dan kesenjangan bukti.
- Skenario serta ringkasan UAT anonim.
- Tabel baseline/target dan backlog ber-ID.
- Ruang lingkup pilot PRO-1, idealnya alur jurnal guru dan penanganan tugas oleh admin.

### Kriteria selesai

Setiap masalah prioritas mempunyai bukti, pengguna terdampak, cara reproduksi, penanggung jawab, serta ukuran perbaikan. Hasil yang belum diukur ditulis **belum diukur**, bukan diperkirakan sebagai hasil nyata.

## 6. Tahap PRO-1 — Penyederhanaan dan modernisasi UI/UX

**Tujuan:** pengguna segera memahami posisi, informasi penting, dan tindakan berikutnya.

### Pekerjaan

- [ ] **PRO-1.1** Standarkan hierarki halaman: judul, konteks singkat, ringkasan penting, tindakan utama, filter, lalu data. Susun sesuai kebutuhan halaman; tidak memaksakan panel kosong.
- [ ] **PRO-1.2** Tetapkan satu tindakan utama per konteks kerja. Tindakan sekunder ditampilkan seperlunya; tindakan berbahaya memiliki penjelasan dampak dan konfirmasi yang sesuai.
- [ ] **PRO-1.3** Kurangi panel bertingkat, border berulang, teks instruksi duplikat, dan ikon tanpa makna. Tampilkan detail lanjutan melalui pengungkapan bertahap.
- [ ] **PRO-1.4** Konsolidasikan token typography, spacing, radius, elevasi, tombol, field, tab, dialog, tabel, pagination, serta feedback menggunakan design system existing.
- [ ] **PRO-1.5** Gunakan warna semantik: berhasil, perhatian, gagal, dan netral. Status selalu dapat dipahami tanpa mengandalkan warna saja.
- [ ] **PRO-1.6** Tindakan singkat menggunakan modal yang fokus dan dapat ditutup dengan aman. Pekerjaan panjang/kompleks menggunakan halaman tersendiri atau langkah bertahap dengan ringkasan.
- [ ] **PRO-1.7** Selaraskan loading, empty, error, success, dan hasil simpan tidak pasti. Bedakan “belum ada data”, “hasil filter kosong”, dan “gagal memuat”.
- [ ] **PRO-1.8** Gunakan animasi ringan untuk memperjelas perubahan; hormati `prefers-reduced-motion` dan hindari gerakan dekoratif yang mengganggu pekerjaan.
- [ ] **PRO-1.9** Periksa label, urutan tab, fokus modal, fokus setelah penyimpanan, kontras, pengumuman status, dan akses dengan keyboard.
- [ ] **PRO-1.10** Uji pilot, bandingkan dengan baseline, lalu perluas bertahap ke modul lain. Jangan mengklaim adopsi seluruh aplikasi sebelum setiap modul diperiksa.

### Hasil dan kriteria selesai

Spesifikasi pola UI, komponen yang digunakan bersama, serta matriks adopsi per modul tersedia. Pilot lulus skenario normal/kosong/loading/error dan UAT ulang; fungsi lama, navigasi, serta hak akses tetap sesuai. Hasil pengukuran menunjukkan arah perubahan terhadap target yang ditetapkan pada PRO-0.

## 7. Tahap PRO-2 — Performa dan kapasitas berdasarkan bukti

**Tujuan:** mempercepat alur yang benar-benar lambat tanpa melemahkan integritas transaksi.

### Pekerjaan

- [ ] **PRO-2.1** Identifikasi halaman/API/query terlama dari pengukuran yang sah. Bedakan bottleneck jaringan, render, query, lock, ukuran respons, dan pekerjaan latar belakang.
- [ ] **PRO-2.2** Prioritaskan riwayat berskala besar, pencarian/filter, pagination, laporan, serta akses serentak. Verifikasi kembali keterbatasan riwayat global paralel yang pernah dicatat.
- [ ] **PRO-2.3** Optimalkan query, indeks, pemilihan kolom, pagination server, dan pembatasan rentang sesuai temuan. Ukur biaya tambahan indeks dan rencana query sebelum menerapkan.
- [ ] **PRO-2.4** Kurangi fetch berulang, waterfall yang tidak perlu, pemuatan data yang belum dibutuhkan, dan render ulang yang mahal.
- [ ] **PRO-2.5** Gunakan caching hanya dengan kebijakan scope pengguna, invalidasi, dan masa berlaku yang jelas. Data privat tidak boleh tertukar akun atau tampil sebagai data terkini setelah perubahan.
- [ ] **PRO-2.6** Uji beban dengan dataset representatif pada lingkungan disposable/staging. Uji beban produksi hanya dalam cakupan yang diizinkan.
- [ ] **PRO-2.7** Bandingkan p50/p95, error rate, timeout, dan penggunaan sumber daya sebelum/sesudah dalam kondisi setara.

### Hasil dan kriteria selesai

Laporan bottleneck serta hasil sebelum/sesudah tersedia. Target performa per alur ditetapkan dari baseline, tercapai atau kesenjangannya dinyatakan jelas. Tes konkurensi dan integritas tetap lulus. Tidak “memperbaiki” timeout hanya dengan menaikkan batas waktu atau menghapus locking/validasi.

## 8. Tahap PRO-3 — Kesiapan operasional yang terverifikasi

**Tujuan:** aplikasi dapat dipantau, dirawat, dan dipulihkan dengan prosedur yang terbukti.

### Pekerjaan

- [ ] **PRO-3.1** Inventaris konfigurasi pengiriman, worker, penjadwal, retry, antrean gagal, deduplikasi, dan pemantauan yang sudah tersedia. Periksa kondisi aktual; jangan menganggap layanan masih nonaktif atau sudah aktif hanya dari catatan lama.
- [ ] **PRO-3.2** Verifikasi pengingat dan pekerjaan terjadwal pada lingkungan yang tepat. Pisahkan status masuk antrean, diterima provider, dan diterima penerima bila bukti tersedia.
- [ ] **PRO-3.3** Uji agar tugas yang sudah selesai tidak terus diingatkan; kegagalan dan retry tidak menghasilkan pesan ganda.
- [ ] **PRO-3.4** Tampilkan pekerjaan yang terlambat/gagal, waktu sukses terakhir, tingkat kegagalan, dan tindakan admin yang dapat dilakukan dengan aman.
- [ ] **PRO-3.5** Hubungkan alert dengan penanggung jawab, langkah penanganan, dan referensi kendala. Tetapkan ambang yang disepakati agar tidak menimbulkan kebisingan.
- [ ] **PRO-3.6** Tetapkan cakupan backup: database, objek/lampiran jika digunakan, konfigurasi yang perlu dipulihkan, dan pengelolaan secret secara terpisah. Tentukan retensi, enkripsi, serta akses.
- [ ] **PRO-3.7** Verifikasi jadwal backup dan lakukan latihan restore pada lingkungan terisolasi. Pastikan email/job dari hasil restore tidak berjalan tanpa sengaja.
- [ ] **PRO-3.8** Sepakati target RPO/RTO; ukur hasil aktual dan jelaskan batasnya. Lengkapi runbook gangguan, rollback aplikasi, serta pemulihan data.

### Hasil dan kriteria selesai

Tersedia bukti pengiriman/eksekusi dalam cakupan yang disepakati, backup bertanggal, latihan restore, daftar pemilik alert, dan runbook. Jika akses atau konfigurasi belum tersedia, tandai bagian tersebut **terblokir** dan jelaskan kebutuhan penyelesaiannya. Uji lokal tidak boleh dinyatakan sebagai bukti restore produksi.

## 9. Tahap PRO-4 — Mobile dan koneksi tidak stabil

**Tujuan:** alur utama nyaman diselesaikan dari ponsel dan status penyimpanan tidak membingungkan.

### Pekerjaan

- [ ] **PRO-4.1** Susun informasi terpenting lebih dahulu. Gunakan kartu untuk data yang lebih mudah dibaca pada ponsel; gunakan scroll lokal pada tabel yang memang membutuhkan perbandingan kolom.
- [ ] **PRO-4.2** Periksa form panjang, keyboard layar, safe area, orientasi, dropdown, serta tombol simpan. Tombol tetap mudah dijangkau tanpa menutup field, pesan, atau baris data.
- [ ] **PRO-4.3** Pastikan modal tidak melebihi viewport, isi dapat digulir, fokus tetap benar, serta pengguna tidak kehilangan isian secara diam-diam saat menutupnya.
- [ ] **PRO-4.4** Tampilkan kondisi koneksi dan bedakan: draft lokal, sedang dikirim, tersimpan di server, gagal, serta hasil yang belum dapat dipastikan.
- [ ] **PRO-4.5** Gunakan draft existing dan kebijakan akun/TTL/versi yang berlaku. Jangan menyamakan draft dengan transaksi yang sudah terkirim.
- [ ] **PRO-4.6** Uji putus sambung, jaringan lambat, request yang terlambat, klik berulang, dan perubahan data oleh pengguna lain. Jangan mengirim ulang transaksi otomatis ketika hasil sebelumnya belum diketahui.
- [ ] **PRO-4.7** Uji perangkat fisik yang tersedia, termasuk browser yang mewakili pemakaian pengguna; catat cakupan yang belum diuji.

### Hasil dan kriteria selesai

Alur jadwal, jurnal, BAP, tugas, dan slip lulus matriks perangkat yang disepakati. Tidak ada overflow halaman horizontal yang tidak disengaja atau kontrol yang terpotong. Scroll vertikal halaman panjang tetap diperbolehkan dan harus nyaman. Tidak ada pengiriman ganda atau draft yang tertukar akun.

## 10. Tahap PRO-5 — Transparansi informasi dan bantuan kontekstual

**Tujuan:** pengguna mengetahui asal informasi dan cara memperbaiki ketidaksesuaian.

### A. Transparansi honorarium

- [ ] **PRO-5.1** Tinjau rincian slip yang sudah tersedia; identifikasi informasi yang masih sulit dipahami, bukan langsung membuat kalkulator baru.
- [ ] **PRO-5.2** Sediakan alur “Asal perhitungan”: slip → komponen → kegiatan/penugasan → JTM, penyesuaian, reversal, dan koreksi terkait sesuai kewenangan.
- [ ] **PRO-5.3** Bedakan nilai proyeksi dan final. Jelaskan tanggal/periode berlaku dan sumber tarif dengan bahasa pengguna.
- [ ] **PRO-5.4** Cocokkan rincian layar, ekspor, dan hasil engine yang sama. Nilai final berasal dari snapshot yang sah dan tidak dihitung ulang menggunakan konfigurasi terbaru.

### B. Bantuan sesuai konteks

- [ ] **PRO-5.5** Tampilkan contoh isian, aturan singkat, dan bantuan di dekat field yang relevan. Hindari instruksi panjang yang muncul berulang di semua halaman.
- [ ] **PRO-5.6** Hubungkan penolakan dengan field atau aturan yang tidak sesuai, langkah perbaikan, dan kode referensi bantuan bila diperlukan.
- [ ] **PRO-5.7** Dari pusat tugas, laporan, atau kendala, arahkan pengguna ke sumber/tanggal/filter/bagian yang relevan. Tautan tidak boleh melewati izin atau membawa informasi sensitif pada URL.
- [ ] **PRO-5.8** Uji apakah pengguna dapat memahami rincian dan menyelesaikan masalah tanpa bantuan tambahan.

### Hasil dan kriteria selesai

Pengguna dapat menjelaskan asal komponen slip berdasarkan rincian yang ditampilkan, dan ketidaksesuaian layar/rincian/ekspor diselesaikan. Bantuan mengarahkan ke tindakan yang tersedia bagi pengguna tersebut. Tidak ada engine honorarium kedua di frontend dan tidak ada pembukaan data guru lain tanpa izin.

## 11. Tahap PRO-6 — Personalisasi ringan

**Tujuan:** mengurangi langkah berulang tanpa membuat navigasi atau kewenangan menjadi berbeda secara tidak terkendali.

### Pekerjaan

- [ ] **PRO-6.1** Pilih preferensi bernilai nyata dari hasil UAT: kepadatan tabel, jumlah baris, filter favorit, dan pintasan halaman.
- [ ] **PRO-6.2** Tentukan cakupan penyimpanan: perangkat/tab atau akun lintas perangkat. Jika dibutuhkan lintas perangkat, rancang penyimpanan server serta migrasinya secara eksplisit.
- [ ] **PRO-6.3** Batasi preferensi pada nilai/kolom/filter yang diizinkan; preferensi tidak boleh memperluas role atau lingkup data.
- [ ] **PRO-6.4** Sediakan reset ke tampilan standar dan perlakukan preferensi lama/rusak dengan fallback yang aman.
- [ ] **PRO-6.5** Periksa logout, pergantian akun, perubahan role, serta filter yang tidak lagi valid pada semester baru.

### Hasil dan kriteria selesai

Preferensi yang dipilih bertahan sesuai cakupan yang dijanjikan, mudah direset, tidak membocorkan konteks akun, dan tidak merusak navigasi back/forward atau filter URL existing. Hindari membuat sistem preferensi baru apabila fondasi existing dapat diperluas.

## 12. Tahap PRO-7 — Fitur tambahan setelah fondasi siap

Tahap ini terdiri dari empat paket yang dapat dirilis terpisah. Pilih urutan paket berdasarkan manfaat UAT dan prasyarat, bukan semata tren tampilan.

### PRO-7.1 — PWA yang dapat dipasang

- [ ] Periksa dukungan browser/perangkat sasaran; siapkan manifest, ikon, identitas aplikasi, dan pengalaman membuka aplikasi yang konsisten.
- [ ] Berikan petunjuk pemasangan sesuai dukungan browser tanpa prompt berulang.
- [ ] Tahap awal mempertahankan pengiriman transaksi secara online. Jika koneksi putus, jelaskan batas kemampuan dan gunakan draft existing bila sesuai.
- [ ] Tentukan strategi pembaruan dan cache secara eksplisit. Jangan cache respons API privat, token, halaman finansial, atau data akun secara sembarangan.
- [ ] Uji logout, pergantian akun, pembaruan versi, serta peluncuran dari ikon aplikasi.

**Prasyarat:** PRO-3 dan PRO-4 diterima. **Selesai jika:** pemasangan/akses berhasil pada perangkat yang disepakati, pembaruan dapat dijalankan, dan tidak ada data privat tertinggal pada cache yang tidak semestinya. Klaim offline dibatasi pada kemampuan yang benar-benar diuji.

### PRO-7.2 — Kalender pribadi terpadu

- [ ] Gabungkan tampilan jadwal KBM, piket, ujian, dan acara dari sumber yang sudah ada; jangan membuat jadwal paralel yang dapat berbeda dengan penugasan efektif.
- [ ] Tampilkan tanggal, jam, jenis tugas, lokasi/kelas/ruang jika tersedia, dan detail sumber sesuai hak akses.
- [ ] Perlakukan pengganti, pembatalan, dan perubahan jadwal secara konsisten dengan sumber terbaru.
- [ ] Sediakan ekspor kalender pribadi, misalnya unduhan `.ics`, dengan identitas kejadian stabil dan waktu yang benar.
- [ ] Jelaskan bahwa unduhan kalender adalah snapshot dan tidak otomatis tersinkron. Langganan kalender melalui URL memerlukan desain izin, pencabutan, dan privasi tersendiri bila kelak dipilih.

**Prasyarat:** PRO-2, PRO-4, serta validasi sumber penugasan. **Selesai jika:** isi kalender cocok dengan sumber untuk tanggal/akun yang sama; perubahan dan pengganti tidak menghasilkan duplikasi; ekspor dapat dibaca aplikasi kalender sasaran tanpa membuka data pengguna lain.

### PRO-7.3 — Riwayat perubahan yang mudah dipahami

- [ ] Gunakan audit existing untuk menyajikan siapa, kapan, tindakan, objek yang berubah, dan alasan yang memang tersimpan serta boleh dilihat.
- [ ] Prioritaskan perubahan jadwal, petugas pengganti, status konfirmasi, dan koreksi yang paling sering ditanyakan pengguna.
- [ ] Bentuk kalimat yang mudah dipahami, misalnya pergantian petugas beserta waktu dan alasan, bukan dump log teknis.
- [ ] Pisahkan catatan internal admin dari riwayat yang boleh dilihat guru; redaksi informasi sensitif.
- [ ] Jika data lama tidak mempunyai rincian before/after, tampilkan keterbatasan tersebut dan jangan mengarang riwayat.

**Prasyarat:** audit/izin existing dipetakan dan PRO-3 diterima. **Selesai jika:** riwayat dapat ditelusuri ke audit yang sah, urutan waktunya benar, dan cakupan pembaca tervalidasi di server. Antarmuka tidak menjadi jalan untuk mengubah bukti audit.

### PRO-7.4 — Catatan pembaruan aplikasi

- [ ] Sediakan ringkasan versi/tanggal, perubahan penting, manfaat, serta tindakan yang perlu dilakukan pengguna.
- [ ] Kelompokkan menjadi fitur baru, perbaikan, dan perubahan alur dengan bahasa singkat.
- [ ] Tampilkan indikator pembaruan yang tidak mengganggu dan dapat ditandai sudah dibaca sesuai keputusan produk.
- [ ] Hubungkan catatan ke panduan yang relevan; jangan memuat secret, rincian celah yang belum tertangani, atau data pengguna.

**Prasyarat:** prosedur rilis PRO-3 tersedia. **Selesai jika:** catatan cocok dengan versi yang benar-benar dirilis, dapat dibaca pada ponsel, dan tidak menambahkan notifikasi berulang yang tidak diperlukan.

## 13. Tahap PRO-8 — Validasi akhir, rilis, dan evaluasi

**Tujuan:** menerima hasil secara terukur dan menjaga kesinambungan setelah rilis.

- [ ] **PRO-8.1** Jalankan ulang tugas UAT yang sama dan bandingkan metrik dengan baseline; gunakan kondisi yang sebanding atau jelaskan perbedaannya.
- [ ] **PRO-8.2** Uji regresi lintas role/modul, integritas data, alur ditolak, concurrency jika relevan, serta hasil write tidak pasti.
- [ ] **PRO-8.3** Uji desktop/tablet/mobile, layar sempit, pembesaran teks, orientasi, keyboard, dan pembaca layar sesuai matriks cakupan.
- [ ] **PRO-8.4** Tinjau keamanan, privasi, cache, log, izin API/SQL, serta konfigurasi untuk fitur yang berubah.
- [ ] **PRO-8.5** Lengkapi PR, pemeriksaan CI, catatan perubahan, kebutuhan migrasi/config, dan prosedur rollback. Terapkan hanya dalam cakupan yang diizinkan.
- [ ] **PRO-8.6** Verifikasi commit/deployment dan smoke test setelah rilis. Tindakan sintetis yang memengaruhi transaksi tidak dicoba pada data pengguna nyata.
- [ ] **PRO-8.7** Pantau dampak pada periode evaluasi yang disepakati dan tentukan tindak lanjut berdasarkan bukti, bukan hanya jumlah fitur selesai.

**Selesai jika:** target yang disepakati tercapai atau pengecualian diterima secara eksplisit, temuan kritis tidak terbuka, bukti rilis lengkap, dan pekerjaan lanjutan tercatat.

## 14. Ukuran keberhasilan dan cara mengukurnya

Target angka diisi pada PRO-0. Angka tidak ditetapkan sebagai fakta sebelum baseline tersedia. Target berikut merupakan format kesepakatan, bukan hasil pengukuran saat dokumen dibuat.

| Indikator | Cara ukur | Baseline | Target | Evaluasi |
|---|---|---|---|---|
| Keberhasilan tugas pengguna | Tugas selesai tanpa intervensi / seluruh tugas yang dicoba | Belum diukur | Tetapkan PRO-0 | UAT PRO-1/4/5/8 |
| Durasi tugas inti | Median durasi per jenis tugas, pisahkan waktu menunggu | Belum diukur | Tetapkan PRO-0 | Sebelum/sesudah |
| Kesalahan dan bantuan | Jumlah kesalahan serta bantuan per tugas | Belum diukur | Tetapkan PRO-0 | UAT ulang |
| Kebingungan pengguna | Laporan kebingungan per pengguna aktif atau per tugas, dengan denominator jelas | Belum diukur | Tetapkan PRO-0 | Periode evaluasi disepakati |
| Waktu respons | p50/p95 per endpoint/alur dan kelas ukuran data | Belum diukur | Tetapkan PRO-0 | PRO-2/8 |
| Timeout/error | Persentase request gagal dengan kategori yang jelas | Belum diukur | Tetapkan PRO-0 | PRO-2/3/8 |
| Pengiriman/pekerjaan terjadwal | Sukses/terlambat/gagal dengan bukti sesuai status yang tersedia | Belum diverifikasi pada program ini | Tetapkan PRO-3 | PRO-3 dan pascarilis |
| Pemulihan | Usia backup yang berhasil dipulihkan dan waktu pemulihan aktual | Belum diukur pada program ini | RPO/RTO disepakati | Drill PRO-3/8 |
| Konsistensi honorarium | Kecocokan rincian, ekspor, snapshot dan sumber pada sampel uji | Belum diuji pada program ini | Tidak ada selisih yang tidak dapat dijelaskan | PRO-5/8 |
| Responsivitas | Matriks viewport/perangkat dan kontrol yang dapat dijangkau | Tetapkan PRO-0 | Tanpa overflow horizontal halaman yang tidak disengaja | PRO-1/4/8 |
| Aksesibilitas | Temuan otomatis + pengujian manual pada cakupan terpilih | Tetapkan PRO-0 | Tidak ada blocker tugas inti yang terbuka | Setiap tahap relevan |

Nilai rata-rata tunggal tidak cukup untuk menyatakan semua halaman cepat. Pisahkan data kecil/besar, guru/admin, kondisi jaringan, serta skenario serentak. Penurunan jumlah laporan juga harus dibaca bersama tingkat penggunaan aplikasi.

## 15. Prosedur satu paket pekerjaan dan Definition of Done

1. Baca dokumen ini, checkpoint, source terkait, dan PR aktif. Pastikan pekerjaan tidak bertabrakan atau mengulang implementasi existing.
2. Tetapkan ID paket, masalah, batas scope, risiko, dependency, serta acceptance criteria sebelum mengubah kode.
3. Implementasikan perubahan sekecil mungkin yang menyelesaikan masalah. Jangan menambah fungsi/engine/subsystem duplikat.
4. Jalankan pemeriksaan sesuai risiko: lint/typecheck/build, tes unit/integrasi, API/SQL bila berubah, serta UI/UAT bila relevan. Perubahan visual sederhana tidak memerlukan tes baru yang hanya menyalin implementasi.
5. Catat hasil aktual, kondisi uji, bukti, dan keterbatasannya; jangan mengisi checklist hanya karena kode sudah ditulis.
6. Perbarui dokumentasi/checkpoint, siapkan PR, dan periksa CI pada head final. Merge serta penerapan produksi mengikuti otorisasi yang berlaku.
7. Jika ada migrasi atau perubahan konfigurasi, dokumentasikan prasyarat, kompatibilitas, verifikasi, dan pemulihannya sebelum penerapan.
8. Sesudah rilis, verifikasi deployment/commit yang benar, lakukan smoke yang aman, dan catat tindak lanjut.

Checklist selesai per paket:

- [ ] Acceptance criteria terpenuhi dan bukti dapat ditelusuri.
- [ ] Fungsi lama serta hak akses tidak mengalami regresi yang teridentifikasi.
- [ ] Loading/error/empty/success dan hasil tidak pasti diperiksa bila relevan.
- [ ] Mobile, keyboard, fokus, dan wrapping diperiksa untuk UI yang berubah.
- [ ] Tidak ada JavaScript error yang teridentifikasi dalam cakupan pengujian.
- [ ] Tidak ada rahasia/data pribadi pada log dan artefak publik.
- [ ] Dokumentasi, PR/checks, serta status rilis diperbarui.
- [ ] Temuan tersisa dicatat beserta dampak dan rencana penanganannya.

## 16. Tracker awal program

| Tahap | Status awal | Penanggung jawab | Bukti/PR | Langkah berikutnya |
|---|---|---|---|---|
| PRO-0 | Baseline teknis tervalidasi; UAT nyata belum selesai | Pengembang; pengelola/moderator untuk UAT | [Paket PRO-0](../pro-0/README.md) | Jadwalkan 1 admin + 3 guru dan isi hasil UAT |
| PRO-1 | Pilot teknis jurnal/tugas diimplementasikan; penerimaan manusia belum | Pengembang + peserta UAT | [Paket PRO-1](../pro-1/README.md) | UAT ulang dan keputusan perluasan modul |
| PRO-2 | Workload riwayat/jurnal tervalidasi teknis; penerapan mengikuti PR72 | Pengembang + operator | [Paket PRO-2](../pro-2/README.md) | Verifikasi rilis/migrasi; lanjut observability dan workload representatif |
| PRO-3 | Kontrol teknis/drill native tervalidasi; penerimaan operasional parsial | Pengembang + operator/pengelola | [Paket PRO-3](../pro-3/README.md) | Tutup BKP-01/BKP-02/MAIL-01 |
| PRO-4 | Belum dimulai | Belum ditetapkan | — | Menunggu pilot UI dan temuan perangkat |
| PRO-5 | Belum dimulai | Belum ditetapkan | — | Tinjau rincian/hambatan yang sudah ada |
| PRO-6 | Belum dimulai | Belum ditetapkan | — | Pilih preferensi berdasarkan UAT |
| PRO-7 | Belum dimulai | Belum ditetapkan | — | Nilai prasyarat setiap paket tambahan |
| PRO-8 | Belum dimulai | Belum ditetapkan | — | Susun gate sejak paket pertama |

Gunakan status: **Belum dimulai → Dianalisis → Dikerjakan → Divalidasi → Siap rilis → Dirilis**. Status **Terblokir** mencantumkan sebab, kebutuhan penyelesaian, dan penanggung jawab. Kode yang telah merged belum otomatis berarti perubahan produksi/config atau penerimaan pengguna sudah selesai.

### Template backlog

| ID | Masalah/tujuan | Scope dan di luar scope | Prasyarat | Prioritas/risiko | Target dan acceptance | Estimasi usaha | Penanggung jawab | Status | Bukti/PR |
|---|---|---|---|---|---|---|---|---|---|
| PRO-x.y | Isi saat perencanaan paket | Isi | Isi | Isi | Isi | Setelah analisis | Isi | Belum dimulai | — |

### Template checkpoint setiap sesi

```text
Tanggal/WIB:
Tahap/paket aktif:
Instruksi dan cakupan yang diizinkan:
Baseline main/branch/head:
Source/dependency yang sudah diperiksa:
Pekerjaan selesai:
Pengujian, hasil dan batas bukti:
PR/CI/merge/deployment:
Migrasi/config: tidak diperlukan / direncanakan / diterapkan dan buktinya:
Target vs hasil aktual:
Temuan/risiko yang masih terbuka:
Blokir dan penanggung jawab:
Satu langkah berikutnya:
```

## 17. Panduan melanjutkan pekerjaan pada sesi berikutnya

- Mulai dari tracker dan checkpoint terbaru, bukan mengulang semua audit terdahulu.
- Cocokkan status dokumen dengan source, PR, deployment, dan konfigurasi yang benar-benar dapat diverifikasi.
- Pilih satu paket yang siap dikerjakan dan jelaskan acceptance criteria-nya.
- Jika pengguna meminta “lanjut tahap”, gunakan kode `PRO-*` agar tidak tertukar dengan penomoran roadmap lama.
- Jika prasyarat belum ada, lanjutkan pekerjaan independen yang aman dan catat bagian yang menunggu data/keputusan.
- Jangan mengasumsikan key, backup, penjadwal, email, atau akses produksi telah berubah hanya karena tersedia kode pendukungnya.
- Simpan pembaruan acuan dalam dokumen/Git sesuai permintaan agar konteks tidak bergantung pada percakapan atau workspace sementara.

## 18. Referensi

- Repositori: https://github.com/amtsnurulfalah-commits/sim-guruv2
- Roadmap terdahulu: https://github.com/amtsnurulfalah-commits/sim-guruv2/blob/main/docs/development/ROADMAP_PENGEMBANGAN.md
- Checkpoint terdahulu: https://github.com/amtsnurulfalah-commits/sim-guruv2/blob/main/docs/development/CHECKPOINT.md
- Paket kesiapan operasional/rilis terdahulu: https://github.com/amtsnurulfalah-commits/sim-guruv2/blob/main/docs/development/stage-8/README.md
- Acuan aksesibilitas WCAG 2.2: https://www.w3.org/WAI/WCAG22/quickref/

Referensi repositori menjadi petunjuk untuk pemeriksaan saat eksekusi, bukan jaminan bahwa isi main atau konfigurasi produksi tidak berubah setelah dokumen ini disusun.

## 19. Riwayat dokumen

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 26 Oktober 2026 | Roadmap baru PRO-0–PRO-8 yang mencakup seluruh rekomendasi prioritas, UI/UX modern, dan fitur tambahan; baseline/target serta tracker belum diisi hasil eksekusi. |
| 1.1 | 26 Oktober 2026 | Baseline teknis PRO-0 dan paket UAT tersedia; cohort 1 admin + 3 guru dipilih pengguna. Hasil UAT manusia tetap belum diukur. |

Checkpoint program baru: [PRO-0](../pro-0/CHECKPOINT.md), [PRO-1](../pro-1/CHECKPOINT.md), [PRO-2](../pro-2/CHECKPOINT.md), [PRO-3](../pro-3/CHECKPOINT.md). Status checkbox rencana di atas dipertahankan; detail selesai/parsial mengikuti matriks paket PRO-0.
