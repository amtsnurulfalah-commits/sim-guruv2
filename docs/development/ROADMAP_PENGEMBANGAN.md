# Roadmap pengembangan profesional SiM-Guru — Tahap 0–8

Disetujui pengguna 23 Oktober 2026 (WIB); dokumentasi dipulihkan/dilanjutkan 24 Oktober 2026. Repository `amtsnurulfalah-commits/sim-guruv2`, target `main`.

## Membaca kembali konteks

Baca roadmap ini → [checkpoint](CHECKPOINT.md) → [hasil Tahap 0](stage-0/README.md) → backlog tahap aktif → source aktual. Periksa status PR/commit di GitHub. Setiap PR memperbarui checkpoint, hasil validasi dan pekerjaan berikutnya.

Penomoran di sini merupakan **program pengembangan lanjutan setelah audit halaman hingga PR #43**, terpisah dari Tahap 0–8 pembangunan ulang awal pada `docs/reference`/`docs/parity`. Jangan menafsirkan dokumen historis sebagai status terkini.

## Keputusan yang dipertahankan

- Stabilitas dan kompatibilitas mendahului estetika; baca dependency sebelum mengubah kode.
- Stack repo: Next App Router, TypeScript, Tailwind, komponen shadcn/Radix, Zod, Postgres.js, Supabase PostgreSQL dan Vercel.
- Autentikasi **internal SiM-Guru**; tidak diganti dengan Central SSO atau Supabase Auth.
- Role utama admin/guru. Hak piket/panitia bersifat kontekstual menurut tanggal, penugasan dan guard; jabatan kepala sekolah bukan otomatis role admin baru.
- WIB, kontrak API, SQL/NUMERIC, sumber JTM, pembulatan transport, ledger pembalikan dan snapshot final dipertahankan.
- Laporan kelengkapan administrasi dipisahkan dari penilaian kinerja guru.
- Gunakan komponen, summary, worker/outbox, finance engine dan lookup bantuan yang sudah ada sebelum membuat subsystem baru.
- Bukti lokal sintetis bukan bukti konfigurasi, penerapan migrasi, email, backup/restore atau UAT produksi.
- Persetujuan keseluruhan roadmap tersimpan. Instruksi eksekusi saat ini: simpan roadmap, jalankan Tahap 0 dan langsung merge PR setelah pemeriksaan lulus; tahap berikutnya mengikuti instruksi kelanjutan pengguna.

## Tahap 0 — Pemetaan dan baseline

- **0.1** Inventarisasi fitur, halaman, peran, API, dependency dan sumber kebenaran.
- **0.2** Petakan jadwal → penugasan/occurrence → konfirmasi/kehadiran/rekap → jurnal/BAP → ledger → honorarium → koreksi.
- **0.3** Catat baseline pengujian, performa lokal, keamanan dan aksesibilitas; nyatakan apa yang belum diukur.
- **0.4** Backlog ber-ID dengan prioritas, dependency, cakupan, penerimaan dan validasi.

Hasil: [paket Tahap 0](stage-0/README.md). Selesai jika semua modul dan rencana berikutnya dapat ditelusuri ke source/kewenangan serta batas bukti jelas.

## Tahap 1 — Standarisasi UI/UX dan fondasi teknis

- **1.1** Inventaris dan standarkan token warna, typography, spacing, tombol dan status dengan design system existing.
- **1.2** Konsolidasikan formulir, dialog, filter, tabel, pagination dan feedback; modal untuk tindakan singkat, halaman untuk form kompleks/panjang.
- **1.3** Navigasi per kewenangan: Pembelajaran, Kehadiran & Penugasan, Keuangan, Administrasi.
- **1.4** Filter relevan pada URL, pulih saat back/forward/reload, dapat dibagikan tanpa data sensitif.
- **1.5** Keyboard, fokus, label, kontras dan target sentuh; sasaran WCAG 2.2 AA.
- **1.6** Kontrak API, loading/error/empty, pengiriman ganda dan hasil write tidak pasti konsisten.

Dependency: Tahap 0. Selesai jika komponen/pilot halaman lulus desktop/mobile serta regresi dan fungsi lama tetap utuh.

Hasil implementasi 1.1–1.6: [paket Tahap 1](stage-1/README.md), termasuk batas adopsi pilot dan validasi.

## Tahap 2 — Pusat tugas dan notifikasi

- **2.1** Identitas tugas stabil, sumber, alasan, prioritas, deadline WIB dan kewenangan guru/petugas/admin.
- **2.2** Pusat tugas berdasarkan urgensi dan role.
- **2.3** Tautan langsung ke sumber/tindakan; status diturunkan dari sumber, bukan checkbox selesai yang terpisah.
- **2.4** Inbox notifikasi dan preferensi dengan fondasi outbox/worker existing.
- **2.5** Deduplikasi/penggabungan pengingat dan penghentian reminder setelah sumber selesai.
- **2.6** Dashboard mengutamakan tugas hari ini, kemudian jadwal, pengumuman dan ringkasan.

Dependency: Tahap 1. Selesai jika tugas sinkron dengan sumber, akses tidak bocor dan notifikasi tidak mengganda. Antrean tidak dinyatakan sebagai pesan diterima.

Hasil implementasi 2.1–2.6: [paket Tahap 2](stage-2/README.md), sumber, kebijakan reminder dan bukti/batas rilis.

## Tahap 3 — Kesiapan honorarium dan persetujuan koreksi

- **3.1** Pemeriksaan kesiapan per periode/per guru dari engine honor yang sama.
- **3.2** Kendala, penerima, sumber dan tindakan perbaikan; bedakan pekerjaan administratif dengan blocker finalisasi menurut aturan yang sudah ada.
- **3.3** Pengajuan koreksi beralasan dan berbukti, pemilik dan status.
- **3.4** Pemeriksaan, persetujuan/penolakan, pemisahan kewenangan eksplisit dan audit keputusan.
- **3.5** Integrasi dengan koreksi selisih existing, idempotensi dan konflik versi.

Dependency: Tahap 1–2. Selesai jika tidak ada engine honor kedua di frontend, snapshot/checksum asli tetap utuh dan koreksi masuk periode tujuan yang sah.

Hasil implementasi 3.1–3.5: [paket Tahap 3](stage-3/README.md), kontrak kesiapan/keputusan, kompatibilitas dan bukti rilis.

## Tahap 4 — Penanganan kendala dan pemantauan

- **4.1** Hubungkan referensi bantuan ke laporan penanganan dan konteks pelapor yang diizinkan.
- **4.2** Status Baru, Ditinjau, Diproses, Menunggu informasi, Selesai; aturan transisi/pembukaan kembali.
- **4.3** Penanggung jawab, catatan internal, riwayat dan verifikasi penyelesaian.
- **4.4** Kelompokkan kejadian berulang tanpa menghilangkan referensi asal.
- **4.5** Pemantauan job, antrean/pengiriman, kegagalan, waktu respons dan ambang alert yang dapat ditindaklanjuti.
- **4.6** Akses/retensi/purge log; pertahankan metadata allowlist dan redaksi rahasia.

Dependency: Tahap 1–2. Selesai jika penanganan dapat ditelusuri, catatan internal terlindungi dan retensi diuji.

Hasil implementasi 4.1–4.6: [paket Tahap 4](stage-4/README.md), lifecycle, kewenangan, pengukuran, retensi dan bukti rilis.

## Tahap 5 — Laporan kepala madrasah

- **5.1** Kamus indikator: sumber, rentang, denominator, status final/proyeksi dan waktu pembaruan.
- **5.2** Ringkasan KBM, kehadiran, jurnal/BAP dan honorarium.
- **5.3** Filter dan drill-down dengan akses server.
- **5.4** Ekspor konsisten dengan filter/rincian.
- **5.5** Kelengkapan bukan penilaian kinerja; tentukan izin pembaca sebelum membuka route laporan.

Dependency: Tahap 1–3 dan pemantauan Tahap 4. Selesai jika ringkasan=rincian=ekspor dan jabatan tambahan tidak diasumsikan mengizinkan seluruh data.

## Tahap 6 — Persiapan semester baru

- **6.1** Allowlist konfigurasi yang dapat disalin; transaksi/kehadiran/jurnal/ledger/slip tidak ikut disalin.
- **6.2** Pilih sumber/tujuan dan konfigurasi.
- **6.3** Pratinjau pemetaan ID serta rentang berlaku baru.
- **6.4** Periksa bentrok guru/kelas/waktu, relasi semester dan target yang sudah terisi.
- **6.5** Commit atomik/idempotent, pemeriksaan sumber berubah dan audit.

Dependency: Tahap 1, pola preview/commit dan master/jadwal. Selesai jika retry tidak menggandakan data, riwayat lama utuh dan kegagalan tidak menyisakan hasil parsial.

## Tahap 7 — Draft otomatis dan pengalaman mobile

- **7.1** Draft jurnal/BAP per akun/entity/versi.
- **7.2** Indikator status dan waktu penyimpanan.
- **7.3** Pulihkan/hapus/TTL serta pembersihan saat logout/pergantian akun.
- **7.4** Konflik perubahan sumber/tanggal dan batas eligibility server.
- **7.5** Kartu mobile, form panjang, orientasi, sentuhan dan koneksi lambat/terputus.

Dependency: Tahap 1–2. Selesai jika draft tidak tertukar akun, tidak dianggap telah terkirim, tidak menyimpan token/rahasia, dan tetap divalidasi server. Putuskan penyimpanan lokal/server sebelum implementasi; jangan mengasumsikan transaksi offline.

## Tahap 8 — Keamanan, pemulihan dan rilis

- **8.1** Audit sesi, otorisasi API/SQL, akses data dan log; acuan OWASP ASVS.
- **8.2** Regresi lintas modul/peran termasuk penolakan, concurrency dan hasil write tidak pasti.
- **8.3** Profil query/render/network dan beban representatif; target ditetapkan dari bukti.
- **8.4** Backup terenkripsi dan latihan restore disposable dengan inventori/RPO/RTO aktual.
- **8.5** Lingkungan uji, release gate, pemeriksaan migrasi, deployment smoke dan rollback.
- **8.6** Panduan pengguna/admin, runbook dan catatan perubahan.

Dependency: tahap yang dirilis. Keamanan/pemulihan diperhatikan sejak Tahap 0. Selesai jika temuan kritis cakupan rilis tertangani, tes wajib lulus dan latihan pemulihan berbukti.

## Cara menyelesaikan satu sub-tahap

Analisis source/dependency → kriteria penerimaan → implementasi terukur → tes sesuai risiko → perbarui checkpoint/bukti → PR + checks → merge → verifikasi rilis sesuai cakupan akses.

Uji normal/kosong/banyak/loading/error/stale/expired, kewenangan, desktop/tablet/mobile, resize/orientasi. Perubahan finansial/otorisasi memerlukan tes SQL. Hindari fungsi duplikat, perubahan fitur tak terkait dan penghapusan source tanpa bukti aman.

Status terkini mengikuti [checkpoint](CHECKPOINT.md): Tahap 0–3 merged dan Tahap 3 terverifikasi produksi; Tahap 4 diimplementasikan, status pemeriksaan/migrasi/merge/deployment mengikuti PR dan validation.json Tahap 4. Berikutnya **Tahap 5 / laporan kepala madrasah**, setelah rilis Tahap 4 dan instruksi pengguna.
