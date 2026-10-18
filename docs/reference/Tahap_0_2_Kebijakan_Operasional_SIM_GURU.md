# Tahap 0.2 — Kebijakan Operasional SiM-Guru

Versi: 1.0 | Tanggal: 18 Oktober 2026 | policy_version: sim-guru-policy-v1

Status: baseline rancangan ditetapkan untuk implementasi; belum merupakan hasil UAT, konfigurasi produksi atau persetujuan kebijakan lembaga. Kebijakan dapat direvisi secara eksplisit sebelum modul terkait diterima. Tidak ada perubahan data/aplikasi produksi pada tahap ini.

## 1. Kedudukan dan batas

Dokumen ini melengkapi Dasar_Pembangunan_Ulang_SIM_GURU.md dan Tahap_0_1_Matriks_Kesetaraan_SIM_GURU.md. Aturan target dan koreksi B01–B25 tetap berlaku. K01–K09 di bawah menjawab keputusan terbuka Tahap 0.1 dengan baseline konkret. Keputusan yang memperjelas atau mengubah perilaku legacy ditandai, agar perbedaan hasil tidak disamarkan sebagai kesetaraan mutlak.

Baseline tetap satu instalasi sekolah/madrasah; autentikasi lokal SiM-Guru dengan PostgreSQL dan Storage Supabase, tanpa Central SSO atau Supabase Auth. Seluruh tanggal operasional Asia/Jakarta, audit timestamptz UTC, UI/dokumen Indonesia. Role utama admin/guru; KEPALA_SEKOLAH adalah jabatan tambahan tanpa eskalasi akses otomatis.

Penetapan ini bersifat desain berdasarkan mandat menjalankan Tahap 0.2. Tidak diperlukan akses produksi untuk menetapkan model, fixtures dan kontrak. Pemilihan akun email/paket hosting serta benchmark deployment tetap memerlukan bukti saat provisioning; tidak diasumsikan sudah tersedia.

## 2. Ringkasan keputusan

| ID | Baseline | Dampak dan tahapan |
|---|---|---|
| K01 | Klaim mandiri dipisahkan dari pengesahan; petugas tidak mengesahkan tugasnya sendiri kecuali pembina upacara sah | Policy/capability resolver, 1.2–1.4, 3.1, 4.1–4.2 |
| K02 | Aktivasi sekali pakai sebagai jalur utama; password sementara acak untuk serah terima administratif | Auth/account lifecycle, 1.3–1.5, 2.1 |
| K03 | JTM numeric(12,4), alokasi maksimal 4 desimal; password 8–128 code point; Argon2id baseline dan benchmark wajib | Schema, validasi, auth dan engine, 1.3, 3.5, 4.4, 6.3 |
| K04 | Estimasi seluruh periode dipisahkan dari realisasi; bonus libur satu hak per occurrence | Calendar/ledger/honor, 2.3, 6.1, 6.3–6.4 |
| K05 | Slip final immutable; koreksi melalui selisih tercatat pada periode terbuka | Domain mutation dan honor, 3.6–6.5 |
| K06 | Email melalui adapter/outbox; scheduler deployment tunggal dengan waktu jatuh tempo WIB dan idempotensi | Auth minimal 1.5, worker lengkap 7.3–7.4 |
| K07 | Jurnal H-1 memakai konfirmasi occurrence; konfirmasi umum legacy hanya melalui normalisasi tercatat | Eligibility dan migrasi, 3.1, 3.6, 8.1–8.2 |
| K08 | Template KBM/UJIAN mendukung day_index 0–6; Minggu tidak otomatis menjadi hari kegiatan | Template dan DayContext, 2.3, 3.2 |
| K09 | Bentrok berbasis interval efektif guru/kelas/ruang; tugas pengawasan umum tidak otomatis memblokir sehari penuh | Scheduling/substitusi/ujian, 2.4, 4.3, 5.1–5.2 |

## 3. K01 — Konfirmasi, klaim mandiri dan kewenangan

### 3.1 Prinsip

Pisahkan assignment, claim, confirmation dan jam aktual. Klaim hadir mandiri tidak membuat konfirmasi resmi, kredit, ataupun capability mengelola orang lain. Jalur input jam pribadi yang sah tetap tersedia sebagaimana dokumen dasar; jam tercatat bukan bukti seluruh tugas sudah dilaksanakan.

Kredit KBM tetap memerlukan jurnal sah; kredit pengawas memerlukan BAP sah; kredit acara memerlukan jurnal acara sah. Jam harian yang valid dapat menjadi dasar transport sesuai F15, tanpa otomatis menghasilkan kredit JTM.

Perubahan dari legacy: self-confirm KBM/piket yang langsung mengesahkan tugas dibatasi menjadi klaim. Pengecualian eksplisit: pembina upacara efektif dapat mengonfirmasi tugasnya sendiri pada tanggal Senin yang ditugaskan, sesuai kemampuan legacy. Pengecualian ini hanya untuk upacara dan tidak memberi hak piket/admin.

### 3.2 Matriks tindakan

Semua aktor harus aktif, sesi sah, lolos onboarding, dan memenuhi maintenance policy. Hari H berarti tanggal occurrence sama dengan tanggal server WIB.

| Operasi | Aktor yang boleh | Prasyarat dan pembatasan |
|---|---|---|
| Klaim kehadiran pribadi | Guru terkait | Penugasan efektif sah; tanpa kredit/otoritas otomatis |
| Konfirmasi/cabut KBM | Admin atau piket operasional | Hari H; piket bukan target sendiri; scope kegiatan tanggal tugas |
| Konfirmasi/cabut piket | Admin | Hari H; asli/pengganti aktif; hasil kredit 4 JTM satu kali |
| Konfirmasi/cabut upacara | Admin atau pembina efektif sendiri | Hari H, Senin, assignment sah; kredit 5 JTM satu kali |
| Konfirmasi/cabut panitia | Admin | Hari H; assignment aktif; satu kredit panitia |
| Konfirmasi/cabut pengawas | Admin atau panitia terkonfirmasi | Hari H; panitia tidak mengesahkan assignment pengawas miliknya sendiri |
| Menunjuk/mengganti pengganti KBM, piket, upacara | Admin atau piket operasional | Hari H; tidak memilih diri sendiri sebagai pengganti; kandidat aktif dan tidak bentrok |
| Mengganti panitia | Admin | Hari H; kandidat aktif dan aturan duplikat/bentrok terpenuhi |
| Mengganti pengawas | Admin atau panitia terkonfirmasi | Hari H; tidak mengangkat diri sendiri; kandidat aktif dan tidak bentrok |
| Input jam guru biasa | Admin, piket operasional, atau guru itu sendiri | Jadwal jam tersedia; jalur self terbatas milik sendiri dan hari H |
| Input jam piket/panitia | Admin | Pengecualian legacy: piket yang juga mengajar boleh input jam pribadi; tetap tidak mengesahkan piket sendiri |
| Input jam pengawas | Admin, piket operasional, guru itu sendiri pada jalur self yang sah, atau panitia terkonfirmasi dengan time-in admin | Panitia hanya untuk pengawas tanggal tugas; target yang juga piket/panitia tetap mengikuti pembatasan lebih ketat |
| Rekap siswa | Admin, piket operasional, atau panitia terkonfirmasi dengan time-in admin | Hanya hari H dan kelas wajib sesuai konteks |
| Kehadiran acara | Admin, piket operasional, atau panitia terkonfirmasi dengan time-in admin | Tanggal occurrence sah; peserta guru; rentang jam acara valid |
| Penyesuaian/alokasi KBM/piket | Admin atau piket operasional | Hari H; tidak untuk occurrence sendiri; piket target sudah dikonfirmasi |
| Penyesuaian/alokasi pengawas | Admin atau panitia terkonfirmasi | Hari H; tidak untuk occurrence sendiri |
| BAP | Pengawas efektif pemilik assignment | Aktif, terkonfirmasi, akhir sesi+5 menit sampai akhir periode |
| Koreksi historis | Admin melalui alur koreksi | Alasan, audit dan pemeriksaan periode final; bukan bypass endpoint reguler |

Piket operasional = guru efektif yang penugasannya sudah dikonfirmasi admin dan memiliki time-in sah. Penerima partial piket memperoleh capability operasional setelah alokasi positif sah dan time-in tersedia; otoritasnya berasal dari alokasi yang telah disahkan, tanpa tambahan otomatis 4 JTM. Pencabutan sumber langsung mencabut capability. Tidak ada siklus yang mengharuskan piket mengonfirmasi dirinya sendiri: admin membuka penugasan/waktu atau alokasi terlebih dahulu.

Panitia boleh mengonfirmasi pengawas sebelum time-in sendiri sesuai pemisahan di dokumen dasar; input waktu/rekap/acara memerlukan time-in admin. Kelengkapan rekap siswa wajib sebelum mutasi operasional pengawas oleh panitia (konfirmasi, substitusi, adjustment); bila himpunan kelas wajib kosong, dinyatakan lengkap. Input rekap sendiri tidak diblokir oleh ketidaklengkapan itu.

### 3.3 Pembatasan waktu dan pengecualian

Jalur biasa mutasi kehadiran/izin hanya hari H. Pembacaan riwayat sesuai scope; koreksi admin lampau memakai endpoint koreksi dengan alasan. Pertahankan aturan masuk tidak lebih awal dari jadwal, tombol pulang nonadmin setelah jadwal+5 menit, nilai pulang tidak melebihi jadwal, pulang tidak sebelum masuk. Input manual admin dapat memperbaiki jam secara eksplisit, tetap waktu valid dan urutan benar. Transport membatasi rasio maksimum 1.

Maintenance memblokir operasi bisnis baru guru, termasuk sesi berjalan; admin dapat memperbaiki konfigurasi. Logout, informasi status dan lifecycle pemulihan akun tetap tersedia dengan rate limit; akun onboarding tidak dapat melakukan bisnis. Job bisnis terjadwal ditunda selama maintenance, kecuali outbox keamanan dan pembersihan sesi/challenge; setelah pulih, due job diproses berdasarkan tanggal jatuh tempo, bukan tanggal proses ulang.

Tes: T02,T12–T14,T18–T21,T37,A03; tambahan K01-01: self-confirm KBM/piket tidak memberi kredit; K01-02: upacara self sah memberi tepat 5 JTM; K01-03: pencabutan partial piket menghilangkan hak operasional; K01-04: penerima partial tidak memperoleh penuh 4 JTM.

## 4. K02 — Pembuatan, aktivasi dan pemulihan akun

Tidak ada registrasi publik. Admin membuat username unik case-insensitive, profil dan role dalam satu transaksi. Status akun: pending_activation, active, disabled, archived. Onboarding memakai flag terpisah; penghapusan akun bereferensi historis menjadi arsip/nonaktif, bukan cascade history honor.

| Jalur | Kebijakan |
|---|---|
| Aktivasi utama | Token acak minimal 256 bit, hash token di database, user/tujuan terikat, TTL 24 jam, sekali pakai; penerbitan ulang mencabut token sebelumnya |
| Email awal belum terbukti | Admin mencatat alamat kandidat; penyelesaian tautan aktivasi membuktikan kontrol alamat yang sama, menetapkan verified_at secara atomik setelah password valid |
| Tanpa email yang dapat dipakai | Admin memverifikasi identitas di luar aplikasi dan mencatat hasil/alasan; berikan password sementara acak minimal 20 karakter melalui serah terima aman |
| Password sementara | Hash Argon2id, TTL 24 jam, wajib ganti; login hanya sesi onboarding; tidak dicetak ke log/seed/email massal, tidak memakai default bersama |
| Onboarding | Password permanen, email terverifikasi dan pertanyaan keamanan tambahan dilengkapi sebelum bisnis; akun tanpa email tetap terbatas sampai email sendiri dapat diverifikasi |
| Ganti password | Password lama benar; hash baru + auth_version + pencabutan seluruh sesi/challenge atomik; login ulang |
| Reset via email | Email terverifikasi, OTP 6 digit TTL 10 menit, resend minimal 60 detik, maksimal 5 salah per challenge; OTP HMAC; token reset acak TTL 5 menit sekali pakai |
| Pertanyaan keamanan | Jawaban hash dan batas percobaan; jawaban benar saja tidak menerbitkan sesi bisnis/token reset tanpa OTP atau persetujuan admin |
| Reset admin tanpa email | Admin verifikasi identitas dan mencatat bukti minimum; cabut sesi/challenge dan terbitkan handover credential/onboarding baru; admin tidak melihat password lama |

Persetujuan pemulihan admin mengikat request ke user tertentu, admin verifier, metode dan waktu; bukan persetujuan username bebas dari browser. Jika email lama tidak dapat diakses, ubah kandidat email hanya melalui alur pemulihan terverifikasi, lalu wajib membuktikan email baru. Respons lupa password generik; challenge tidak membocorkan hash/jawaban/token lewat query profil. Pengiriman gagal dapat dicoba ulang tanpa mengaktifkan akun secara diam-diam.

Sesi permanen: absolut 24 jam, idle 2 jam, peringatan 1 menit, pemeriksaan browser maksimal interval 5 menit; penegakan server setiap permintaan. Token acak di cookie HttpOnly, hash token di database. Aktivitas memperpanjang idle tanpa melewati batas absolut. Account disabled/auth_version berubah langsung menolak sesi lama.

Tes: T01,T03,T04,T42–T50; K02-01: token aktivasi diulang/kedaluwarsa ditolak; K02-02: akun tanpa email tetap onboarding; K02-03: credential sementara tidak dapat menjalankan aksi bisnis.

## 5. K03 — Presisi angka dan kredensial

### 5.1 JTM dan uang

| Nilai | Kontrak baseline |
|---|---|
| JTM tersimpan | numeric(12,4); batas nonnegatif; JSON decimal string kanonis, bukan floating point JavaScript |
| Penyesuaian A | Bilangan bulat 0 ≤ A ≤ S sesuai aturan dasar; S dan seluruh hasil ledger dapat pecahan |
| Alokasi | >0 dengan maksimal 4 desimal, total A+R ≤ S; input presisi berlebih ditolak, tidak dipotong diam-diam |
| Jurnal H-1 | round-half-up(A × 0.8, 1), setelah adjustment; bobot disimpan terpisah dan diterapkan sekali; alokasi tidak terkena bobot jurnal pemilik |
| JTM acara definisi | Integer 1–99; piket 4; upacara 5 |
| Jarak | numeric(5,2), 0 atau 0.01–999.99; >2 desimal ditolak |
| Tarif JTM/tunjangan | Rupiah bulat nonnegatif, nilai maksimum 999999999; tarif/km saat aktif 1–999999999 |
| Perhitungan internal | Decimal presisi cukup; perantara transport tanpa pembulatan harian; simpan hasil uang numeric(20,4), overflow ditolak atomik |
| Honor mengajar | Total JTM × tarif, dibulatkan half-up ke rupiah bulat sekali pada komponen bulanan |
| Transport | Jumlah bulanan presisi, kemudian pembulatan tiga titik sesuai dokumen dasar, bukan pembulatan tiap hari |
| Total pembayaran | Honor mengajar bulat + tunjangan bulat + transport dibulatkan; snapshot menyimpan nilai sebelum/sesudah pembulatan |

Rasio transport untuk UI dibulatkan 3 desimal; nominal dihitung dari rasio presisi internal sebelum pembulatan tampilan. Tidak menambahkan faktor ×2. Kebijakan pembulatan rupiah komponen honor adalah penetapan tambahan target karena keluaran pecahan JTM × tarif dapat berupa pecahan rupiah; uji dan formula_version harus mencatatnya. Tidak menghitung ulang legacy snapshot dengan aturan ini.

### 5.2 Password dan hash

Password permanen 8–128 Unicode code point, tanpa trim/normalisasi/casefold; wajib huruf besar/kecil, angka dan simbol yang didukung schema, tidak sama password lama, tidak mengandung username atau unsur nama >2 huruf. Daftar simbol diterima ditetapkan eksplisit dalam schema bersama, mengikuti kemampuan sumber dan memberi pesan jelas. Jangan truncate berdasarkan byte atau menyimpan plaintext.

Argon2id baseline memory 19 MiB (19456 KiB), iterations 2, parallelism 1, salt acak oleh pustaka; hash berformat algoritme/parameter. Runtime Node.js. Benchmark di lingkungan deployment wajib mengukur latency p50/p95, memori dan login paralel sah/rate-limited. Kandidat kenaikan parameter diuji tanpa mengurangi baseline untuk mengejar latency. Catat library/version, region, runtime, beban, parameter dan hasil. Parameter produksi belum disebut teruji sampai benchmark benar-benar berjalan. Rehash setelah login sukses jika parameter usang.

Tes: T09,T15–T17,T24–T26,T44,T49; K03-01: alokasi 0.0001 diterima dan 0.00001 ditolak; K03-02: batas password 128/129; K03-03: angka uang pecahan/overflow ditangani sesuai kontrak; K03-04: rasio tampilan tidak mengubah nominal.

## 6. K04 — Estimasi dan bonus libur

Satu hak libur per occurrence aktif pada tanggal is_holiday=true: masing-masing KBM, piket dan pembina Senin. Beberapa jadwal guru dalam sehari tetap beberapa hak. Hak libur dan jurnal libur otomatis adalah dua representasi/status sumber yang sama; jurnal manual yang sudah ada tidak ditambah bonus lagi untuk occurrence itu.

| Tampilan/status | Kebijakan |
|---|---|
| Estimasi seluruh periode | Memuat hak libur seluruh bulan termasuk tanggal mendatang; diberi label proyeksi dan waktu perhitungan |
| Realisasi sampai hari ini | Hanya kredit yang telah diakui; tanggal mendatang dikecualikan; entitlement yang belum diposting ditampilkan terpisah sebagai tertunda |
| Auto-jurnal | Pada jadwal 16.00 WIB untuk tanggal libur; satu kredit per occurrence, tidak menimpa jurnal manual; retry idempotent |
| Pembatalan run | Reversal hanya posting run yang dipilih; jurnal manual tetap; kewajiban hak sah ditampilkan tertunda sampai diposting ulang atau dibatalkan lewat koreksi beralasan |
| Finalisasi | Hanya periode berakhir; semua hak sah sudah direkonsiliasi dan tidak ada job relevan pending/running/failed yang belum diselesaikan atau dikecualikan dengan alasan oleh admin |

Admin tidak dapat memfinalisasi bulan berjalan/mendatang melalui endpoint biasa. Finalisasi otomatis bulan lalu tanggal 2 pukul 10.00 WIB menggunakan pemeriksaan kelengkapan yang sama dengan manual. Jika belum lengkap, status blocked dengan alasan dan pemberitahuan admin; tidak membuat slip parsial. Hal ini tidak mewajibkan seluruh guru mengisi jurnal: jurnal yang kedaluwarsa tanpa hak sah memberi 0, sedangkan keadaan inkonsisten/orphan/job gagal yang berpengaruh harus diselesaikan.

Tes: T29–T33,T41,A08; K04-01: dua jadwal libur diakui masing-masing satu kali; K04-02: finalisasi bulan berjalan ditolak; K04-03: blocked job tidak menghasilkan sebagian slip; K04-04: cancel run tidak berubah menjadi bonus tersembunyi di engine lain.

## 7. K05 — Koreksi, periode final dan audit

Setiap mutasi menentukan periode finansial sumber dan memeriksa lock periode dalam transaksi yang sama. Ini mencegah jurnal/adjustment masuk bersamaan dengan finalisasi setelah perhitungan dimulai. Finalisasi menyimpan identitas, tarif, semua lines/sumber, policy_version dan formula_version. Satu row periode tetap final walau nominal semua guru nol.

Baseline tidak menyediakan pembukaan ulang/final ulang periode yang sudah final. Kesalahan ditangani koreksi delta pada periode terbuka berikutnya; dokumen final asli tetap valid sebagai bukti penerbitan, ditandai memiliki koreksi terkait bila ada. Delta dapat positif/negatif dan dipisahkan dari kredit reguler nonnegatif.

Alur: admin membuat draft koreksi → pilih transaksi/slip sumber → tulis alasan dan lampirkan referensi bukti → pratinjau sebelum/sesudah/selisih menggunakan formula versi yang sesuai → konfirmasi admin → transaksi mengunci sumber/target, memastikan source version sama, mencatat koreksi dan ledger reversal/delta, lalu outbox notifikasi. Pengulangan request tidak membuat koreksi kedua. Guru dapat mengajukan permintaan, tanpa mengesahkan koreksinya sendiri.

Koreksi finansial terhadap periode final tidak boleh dibuat lewat edit/hapus reguler. Koreksi data faktual disimpan sebagai revisi terhubung ke record asal; snapshot final dan bukti lama tetap tersedia. Koreksi historis sebelum final boleh dilakukan admin dengan alasan dan transaksi domain; tidak meniadakan aturan waktu submit guru. Force hanya mengakui dampak yang sudah dipratinjau, bukan melewati kewenangan atau membuka snapshot final.

Jika koreksi negatif melebihi hak periode target, periode ditandai membutuhkan penyelesaian admin dan finalisasi diblokir; tidak membuat pembayaran negatif atau carry-forward diam-diam. Mekanisme cicilan/utang merupakan perluasan kebijakan terpisah.

Tes: T13,T21,T31–T33; K05-01: edit biasa sumber final ditolak; K05-02: koreksi sama dua request hanya satu delta; K05-03: perubahan master tidak mengubah slip asli; K05-04: mutasi bersamaan finalisasi terserialisasi; K05-05: selisih negatif berlebih memblokir settlement.

## 8. K06 — Email, worker dan scheduler

Keputusan arsitektur: MailAdapter server-only dengan kontrak send, receipt/providerMessageId dan klasifikasi error; outbox persisten PostgreSQL menjadi antrean. Provider dipilih saat provisioning berdasarkan akun/domain yang tersedia, verifikasi pengirim, kapasitas, biaya dan dukungan retry/idempotensi. Tidak mengarang API key, domain atau akun. Pilihan merek bukan penghalang schema/layanan; pengiriman produksi belum siap sebelum provider dikonfigurasi dan diuji. Pengujian lokal memakai fake adapter yang ditandai jelas, tidak mengklaim email terkirim nyata.

Outbox minimum tersedia pada 1.5 untuk aktivasi/OTP/reset; worker penuh dan notifikasi seluruh domain pada 7.3. Tidak menyimpan password dalam payload. Payload token aktivasi/OTP yang diperlukan untuk pengiriman dienkripsi dengan key server terpisah, akses minimum, retensi sampai selesai/expiry; hash/HMAC challenge tetap berbeda. Jangan menyimpan token plaintext dalam JSON outbox atau log. Link token tidak ditampilkan pada dashboard operasi.

Retry baseline: maksimal 5 percobaan total, jeda 1, 5, 15, 60 menit dengan jitter untuk transient failure. Challenge kedaluwarsa membatalkan pengiriman OTP/reset usang. Permanent failure menuju failed dan dapat diterbitkan ulang lewat alur sah, bukan loop tanpa batas. Worker menggunakan lease per row, batch terbatas, recover lease setelah crash dan dedupe_key unik.

Pengiriman email bersifat at-least-once: bila provider menerima lalu koneksi timeout sebelum receipt tersimpan, email ganda masih mungkin. Gunakan idempotency provider jika tersedia; tidak mengklaim exactly-once pada layanan eksternal. Duplikasi email tidak boleh menggandakan token, kredit, slip atau transaksi bisnis. Receipt ambigu diberi status unknown untuk rekonsiliasi/retry terkendali.

| Job | Due WIB | Padanan UTC | Kunci bisnis |
|---|---|---|---|
| Auto-jurnal libur | Setiap hari 16.00 | 09.00 | holiday:YYYY-MM-DD + occurrence |
| Finalisasi bulan lalu | Tanggal 2 pukul 10.00 | 03.00 | honor:YYYY-MM |
| Pengumuman/pengingat tanggal | Harian 08.00 | 01.00 | announcement:id:version:user:offset |
| Reminder operasional | Pemeriksaan jendela due terkonfigurasi; BAP mulai sesi+5 menit | Dihitung dari WIB | type:occurrence:user:window |
| Outbox | Target polling 1 menit saat kapasitas/paket mendukung | Interval deployment | ID outbox/dedupe_key |
| Cleanup | Harian 03.00 | 20.00 hari UTC sebelumnya | cleanup:date |

Interval polling adalah kebutuhan desain, bukan klaim kemampuan paket Vercel saat ini. Sebelum deployment verifikasi dokumentasi/paket aktual, cron minimum, timeout, runtime, koneksi/pool dan volume email. Jika paket tidak memenuhi, gunakan paket/scheduler yang memenuhi dengan satu sumber pemicu aktif; jangan menurunkan frekuensi secara diam-diam. Rahasiakan CRON_SECRET; route memeriksa auth, due WIB, lease/lock dan idempotensi. Trigger GAS lama dinonaktifkan saat cutover agar tidak ada dua scheduler.

Job gagal melepas/menandai lease dengan error teredaksi dan dapat diretry; key bisnis tetap sama sementara attempt/run berbeda. Kelengkapan run dan status enable terlihat pada admin/operasi. Tombol disable menghentikan run baru; run yang sedang berlangsung diselesaikan atau rollback, tidak diputus sembarang di tengah transaksi.

Tes: T04,T30,T32,T34,T41,A02; K06-01: crash sesudah provider menerima tidak menggandakan bisnis; K06-02: retry OTP yang sudah kedaluwarsa tidak mengirim; K06-03: key job sama tidak memproses ulang kredit; K06-04: secret dan payload sensitif tidak muncul pada log.

## 9. K07 — Eligibility jurnal H-1

Gunakan satu fungsi domain getJournalEligibility(actor, occurrence, now, policy) untuk daftar tugas, tombol, endpoint eligible, submit dan edit terkait. Query bukan janji submit pasti diterima; mutasi memeriksa ulang dalam transaksi.

Urutan: sesi/akun/onboarding/maintenance → occurrence sah → pemilik efektif tanggal kegiatan → tanggal hari H atau kemarin → flag H-1 → confirmation occurrence sah → tidak ada jurnal/kredit duplikat → block → counts/rekap siswa → adjustment dan bobot.

Konfirmasi umum harian baru tidak mengesahkan semua occurrence. Penguatan terhadap legacy ini mencegah satu baris kehadiran mengesahkan tugas yang tidak dilaksanakan. Hari H juga memerlukan konfirmasi occurrence sebelum kredit jurnal. Hari H bobot 1; H-1 bobot 0.8, satu desimal. H-2/masa depan ditolak. Pengganti kemarin tetap eligible bila benar pemilik efektif kemarin dan confirmation sesuai; pemilik asli yang sudah diganti ditolak.

Migrasi konfirmasi umum legacy: simpan raw evidence → cocokkan guru/tanggal/penugasan efektif dan tidak ada pembatalan/bentrok → buat candidate mapping → admin menyetujui kandidat yang dapat dibuktikan → materialisasi confirmation occurrence dengan source legacy_normalized, actor/batch dan alasan. Jika ambigu, tandai unresolved; jangan membuat pengesahan otomatis untuk semua jadwal. Riwayat final legacy tetap snapshot apa adanya dan tidak ditahan oleh eligibility transaksi baru.

Bobot keterlambatan ditentukan saat submit pertama dan tidak direset ketika materi diedit. Edit konten tidak mengubah pemilik/tanggal/occurrence. Perubahan counts wajib sesuai standar/rekap; adjustment memengaruhi source ledger yang sama, bukan menulis ulang bobot dua kali. Blok jurnal berlaku pada submit/edit. Koreksi administratif di luar jalur reguler mengikuti K05.

Tes: T06–T12,T17; K07-01: UI dan submit menghasilkan eligibility/kode alasan sama; K07-02: general attendance baru tidak mengesahkan jurnal; K07-03: general legacy ambigu tidak auto-confirm; K07-04: edit H-1 tidak menaikkan kredit kembali 100%.

## 10. K08 — Hari template dan konteks Minggu

Database/kontrak template menerima day_index 0–6 (Minggu=0), sched_type KBM atau UJIAN. Satu template per pasangan hari/tipe; jam HH:mm intrahari, pulang > masuk. UI boleh menampilkan Senin–Sabtu terlebih dahulu, tetapi Minggu dapat dipilih eksplisit oleh admin. Ini perluasan terkontrol dari guard legacy 1–6, selaras model hari utama 0–6.

Template bukan penugasan atau konfirmasi. Menerapkan template pada Minggu tidak membuat KBM/ujian, bonus, atau hak transport baru. DayContext + penugasan/extra attendee sah menentukan peserta. Kalender biasa is_holiday=false tidak mematikan kegiatan. Jika KBM dan ujian sama-sama aktif pada tanggal yang sama, admin memilih tipe penerapan eksplisit; sistem menampilkan preview peserta dan jam sebelum konfirmasi, bukan memilih berdasarkan urutan query.

Penerapan idempotent. Jangan overwrite jam aktual. Jam jadwal yang sudah dipakai sebagai dasar kehadiran/transport membutuhkan koreksi dengan preview perubahan; periode final mengikuti K05. Jadwal lintas tengah malam ditolak baseline, bukan modulo 24.

Tes: T25,T27,T41,A01; K08-01: template Minggu tanpa occurrence tidak menambah peserta/kredit; K08-02: dua tipe konteks memerlukan pilihan eksplisit; K08-03: apply ulang tidak mengubah aktual atau menggandakan attendance.

## 11. K09 — Bentrok penugasan

Gunakan interval setengah terbuka [mulai, selesai) pada tanggal WIB. Dua interval overlap bila startA < endB dan startB < endA. Selesai 09.00 dan mulai 09.00 tidak bentrok; tidak ada buffer perjalanan otomatis. Berlaku untuk penugasan efektif aktif dalam periode akademik/tanggal yang sama. Assignment cancelled/substituted tidak ikut menempati slot guru asli; riwayatnya tetap disimpan.

| Kombinasi | Kebijakan |
|---|---|
| KBM–KBM | Tolak guru sama atau kelas sama yang overlap dalam periode aktif yang sama |
| Pengawas–pengawas | Tolak guru sama pada sesi sama maupun sesi berbeda yang overlap; assignment identik tetap duplikat |
| KBM–pengawas | Tolak guru sama pada occurrence yang sama-sama aktif di DayContext dan interval overlap |
| Substitusi | Kandidat dihitung dengan seluruh penugasan efektif, termasuk substitusi lain; replace satu transaksi |
| Ruang–ruang ujian | Tolak ruang fisik sama pada tanggal dan interval overlap; nama ruang dinormalisasi/ID kanonis |
| Kelas–ujian/KBM | Tolak kelas yang dipakai dua kegiatan aktif overlap; kelas gabungan diwakili relasi kelas, bukan string bebas |
| Panitia/piket–KBM/pengawas | Tidak memblokir sehari penuh hanya karena label tugas; jika ada interval penugasan eksklusif yang ditetapkan, interval itulah yang diperiksa |
| Upacara/acara | Jika ada interval eksklusif penugasan/peserta, periksa overlap; upacara tanpa jam memerlukan kelengkapan jam sebelum pengecekan overlap berbasis waktu |

Jadwal harian masuk-pulang bukan interval tugas eksklusif. Assignment panitia tetap unik guru/tanggal sesuai sumber, meskipun ada periode ujian lain pada tanggal sama. Piket mingguan tetap unik guru/hari dan occurrence turunannya unik guru/tanggal. Jenis tugas tidak boleh menerima kredit ganda untuk satu sumber occurrence; kombinasi panitia/pengawas yang sah memiliki sumber berbeda dan tetap mengikuti prasyarat masing-masing.

Jika KBM dinonaktifkan karena mode ujian, template mingguan tidak dihapus; konflik occurrence pada tanggal ujian mengikuti kegiatan efektif. Saat KBM diaktifkan kembali atau jadwal/sesi diubah, sistem memeriksa dampak occurrence mendatang dan menolak konflik baru. Snapshot masa lalu tidak ditulis ulang.

Pemeriksaan berlangsung dalam transaksi dengan lock/constraint yang mencakup kandidat slot dan resource; cek frontend hanya pratinjau. Dua request paralel yang bertabrakan tidak boleh sama-sama sukses. Berikan error CONFLICT/COLLISION dengan detail aman berupa tanggal/jam/jenis, bukan data privat di luar scope actor.

Tes: T05,T11,T16,T17,T23,A04; K09-01: batas jam bersambung diterima; K09-02: dua sesi beda overlap ditolak; K09-03: kombinasi panitia/pengawas tanpa interval eksklusif tidak ditolak semata role; K09-04: perubahan DayContext tidak mengaktifkan bentrok tersembunyi; K09-05: concurrent assignment satu slot hanya satu sukses.

## 12. Audit, versi kebijakan dan implementasi

Semua keputusan memengaruhi layanan domain dan policy server, bukan hanya tombol UI. Audit minimal requestId, actor, entity/occurrence, action, timestamp, reason, source version dan policy_version; redact rahasia. Perubahan policy setelah implementasi harus melalui versi baru, analisis dampak, fixtures dan migrasi bila perlu. Tidak mengubah history final otomatis.

| Keputusan | Artefak Tahap 0.3 yang wajib diturunkan |
|---|---|
| K01 | Capability matrix per endpoint, pemisahan claim/confirmation dan provenance time-in |
| K02 | State machine akun/challenge/sesi, transaksi aktivasi/reset, jalur onboarding dan admin recovery |
| K03 | Domain Decimal, constraint presisi, rounding specification, schema password dan rencana benchmark |
| K04 | Identitas entitlement/posting/reversal, cutoff estimasi/realisasi dan validasi finalisasi |
| K05 | Correction model, lock periode lintas mutasi, source revision dan delta settlement |
| K06 | Adapter, encrypted outbox payload, lease/job runs, due calculation dan kontrak retry |
| K07 | Eligibility result union, normalisasi evidence legacy dan bobot jurnal immutable |
| K08 | Unique template day/type, apply preview/version dan resolusi DayContext |
| K09 | Resource occupancy, interval exclusive/nonexclusive dan transaksi deteksi bentrok |

## 13. Kesiapan dan pekerjaan lanjutan

K01–K09 telah memiliki baseline aturan yang dapat diturunkan menjadi schema/kontrak/tes. Ini menyelesaikan Tahap 0.2 pada tingkat kebijakan rancangan. Baseline belum berarti pihak lembaga telah mengesahkan perubahan operasional; revisi pengguna berikutnya mengungguli pilihan desain ini.

Sisa verifikasi eksternal yang ditempatkan pada tahap relevan: akun/provider dan domain pengirim sebelum pengiriman nyata; kemampuan paket/cron/worker dan akses database sebelum deployment; benchmark Argon2id sebelum produksi; pemetaan konfirmasi umum dan jam tugas legacy saat migrasi; UAT kebijakan sebelum cutover. Tidak ada hasil benchmark, email nyata, tes runtime atau persetujuan UAT yang diklaim pada tahap ini.

Tahap berikutnya 0.3: rancangan teknis terperinci, dengan dokumen ini dan matriks 0.1 sebagai input. Dokumen dasar dan matriks 0.1 tidak ditimpa; keputusan terbuka yang tercatat pada 0.1 kini dijawab oleh versi dokumen ini.
