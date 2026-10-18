# Cetak Biru Pembangunan Ulang SiM-GURU

**Stack wajib:** Next.js App Router, TypeScript, Vercel, Tailwind CSS, shadcn/ui, Zod, Supabase PostgreSQL dan Storage.

**Sumber:** [amtsnurulfalah-commits/sim-guru](https://github.com/amtsnurulfalah-commits/sim-guru), checkout HEAD `28014207da58e3d295db5bf09f52b0d7bc26de5b`, ditelaah pada 18 Oktober 2026.

**Revisi autentikasi:** 18 Oktober 2026 — autentikasi internal dan kredensial pada database SiM-GURU sendiri.

**Status dokumen:** spesifikasi pembangunan ulang dan dasar prompt implementasi; bukan aplikasi baru yang sudah selesai atau sertifikasi bahwa sistem produksi lama bebas kesalahan.

## 1. Cara menggunakan dokumen

Dokumen ini menjadi kontrak cakupan, aturan bisnis, arsitektur target, migrasi, dan penerimaan aplikasi baru. Baca bagian utama sebelum lampiran. Lampiran menyediakan inventaris fungsi, halaman, atribut input, interaksi penyimpanan, dan titik validasi yang ditemukan secara statis agar fitur kecil tidak hilang saat pemecahan monolit.

Gunakan urutan berikut:

1. Bekukan sumber pada commit di atas; jangan menggunakan HEAD yang berubah tanpa meninjau selisihnya.
2. Buat matriks fungsi lama → layanan baru → halaman → pengujian menggunakan lampiran.
3. Implementasikan layanan domain dan transaksi sebelum mempercantik halaman.
4. Migrasikan data melalui staging dan rekonsiliasi.
5. Jalankan skenario penerimaan, terutama perhitungan JTM, transportasi, honorarium, dan pembatalan.
6. Tandai setiap fitur `belum dibuat`, `dibuat`, `teruji`, atau `diterima`. Label selesai memerlukan bukti pengujian.

Istilah dalam dokumen:

- **Teramati:** perilaku yang ada pada kode sumber.
- **Wajib target:** perilaku yang harus diwujudkan pada aplikasi baru.
- **Koreksi:** perbaikan ketidakkonsistenan/celah lama; jangan mereplikasi cacat sebagai persyaratan bisnis.
- **Perlu data operasional:** sesuatu yang tidak dapat dipastikan hanya dari repositori.

## 2. Cakupan dan batas bukti

Repositori yang diperoleh berisi dua berkas terlacak: `Code.gs` (30.363 baris) dan `Index.html` (22.461 baris), total 52.824 baris. Terdapat 343 deklarasi fungsi tingkat atas di backend. Tidak ditemukan README, manifest Apps Script, migrasi basis data, package manifest, atau suite pengujian di checkout tersebut.

`Code.gs` tidak hanya berisi backend: terdapat generator sidebar, navbar, footer, modal, dan ribuan baris templat halaman melalui `getPageContent`. `Index.html` menyediakan kerangka aplikasi, CSS, pengelolaan sesi di browser, navigasi SPA manual, pemanggilan `google.script.run`, ekspor, dan interaksi antarmuka.

Analisis dilakukan melalui pemetaan seluruh berkas, deklarasi, referensi halaman, kontrak input, akses sheet, validasi, alur mutasi, dan pembacaan rinci modul domain utama. Inventaris lampiran dihasilkan dari berkas sumber secara otomatis; inventaris tersebut adalah bukti statis, bukan pembuktian semua cabang telah dieksekusi. Sembilan helper murni sumber diuji dengan 17 assertion untuk durasi, rasio hadir, transportasi, pembulatan, kredit acara, dan konservasi JTM.

Belum diakses: isi Spreadsheet produksi, seluruh kolom hasil evolusi manual, Script Properties, daftar trigger yang benar-benar terpasang, Drive, akun email, maupun deployment GAS produksi. Karena itu validitas data produksi, konfigurasi aktif, dan perilaku layanan eksternal harus diverifikasi pada tahap migrasi. Tidak ada klaim uji end-to-end terhadap aplikasi lama atau baru.

## 3. Ringkasan produk dan batas cakupan

SiM-GURU mengelola kegiatan dan administrasi guru yang terkait langsung dengan perolehan JTM dan honorarium. Produk bukan sekadar CRUD pengguna atau jurnal. Rantai utamanya adalah:

**Identitas → otorisasi lokal → jadwal/penugasan → konfirmasi dan waktu hadir → jurnal/BAP → kredit JTM → tunjangan/transportasi → finalisasi honorarium → slip dan verifikasi.**

Modul wajib:

| ID | Modul | Kemampuan yang harus tersedia |
|---|---|---|
| F01 | Autentikasi dan profil | Login username/password, sesi, logout dengan konfirmasi, kedaluwarsa, pemulihan, perubahan profil dan kata sandi, verifikasi email OTP, pertanyaan keamanan sebagai faktor tambahan dan reset internal |
| F02 | Dashboard | Ringkasan guru/admin, jadwal dan progres hari ini, status kehadiran, piket, ujian, jurnal/BAP tertunda, bonus libur, estimasi honorarium |
| F03 | Pengguna | Daftar/cari/filter role, tambah/edit, NIP, kontak, jarak, jabatan tambahan, pengelolaan status akses, reset kredensial sesuai kewenangan identitas |
| F04 | Jadwal KBM | CRUD, filter guru/mapel/kelas/hari/tahun/semester, pencarian, hapus terpilih, hitung waktu selesai, deteksi bentrok, rekap/cetak |
| F05 | Jurnal KBM | Input hari H dan H-1 bersyarat, hadir/absen, materi/catatan, validasi rekap, detail/edit/hapus, riwayat paginasi, CSV/PDF |
| F06 | Absensi siswa | Rekap per kelas/tanggal: hadir, sakit, izin, alpa; progres kelengkapan; riwayat dan pembatasan akses |
| F07 | Piket | Jadwal mingguan, konfirmasi/cabut, pengganti, pembatalan, panel operasional dan kredit 4 JTM |
| F08 | Upacara | Jadwal pembina hari Senin, konfirmasi/cabut, penggantian pembina, kredit 5 JTM |
| F09 | Substitusi KBM | Penunjukan, penggantian pengganti, konfirmasi, pencabutan dan pembersihan dampak terkait |
| F10 | Ujian | Periode, sesi, ruang, mapel/kelas/jumlah siswa, pengawas, panitia, konflik, konfirmasi, substitusi, rekap |
| F11 | BAP | Input/edit setelah batas waktu, validasi peserta, pemilik dan periode, hubungan kredit pengawas |
| F12 | Penyesuaian JTM | Kurangi kredit, alasan, alokasikan selisih ke beberapa guru, hapus alokasi, reset; KBM/ujian/piket |
| F13 | Absensi guru | Jam jadwal/aktual, daftar harian, detail, manual admin, tambahan peserta, izin keluar, template KBM/ujian, riwayat pribadi/PDF |
| F14 | Acara | Rutin/insidental, kehadiran, jurnal, H-1, riwayat, kredit JTM dan dependensi penghapusan |
| F15 | Transportasi | Tarif/km, jarak guru, rasio durasi efektif, izin keluar, blokir tanggal, pembulatan bulanan |
| F16 | Honorarium | Estimasi, rekap admin, finalisasi manual/otomatis, tunjangan tambahan, snapshot, riwayat, slip/PDF/cetak, Excel, ID transaksi/verifikasi |
| F17 | Kalender dan jurnal libur | Libur tunggal/rentang, kalender akademik, estimasi bonus, generate/cancel otomatis, status scheduler |
| F18 | Pengumuman | CRUD, status aktif, tingkat urgensi, target role/user, dismissibility, CTA, email dan pengingat |
| F19 | Pemblokiran dan maintenance | Blok jurnal per mapel, acara per tipe, transportasi per rentang; maintenance langsung/terjadwal dengan pengecualian admin |
| F20 | Otomasi dan pengalaman pengguna | Email transaksional/pengingat, retry, mobile, sidebar collapse/accordion, loading/error/empty state, toast, modal, filter dan ekspor |

**Cakupan organisasi:** sumber tidak memiliki model tenant yang eksplisit. Baseline pembangunan ulang adalah satu instalasi sekolah/madrasah dengan identitas sekolah yang dapat dikonfigurasi. Multi-tenant bukan fitur yang terbukti ada pada sumber dan tidak boleh diasumsikan sebagai syarat kesetaraan. Jika nantinya ditambahkan, lakukan sebagai perluasan terpisah dengan `school_id` pada seluruh domain dan seluruh kebijakan akses.

## 4. Arsitektur lama dan ketergantungan

| Komponen lama | Peran | Pengganti target |
|---|---|---|
| HtmlService/doGet/getPageContent | Halaman dan navigasi manual | App Router, layouts, Server Components |
| google.script.run | RPC frontend ke fungsi GAS | Server Actions dan Route Handlers yang memanggil layanan domain sama |
| SpreadsheetApp/getData/findData | Penyimpanan relasional informal | Supabase PostgreSQL, FK, index, constraint, query terarah |
| Spreadsheet pengguna eksternal | Sumber username/password | Tabel kredensial privat aplikasi dan LocalAuthService |
| Sessions sheet + localStorage | Sesi 24 jam | Sesi lokal dengan cookie HttpOnly dan penyimpanan hash token |
| PropertiesService | OTP/rate limit/reset token | Tabel challenge privat dengan TTL, HMAC OTP/hash reset token dan penghitung percobaan |
| LockService/System_Locks | Kunci dan idempotensi | Transaksi PostgreSQL, row locks/advisory locks, unique key job |
| ScriptApp triggers | Tugas berkala | Vercel Cron dan tabel job, waktu dihitung pada Asia/Jakarta |
| MailApp | OTP, konfirmasi, pengingat, slip | Adapter email server dan transactional outbox |
| DriveApp/savePdfToDrive | Penyimpanan PDF | Supabase Storage privat dan URL unduhan terbatas |
| html2pdf/SheetJS CDN | PDF dan Excel browser | Pustaka terpasang dengan versi terkunci atau renderer server |
| Cache in-memory snapshot | Optimasi data ±5 menit | Query/index dan invalidasi per domain, tanpa mencampur data pengguna |

Sumber legacy mengacu pada spreadsheet kredensial eksternal dengan konstanta ID. Ketergantungan historis ini diganti sepenuhnya oleh penyimpanan hash password pada database SiM-GURU sendiri; tidak dipertahankan pada target. Jangan memindahkan ID spreadsheet atau sandi ke bundle browser.

## 5. Arsitektur target

### 5.1 Pemisahan tanggung jawab

- **App Router:** halaman, layout terproteksi, navigasi, metadata, error/loading boundary.
- **Server Components:** mengambil data yang sudah disaring aksesnya dan mengirim DTO minimum.
- **Client Components:** formulir interaktif, modal, filter lokal, pemilihan baris, pratinjau, timer tampilan, sidebar dan ekspor browser.
- **Zod:** validasi seluruh input di server; schema yang sesuai boleh digunakan kembali di client.
- **Layanan domain:** `SchedulingService`, `AttendanceService`, `JournalService`, `PicketService`, `CeremonyService`, `ExamService`, `JtmService`, `EventService`, `TransportService`, `HonorariumService`, `AnnouncementService`.
- **Repository/data-access layer:** query bertipe dan terotorisasi; jangan mengakses tabel mentah langsung dari komponen bisnis.
- **PostgreSQL:** integritas, constraint, transaksi lintas tabel, perhitungan finansial presisi.
- **Storage:** foto/slip/ekspor dengan policy objek; file sensitif tidak menggunakan bucket publik.
- **Outbox/worker:** pengiriman email yang dapat diulang tanpa menggandakan transaksi bisnis.

Gunakan TypeScript `strict`; larang `any` pada kontrak domain. Kunci versi dependensi dalam lockfile saat implementasi, gunakan versi stabil yang kompatibel setelah dicek pada saat pembangunan. Dokumen tidak menetapkan nomor versi berdasarkan dugaan.

### 5.2 Struktur proyek yang disarankan

```text
src/
  app/
    (public)/login/page.tsx
    (public)/lupa-password/page.tsx
    (public)/verifikasi-dokumen/page.tsx
    (protected)/layout.tsx
    (protected)/dashboard/page.tsx
    (protected)/jadwal/page.tsx
    (protected)/jurnal/page.tsx
    (protected)/absensi-siswa/page.tsx
    (protected)/piket/page.tsx
    (protected)/upacara/page.tsx
    (protected)/ujian/page.tsx
    (protected)/acara/page.tsx
    (protected)/kehadiran/page.tsx
    (protected)/honorarium/page.tsx
    (protected)/pengaturan/page.tsx
    api/auth/
    api/cron/
    api/exports/
  components/ui/
  features/<domain>/{components,schemas,actions,queries}.ts(x)
  server/{auth,authorization,services,repositories,mail,jobs}/
  lib/{dates,money,errors}/
  types/
supabase/migrations/
supabase/seed.sql
tests/{unit,integration,e2e,fixtures}/
docs/{api,migration,operations,parity}/
```

Nama folder adalah rancangan, bukan berkas yang sudah dibuat. Penentuan role dan hak akses harus berlangsung di server setiap kali membaca/mengubah data, termasuk Server Actions. Layout dan penyembunyian menu hanya membantu pengalaman pengguna.

### 5.3 Autentikasi internal SiM-GURU

**Keputusan arsitektur terbaru:** username, password, profil, role, permissions, sesi dan pemulihan akun dikelola oleh SiM-GURU sendiri pada Supabase PostgreSQL milik aplikasi. Tidak ada integrasi Central SSO, spreadsheet kredensial eksternal, atau penyedia identitas lain pada aplikasi target. Supabase digunakan sebagai database/Storage; Supabase Auth bukan mesin autentikasi baseline ini.

Alur login: browser → Route Handler/Server Action Next.js → normalisasi username → baca akun lokal dan hash kredensial → verifikasi password di server → cek status akun, onboarding dan maintenance → buat sesi lokal → kirim cookie aman. Role dan actor diambil dari database, tidak dipercaya dari browser. Seluruh operasi autentikasi berjalan pada **Node.js runtime** yang kompatibel dengan pustaka hashing terpilih, bukan Edge runtime yang belum dibuktikan mendukungnya.

Gunakan kontrak internal berikut sebagai rancangan layanan, bukan endpoint eksternal:

```ts
type LocalLoginResult =
  | { ok: true; userId: string; requiresPasswordChange: boolean }
  | { ok: false; code:
      'INVALID_CREDENTIALS' | 'ACCOUNT_DISABLED' |
      'RATE_LIMITED' | 'MAINTENANCE' | 'UNAVAILABLE' };

interface LocalAuthService {
  login(input: {
    username: string;
    password: string;
    requestId: string;
  }): Promise<LocalLoginResult>;
  logout(sessionToken: string): Promise<void>;
  changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void>;
}
```

`userId` pada changePassword selalu diisi dari sesi tepercaya oleh server. Detail session token tidak dikirim sebagai JSON yang disimpan client; cookie dipasang oleh Route Handler/Server Action. DTO login tidak memuat password_hash atau jawaban keamanan.

#### Penyimpanan dan pemeriksaan password

- Simpan `password_hash` menggunakan **Argon2id**, dengan salt acak unik yang dikelola pustaka dan format hash yang menyertakan algoritme/parameter. Baseline parameter minimal: memory 19 MiB, iterations 2, parallelism 1; ukur beban deployment Vercel sebelum produksi dan tingkatkan jika sesuai kapasitas. Gunakan pustaka terawat yang diuji pada Node runtime deployment.
- Jangan menyimpan password plaintext, mengenkripsi password agar dapat dibaca kembali, atau memakai SHA-256/MD5 sebagai hash password tunggal. Hash SHA-256 boleh untuk token acak berentropi tinggi; OTP 6 digit perlu HMAC berkey server/penyimpanan yang tahan brute force offline, selain pembatasan percobaan.
- Username di-trim dan dibandingkan case-insensitive dengan unique constraint. Password tidak di-trim, di-lowercase atau dinormalisasi diam-diam; verifikasi nilai yang dimasukkan apa adanya.
- Gunakan fungsi verify pustaka; akun tidak ditemukan menjalankan dummy password verification yang setara untuk mengurangi perbedaan waktu respons. Pesan username/password salah dibuat generik.
- Rehash saat login sukses jika parameter hash usang; jangan mengubah password tanpa verifikasi.
- Rate limit tersimpan pada database/penyimpanan bersama, bukan variabel proses Vercel. Gunakan gabungan key akun yang dinormalisasi dan asal permintaan dengan pembatasan sementara yang dapat dipulihkan.
- Ubah password memerlukan password lama dan sesi aktif; simpan hash baru, naikkan `auth_version`, cabut sesi/challenge terkait secara atomik, kemudian wajib login ulang. Password tidak pernah dikembalikan oleh endpoint baca user.

#### Pembuatan akun dan pemulihan

Admin membuat akun lokal dengan username unik, role, profil dan mekanisme aktivasi. Tidak ada registrasi publik otomatis pada baseline. Pilih tautan aktivasi sekali pakai atau password sementara acak yang wajib diganti; jangan menggunakan default bersama `123456`. Akun aktivasi/onboarding yang belum lengkap hanya boleh mengakses halaman penyelesaian akun dan logout, bukan mutasi kegiatan atau honorarium.

SiM-GURU menyediakan perubahan password, lupa password melalui email terverifikasi, verifikasi OTP, reset token sekali pakai dan reset oleh admin lokal. Admin tidak bisa melihat password lama. Persetujuan permintaan reset menghasilkan challenge/tautan baru, bukan menuliskan password umum. Akun tanpa email yang dapat diakses ditangani melalui permintaan pemulihan yang diverifikasi admin dengan audit.

Pertanyaan keamanan tetap tersedia sebagai kemampuan legacy dengan jawaban di-hash. Pertanyaan keamanan bukan satu-satunya bukti untuk reset password: jawaban benar harus dilanjutkan OTP email terverifikasi atau persetujuan admin. Semua alur pemulihan selesai di SiM-GURU dan tidak mengalihkan pengguna ke layanan identitas lain. Email memakai adapter pengiriman pesan; adapter tersebut tidak menjadi sumber identitas.

### 5.4 Akses database untuk autentikasi dan data bisnis

Gunakan pola backend-for-frontend dengan sesi internal aplikasi:

1. Browser tidak melakukan CRUD langsung ke tabel kredensial maupun tabel bisnis. Tabel `auth_private.user_credentials`, sesi, challenge dan rate limit tidak diekspos melalui Data API publik.
2. Server memvalidasi sesi lokal, status akun, `auth_version` dan scope operasi. Identitas kanonis adalah `app_users.id`, bukan subject dari layanan lain.
3. Jalur autentikasi memakai koneksi server terbatas khusus (`AUTH_DATABASE_URL`) yang hanya mendapat privilege minimum untuk lookup/hash/session/challenge dan operasi lifecycle akun yang diperlukan. UI bisnis, ekspor dan query list user tidak mendapat akses hash. Jangan menggunakan role owner/superuser sebagai runtime.
4. Jalur bisnis memakai `DATABASE_URL` dengan role runtime terbatas; transaksi memasang konteks actor tepercaya melalui `SET LOCAL`/`set_config(..., true)`. Jangan memakai setting session yang dapat bocor antarpermintaan pada pool.
5. Terapkan RLS/GRANT default-deny, helper SQL konteks dan policy untuk role non-owner/non-BYPASSRLS. Jangan menyediakan RPC publik yang menerima actor bebas dan bisa mengatur konteks otorisasi.
6. Penulisan lintas profil dan kredensial saat pembuatan akun wajib atomik. Kedua URL mengarah ke database PostgreSQL SiM-GURU yang sama dengan role berbeda; transaksi memakai satu koneksi berprivilege terbatas yang cukup untuk operasi itu atau routine database khusus yang di-hardening. Dua request terpisah bukan satu transaksi. Routine berprivilege lebih tinggi memvalidasi caller/actor tepercaya, mengunci search_path dan tidak terbuka ke anon/public.
7. Sesi internal tidak menghasilkan JWT Supabase Auth. `auth.uid()` bukan identitas sesi ini; jangan membuat policy yang mengharapkannya terisi tanpa mekanisme autentikasi yang benar.
8. Role migrasi/administrasi dipisahkan. Pengujian negatif memakai role runtime yang benar, termasuk upaya membaca hash melalui query bisnis atau REST publik.

Jika Supabase secret/service-role digunakan pada job/Storage terpilih, kredensial tersebut melewati RLS. Otorisasi resource wajib diperiksa layanan server; jangan mengklaim RLS melindungi jalur bypass. Simpan pada modul `server-only`, bukan bundle browser.

### 5.5 Sesi dan keamanan akun

Teramati: sesi server 24 jam, pengecekan browser tiap 5 menit, idle 2 jam, peringatan 1 menit sebelum idle logout, pengecekan ulang ketika tab terlihat. Terdapat pengalihan profil jika password default, pertanyaan keamanan belum dibuat, atau email belum diverifikasi.

Wajib target:

- Cookie sesi `HttpOnly`, `Secure` di produksi, `SameSite` yang sesuai alur, `Path=/`; token acak dan hash token pada database.
- Kedaluwarsa absolut 24 jam dan idle 2 jam diterapkan server, bukan hanya timer browser. Tombol tetap login memperbarui aktivitas secara sah tanpa melampaui kedaluwarsa absolut.
- Logout mencabut sesi, membersihkan cache pengguna dan menyinkronkan tab lain; dialog konfirmasi dipertahankan.
- Tindakan mutasi memeriksa origin/CSRF sesuai mekanisme yang digunakan, rate limit login/OTP/reset/validasi dokumen, dan respons tanpa membocorkan rahasia.
- Jangan membawa sandi plaintext, default `123456`, token localStorage, atau jawaban keamanan plaintext ke desain baru. Pertahankan proses onboarding wajib melalui flag server dan layanan akun internal.
- Kunci layanan email dan database tidak boleh memakai prefix `NEXT_PUBLIC_`. Username, password, OTP dan token tidak ditulis ke log.

## 6. Aktor dan otorisasi kontekstual

Role utama sumber adalah `admin` dan `guru`. `KEPALA_SEKOLAH` merupakan `additional_role`, bukan pengganti role utama. Piket, pengganti, panitia, pengawas, dan pembina upacara adalah penugasan dengan tanggal/occurrence, bukan role global permanen.

| Tindakan | Admin | Guru biasa | Piket efektif | Panitia efektif | Pengawas/pembina |
|---|---|---|---|---|---|
| Pengaturan, master, pengguna | Ya | Tidak | Tidak | Tidak | Tidak |
| Jurnal pribadi | Lihat/edit sesuai policy | Milik sendiri dan jadwal sah | Milik sendiri | Milik sendiri | Sesuai tugas |
| Konfirmasi KBM | Ya | Sumber memiliki jalur self-confirm; lihat koreksi | Untuk lingkup tanggal tugas | Bukan kewenangan umum | Tidak otomatis |
| Input jam guru | Ya | Jalur self sesuai policy | Guru nonpiket setelah time-in sendiri tercatat | Pengawas tanggal terkait setelah time-in sendiri | Tidak otomatis |
| Input jam piket/panitia | Ya | Tidak otomatis | Tidak untuk piket lain | Tidak untuk panitia lain | Tidak otomatis |
| Rekap siswa | Ya | Tidak | Ya | Setelah konfirmasi dan time-in | Tidak otomatis |
| Konfirmasi panitia | Ya, hari H | Tidak | Tidak | Tidak | Tidak |
| Konfirmasi/pengganti pengawas | Ya, hari H | Tidak | Tidak hanya karena piket | Ya, tugas aktif terkonfirmasi | Tidak untuk diri sendiri |
| BAP | Baca/koreksi administratif terpisah | Tidak | Tidak otomatis | Tidak atas nama pengawas | Milik sendiri, aktif, terkonfirmasi, waktu sah |
| Penyesuaian JTM KBM/piket | Ya hari H | Tidak | Ya hari H | Tidak otomatis | Tidak otomatis |
| Penyesuaian JTM pengawas | Ya hari H | Tidak | Tidak otomatis | Ya hari H | Tidak otomatis |
| Finalisasi/rekap seluruh honor | Ya | Tidak | Tidak | Tidak | Tidak |
| Slip dan riwayat pribadi | Ya sesuai scope | Milik sendiri | Milik sendiri | Milik sendiri | Milik sendiri |

Penting: sumber tidak seragam. `_isPicketOfficer` menerima jadwal reguler hari ini; pengganti memerlukan bukti log piket; penerima `PARTIAL-SUB-PIKET` juga dapat dianggap petugas. Modul jam masuk/keluar memakai pemeriksaan sendiri dan tidak seluruhnya setara dengan helper itu. Aplikasi baru harus memakai policy tunggal yang mengembalikan capabilities eksplisit, sambil mempertahankan hak operasional penerima relokasi piket yang sah.

Pisahkan `isAssigned`, `isConfirmed`, `hasTimeIn`, dan `canManageOthers`. Jangan menganggap keempatnya sama. Tambahkan matriks policy per endpoint; setiap pengecualian self-confirm harus menjadi keputusan tertulis. Kebijakan target yang disarankan: konfirmasi kegiatan oleh petugas berwenang, sedangkan self-check-in diperlakukan sebagai klaim kehadiran tersendiri yang tidak otomatis menghasilkan otoritas atau honor.

## 7. Model data sumber dan skema target

### 7.1 Prinsip tipe dan riwayat

- ID target UUID; simpan `legacy_id` unik untuk semua entitas impor. Jangan mengubah ID spreadsheet menjadi angka karena NIP/ID dapat kehilangan nol awal.
- Tanggal kegiatan `date`; jam lokal `time`; audit `timestamptz` UTC. Semua batas hari dihitung dengan `Asia/Jakarta` secara eksplisit.
- JTM menggunakan `numeric`, bukan integer global: H-1 dan relokasi dapat menghasilkan pecahan. Rupiah dan rasio memakai decimal/integer yang terkontrol, bukan floating point untuk settlement.
- `academic_year_id` dan `semester_id` eksplisit. Perilaku lama kolom kosong mengikuti periode aktif hanya untuk normalisasi migrasi; jangan teruskan fallback yang dapat mengubah arti data historis.
- Pisahkan penugasan berulang dari occurrence tanggal tertentu. Kehadiran harian dipisahkan dari konfirmasi setiap kegiatan.
- Simpan snapshot nama/mapel/kelas/jadwal/tarif yang diperlukan untuk sejarah; perubahan master tidak boleh mengubah slip final.

### 7.2 Pemetaan tabel

| Sheet sumber | Tabel target | Isi dan relasi inti |
|---|---|---|
| Users | app_users | legacy_id, username unik case-insensitive, auth_version, must_change_password, full_name, nip teks, role, status, photo_path, phone, contact_email, verified_at, km_distance, additional_role; base_salary lama ditahan untuk audit, tarif operasional sumber berasal dari Config |
| Kredensial username/password legacy | auth_private.user_credentials | user_id PK/FK app_users, password_hash, password_changed_at, credential_version; akses khusus layanan autentikasi; tidak memiliki password plaintext |
| Percobaan login legacy/client | auth_private.auth_rate_limits | key akun/asalan terhash, window_start, failures, blocked_until; penyimpanan bersama lintas instance |
| Pertanyaan keamanan legacy | auth_private.security_questions | user_id unik, question, answer_hash, updated_at; faktor tambahan, tidak dikirim bersama jawaban ke frontend |
| Sessions | app_sessions | token_hash, user_id, auth_version_at_issue, expires_at, idle_expires_at, last_activity_at, revoked_at; sesi lama tidak diimpor |
| Schedules | teaching_schedules + teaching_occurrences | guru, hari 0–6, mulai/selesai, mapel, kelas, JTM, tahun/semester; occurrence memiliki date dan snapshot |
| Teaching_Logs | teaching_journals + jtm_ledger | log_id, schedule/occurrence, pemilik, tanggal, materi, hadir/absen, catatan, jtm_val, waktu_submit, input_type; pisahkan log tugas non-KBM menjadi ledger bertipe |
| Config | system_settings + academic_periods + classes | setting bertipe, identitas sekolah, tarif, periode aktif, jumlah standar siswa/kelas, flags; jangan mengandalkan key dinamis untuk relasi utama |
| Academic_Calendar | academic_calendar | tanggal, uraian, is_holiday; rentang API menghasilkan occurrence per tanggal atau rentang yang dibuka deterministik |
| Honor_History | honor_periods + honor_statements + honor_statement_lines | periode, pengguna, total_jtm, total_honor, finalized_at, details_json asli, trx_id unik, snapshot perincian |
| Allowances | allowances | nama tugas, guru, nominal; snapshot saat finalisasi |
| Subjects | subjects | nama unik dengan normalisasi |
| Reset_Requests | password_reset_requests | pengguna/username, pemohon, status, verified_by, waktu; persetujuan admin lokal menerbitkan challenge reset sekali pakai |
| Daily_Attendance | daily_attendance + activity_confirmations | tanggal/guru/jadwal masuk-pulang aktual/jadwal, status dan konfirmasi; legacy schedule_id dipindah ke tabel konfirmasi |
| Attendance_Sched_Templates | attendance_schedule_templates | day_index, sched_type KBM/UJIAN, time_in/out |
| Attendance_Leaves | attendance_leaves | guru/tanggal, leave_time, return_time, reason; larang interval bertumpang tindih |
| Picket_Schedules | picket_schedules + picket_assignments | penugasan mingguan dan occurrence tanggal; guru asli/efektif |
| Substitutes | substitutions | tanggal, tipe tugas, original_user_id, substitute_user_id, occurrence_id, status, audit |
| Ceremony_Schedules | ceremony_assignments | tanggal Senin unik, guru, tahun/semester, original/effective teacher |
| Announcements | announcements + announcement_targets + announcement_acknowledgements | konten, severity, aktif, tanggal, CTA, target role/user, override dismissibility, versi, status baca |
| System_Locks | job_runs | job_key unik, state, attempts, started/completed_at, metadata, last_error |
| Exam_Periods | exam_periods | nama, mulai/akhir, default JTM panitia/hari, deskripsi, pembuat |
| Exam_Sessions | exam_sessions | period_id, tanggal, nama sesi, jam mulai/selesai, JTM |
| Exam_Rooms | exam_rooms | session_id, ruang, mapel, kelas, total_siswa |
| Exam_Supervisors | exam_supervisor_assignments | room_id, guru, status, is_substitute, original_user_id, konfirmasi/pembatalan, JTM override |
| Exam_Committee | exam_committee_assignments | periode/tanggal/guru, JTM, status/substitusi/konfirmasi/pembatalan |
| Exam_BAP | exam_baps | supervisor_assignment_id unik, peserta_hadir/absen, catatan, submitted_at, updated_at |
| JTM_Adjustments | jtm_adjustments | occurrence_type/ref/date, original_user_id, scheduled_jtm, adjusted_jtm, selisih, alasan dan audit |
| JTM_Reallocations | jtm_reallocations | adjustment_id, occurrence, substitute_user_id, allocated_jtm, audit, ledger_entry_id |
| Event_Definitions | event_definitions + event_dates | nama, type rutin/insidental, hari berulang atau tanggal, waktu, JTM, uraian |
| Event_Attendance | event_attendance | event occurrence/guru unik, time_in, confirmer, journal_submitted, snapshot JTM |
| Event_Journals | event_journals | journal_id, attendance_id unik, guru/tanggal, deskripsi, submitted_at |
| BlokJurnal | journal_blocks | mapel, rentang inklusif, pesan, aktif, created_at |
| BlokAcara | event_blocks | tipe acara, rentang inklusif, pesan, aktif |
| BlokTransport | transport_blocks | rentang inklusif, keterangan, aktif |
| PropertiesService | verification_challenges | hash OTP/reset token, tujuan, target, TTL, attempts, consumed_at dan rate window |
| MailApp effects | notification_outbox + notification_deliveries | penerima, tipe pesan, dedupe_key, payload snapshot, retry dan hasil |
| Drive output | document_exports + Storage | pemilik, jenis, object_path, status, expiry, checksum/snapshot |
| Belum ada | audit_logs + migration_batches | actor, action, entity, timestamp, redacted changes; jejak impor/rekonsiliasi |

Kolom tambahan sumber yang tidak seluruhnya ada di `doSetup` harus tetap diperiksa pada ekspor aktual: `Schedules.tahun_pelajaran/semester`, `Ceremony_Schedules.tahun_pelajaran/semester`, flag extra attendee/reason pada absensi, serta flag email/reminder pengumuman. Header setup bukan satu-satunya sumber skema.

Kredensial, sesi, challenge, rate limit dan jawaban keamanan berada di schema privat; nama app_sessions/verification_challenges pada tabel pemetaan merujuk nama logis, bukan izin mengeksposnya pada schema publik. Profil publik-terbatas hanya memuat DTO nonrahasia. `app_users.auth_version` dicocokkan pada setiap validasi sesi agar penonaktifan/reset segera berlaku.

### 7.3 Constraint dan indeks wajib

- `unique(lower(username))`, `unique(user_credentials.user_id)`, FK untuk seluruh referensi pengguna dan master.
- `unique(user_id, date)` pada kehadiran harian target; konfirmasi kegiatan unik `(occurrence_id, user_id)`.
- `unique(occurrence_id, user_id)` pada jurnal KBM sesuai penugasan efektif; jangan memperbolehkan guru asli dan pengganti memperoleh kredit penuh untuk occurrence sama.
- Satu substitusi aktif per occurrence; status historis tetap dipertahankan.
- Satu BAP per assignment pengawas; satu jurnal acara per attendance; satu rekap siswa per kelas/tanggal/periode yang sesuai.
- Satu penyesuaian aktif per `(occurrence_type, occurrence_id)`; date adalah bagian identitas occurrence, terutama jadwal berulang.
- Satu ledger credit efektif per sumber bisnis; reversal memiliki referensi entry asli dan unique key.
- Satu periode final per tahun-bulan, satu slip per periode/guru, trx_id unik; periode tetap ada walau total seluruh guru nol.
- Check nonnegative counts/nominal/JTM; time_end > time_start untuk kegiatan intrahari; date_end >= date_start.
- Indeks `(user_id,date)`, `(academic_period_id,day_index)`, `(period_id,date)`, `(status,next_attempt_at)`, `(occurrence_id,status)`.
- Pencegahan bentrok guru/kelas/ruang memakai pemeriksaan transaksi atau exclusion constraint yang sesuai tipe interval. Jangan hanya mengandalkan filter frontend.

## 8. Aturan jadwal dan konteks hari

Jadwal KBM mengikuti hari, guru, kelas, mapel, jam, JTM, tahun pelajaran dan semester. `day_index` sumber memakai Minggu=0 sampai Sabtu=6. UI memiliki pratinjau durasi dan perhitungan akhir jadwal serta cek bentrok lokal; target memindahkan verifikasi bentrok ke server juga.

Jadwal pribadi menampilkan jadwal sendiri dan tugas pengganti pada tanggal relevan. Jadwal hari ini diurutkan jam mulai dan menunjukkan status jurnal/konfirmasi. Jadwal H-1 tampil terpisah bila flag aktif, belum diisi dan penugasan sah.

Jangan mengasumsikan 1 JTM selalu sama dengan durasi jam tertentu tanpa membaca konfigurasi UI terkait. JTM adalah nilai bisnis yang disimpan. Lama menit dan JTM harus terpisah; istirahat diperhitungkan dalam pratinjau waktu, bukan secara diam-diam mengubah kredit.

Kalender libur, mode KBM, mode ujian dan periode ujian harus menghasilkan `DayContext` tunggal: `date`, `isHoliday`, `kbmEnabled`, `examEnabled`, `activeExamPeriods`, `activeAcademicPeriod`. Semua dashboard, daftar tugas, reminder, kredit, dan API menggunakan konteks yang sama. Sumber memakai beberapa helper terpisah untuk konteks ini; lihat lampiran dan inventaris setting.

Riwayat wajib menggunakan snapshot periode kegiatan, bukan periode aktif saat riwayat dibuka.

## 9. Jurnal KBM dan rekap siswa

### 9.1 Aturan input

1. Identitas valid, profil aktif dan memiliki hak terhadap occurrence.
2. Jadwal harus ada. Pemilik adalah guru asli atau pengganti sah pada tanggal jurnal; guru asli yang sudah digantikan tidak mengisi untuk memperoleh kredit yang sama.
3. Tanggal hari ini diterima sebagai `SAME_DAY` berbobot 100%.
4. Kemarin diterima sebagai `H_MINUS_1` hanya jika `allow_h_minus_1_journal=true`; bobot 80%, dibulatkan satu desimal: `round(jtm_dasar × 0.8, 1)`.
5. Tanggal lebih lama ditolak `DATE_EXPIRED`; masa depan ditolak `FUTURE_DATE`; feature mati ditolak `H1_DISABLED`.
6. H-1 memerlukan konfirmasi kemarin. Kode penyimpanan lama menerima schedule-specific atau konfirmasi umum kosong; tampilan jadwal lama tidak konsisten karena hanya memeriksa schedule-specific. Target harus memakai policy occurrence yang sama pada query kelayakan dan mutasi.
7. Untuk kelas dengan standar siswa, `hadir + absen = standar_kelas`.
8. Jika ada rekap piket pada tanggal jurnal, `hadir = rekap.hadir` dan `absen = sakit + izin + alpa`. Jika tidak ada rekap, kode lama melewati pemeriksaan kesesuaian tersebut; tampilkan keadaan ini secara jujur dan jangan membuat rekap palsu.
9. Materi wajib; counts bilangan bulat nonnegatif; catatan mengikuti batas UI yang dibawa ke schema. Validasi server tidak cukup hanya `parseInt(...) || 0`.
10. Duplikat ditolak atomik, termasuk dua submit paralel.
11. Dasar JTM memakai snapshot occurrence dan penyesuaian sah. Bobot keterlambatan disimpan eksplisit dan diterapkan tepat sekali.
12. Pemblokiran mapel/rentang diperiksa di server pada submit dan edit; modal pemeriksaan di browser saja tidak cukup.

Sumber `saveTeachingJournal` belum secara menyeluruh menegakkan semua prasyarat UI seperti keberadaan jadwal/konfirmasi hari H/block mapel. Target memperkuat server sesuai maksud alur, bukan menyalin celah.

### 9.2 Edit, hapus dan riwayat

Sumber menerima edit dari pemilik atau admin; edit mengubah materi/counts/catatan dan memvalidasi ulang standar serta rekap siswa. Riwayat guru dipaginasi dan dibatasi milik sendiri; admin memiliki filter lebih luas, tanggal cepat, pencarian, detail, serta CSV/PDF.

Target mempertahankan kemampuan edit/hapus, dengan audit dan reversal kredit bila memengaruhi honor. Untuk periode final, jangan mengubah snapshot slip; perubahan setelah final dicatat sebagai koreksi eksplisit pada periode terbuka atau proses pembatalan final yang tersendiri. Ini merupakan penguatan target.

### 9.3 Rekap siswa

Rekap terdiri dari kelas, tanggal, hadir, sakit, izin, alpa, submitted_by dan submitted_at. Kode lama melakukan upsert hari ini; total tidak boleh nol atau negatif. Target memperketat tipe integer dan validitas kelas. Daftar kelas berasal dari jadwal periode aktif.

Piket asli/pengganti dan panitia terkonfirmasi yang sudah memiliki time-in dapat mengisi sesuai hak kontekstual. Admin tidak dipaksa pengalihan kelengkapan. Pengguna operasional mendapat progres kelas yang sudah diisi dan alur melengkapi sebelum pekerjaan terkait; hitung kelengkapan berdasarkan himpunan kelas wajib, bukan sekadar jumlah baris seluruh rekap hari ini.

Riwayat nonadmin sumber terbatas pada baris yang ia input; admin dapat melihat seluruhnya. Pertahankan filter bulan/tahun dan identitas penginput.

## 10. Piket, upacara dan substitusi penuh

### 10.1 Piket

- Jadwal piket mingguan dikelola admin; konfirmasi harian menghasilkan log `PICKET-DUTY` dengan 4 JTM.
- Konfirmasi ulang tidak menggandakan log. Konfirmasi umum kehadiran dan log tugas adalah dua catatan berbeda yang harus dibuat atomik bila keduanya diperlukan.
- Piket dapat diganti dengan guru lain; pengganti tidak boleh admin atau guru asli. Simpan original/effective teacher dan audit.
- Pencabutan/pembatalan membersihkan konfirmasi, log kredit, penyesuaian dan relokasi yang terkait occurrence itu saja.
- Panel admin mengelola konfirmasi, pengganti dan waktu piket; panel guru piket mengelola KBM, pengganti dan rekap hari tugas.
- Penerima relokasi sebagian piket berhak operasional sesuai policy tunggal, tanpa memperoleh 4 JTM penuh tambahan secara otomatis.

### 10.2 Upacara

- Jadwal pembina hanya Senin dan satu jadwal per tanggal.
- Konfirmasi menghasilkan `CEREMONY-DUTY` senilai 5 JTM.
- Admin atau pembina sah dapat menjalankan konfirmasi sesuai aturan; server harus memeriksa penugasan tanggal tersebut.
- Penggantian oleh admin/piket mengganti guru efektif, menghapus/membalik kredit pembina asli, dan meminta pembina baru mengonfirmasi.
- Pencabutan harus memeriksa hak admin/pemilik tugas; kode lama pada `revokeCeremonyLeader` hanya memeriksa sesi, sehingga perlu diperbaiki.

### 10.3 Substitusi KBM

- Penunjukan untuk occurrence hari H, tidak boleh diri sendiri, admin, guru tidak aktif, atau guru yang bentrok.
- Substitusi aktif yang sudah ada menghasilkan `COLLISION`; UI menawarkan ganti pengganti melalui operasi terotorisasi.
- `replace` wajib satu transaksi. Pola lama revoke kemudian assign dapat kehilangan pengganti lama jika assign gagal.
- Pengganti mengisi jurnal atas namanya untuk jadwal asli. H-1 tetap diperbolehkan untuk pengganti kemarin jika flag aktif dan konfirmasi tersedia.
- Pembatalan membersihkan kredit/jurnal/konfirmasi yang terkait pengganti occurrence tersebut dan mengembalikan guru asli; jangan menghapus absensi harian atau tugas lain guru tersebut.
- Simpan bukti original_user_id pada struktur tersendiri, bukan menumpang pada kolom jumlah siswa seperti beberapa log legacy.

## 11. Ujian, panitia, pengawas dan BAP

### 11.1 Struktur dan master

Hierarki: periode → sesi → ruang → assignment pengawas → BAP. Panitia adalah assignment per periode/tanggal. Periode memiliki rentang tanggal dan default JTM panitia per hari. Sesi memiliki tanggal, nama, jam dan JTM. Ruang memiliki nama, mapel, kelas dan total siswa. Pengawas memiliki JTM override jika tersedia.

Wajib tersedia tambah/edit/hapus periode, sesi, ruang dan pengawas; tambah/hapus panitia; filter periode; accordion sesi/tanggal; detail dan rekap JTM/BAP. Penghapusan harus menampilkan dampak jumlah dependensi dan meminta konfirmasi eksplisit dalam UI sebelum transaksi cascade yang diizinkan.

Teramati: pengawas aktif tidak dapat ditempatkan di ruang lain pada sesi yang sama. Panitia aktif tidak boleh duplikat pada tanggal sama. Target juga memeriksa sesi berbeda dengan interval waktu bertumpang tindih. Jangan melarang kombinasi panitia/pengawas sepanjang hari secara sembarang jika sumber dan kebijakan operasional mengizinkan; konflik harus berbasis interval tugas yang nyata.

### 11.2 Konfirmasi dan kredit

- Panitia dikonfirmasi/cabut oleh admin pada hari H; harus status aktif dan belum dikonfirmasi untuk konfirmasi baru.
- Konfirmasi panitia menghasilkan kredit `EXAM-COMMITTEE`; pencabutan membalik kredit itu.
- Pengawas dikonfirmasi/cabut oleh admin atau panitia tanggal terkait yang terkonfirmasi; hari H dan assignment aktif.
- Konfirmasi pengawas saja belum menghasilkan honor pengawas: kredit `EXAM-SUPERVISOR` dihasilkan setelah BAP tersubmit.
- Untuk input jam aktual pengawas oleh panitia, panitia juga harus sudah memiliki time-in yang dicatat admin. Kelengkapan rekap siswa panitia yang disyaratkan alur harus diperiksa di server pada tindakan terkait.
- Pengganti pengawas/panitia menyimpan hubungan asli/pengganti, status aktif/cancelled, audit dan konfirmasi. Pembatalan tidak boleh menghapus tugas guru lain.

### 11.3 BAP

1. Caller merupakan pemilik assignment pengawas; assignment aktif, bukan cancelled, dan kehadiran terkonfirmasi.
2. BAP dibuka setelah waktu akhir sesi + 5 menit pada hari sesi. Hari sebelum sesi ditolak.
3. Hari sesudah sesi masih dapat diizinkan selama periode belum berakhir; jangan mempersempit menjadi hanya hari H tanpa keputusan perubahan kebijakan.
4. Setelah `period.date_end`, submit/edit ditolak.
5. Counts nonnegatif dan, bila total siswa ruang >0, hadir + absen sama dengan total ruang. Target menggunakan integer eksplisit.
6. Submit pertama dan edit merupakan operasi berbeda; duplikat submit ditolak.
7. Kredit memakai override assignment >0 jika tersedia, jika tidak JTM sesi; penyesuaian aktif yang valid boleh bernilai nol dan harus dihormati.
8. Edit BAP memperbarui counts dan ledger sumber yang sama; tidak menambah kredit duplikat.
9. Jika konfirmasi/substitusi dicabut sementara sudah ada BAP, server mengembalikan keadaan butuh konfirmasi dampak. `force` tidak boleh melewati otorisasi dan tidak boleh mengubah slip final diam-diam.

## 12. Penyesuaian JTM dan relokasi sebagian

Sumber mendukung `KBM`, `EXAM`, dan `PIKET`. Referensi KBM lama memakai schedule_id, ujian memakai supervisor_id, piket memakai `user_id|date`. Target memakai occurrence ID bertanggal untuk ketiganya.

Aturan dasar:

```text
S = scheduled_jtm
A = adjusted_jtm, bilangan bulat 0 ≤ A ≤ S
D = S − A
R = jumlah allocated_jtm aktif
A + R ≤ S
sisa_belum_dialokasikan = S − A − R
```

- Pengurangan memerlukan alasan yang di-trim, 1–500 karakter.
- Alokasi harus angka finite >0; helper lama tidak mensyaratkan integer untuk alokasi. Pertahankan dukungan pecahan dengan presisi yang didefinisikan.
- Penerima bukan guru asli dan bukan admin, harus ada/aktif dan sah untuk penugasan.
- Penyesuaian KBM/piket oleh admin/piket berwenang; ujian oleh admin/panitia terkonfirmasi; semua pada hari H.
- Piket harus mempunyai log konfirmasi aktif sebelum penyesuaian.
- Multi-penerima diperbolehkan sampai batas konservasi; alokasi tidak otomatis sama dengan substitusi penuh.
- Tampilkan JTM terjadwal, disesuaikan, selisih, alokasi, sisa dan alasan pada panel.
- Hapus alokasi membalik kredit alokasi tersebut. Reset menghapus penyesuaian dan seluruh alokasi terkait serta mengembalikan basis JTM.
- Pencabutan konfirmasi atau pembatalan tugas membalik efek turunannya. Gunakan transaksi/lock yang mencakup baca-validasi-tulis, bukan validasi sebelum lock.
- Pembobotan jurnal H-1 terjadi setelah penyesuaian dasar untuk pemilik jurnal; simpan komponen yang terpisah agar tidak diterapkan ulang pada kredit alokasi.

Ledger bertipe sumber: `KBM`, `PIKET`, `UPACARA`, `EXAM_SUPERVISOR`, `EXAM_COMMITTEE`, `EVENT`, `HOLIDAY_BONUS`, `PARTIAL_SUB_KBM`, `PARTIAL_SUB_EXAM`, `PARTIAL_SUB_PIKET`, `REVERSAL`. Alias legacy seperti `PIKET`/`PICKET-DUTY` dan `UPACARA`/`CEREMONY-DUTY` dipetakan saat impor.

## 13. Kehadiran guru dan izin keluar

### 13.1 Dua jenis bukti

Konfirmasi jadwal/kegiatan tidak sama dengan jam hadir harian. Tabel lama mencampurkan beberapa baris guru/tanggal melalui schedule_id; target memisahkannya agar satu hari tidak membayar transport berkali-kali atau mengambil jam dari baris yang salah.

Fitur wajib: daftar harian/filter tanggal, detail, jam jadwal/aktual, status, tambahan peserta tanpa jadwal dengan alasan, input manual admin, izin keluar sementara, template jam KBM/UJIAN, terapkan template ke tanggal, pengaturan jam per guru/tanggal, riwayat pribadi bulanan dan PDF.

### 13.2 Waktu dan izin

- Format `HH:mm`, waktu valid intrahari.
- Kode lama mewajibkan jam jadwal masuk sebelum input jam masuk, dan menolak jam aktual masuk lebih awal dari jam jadwal.
- Jam keluar memerlukan jam masuk dan jadwal keluar; untuk nonadmin tombol tersedia setelah jadwal keluar +5 menit. Nilai jam keluar tidak boleh melebihi jadwal keluar.
- Input manual admin dapat memperbaiki data; jam keluar tidak boleh lebih awal daripada masuk. Target semua jalur harus memeriksa urutan tersebut, bukan hanya modal detail.
- Piket untuk mengelola jam orang lain harus sudah memiliki time-in. Jam piket lain ditangani admin; sumber memiliki pengecualian self bila piket juga memiliki jadwal mengajar.
- Panitia hanya mengelola jam pengawas pada tanggal tugas setelah time-in sendiri tersedia.
- Guru biasa memiliki jalur input diri pada sumber; jangan menggantinya dengan akses umum mengubah guru lain.
- Izin keluar memerlukan kehadiran, alasan, interval kembali > keluar, dan tidak bertumpang tindih dengan izin lain. Penghapusan izin mengikuti actor dan scope tanggal yang sah.
- Target klip interval izin terhadap rentang hadir aktual ketika menghitung durasi, sehingga izin di luar kehadiran tidak mengurangi dua kali. Jika data legacy memiliki interval tidak sah, tandai untuk rekonsiliasi.
- Template hanya `KBM` atau `UJIAN`, day_index valid, jam pulang > jam masuk; admin dapat CRUD dan menerapkan ke tanggal yang sesuai konteks.

Aturan larangan masuk lebih awal dan batas keluar adalah perilaku spesifik sumber. Pertahankan dalam mode kompatibilitas, tampilkan penjelasannya, dan jangan mengubahnya menjadi geolocation/selfie/biometrik yang tidak ada pada sumber.

## 14. Acara rutin/insidental dan jurnal acara

- Definisi acara admin: nama unik case-insensitive, `rutin` dengan hari berulang atau `insidental` dengan daftar tanggal, waktu mulai < selesai, JTM integer 1–99, deskripsi.
- Daftar kegiatan hari ini didapat dari recurrence atau tanggal eksplisit; backend harus memastikan tanggal attendance benar-benar occurrence acara.
- Admin/piket terkonfirmasi dengan time-in/panitia terkonfirmasi dengan time-in mengelola kehadiran sesuai scope; hanya guru dapat menjadi peserta yang diberi kredit.
- Jam masuk acara harus ≥ mulai dan < selesai. Attendance satu per acara/tanggal/guru.
- Pembatalan hadir ditolak jika jurnal telah diisi, kecuali proses koreksi administratif yang tercatat dan membalik kredit.
- Guru hanya mengisi jurnal attendance miliknya; deskripsi wajib, maksimal 1.000 karakter, satu kali submit.
- Hari H mendapat JTM definisi saat submit; H-1 bila flag aktif mendapat 80%, satu desimal; tanggal lebih lama/masa depan ditolak.
- Snapshot JTM disimpan di attendance saat jurnal sukses. Kehadiran tanpa jurnal memberikan 0 JTM acara.
- Jurnal dan perubahan status attendance/ledger wajib atomik; pola lama append jurnal kemudian update attendance rentan tidak sinkron.
- Riwayat hadir bulanan menampilkan tanggal, jam, status jurnal dan JTM; riwayat jurnal guru milik sendiri dan admin seluruh guru, urut terbaru.
- Penghapusan definisi merupakan dua tahap: pratinjau jumlah kehadiran/jurnal, lalu konfirmasi. Lindungi referensi ke periode honor final.
- Blok tipe acara/rentang aktif harus diperiksa di server ketika mengirim jurnal.

## 15. Transportasi

Transportasi adalah perhitungan durasi kehadiran, bukan nominal tetap per jumlah jurnal. `km_distance` dapat kosong/0; nilai positif 0,01–999,99 dengan paling banyak 2 desimal. Tarif per km bernilai 1–999.999.999 jika diaktifkan. Jangan menambahkan faktor pulang-pergi ×2 karena kode sumber tidak melakukannya.

```text
durasi_jadwal = max(0, menit(jadwal_pulang) − menit(jadwal_masuk))
durasi_aktual = max(0, menit(pulang) − menit(masuk) − izin_keluar_efektif)
rasio = min(1, durasi_aktual / durasi_jadwal)
transport_harian = km_distance × tarif_per_km × rasio
```

Jika fitur mati, jarak/tarif/durasi tak valid atau durasi ≤0, hasil 0. Persentase tampil maksimal 100%, dibulatkan tiga desimal. Untuk peserta tambahan tanpa jadwal masuk, implementasi lama menggunakan durasi aktual sebagai durasi jadwal; pertahankan secara eksplisit dengan penanda extra attendee, bukan menganggap semua data jadwal kosong berhak 100%.

Kode lama memilih satu baris per tanggal dengan durasi jadwal terbesar. Bila ada beberapa baris yang berbeda, migrasi harus merekonsiliasi waktu aktual dan sumbernya; jangan menggabungkan sehingga nominal membesar tanpa dasar. Tanggal dalam blok transportasi aktif menghasilkan 0 transport, tetap simpan bukti kehadiran.

**Nuansa acara:** helper `_computeTransportDates` membentuk union tanggal reguler/acara, tetapi kedua implementasi perhitungan bulanan yang aktif menggunakan `regularDates` saja. Jumlah hari acara berjurnal dicatat untuk info, bukan otomatis menambah tanggal pembayaran. Baseline kompatibilitas: acara saja tanpa kehadiran harian yang sah tidak otomatis mendapat transport. Jika perlu pembayaran acara mandiri, itu perubahan kebijakan yang harus memiliki jadwal/durasi sendiri dan uji terpisah.

**Pembulatan tiga titik dilakukan setelah penjumlahan bulanan**, tidak per hari:

| Sisa terhadap kelipatan Rp1.000 | Hasil |
|---|---|
| `< 333,34` | Turun ke kelipatan Rp1.000 |
| `≥ 333,34` dan `< 666,67` | Kelipatan Rp1.000 + Rp500 |
| `≥ 666,67` | Naik ke Rp1.000 berikutnya |

Contoh: Rp10.333,33 → Rp10.000; Rp10.333,34 → Rp10.500; Rp10.666,66 → Rp10.500; Rp10.666,67 → Rp11.000. Gunakan decimal agar batas tidak bergeser akibat floating point.

## 16. Honorarium, finalisasi dan dokumen

### 16.1 Rumus tunggal target

```text
JTM_total = kredit_KBM + kredit_piket + kredit_upacara
          + kredit_pengawas_BAP + kredit_panitia
          + kredit_relokasi + kredit_acara_berjurnal
          + bonus_libur_yang_sah
honor_mengajar = JTM_total × tarif_per_JTM
honor_total = honor_mengajar + jumlah_tunjangan_tambahan + transport_bulanan_dibulatkan
```

Sumber menggunakan `Config.base_salary` sebagai tarif per JTM, bukan gaji pokok tetap, walaupun nama field berpotensi menyesatkan. `Users.base_salary` tidak dijadikan sumber tarif pada jalur perhitungan utama yang diperiksa. Label target harus menjelaskan “Tarif per JTM”.

Satu mesin perhitungan wajib digunakan untuk dashboard, estimasi, rekap admin, finalisasi, slip dan verifikasi. Hasil engine memuat setiap komponen dan asalnya. Jangan menulis salinan formula pada komponen frontend.

### 16.2 Bonus libur

Sumber memperkirakan JTM jadwal pada tanggal kalender `is_holiday=true`, dan dapat membuat log auto untuk KBM, piket serta pembina upacara pada Senin. Pendeteksian auto memakai penanda catatan `Auto-generated: Libur Bonus`. Target memindahkan identitas itu ke source_type dan occurrence, tanpa menghilangkan teks materi/catatan legacy.

Sumber bermasalah: helper bonus ringkas menimpa beberapa jadwal guru pada hari sama; helper detail menjumlahkan seluruh jadwal. Finalisasi dan rekap juga memperlakukan log auto secara berbeda. Target menetapkan satu kredit per occurrence libur; perkiraan dan realisasi adalah dua status dari hak yang sama, bukan dua tambahan terpisah. Satu tanggal dengan dua jadwal tetap dapat memberi dua kredit jadwal yang berbeda; piket/upacara adalah occurrence lain yang dinilai sesuai penugasan.

Tentukan secara eksplisit apakah estimasi periode mencakup libur mendatang dalam bulan. Sumber memiliki variabel cutoff yang tidak dipakai dan memasukkan tanggal sebulan. Target labeli `estimasi seluruh periode` terpisah dari `realisasi sampai hari ini`; finalisasi hanya memakai hak periode yang sudah lengkap.

### 16.3 Finalisasi

- Admin dapat memilih bulan/tahun dan finalisasi manual. Parameter bulan legacy 0–11 harus dikonversi jelas ke kontrak baru 1–12 atau `YYYY-MM`.
- Otomasi sumber memfinalisasi bulan sebelumnya pada tanggal 2 pukul 10.00 sesuai timezone script; target menggunakan 10.00 WIB secara eksplisit setelah verifikasi kebutuhan operasional.
- Sumber menolak periode bila sudah ada history dan hanya menyimpan guru dengan total >0. Target harus memiliki row periode tersendiri supaya finalisasi total nol tetap terkunci, dan jangan membuat periode parsial menjadi “sudah final”.
- Finalisasi satu transaksi: lock periode → validasi → hitung → tulis semua slip dan lines → tandai final → enqueue email. Gagal satu bagian tidak meninggalkan sebagian guru final.
- Snapshot menyimpan tarif, identitas penerima/sekolah/penandatangan, breakdown semua source JTM, bobot H-1, bonus, tunjangan, jarak/tarif transport, pembulatan dan versi formula.
- Data final immutable; tidak dihitung ulang menggunakan master terkini. Proses koreksi tersendiri dengan audit dan penyesuaian/reversal.
- Email gagal tidak membatalkan finalisasi; retry outbox tidak membuat slip/kredit baru.

### 16.4 Riwayat, slip dan validasi

Guru melihat periode dan slip sendiri; admin rekap total/riwayat seluruh guru dengan pencarian, filter periode dan pagination. Pertahankan unduh PDF, cetak native, ekspor Excel riwayat admin, serta perincian tugas tambahan/transport/bonus/JTM acara. Tampilan dapat menyembunyikan nominal honor/transport untuk privasi layar.

`trx_id` unik menjadi bukti dokumen final. Halaman verifikasi menerima ID, menampilkan status valid/tidak dan data minimum yang memang akan dibagikan. Sumber memverifikasi melalui lookup history tanpa sesi; jangan mengubah menjadi endpoint publik untuk daftar semua honor. Gunakan token verifikasi acak, rate limit dan snapshot final; jangan menghitung tarif dari Config hari ini seperti jalur lama.

## 17. Kalender, auto-jurnal dan scheduler

Kalender mendukung tanggal tunggal/rentang, uraian, `is_holiday` dan penghapusan/edit. Sumber melarang edit/hapus hari libur yang sudah lewat pada jalur tertentu; pertahankan pembatasan dan sediakan koreksi historis administratif tersendiri bila dibutuhkan.

Auto-jurnal:

1. Pastikan tanggal merupakan libur bonus.
2. Dapatkan lock/job key tanggal.
3. Ambil occurrence jadwal periode yang benar, piket dan upacara yang relevan.
4. Lewati jadwal tidak aktif, duplikat exact, atau jurnal manual yang sudah ada.
5. Buat jurnal/kredit bertipe auto dengan rincian generated/skipped dan alasan.
6. Tandai completed hanya setelah transaksi berhasil; enqueue notifikasi terpisah.
7. Pembatalan hanya membalik hasil run yang dipilih dan membuka status yang sesuai; jangan menghapus jurnal manual.

Teramati: scheduler auto-jurnal dipasang setiap hari sekitar 16.00 WIB; ada status/pasang/hapus melalui admin. Aplikasi baru menyediakan pengaktifan job dan status run, bukan memalsukan status trigger GAS. UI dapat menonaktifkan job sementara; `vercel.json`/infrastruktur tetap dikelola deployment.

| Job | Waktu/kondisi target | Idempotency key |
|---|---|---|
| Auto-jurnal libur | 16.00 WIB, cek kalender | `holiday:{date}` + unique per occurrence |
| Finalisasi otomatis | Tanggal 2, 10.00 WIB, bulan sebelumnya | `honor:{YYYY-MM}` |
| Pengumuman email | Pemeriksaan harian 08.00 WIB, pengingat sesuai offset sumber | `announcement:{id}:{version}:{recipient}:{offset}` |
| Pengingat operasional | Jadwal terkonfigurasi, sesuai hari KBM/ujian dan prasyarat | `{type}:{date}:{recipient}:{window}` |
| Pengiriman outbox | Berkala/batch sesuai kapasitas | ID outbox unik |
| Bersih sesi/challenge | Berkala | TTL/consumed/revoked |

Cron Vercel memakai UTC: 16.00 WIB = 09.00 UTC; 08.00 WIB = 01.00 UTC; 10.00 WIB = 03.00 UTC. Waktu dan batas paket hosting harus diverifikasi saat implementasi. Cron bukan jaminan tepat detik atau exactly-once; route memeriksa secret, waktu jatuh tempo WIB, idempotensi dan lock. Gunakan konfigurasi scheduler tunggal; jangan menjalankan trigger GAS dan Cron baru bersamaan saat cutover.

## 18. Pengumuman, blokir dan notifikasi

### 18.1 Pengumuman

- Severity: `info`, `success`, `warning`, `critical`; urutan tampil critical → warning → success → info, lalu updated_at terbaru.
- Judul/isi wajib, status aktif, rentang tanggal opsional dengan batas inklusif.
- Target user eksplisit mengungguli target role; role `all/guru/admin` digunakan bila tidak ada target user.
- `is_dismissible` global dapat dioverride daftar user dismissible/nondismissible; user tidak boleh berada dalam kedua daftar. Sumber selalu mengizinkan admin menutup.
- CTA text/URL; URL hanya skema HTTP/HTTPS yang valid dan aman.
- Sumber menyimpan tanda pernah dilihat di browser dengan versi. Target boleh memindahkannya ke server agar konsisten antarperangkat, tetapi versi perubahan harus bisa memunculkan pengumuman kembali.
- Body yang mendukung formatting disanitasi; jangan menggunakan HTML arbitrer dari database.
- Email pengumuman memiliki flag send, sent dan reminder H-3/H-2/H-1 pada kolom tambahan; per penerima dan versi wajib terdeduplikasi.

### 18.2 Blokir

Blok jurnal: mapel + tanggalMulai/tanggalSelesai + pesan + aktif. Blok acara: tipeAcara + rentang + pesan + aktif. Blok transport: rentang + keterangan + aktif. Semua rentang inklusif, tanggal akhir ≥ awal, validasi admin dan tanggal kalender sebenarnya. Block jurnal/acara menolak submit/edit terkait dengan pesan yang ditentukan. Block transport menghasilkan nominal 0 pada tanggal itu dan tidak menghapus kehadiran.

### 18.3 Notifikasi wajib

Pertahankan email OTP, pemulihan, konfirmasi/pencabutan piket, penetapan/pembatalan pengganti, konfirmasi/pencabutan KBM, konfirmasi/substitusi panitia/pengawas, auto-jurnal libur, kehadiran acara, pengumuman dan finalisasi honor. Pengingat mencakup jurnal KBM/acara yang belum diisi, BAP setelah sesi+5 menit, KBM yang belum dikonfirmasi kepada petugas piket dan pengawas belum dikonfirmasi kepada panitia.

Reminder KBM tidak dikirim ke guru asli yang sudah digantikan; diarahkan ke pengganti efektif. Jurnal acara tetap diperiksa pada hari non-KBM bila konteks kegiatan sah. Semua penerima dihitung dari penugasan aktif, bukan list user statis. Deduplikasi, batching, retry dan status gagal tersedia; jangan menelan exception email tanpa bukti operasional.

## 19. Profil, OTP, pemulihan dan maintenance

Teramati: edit nama, NIP/detail guru, nomor telepon yang dinormalisasi, foto profil dari URL, username, perubahan password, pertanyaan keamanan dan verifikasi email. Username unik case-insensitive pada pengelolaan user; field NIP wajib diperlakukan sebagai teks. `additional_role` hanya kosong atau `KEPALA_SEKOLAH` pada helper sumber.

Aturan password baseline: minimal 8 karakter, huruf besar/kecil, angka, simbol, bukan sama password lama dan tidak mengandung username/unsur nama lebih dari 2 huruf, mengikuti kemampuan sumber. Terapkan di server dan client menggunakan schema yang sesuai; dukung password panjang minimal sampai 64 karakter tanpa truncation, dengan maksimum eksplisit untuk membatasi beban. SiM-GURU memverifikasi password lama terhadap hash lokal dan menyimpan hash baru; tidak memperbarui spreadsheet eksternal. Kebijakan keamanan berikutnya dapat diperketat secara terkontrol dengan versi konfigurasi.

OTP verifikasi email sumber 6 digit, kedaluwarsa 10 menit, jeda kirim 60 detik, maksimal 5 salah. Pemulihan lewat OTP email atau pertanyaan keamanan menghasilkan reset token sekali pakai sekitar 5 menit. Pertahankan pemulihan internal yang aman: pertanyaan keamanan harus disertai OTP email atau persetujuan admin, bukan menerbitkan reset token hanya dari jawaban. Challenge terikat user/tujuan/email target, percobaan dibatasi, OTP disimpan sebagai HMAC berkey server dan token acak di-hash; verifikasi dan konsumsi dilakukan atomik. Password reset sukses membatalkan semua sesi dan challenge pemulihan lama, mengirim notifikasi tanpa password, dan mengharuskan login ulang. Permintaan lupa password memberikan respons umum agar keberadaan username/email tidak terungkap.

Maintenance memiliki mode langsung, mode terjadwal, waktu awal/akhir, pesan dan pengecualian admin. Pada sumber pemeriksaan utama berada saat login; target perlu mendefinisikan dampak pada sesi berjalan dan memeriksa di titik mutasi. Minimum: guru tidak bisa memulai operasi baru selama maintenance, admin tetap bisa memperbaiki konfigurasi. Jangan cache konfigurasi maintenance lintas pengguna secara keliru.

## 20. Kontrak layanan/API target

Nama rute berikut rancangan internal aplikasi baru, bukan endpoint GAS lama. Boleh menggunakan Server Actions untuk UI internal; seluruhnya tetap memanggil layanan dan policy yang sama.

| Kelompok | Operasi target | Layanan |
|---|---|---|
| `/api/auth/*` | login, logout, session, change-password, activation, forgot-password, OTP, reset-password | AuthService |
| `/api/profile/*` | baca/edit, kontak, challenge email | ProfileService |
| `/api/users/*` | list, pembuatan akun lokal, edit/status, reset oleh admin | UserService |
| `/api/schedules/*` | CRUD, batch delete, weekly/today, conflict check | SchedulingService |
| `/api/journals/*` | eligible, submit, edit, delete, history/filter | JournalService |
| `/api/student-attendance/*` | required classes, upsert today, history | StudentAttendanceService |
| `/api/picket/*`, `/api/ceremonies/*` | master, confirm/revoke, substitute | Picket/CeremonyService |
| `/api/substitutions/*` | assign, replace, revoke | SubstitutionService |
| `/api/exams/*` | periods/sessions/rooms/assignments/confirm/substitute/BAP/recap | ExamService |
| `/api/jtm/*` | state, adjust, allocate, remove, reset | JtmService |
| `/api/attendance/*` | day/detail/time/manual/templates/leaves/extra/history | AttendanceService |
| `/api/events/*` | definition, occurrence, attendance, journal, history | EventService |
| `/api/honorarium/*` | estimate, recap, finalize, periods, statements | HonorariumService |
| `/api/documents/verify` | validasi satu token dokumen | DocumentService |
| `/api/settings/*` | kalender/master/config/blocks/maintenance | SettingsService |
| `/api/announcements/*` | CRUD, active, acknowledge | AnnouncementService |
| `/api/exports/*` | PDF/CSV/XLSX terotorisasi | ExportService |
| `/api/cron/*` | jobs terproteksi dan outbox | JobService |

Gunakan response union yang konsisten:

```ts
type ApiResult<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; error: {
      code: string;
      message: string;
      fieldErrors?: Record<string, string[]>;
      details?: Record<string, unknown>;
    }; requestId: string };
```

Kode error dipertahankan maknanya: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `DUPLICATE`, `COLLISION`, `STUDENT_COUNT_MISMATCH`, `STUDENT_ATTENDANCE_MISMATCH`, `H1_DISABLED`, `H1_NOT_CONFIRMED`, `H1_REPLACED`, `DATE_EXPIRED`, `FUTURE_DATE`, serta kode JTM pada lampiran. Gangguan database autentikasi/email tidak disamakan dengan salah password.

Contoh submit jurnal:

```json
{
  "occurrenceId": "uuid-occurrence",
  "date": "2026-10-18",
  "material": "Interaksi sosial",
  "studentsPresent": 28,
  "studentsAbsent": 2,
  "notes": "Diskusi kelompok",
  "idempotencyKey": "uuid-request"
}
```

`userId`, tarif dan kredit efektif dihitung dari sesi/penugasan server, bukan dipercaya dari request. Untuk penyesuaian, request berisi `occurrenceId`, `adjustedJtm`, `reason`, `expectedVersion`; untuk alokasi berisi daftar penerima/jumlah dan idempotency key. Konflik versi menghasilkan HTTP 409; kegagalan validasi 422; sesi 401; akses 403; sumber hilang 404; dependency sementara 503.

Export tidak boleh mengambil data tambahan di luar filter/akses pengguna. CSV harus escape separator/quote/newline dan mengatasi formula injection pada nilai yang diawali `=`, `+`, `-`, `@` bila relevan.

## 21. UX dan pemetaan halaman

Gunakan bahasa Indonesia untuk label, error, waktu, tanggal dan dokumen. UI responsif, sidebar dapat collapse/disembunyikan, accordion grup bertingkat, badge tugas/pengingat, jam/tanggal, indikator loading navigasi, skeleton, empty/error state, tombol retry dan toast sukses/gagal. Modal mendukung fokus, Escape/overlay sesuai tingkat risiko, scroll terkunci dengan benar, fokus kembali setelah tutup dan tombol submit anti-duplikat. Pertahankan konfirmasi logout serta konfirmasi dampak pembatalan/hapus/finalisasi.

Filter tanggal/semester/tahun/guru/mapel/kelas/hari dan pagination harus bekerja pada dataset lengkap di server; export mengikuti filter yang sama. Persist preferensi sidebar/nominal/halaman terakhir boleh di browser, tetapi role, token, permission dan onboarding flag tidak dipercaya dari localStorage.

| Halaman lama | Rute target yang disarankan |
|---|---|
| Page_Login | `/login` |
| Page_Dashboard | `/dashboard` dengan DTO admin/guru |
| Page_Profile | `/profil` |
| Page_Users | `/admin/pengguna` |
| Page_ManageSchedule | `/admin/jadwal` |
| Page_MySchedule | `/jadwal-saya` |
| Page_Journal / Page_Journal_Admin | `/jurnal` / `/admin/jurnal` |
| Page_Picket / Page_Picket_Admin | `/piket` / `/admin/piket` |
| Page_ExamSchedule | `/admin/ujian` |
| Page_ExamPanitia | `/ujian/panitia` |
| Page_Attendance / Page_AttendanceList | `/kehadiran` |
| Page_AttendanceSchedule | `/admin/jadwal-kehadiran` |
| Page_AdminDailyAttendance | `/admin/kehadiran-harian` |
| Page_MyAttendance | `/kehadiran-saya` |
| Page_StudentAttendance*Input* | `/absensi-siswa/input` dengan scope actor |
| Page_StudentAttendanceHistory* | `/absensi-siswa/riwayat` dengan scope actor |
| Page_EventManagement | `/admin/acara` |
| Page_EventAttendance* | `/acara/kehadiran` |
| Page_EventJournal | `/acara/jurnal` |
| Page_EventJournalHistory* | `/acara/riwayat` |
| Page_Honorarium* | `/honorarium` / `/admin/honorarium` |
| Page_HonorariumHistory* | `/honorarium/riwayat` / `/admin/honorarium/riwayat` |
| Page_Settings_Config/Mapel/Tunjangan/Transportasi | `/admin/pengaturan/*` |
| Page_Settings_Kalender/Pengumuman/Maintenance | `/admin/pengaturan/*` |
| Page_Settings_BlokJurnal/BlokAcara/BlokTransport | `/admin/pemblokiran/*` |

Beberapa nama `Page_*_Admin` adalah varian/alias client, bukan selalu case templat tersendiri. Lampiran mencantumkan seluruh referensi yang ditemukan agar alias tidak dianggap fitur hilang atau halaman baru yang wajib digandakan.

## 22. Temuan yang wajib ditangani saat pembangunan ulang

Temuan berikut adalah hasil pembacaan statis, bukan hasil eksploitasi produksi. Lokasi mengacu pada commit sumber yang dibekukan.

| ID | Temuan dan bukti | Dampak | Keputusan target |
|---|---|---|---|
| B01 | `loginUser`, `_extGetPassword_`, `_extSetPassword_`: perbandingan/simpan password sebagai string; default 123456 | Kredensial tidak layak disalin | Autentikasi internal, hash Argon2id dan reset/onboarding aman |
| B02 | `Index.html`: auth_token/user_role/onboarding di localStorage | Dapat dimanipulasi client dan terbaca script | Cookie HttpOnly, validasi server |
| B03 | `assignSubstitute` hanya memeriksa sesi, berbeda dari revoke/replace yang memeriksa admin/piket | Hak mutasi tidak konsisten | Policy terpusat setiap jalur |
| B04 | `revokeCeremonyLeader`, `generateAutoJurnalForHoliday`, `savePdfToDrive` memiliki guard kurang ketat/tiada pada entry tertentu | Mutasi/ekspor berpotensi di luar kewenangan | Otorisasi per resource dan job |
| B05 | `saveTeachingJournal` bisa melanjutkan bila jadwal tidak ditemukan, konfirmasi/block hari H tidak lengkap di server | Jurnal tidak sah/jalur UI dapat dilewati | Validasi occurrence/konfirmasi/block di service |
| B06 | `getTodaySchedule` H-1 hanya specific confirmation, `saveTeachingJournal` menerima general confirmation | UI menolak data yang server anggap sah | Satu fungsi eligibility |
| B07 | `_calculateMonthlyBonusFast` menyimpan satu jadwal per day; versi Detailed memakai array | Bonus kurang untuk banyak jadwal | Satu engine berbasis occurrence |
| B08 | `_processHonorariumFinalization` menjumlah log auto, rekap mengabaikan lalu menambah bonus detail; versi bonus ringkas melewati tanggal auto | Angka rekap/final bisa berbeda, kredit piket/upacara auto juga perlu rekonsiliasi | Hak libur satu sumber dengan status estimasi/realisasi |
| B09 | H-1 menyimpan 0.8 di jurnal, jalur honor reguler menggunakan schedule/adjustment tanpa membaca input_type | Potensi kredit kembali 100% | Ledger effective JTM menjadi otoritas |
| B10 | Penyesuaian KBM lookup memakai occurrence_type/ref tanpa tanggal sebagai key penyimpanan penuh | Adjustment jadwal berulang dapat menimpa hari lain | Key occurrence bertanggal |
| B11 | Snapshot history tidak lengkap; validasi/slip tertentu menggunakan user/config terkini | Identitas/tarif slip historis dapat berubah | Snapshot final lengkap |
| B12 | Finalisasi cek history sebelum write tanpa transaksi/kunci periode, skip total nol | Duplikat/parsial/periode nol tidak terkunci | Row periode dan transaksi finalisasi |
| B13 | `_computeTransportDates` union tidak dipakai kedua sum bulanan | Komentar/indikator acara dapat menyesatkan pembayaran | Dokumentasikan baseline actual, perubahan kebijakan terpisah |
| B14 | Banyak operasi multi-sheet bukan transaksi; replace revoke→assign, jurnal acara append→update | Data parsial/orphan/dobel | SQL transaction, FK, unique, rollback |
| B15 | Cek conservation/duplikat sebagian berlangsung sebelum lock, cek bentrok jadwal di client | Race condition | Lock dan validasi ulang dalam transaksi |
| B16 | Kolom runtime melebihi header setup, tanggal boolean dan waktu dinormalisasi generik | Impor skema sederhana dapat kehilangan data | Profiling header aktual dan staging |
| B17 | Helper `getEventJournalHistory` mengembalikan `r.id`, sementara schema jurnal memakai journal_id | ID detail dapat kosong | PK tunggal dan mapping legacy eksplisit |
| B18 | Konflik pengawas hanya sesi sama; interval sesi berbeda tidak diperiksa helper | Bentrok waktu terlewat | Validasi interval server |
| B19 | `checkStudentAttendanceToday` menghitung jumlah seluruh rekap hari ini dibanding kelas wajib | Kelas lain dapat menutupi kelas yang belum lengkap | Set difference kelas wajib−sudah diisi |
| B20 | `getPageContent` mengirim templat; batas akses banyak bergantung UI dan entry bervariasi | Menu tersembunyi bukan kontrol akses | Semua query/mutasi dievaluasi server |
| B21 | Snapshot cache dan invalidasi tidak seragam pada seluruh mutasi | Dashboard/honor bisa stale | Invalidation terarah dan query final fresh |
| B22 | `cutoffDate` bonus tidak dipakai dan tanggal mendatang sebulan ikut dihitung | Estimasi/realisasi rancu | Pisahkan estimasi periode dan realisasi |
| B23 | Beberapa helper otorisasi piket tidak mengakui penerima partial secara seragam | Hak operasional tidak konsisten | Capability resolver tunggal |
| B24 | Error email sering ditangkap tanpa status persisten; konfigurasi trigger aktual tidak tersedia | Kegagalan sunyi/trigger ganda | Outbox, observability, inventaris trigger sebelum cutover |

Tidak menghapus helper karena terlihat tidak dipanggil dari `Index.html` saja: trigger GAS, fungsi global, callback, alias halaman dan pemanggilan dinamis bisa menjadi pemanggil. `getData`, `getPageContent`, scheduler dan `_cleanup` memerlukan penelusuran konteks. Lampiran bukan daftar dead code yang aman dihapus.

## 23. Strategi migrasi data

1. **Inventaris operasi:** ekspor seluruh sheet beserta header aktual, metadata timezone/locale, Script Properties nonrahasia yang relevan, daftar trigger, konfigurasi Drive/email dan kontrak identitas. Rahasia ditransfer melalui secret manager, bukan dokumen ini.
2. **Backup utuh:** read-only snapshot sumber, checksum, waktu ekspor, pemilik dan lokasi backup; uji pemulihan sebelum cutover.
3. **Staging:** masukkan baris mentah dengan source sheet, nomor baris, batch ID dan nilai asli. Pertahankan details_json dan marker legacy.
4. **Profiling:** duplikat username/id/attendance/journal; header kosong; boolean campur; date object/string; jadwal tanpa semester; orphan guru/jadwal; interval jam tidak sah; nominal/JTM negatif; assignment cancelled dengan BAP/kredit aktif.
5. **Normalisasi terkontrol:** ID mapping, username casefold, timezone Jakarta, tanggal ISO, jam valid, NIP string, integer counts, decimal JTM/nominal; log setiap koreksi.
6. **Impor master:** periode akademik, kelas/mapel, profil, username kanonis dan pemetaan user_id lokal, setting/tunjangan/kalender.
7. **Impor transaksi:** jadwal/occurrence, penugasan/substitusi, attendance/confirmation/leaves, rekap siswa, jurnal, ujian/BAP, acara, adjustment/reallocation/ledger.
8. **History honor:** impor nilai final sumber sebagai snapshot historis apa adanya; jangan menghitung ulang dan menimpa slip yang sudah diterbitkan. Beri `formula_version=legacy` dan catat bila snapshot komponen tidak lengkap.
9. **Tidak diimpor:** token sesi lama, OTP aktif, reset token, password plaintext dan jawaban keamanan plaintext. Akun migrasi memulai aktivasi/reset password internal melalui email terverifikasi atau admin; jangan membuat hash dari nilai placeholder dan menganggap akun dapat login.
10. **Rekonsiliasi:** hitung per tabel, guru/tanggal/occurrence, bulan/komponen JTM/transport/nominal; jelaskan selisih akibat koreksi B01–B24 dalam laporan, jangan memaksa mesin baru mengikuti bug.
11. **Parallel run:** minimal satu periode representatif yang mencakup H-1, libur, ujian, substitusi dan relokasi. Bandingkan keluaran lama, target dan expected business result.
12. **Cutover:** hentikan write/trigger lama, ekspor delta, impor dan rekonsiliasi akhir, aktifkan autentikasi internal/sesi/job baru, lakukan smoke test dan pantau.
13. **Rollback:** titik keputusan jelas dan snapshot database pra-cutover; bila sudah ada transaksi baru, rekonsiliasi/ekspor delta sebelum memulihkan. Jangan rollback dengan menghilangkan transaksi pengguna.

Data produksi diperlukan untuk menyelesaikan migrasi, tetapi tidak diperlukan untuk mulai membuat schema, layanan, fixtures dan tes.

## 24. Rencana implementasi bertahap

| Tahap | Hasil konkret | Syarat keluar |
|---|---|---|
| 0 | Pin source, matriks parity, keputusan auth/policy/koreksi | Seluruh fungsi publik dan halaman terpetakan |
| 1 | Scaffold, migrations, env schema, LocalAuthService/hash password/session, role policy, UI shell | Login/logout/akses negatif dan build lulus |
| 2 | Pengguna, periode, kelas/mapel, settings, kalender, jadwal | CRUD, constraints, filter dan bentrok server teruji |
| 3 | Occurrence, confirmation, attendance/leaves/templates, rekap siswa, jurnal | Hari H/H-1 dan ketergantungan teruji |
| 4 | Piket/upacara/substitusi/penyesuaian-relokasi | Konservasi dan rollback teruji paralel |
| 5 | Ujian/panitia/pengawas/BAP, acara dan jurnal | Timing, substitusi, kredit dan force flow teruji |
| 6 | Engine honor/transport/libur, snapshot, slip, ekspor/verifikasi | Rekap=final=slip dan golden fixtures lulus |
| 7 | Pengumuman, blocks, maintenance, outbox/reminder/cron | Retry/idempotensi/akses job teruji |
| 8 | Import staging, rekonsiliasi, QA mobile/aksesibilitas, deployment | UAT, restore, rollback dan cutover disetujui operasional |

Jangan mempublikasikan aplikasi yang masih menggunakan data dummy sebagai sumber transaksi nyata. Setiap tahap dapat dipreview, namun fitur belum tersedia harus diberi status jelas. Dokumentasi API, environment, provisioning admin, backup, job dan migrasi wajib mengikuti implementasi aktual.

## 25. Pengujian penerimaan dan bukti kesetaraan

### 25.1 Skenario minimum

| ID | Skenario | Hasil wajib |
|---|---|---|
| T01 | Username/password salah, profil/kredensial lokal hilang atau akun nonaktif | Login ditolak; respons terkendali, tidak auto-admin dan tidak ada sesi |
| T02 | Guru memanggil action admin atau userId orang lain | 403 tanpa efek samping |
| T03 | Sesi absolut/idle lewat, logout multi-tab | Server menolak; browser kembali login |
| T04 | OTP salah 5 kali, TTL habis, resend cepat, token reset dipakai ulang | Ditolak dan terikat target/tujuan |
| T05 | Jadwal guru/kelas bentrok dan periode berbeda | Bentrok aktif ditolak; periode sah tidak salah ditolak |
| T06 | Dua submit jurnal paralel | Satu jurnal dan satu kredit |
| T07 | Standar kelas 30, hadir 28 absen 2 | Diterima jika rekap konsisten |
| T08 | Hadir 29 absen 1 tetapi rekap 28 dan 2 | STUDENT_ATTENDANCE_MISMATCH |
| T09 | H-1 JTM 3, flag aktif, penugasan/konfirmasi sah | Kredit 2,4 di jurnal/rekap/final/slip |
| T10 | H-1 flag mati, H-2, masa depan | Kode error tepat; tidak ada write |
| T11 | Guru asli telah diganti, pengganti mengisi H-1 | Asli ditolak; pengganti sah diterima satu kali |
| T12 | Blok jurnal/acara dipanggil langsung via API | Tetap ditolak server |
| T13 | Piket/pengganti dicabut dengan relokasi aktif | Seluruh efek occurrence itu berbalik; tugas lain utuh |
| T14 | Pembina bukan Senin/duplikat tanggal | Ditolak; konfirmasi sah memberi 5 JTM |
| T15 | Adjust 4→2, alokasi 1+1, tambahan 0,1 | Dua alokasi diterima; tambahan ditolak |
| T16 | Dua alokasi paralel berebut sisa 1 | Hanya satu yang masuk; total ≤4 |
| T17 | Adjustment jadwal sama dua tanggal berbeda | Tidak saling menimpa |
| T18 | Konfirmasi panitia tanpa BAP | Kredit panitia masuk; pengawas belum masuk |
| T19 | BAP sebelum akhir+5, tepat batas, akhir periode | Ditolak/dibuka/ditutup sesuai waktu Jakarta |
| T20 | Counts BAP tidak sesuai ruang, edit ulang | Ditolak atau update sumber yang sama, tanpa double credit |
| T21 | Cancel supervisor dengan BAP | Preview dampak lalu transaksi berotorisasi; final history utuh |
| T22 | Event hadir tanpa jurnal; jurnal hari H/H-1 | 0, lalu kredit sesuai snapshot atau 80% |
| T23 | Event rutin/insidental di tanggal tidak cocok | Tidak dapat dibuatkan attendance palsu |
| T24 | Transport km10 tarif1000 durasi210/420 | Rp5.000 sebelum pembulatan bulanan |
| T25 | Aktual melebihi jadwal, nol, izin bertumpuk | Cap100%, nol, interval tumpang tindih ditolak |
| T26 | Pembulatan 10333,33/10333,34/10666,66/10666,67 | 10000/10500/10500/11000 |
| T27 | Dua jurnal sehari, acara+KBM, event-only | Transport tidak berlipat; baseline event-only jelas |
| T28 | Tanggal transport diblok | Transport0, kehadiran tetap ada |
| T29 | Libur guru dua jadwal, auto belum/sudah dibuat | Hak kedua jadwal masuk tepat sekali |
| T30 | Auto-jurnal dijalankan ulang dan dibatalkan | Tidak dobel; hanya run terkait dibalik |
| T31 | Rekap→final→slip→verify pada dataset sama | Angka dan snapshot sama |
| T32 | Finalisasi paralel, sebagian error, periode total nol | Satu final atomik; rollback utuh; nol tetap terkunci |
| T33 | Ubah tarif/nama/jadwal setelah final | Slip final tidak berubah |
| T34 | SMTP gagal lalu retry job | Bisnis sukses satu kali, email terdeduplikasi |
| T35 | Pengumuman target user vs role/override versi | Precedence tepat; versi baru dapat tampil lagi |
| T36 | Kelas rekap ekstra menutupi kelas wajib kosong | Tetap ditandai belum lengkap |
| T37 | Maintenance langsung/terjadwal, admin/guru | Admin dapat memperbaiki, operasi guru mengikuti policy |
| T38 | Akses direct database/Storage tanpa izin | Ditolak dengan role runtime nyata |
| T39 | Export filter & pemilik, CSV karakter berbahaya | Data tepat, tidak bocor, output aman dibuka |
| T40 | Mobile, keyboard, modal berulang, loading gagal | Layout/aksesibilitas berfungsi, scroll/fokus pulih |

Golden fixture hendaknya mencakup satu guru dengan: KBM 10 JTM termasuk satu jurnal H-1, piket 4, upacara 5, panitia/pengawas, event, relokasi sebagian, libur dua jadwal, tunjangan dan transport dengan izin. Simpan expected per source, bukan hanya grand total sehingga double-count tidak tersembunyi.

### 25.1a Pengujian khusus autentikasi internal

| ID | Skenario | Hasil wajib |
|---|---|---|
| T42 | Admin membuat akun dan username berbeda hanya kapital | Satu username kanonis; duplicate ditolak; profil+kredensial atomik |
| T43 | Baca user/ekspor/REST langsung dengan role bisnis/anon | Tidak memperoleh password_hash, answer_hash, token atau OTP |
| T44 | Buat, login dan ganti password | Argon2id valid; password lama salah ditolak; password baru bekerja dan lama gagal |
| T45 | Ubah password/reset admin/nonaktifkan akun dengan sesi lama aktif | auth_version berubah; semua sesi lama ditolak server |
| T46 | Reset token/OTP dipakai dua request paralel | Hanya satu sukses; hash baru dan konsumsi token satu transaksi |
| T47 | Pertanyaan keamanan benar tanpa OTP/persetujuan admin | Tidak bisa reset atau memperoleh sesi bisnis |
| T48 | Akun migrasi belum aktivasi/password sementara | Hanya aktivasi/onboarding/logout; tidak dapat mutasi bisnis |
| T49 | Login brute force lintas instance, akun tidak ditemukan | Rate limit persisten, respons umum dan tanpa kebocoran akun |
| T50 | Operasi auth tidak dapat mengakses layanan identitas eksternal | Seluruh lifecycle lokal tetap berfungsi; tidak ada request identitas keluar |

### 25.2 Definition of Done

- Seluruh F01–F20 dan semua entry publik lampiran memiliki mapping implementasi dan tes/penjelasan penggantian.
- Typecheck, lint, build produksi dan tes domain/integrasi/E2E relevan lulus.
- RLS/GRANT, aksi langsung tanpa UI, IDOR, kebocoran service key dan akses file diuji negatif.
- Semua operasi finansial dan lintas entitas atomik/idempotent; concurrency test lulus.
- Rekonsiliasi impor disertai daftar selisih dan keputusan; tidak ada orphan yang disembunyikan.
- PDF/print/XLSX/CSV diperiksa isi dan tata letaknya; tanggal/nominal berbahasa Indonesia.
- Environment/schema secrets tervalidasi, tidak bocor; preview dan produksi terpisah.
- Backup/restore, runbook cron/outbox, bootstrap admin dan rollback tersedia.
- Tidak ada placeholder, tombol tanpa aksi, data dummy tersamar, maupun klaim “semua berfungsi” tanpa hasil uji.

## 26. Environment dan operasi target

Contoh nama variabel; validasi dengan schema environment server dan sesuaikan kebutuhan runtime internal:

```dotenv
APP_URL=
APP_TIMEZONE=Asia/Jakarta
DATABASE_URL=
AUTH_DATABASE_URL=
SESSION_SECRET=
AUTH_CHALLENGE_HMAC_SECRET=
CRON_SECRET=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
MAIL_PROVIDER=
MAIL_API_KEY=
MAIL_FROM=
```

`AUTH_DATABASE_URL` dan `DATABASE_URL` mengarah ke database SiM-GURU yang sama melalui role autentikasi dan bisnis berprivilege minimum; koneksi migrasi administratif terpisah. Jangan menjadikan URL autentikasi sebagai variabel publik. `DATABASE_URL` mengikuti driver/pooling runtime dan migrasi menggunakan koneksi yang sesuai; jangan menyalin placeholder password atau alamat dari proyek lain. Kunci publik hanya ditambahkan ke `NEXT_PUBLIC_*` bila benar-benar diperlukan di browser. Secret key Supabase opsional sesuai pola server yang dipilih dan tidak dibundel client. Jangan membuat variabel yang tidak digunakan.

Bootstrap admin harus idempotent: command server terkontrol membuat profil, username unik, hash password Argon2id, role admin dan flag wajib ganti password/aktivasi dalam satu transaksi; hentikan jika target akun berbeda atau sudah ada tanpa kondisi pemulihan yang sah. Kredensial bootstrap diberikan lewat input rahasia/tautan aktivasi, tidak dicetak ke log atau ditanam dalam seed. Jangan memberikan admin kepada pengguna pertama secara otomatis. Health check memisahkan konfigurasi hilang, database autentikasi/bisnis tidak tersedia dan email gagal tanpa membocorkan nilainya.

Log mencakup requestId/jobId, actor ID internal, entity, hasil dan latency; nominal sensitif dibatasi. Dashboard operasi menunjukkan job gagal, outbox tertunda, finalisasi terakhir dan hasil impor. Hindari log password/token/email body.

## 27. Prompt implementasi yang dapat digunakan kembali

> Anda adalah pengembang aplikasi full stack. Bangun ulang SiM-GURU dengan Next.js App Router + TypeScript strict + Vercel + Tailwind CSS + shadcn/ui + Zod + Supabase PostgreSQL/Storage. Gunakan dokumen ini sebagai spesifikasi utama dan commit sumber `28014207da58e3d295db5bf09f52b0d7bc26de5b` sebagai bukti perilaku legacy. Jangan mengurangi cakupan menjadi demo CRUD.
>
> Sebelum menulis fitur, buat matriks parity seluruh F01–F20, entry publik backend dan halaman pada lampiran. Tentukan source of truth untuk identitas, policy kontekstual, occurrence tanggal, ledger JTM, engine honor, snapshot final dan job idempotency. Gunakan autentikasi internal SiM-GURU: username unik pada app_users, password_hash Argon2id pada tabel privat, sesi cookie HttpOnly, aktivasi/reset/OTP serta manajemen akun pada database aplikasi sendiri. Tidak membuat integrasi Central SSO atau mengandalkan Supabase Auth. Terapkan pemisahan privilege autentikasi/bisnis dan policy akses yang sesuai sesi lokal.
>
> Implementasikan bertahap sesuai bagian 24. Setiap mutasi memiliki autentikasi/otorisasi per resource, schema Zod server, constraint database, transaksi yang benar dan audit. Gunakan satu engine JTM/transport/honor untuk seluruh tampilan dan finalisasi. Terapkan koreksi B01–B24, pertahankan data honor historis apa adanya, dan jangan mereplikasi bug untuk mencapai kesamaan angka yang keliru.
>
> Pertahankan seluruh operasi jurnal hari H/H-1, rekap siswa, piket/upacara/substitusi, ujian/panitia/pengawas/BAP, penyesuaian dan multi-alokasi JTM, attendance/jam/izin/template/extra attendee, acara/jurnal, bonus libur, transport, tunjangan, finalisasi, slip/verifikasi/ekspor, pengumuman/blok/maintenance, OTP/pemulihan internal dan reset admin lokal, email dan scheduler. Seluruh teks antarmuka dan dokumen berbahasa Indonesia.
>
> Buat migrations, seed aman, fixtures, dokumentasi environment/API/provisioning/migrasi/operasi dan bukti pengujian. Jalankan T01–T50; T41 kalender dijelaskan pada Lampiran A.2. Sertakan tes lifecycle kredensial privat dan sesi lokal. Laporan tiap tahap menyebut fitur selesai, verifikasi yang benar-benar dijalankan, risiko/keterbatasan dan pekerjaan belum selesai. Jangan mengklaim kompatibilitas produksi tanpa data rekonsiliasi dan uji alur nyata. Jangan deploy ke produksi atau menulis data produksi sebagai bagian pembuatan fondasi.

## 28. Referensi teknis resmi

Rujukan ini mendukung rancangan target; bukan bukti fitur legacy:

- [Next.js — Authentication](https://nextjs.org/docs/app/guides/authentication): autentikasi, sesi, otorisasi dan data-access layer.
- [Next.js — Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data): verifikasi akses pada Server Functions.
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): policy, role dan bypass.
- [Supabase — Securing your data](https://supabase.com/docs/guides/database/secure-data): perlindungan kunci secret/service role.
- [OWASP — Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): penyimpanan password dengan Argon2id.
- [OWASP — Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): token sekali pakai, kedaluwarsa dan pemulihan akun.
- [OWASP — Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): sesi server dan cookie.
- [Vercel — Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs): autentikasi, concurrency dan idempotensi.
- [Vercel — Cron quickstart](https://vercel.com/docs/cron-jobs/quickstart): konfigurasi jadwal UTC.

## Lampiran A. Konfigurasi dan detail tambahan yang tidak boleh hilang

### A.1 Jenjang, kelas dan durasi

Konfigurasi antarmuka sumber memakai `tingkatan` SD/SMP/SMA/SMK yang juga merepresentasikan MI/MTs/MA/MAK, `use_parallel`, `parallel_max`, `tahun_pelajaran`, `semester`, `waktu_per_jtm`, `app_version`, `kepala_sekolah`, `base_salary` dan `std_kelas_<nama>`.

| Jenjang sumber | Batas paralel | Maksimum siswa/rombel pada UI sumber |
|---|---|---|
| SD/MI | A–D | 28 |
| SMP/MTs | A–K | 32 |
| SMA/MA | A–L | 36 |
| SMK/MAK | A–X | 36 |

Saat paralel aktif, nilai rombel positif minimal 15; nilai 0 tetap diperbolehkan untuk kelas yang belum diisi. Ketika jenjang berubah, pilihan huruf paralel di-clamp ke maksimum jenjang. Angka ini merupakan kebijakan aplikasi sumber, **bukan pernyataan regulasi pendidikan terkini**. Target mempertahankan konfigurasi tersebut dengan validasi server dan menyediakan penyesuaian terkontrol.

Waktu akhir pratinjau jadwal sumber dihitung `mulai + JTM × waktu_per_jtm + istirahat_menit`, default waktu per JTM 40 menit. Target menolak overflow melewati hari untuk jadwal intrahari, bukan memakai modulo 24 diam-diam. JTM tetap field bisnis terpisah dari durasi aktual.

Setting nama sekolah ditemukan dengan alias `school_name`, `app_school_name`, `app_name`; normalisasikan ke satu setting kanonis sambil menyimpan nilai lama untuk rekonsiliasi. Maintenance memakai `maintenance_mode`, `maintenance_message`, `maintenance_scheduled`, `maintenance_start`, `maintenance_end`.

### A.2 Tambahan temuan kalender (B25)

`_notifIsHoliday_` pada sumber menganggap setiap tanggal yang terdapat di Academic_Calendar sebagai libur tanpa memeriksa `is_holiday`, sedangkan bonus libur memeriksa flag tersebut. Akibatnya kalender nonlibur dapat menghentikan reminder atau dianggap menonaktifkan kegiatan secara tidak konsisten. Target membedakan tanggal kalender biasa dari libur dengan flag yang benar melalui DayContext tunggal. Tambahkan T41: kalender `is_holiday=false` tidak mematikan KBM/ujian/reminder. Rujukan B01–B24 pada bagian utama diperluas mencakup B25 dan uji T01–T40 diperluas dengan T41 ini.

### A.3 Batas pemakaian lampiran otomatis

Indeks berikut mencakup seluruh deklarasi fungsi backend tingkat atas pada commit sumber. Atribut input dan akses sheet diekstrak secara leksikal, sehingga mencakup referensi langsung yang terdeteksi, **bukan** jaminan daftar dependensi transitif lengkap. Referensi helper, data dinamis, callback, scope lokal dan alias perlu ditelusuri ketika implementasi. Tidak adanya sheet/atribut pada satu baris tidak membuktikan fungsi tidak membaca/menulis data.

## Lampiran B. Indeks lengkap fungsi backend

Gunakan tautan commit per fungsi untuk membuka sumber yang tepat. Setiap entry wajib diberi mapping ke layanan baru atau alasan penggantian oleh fasilitas framework. Fungsi bertanda underscore adalah helper secara konvensi; tidak berarti aman dipanggil publik.

| Fungsi dan parameter | Baris sumber | Atribut input langsung | Sheet/tabel langsung yang terdeteksi |
|---|---|---|---|
| `_validateEventDefinition(payload)` | [L40](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L40) | `jtm_val`, `name`, `time_end`, `time_start` | Melalui helper/konteks atau tidak ada |
| `_authorizeEventWriter(user)` | [L85](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L85) | — | Melalui helper/konteks atau tidak ada |
| `_computeEventJtm(attendanceRecords)` | [L88](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L88) | — | Melalui helper/konteks atau tidak ada |
| `_computeTransportDates(regularDates, eventAttendanceRecords)` | [L99](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L99) | — | Melalui helper/konteks atau tidak ada |
| `_authorizeAttendanceWriter(user, isPicketConfirmed)` | [L114](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L114) | — | Melalui helper/konteks atau tidak ada |
| `_jtmValidateAdjusted(scheduledJtm, rawAdjusted)` | [L134](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L134) | — | Melalui helper/konteks atau tidak ada |
| `_jtmComputeDifference(scheduledJtm, adjustedJtm)` | [L168](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L168) | — | Melalui helper/konteks atau tidak ada |
| `_jtmValidateReason(adjustedJtm, scheduledJtm, rawReason)` | [L172](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L172) | — | Melalui helper/konteks atau tidak ada |
| `_jtmValidateAllocation( rawAllocation, originalUserId, substituteUserId, isSubstituteAdmin, )` | [L203](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L203) | — | Melalui helper/konteks atau tidak ada |
| `_jtmCheckConservation( scheduledJtm, adjustedJtm, existingAllocations, newAllocation, )` | [L244](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L244) | — | Melalui helper/konteks atau tidak ada |
| `_jtmAuthorizeKbm(user, isPicketToday, todayDate, occurrenceDate)` | [L275](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L275) | — | Melalui helper/konteks atau tidak ada |
| `_jtmAuthorizeExam(authResult, todayDate, sessionDate)` | [L298](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L298) | — | Melalui helper/konteks atau tidak ada |
| `doSetup()` | [L318](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L318) | — | Melalui helper/konteks atau tidak ada |
| `getStudentAttendancePageData(token)` | [L595](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L595) | — | `"Schedules"`, `"Student_Attendance"` |
| `saveStudentAttendance(token, payload)` | [L658](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L658) | `alpa`, `class_name`, `hadir`, `izin`, `sakit` | `"Student_Attendance"` |
| `checkStudentAttendanceToday(token)` | [L720](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L720) | — | `"Schedules"`, `"Student_Attendance"` |
| `getStudentAttendanceHistory(token, params)` | [L764](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L764) | — | `"Student_Attendance"`, `"Users"` |
| `createSheetIfNeeded_(ss, sheetName, headers)` | [L818](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L818) | — | Melalui helper/konteks atau tidak ada |
| `getDbId()` | [L837](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L837) | — | Melalui helper/konteks atau tidak ada |
| `getSheet(name)` | [L847](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L847) | — | Melalui helper/konteks atau tidak ada |
| `getData(sheetName)` | [L858](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L858) | `length`, `slice` | Melalui helper/konteks atau tidak ada |
| `findData(sheetName, key, value)` | [L904](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L904) | — | Melalui helper/konteks atau tidak ada |
| `generateId(prefix)` | [L908](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L908) | — | Melalui helper/konteks atau tidak ada |
| `formatRupiah(num)` | [L911](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L911) | — | Melalui helper/konteks atau tidak ada |
| `formatDateIndo(dateInput)` | [L920](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L920) | — | Melalui helper/konteks atau tidak ada |
| `loginUser(username, password)` | [L943](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L943) | — | `"Config"`, `"Sessions"`, `"Users"` |
| `logoutUser(token)` | [L1035](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1035) | `length` | `"Sessions"` |
| `verifySession(token)` | [L1046](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1046) | `find` | `"Sessions"`, `"Users"` |
| `checkSessionStatus(token)` | [L1057](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1057) | — | Melalui helper/konteks atau tidak ada |
| `updateUserProfile(token, payload)` | [L1067](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1067) | `full_name`, `new_password`, `old_password`, `phone` | `"Users"` |
| `updateGuruProfileDetails(token, payload)` | [L1142](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1142) | `alamat`, `golongan`, `status_kepegawaian` | `"Users"` |
| `getMyProfile(token)` | [L1164](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1164) | — | `"Allowances"`, `"Config"`, `"Schedules"`, `"Users"` |
| `_ensureUserColumn_(sheetObj, headerName, defaultPos)` | [L1229](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1229) | — | Melalui helper/konteks atau tidak ada |
| `_normalizePhoneNumber_(input)` | [L1244](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1244) | — | Melalui helper/konteks atau tidak ada |
| `requestEmailOTP(token, newEmail)` | [L1279](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1279) | — | `"Users"` |
| `verifyEmailOTP(token, newEmail, otpCode)` | [L1384](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1384) | `attempts`, `code`, `email`, `expires` | `"Users"` |
| `_isValidEmail_(s)` | [L1481](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1481) | — | Melalui helper/konteks atau tidak ada |
| `_escHtml_(s)` | [L1485](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1485) | — | Melalui helper/konteks atau tidak ada |
| `_notifGetEmail_(userId)` | [L1492](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1492) | — | `"Users"` |
| `_notifGetName_(userId)` | [L1509](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1509) | — | `"Users"` |
| `_notifBuildHtml_(opts)` | [L1519](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1519) | — | Melalui helper/konteks atau tidak ada |
| `_notifSend_(toEmail, subject, htmlBody, textBody)` | [L1606](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1606) | — | Melalui helper/konteks atau tidak ada |
| `_notifToUser_(userId, subject, htmlBody, textBody)` | [L1625](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1625) | — | Melalui helper/konteks atau tidak ada |
| `_notifIsHoliday_(dateStr)` | [L1630](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1630) | — | `"Academic_Calendar"` |
| `_notifIsKbmEnabled_(dateStr)` | [L1651](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1651) | — | Melalui helper/konteks atau tidak ada |
| `_notifIsTeachingDay_(dateStr)` | [L1661](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1661) | — | Melalui helper/konteks atau tidak ada |
| `_notifIsExamEnabled_(dateStr)` | [L1672](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1672) | — | `EXAM_SHEET.PERIODS` |
| `_notifPicketConfirmed_(userId, opts)` | [L1687](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1687) | — | Melalui helper/konteks atau tidak ada |
| `_notifPicketRevoked_(userId)` | [L1715](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1715) | — | Melalui helper/konteks atau tidak ada |
| `_notifPicketSubstituted_(originalUserId, substituteUserId)` | [L1737](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1737) | — | Melalui helper/konteks atau tidak ada |
| `_notifPicketSubCancelled_(substituteUserId)` | [L1778](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1778) | — | Melalui helper/konteks atau tidak ada |
| `_notifKbmConfirmed_(userId, opts)` | [L1800](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1800) | — | Melalui helper/konteks atau tidak ada |
| `_notifKbmRevoked_(userId, opts)` | [L1823](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1823) | — | Melalui helper/konteks atau tidak ada |
| `_notifKbmSubstituted_( originalUserId, substituteUserId, scheduleInfo, byName, )` | [L1847](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1847) | — | Melalui helper/konteks atau tidak ada |
| `_notifKbmSubCancelled_(substituteUserId, scheduleInfo, byName)` | [L1897](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1897) | — | Melalui helper/konteks atau tidak ada |
| `_notifAutoJurnalLiburGenerated_( generatedLogs, dateStr, holidayDesc, actorName, )` | [L1920](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1920) | — | Melalui helper/konteks atau tidak ada |
| `_notifCommitteeConfirmed_(userId, dateStr)` | [L2064](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2064) | — | Melalui helper/konteks atau tidak ada |
| `_notifCommitteeRevoked_(userId, dateStr)` | [L2083](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2083) | — | Melalui helper/konteks atau tidak ada |
| `_notifCommitteeSubstituted_( originalUserId, substituteUserId, dateStr, )` | [L2102](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2102) | — | Melalui helper/konteks atau tidak ada |
| `_notifCommitteeSubCancelled_(substituteUserId, dateStr)` | [L2144](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2144) | — | Melalui helper/konteks atau tidak ada |
| `_notifSupervisorConfirmed_(userId, dateStr, byName, sessionInfo)` | [L2163](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2163) | — | Melalui helper/konteks atau tidak ada |
| `_notifSupervisorRevoked_(userId, dateStr, byName, sessionInfo)` | [L2186](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2186) | — | Melalui helper/konteks atau tidak ada |
| `_notifSupervisorSubstituted_( originalUserId, substituteUserId, dateStr, byName, sessionInfo, )` | [L2208](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2208) | — | Melalui helper/konteks atau tidak ada |
| `_notifSupervisorSubCancelled_( substituteUserId, dateStr, byName, sessionInfo, )` | [L2261](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2261) | — | Melalui helper/konteks atau tidak ada |
| `_notifTodayID_()` | [L2288](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2288) | — | Melalui helper/konteks atau tidak ada |
| `_notifFmtTime_(val)` | [L2291](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2291) | — | Melalui helper/konteks atau tidak ada |
| `_notifResolveDate_(value)` | [L2308](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2308) | — | Melalui helper/konteks atau tidak ada |
| `_notifFmtDate_(value)` | [L2345](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2345) | — | Melalui helper/konteks atau tidak ada |
| `_notifFmtDateLong_(value)` | [L2368](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2368) | — | Melalui helper/konteks atau tidak ada |
| `_notifFmtDateTime_(value)` | [L2401](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2401) | — | Melalui helper/konteks atau tidak ada |
| `_notifFmtDateLongTime_(value)` | [L2410](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2410) | — | Melalui helper/konteks atau tidak ada |
| `_checkPasswordComplexity(password, fullName, username)` | [L2418](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2418) | — | Melalui helper/konteks atau tidak ada |
| `_extUsersSheet_()` | [L2458](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2458) | — | Melalui helper/konteks atau tidak ada |
| `_extFindUserRow_(username)` | [L2463](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2463) | `length` | Melalui helper/konteks atau tidak ada |
| `_extGetPassword_(username)` | [L2474](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2474) | — | Melalui helper/konteks atau tidak ada |
| `_extSetPassword_(username, newPassword)` | [L2478](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2478) | `length` | Melalui helper/konteks atau tidak ada |
| `_extAddUser_(username, password)` | [L2491](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2491) | — | Melalui helper/konteks atau tidak ada |
| `_extUpdateUsername_(oldUsername, newUsername)` | [L2498](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2498) | `length` | Melalui helper/konteks atau tidak ada |
| `_extDeleteUser_(username)` | [L2511](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2511) | `length` | Melalui helper/konteks atau tidak ada |
| `getAllSchedulesAdmin(token)` | [L2524](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2524) | — | `"Schedules"`, `"Users"` |
| `saveScheduleAdmin(token, data)` | [L2564](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2564) | `class_name`, `day_index`, `id`, `jtm_val`, `semester`, `subject`, `tahun_pelajaran`, `time_end`, `time_start`, `user_id` | `"Schedules"` |
| `deleteScheduleAdmin(token, id)` | [L2604](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2604) | — | Melalui helper/konteks atau tidak ada |
| `deleteMultipleSchedulesAdmin(token, ids)` | [L2607](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2607) | — | Melalui helper/konteks atau tidak ada |
| `getMyWeeklyData(token)` | [L2627](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2627) | — | `"Allowances"`, `"Ceremony_Schedules"`, `"Config"`, `"Picket_Schedules"`, `"Schedules"`, `"Teaching_Logs"` |
| `getDayName(index)` | [L2739](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2739) | — | Melalui helper/konteks atau tidak ada |
| `saveTeachingJournal(token, data)` | [L2743](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2743) | `date`, `material`, `notes`, `schedule_id`, `siswa_absen`, `siswa_hadir` | `"Config"`, `"Daily_Attendance"`, `"Schedules"`, `"Student_Attendance"`, `"Substitutes"`, `"Teaching_Logs"` |
| `getClassExpectedStudents(token, scheduleId)` | [L2989](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2989) | — | `"Config"`, `"Schedules"` |
| `getPicketRekapForDate(token, scheduleId, dateStr)` | [L3012](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3012) | — | `"Schedules"`, `"Student_Attendance"` |
| `updateTeachingLog(token, payload)` | [L3050](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3050) | `log_id`, `material`, `notes`, `siswa_absen`, `siswa_hadir` | `"Config"`, `"Schedules"`, `"Student_Attendance"`, `"Teaching_Logs"` |
| `getSettingsMasterData(token)` | [L3177](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3177) | — | `"Academic_Calendar"`, `"Allowances"`, `"Config"`, `"Subjects"`, `"Users"` |
| `saveSystemConfig(token, data)` | [L3225](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3225) | — | `"Config"` |
| `saveSubject(token, data)` | [L3263](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3263) | `id`, `name` | `"Subjects"` |
| `deleteSubject(token, id)` | [L3299](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3299) | — | Melalui helper/konteks atau tidak ada |
| `saveAllowance(token, data)` | [L3302](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3302) | `amount`, `duty_name`, `id`, `user_id` | `"Allowances"` |
| `deleteAllowance(token, id)` | [L3330](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3330) | — | Melalui helper/konteks atau tidak ada |
| `addHoliday(token, date, desc, isHoliday, id)` | [L3333](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3333) | `length` | `"Academic_Calendar"` |
| `deleteHoliday(token, id)` | [L3373](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3373) | `length` | `"Academic_Calendar"` |
| `deleteRowById(token, sheetName, id)` | [L3402](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3402) | `length` | Melalui helper/konteks atau tidak ada |
| `_annBool_(v)` | [L3419](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3419) | — | Melalui helper/konteks atau tidak ada |
| `_annDateOnly_(v)` | [L3425](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3425) | — | Melalui helper/konteks atau tidak ada |
| `_annParseIdList_(v)` | [L3441](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3441) | — | Melalui helper/konteks atau tidak ada |
| `_annStringifyIdList_(arr)` | [L3468](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3468) | — | Melalui helper/konteks atau tidak ada |
| `_annEnsureSheet_()` | [L3480](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3480) | — | Melalui helper/konteks atau tidak ada |
| `getActiveAnnouncementsForUser(token)` | [L3534](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3534) | — | `SHEET_NAME.ANNOUNCEMENTS` |
| `listAnnouncementsAdmin(token)` | [L3595](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3595) | — | `SHEET_NAME.ANNOUNCEMENTS` |
| `saveAnnouncement(token, data)` | [L3633](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3633) | `body`, `cta_text`, `cta_url`, `dismissible_user_ids`, `ends_at`, `id`, `is_active`, `is_dismissible`, `nondismissible_user_ids`, `send_email_notification`, `severity`, `starts_at`, `target_role`, `target_user_ids`, `title` | `"Users"` |
| `toggleAnnouncement(token, id, isActive)` | [L3841](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3841) | — | Melalui helper/konteks atau tidak ada |
| `deleteAnnouncement(token, id)` | [L3865](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3865) | — | Melalui helper/konteks atau tidak ada |
| `getBlokJurnal(token)` | [L3871](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3871) | — | `SHEET_NAME.BLOK_JURNAL` |
| `simpanBlokJurnal(token, data)` | [L3898](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3898) | `aktif`, `id`, `mataPelajaran`, `pesan`, `tanggalMulai`, `tanggalSelesai` | `SHEET_NAME.BLOK_JURNAL` |
| `hapusBlokJurnal(token, id)` | [L3948](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3948) | — | Melalui helper/konteks atau tidak ada |
| `cekBlokJurnal(token, mataPelajaran, tanggal)` | [L3960](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3960) | — | `SHEET_NAME.BLOK_JURNAL` |
| `getBlokAcara(token)` | [L3997](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3997) | `map` | `SHEET_NAME.BLOK_ACARA` |
| `simpanBlokAcara(token, data)` | [L4020](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4020) | `aktif`, `id`, `pesan`, `tanggalMulai`, `tanggalSelesai`, `tipeAcara` | `SHEET_NAME.BLOK_ACARA` |
| `hapusBlokAcara(token, id)` | [L4065](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4065) | — | `SHEET_NAME.BLOK_ACARA` |
| `cekBlokAcara(token, tipeAcara, tanggal)` | [L4087](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4087) | `length` | `SHEET_NAME.BLOK_ACARA` |
| `isTransportBlocked(tanggal)` | [L4118](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4118) | — | Melalui helper/konteks atau tidak ada |
| `_loadBlokTransportActive()` | [L4134](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4134) | — | `SHEET_NAME.BLOK_TRANSPORT` |
| `_isDateBlockedByList(dateStr, blokList)` | [L4152](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4152) | — | Melalui helper/konteks atau tidak ada |
| `getBlokTransport(token)` | [L4167](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4167) | `map` | `SHEET_NAME.BLOK_TRANSPORT` |
| `simpanBlokTransport(token, data)` | [L4195](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4195) | `aktif`, `id`, `keterangan`, `tanggalMulai`, `tanggalSelesai` | `SHEET_NAME.BLOK_TRANSPORT` |
| `hapusBlokTransport(token, id)` | [L4247](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4247) | — | `SHEET_NAME.BLOK_TRANSPORT` |
| `checkAndSendAnnouncementEmails()` | [L4275](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4275) | `length` | `"Users"` |
| `installAnnouncementTrigger()` | [L4421](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4421) | — | Melalui helper/konteks atau tidak ada |
| `doGet(e)` | [L4440](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4440) | — | `"Config"` |
| `_sidebar()` | [L4465](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4465) | — | Melalui helper/konteks atau tidak ada |
| `_navbar()` | [L5149](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L5149) | — | Melalui helper/konteks atau tidak ada |
| `_footer()` | [L5305](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L5305) | — | Melalui helper/konteks atau tidak ada |
| `_modal()` | [L5443](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L5443) | — | Melalui helper/konteks atau tidak ada |
| `getPageContent(pageName)` | [L7425](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L7425) | — | Melalui helper/konteks atau tidak ada |
| `getDashboardStats(token)` | [L15165](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15165) | — | Melalui helper/konteks atau tidak ada |
| `_calculateMonthlyBonusFast_Detailed(userId, month, year, snapshot)` | [L15334](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15334) | — | Melalui helper/konteks atau tidak ada |
| `_getIndoDayIndex()` | [L15389](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15389) | — | Melalui helper/konteks atau tidak ada |
| `_getConfigMap()` | [L15395](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15395) | `forEach` | `"Config"` |
| `getTodaySchedule(token)` | [L15401](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15401) | — | Melalui helper/konteks atau tidak ada |
| `deleteTeachingLog(token, id)` | [L15585](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15585) | `length` | `"Teaching_Logs"` |
| `getAdminDashboardData_V2(token)` | [L15617](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15617) | — | Melalui helper/konteks atau tidak ada |
| `getAdminDailyAttendance(token)` | [L15800](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15800) | — | Melalui helper/konteks atau tidak ada |
| `getAdminDailyAttendanceHistory(token, dateStr)` | [L15871](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15871) | — | `"Daily_Attendance"`, `"Users"` |
| `_attendanceScheduleColIndex_(sheet)` | [L15999](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15999) | — | Melalui helper/konteks atau tidak ada |
| `confirmTeacherPresence(token, targetUserId, scheduleId)` | [L16014](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16014) | — | `"Daily_Attendance"` |
| `revokeTeacherPresence(token, targetUserId, scheduleId)` | [L16068](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16068) | — | `"Daily_Attendance"` |
| `getPicketPageData(token)` | [L16126](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16126) | — | `"Ceremony_Schedules"`, `"Daily_Attendance"`, `"Picket_Schedules"`, `"Schedules"`, `"Substitutes"`, `"Teaching_Logs"`, `"Users"` |
| `_isPicketOfficer(user)` | [L16372](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16372) | — | `"Picket_Schedules"`, `"Substitutes"`, `"Teaching_Logs"` |
| `_hasTimeInToday(userId)` | [L16418](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16418) | — | `"Daily_Attendance"` |
| `savePicketSchedule(token, data)` | [L16427](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16427) | `day_index`, `user_id` | `"Picket_Schedules"`, `"Users"` |
| `revokePicketDaily(token, userId)` | [L16465](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16465) | — | `"Daily_Attendance"`, `"Teaching_Logs"` |
| `substitutePicketDaily(token, originalUserId, substituteUserId)` | [L16527](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16527) | — | `"Picket_Schedules"`, `"Substitutes"`, `"Users"` |
| `cancelPicketSubstituteAttendance(token, logId)` | [L16625](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16625) | — | `"Daily_Attendance"`, `"Teaching_Logs"` |
| `deletePicketSchedule(token, id)` | [L16686](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16686) | — | Melalui helper/konteks atau tidak ada |
| `confirmPicketDaily(token, userId)` | [L16689](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16689) | — | `"Picket_Schedules"`, `"Substitutes"`, `"Teaching_Logs"` |
| `confirmPicketSubPresenceBackend(token, targetUserId)` | [L16771](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16771) | — | `"Daily_Attendance"` |
| `getPicketStatus(token)` | [L16807](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16807) | — | `"Picket_Schedules"` |
| `calculateMonthlyBonus(userId, month, year)` | [L16818](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16818) | — | Melalui helper/konteks atau tidak ada |
| `getAvailableHonorPeriods(token)` | [L16822](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16822) | — | `"Honor_History"` |
| `_sendHonorariumEmail( user, periodId, finalJtm, totalAllow, grandTotal, allowancesInfo, transportTotal = 0, kbmJtm = 0, bonusJtm = 0, eventJtm = 0, )` | [L16853](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16853) | — | Melalui helper/konteks atau tidak ada |
| `_processHonorariumFinalization(useMonth, useYear)` | [L17008](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17008) | — | `"Allowances"`, `"Honor_History"`, `"Schedules"`, `"Teaching_Logs"`, `"Users"`, `EVENT_SHEET.ATTENDANCE` |
| `saveMonthlyHonorarium(token, targetMonth, targetYear)` | [L17169](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17169) | — | Melalui helper/konteks atau tidak ada |
| `autoFinalizeHonorarium()` | [L17184](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17184) | — | Melalui helper/konteks atau tidak ada |
| `setupAutoFinalizeTrigger()` | [L17194](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17194) | — | Melalui helper/konteks atau tidak ada |
| `getMyHonorariumData(token, period)` | [L17208](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17208) | — | `EVENT_SHEET.ATTENDANCE` |
| `_calculateMonthlyBonusFast(userId, month, year, snapshot)` | [L17583](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17583) | — | Melalui helper/konteks atau tidak ada |
| `getAdminHonorRecap(token, targetMonth, targetYear)` | [L17627](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17627) | — | Melalui helper/konteks atau tidak ada |
| `getHonorariumHistoryGuru(token)` | [L17785](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17785) | — | Melalui helper/konteks atau tidak ada |
| `getHonorariumHistoryAdmin(token)` | [L17853](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17853) | `length`, `push`, `sort` | Melalui helper/konteks atau tidak ada |
| `getAllUsers(token)` | [L17931](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17931) | — | `"Users"` |
| `_validateKmDistance_(raw)` | [L17946](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17946) | — | Melalui helper/konteks atau tidak ada |
| `_validateAdditionalRole_(raw)` | [L17978](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17978) | — | Melalui helper/konteks atau tidak ada |
| `saveUser(token, data)` | [L17991](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17991) | `additional_role`, `full_name`, `id`, `km_distance`, `nip`, `password`, `role`, `username` | `"Users"` |
| `deleteUser(token, id)` | [L18110](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18110) | — | `"Users"` |
| `resetUserPassword(token, id)` | [L18122](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18122) | — | `"Users"` |
| `getConfigValue(key)` | [L18148](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18148) | — | `"Config"` |
| `savePdfToDrive(base64, filename)` | [L18153](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18153) | — | Melalui helper/konteks atau tidak ada |
| `getAdminJournalHistory( token, page, limit, filterDateFrom, filterDateTo, filterGuru, filterClass, )` | [L18168](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18168) | — | `"Schedules"`, `"Teaching_Logs"`, `"Users"` |
| `saveCeremonySchedule(token, date, userId)` | [L18392](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18392) | — | `"Ceremony_Schedules"`, `"Config"`, `SHEET_NAME.CEREMONY_SCHEDULES` |
| `deleteCeremonySchedule(token, id)` | [L18438](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18438) | — | Melalui helper/konteks atau tidak ada |
| `confirmCeremonyLeader(token, userId)` | [L18441](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18441) | — | `"Teaching_Logs"` |
| `revokeCeremonyLeader(token, userId)` | [L18484](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18484) | — | `"Teaching_Logs"` |
| `substituteCeremonyLeader(token, subId)` | [L18511](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18511) | — | `"Ceremony_Schedules"`, `"Teaching_Logs"`, `"Users"` |
| `assignSubstitute(token, scheduleId, subId)` | [L18589](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18589) | — | `"Schedules"`, `"Substitutes"`, `"Users"` |
| `replaceSubstitute(token, scheduleId, newSubId)` | [L18670](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18670) | — | Melalui helper/konteks atau tidak ada |
| `revokeSubstitute(token, scheduleId)` | [L18703](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18703) | — | `"Daily_Attendance"`, `"Picket_Schedules"`, `"Schedules"`, `"Substitutes"`, `"Teaching_Logs"`, `"Users"` |
| `getTodaySubstitutes(token)` | [L18851](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18851) | — | `"Daily_Attendance"`, `"Schedules"`, `"Substitutes"`, `"Users"` |
| `safeDate(val)` | [L18919](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18919) | — | Melalui helper/konteks atau tidak ada |
| `safeTime(val)` | [L18925](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18925) | — | Melalui helper/konteks atau tidak ada |
| `verifyForgotSecurityAnswer(username, securityAnswer)` | [L18931](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18931) | — | `"Users"` |
| `_issueForgotResetToken_(username, method)` | [L18976](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18976) | — | Melalui helper/konteks atau tidak ada |
| `_consumeForgotResetToken_(resetToken)` | [L18990](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18990) | `expires`, `method`, `username` | Melalui helper/konteks atau tidak ada |
| `getForgotMethods(username)` | [L19029](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19029) | — | `"Users"` |
| `_maskEmail_(email)` | [L19044](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19044) | — | Melalui helper/konteks atau tidak ada |
| `requestForgotPasswordOTP(username)` | [L19057](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19057) | — | `"Users"` |
| `requestPasswordResetByOTP(username, otpCode)` | [L19160](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19160) | `attempts`, `code`, `expires` | `"Users"` |
| `resetPasswordWithToken(resetToken, newPassword)` | [L19225](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19225) | — | `"Reset_Requests"`, `"Users"` |
| `getSecurityQuestion(username)` | [L19343](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19343) | — | `"Users"` |
| `getMySecurityQuestion(token)` | [L19356](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19356) | — | Melalui helper/konteks atau tidak ada |
| `saveSecurityQuestion(token, question, answer)` | [L19362](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19362) | — | `"Users"` |
| `getResetRequests(token)` | [L19403](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19403) | — | `"Reset_Requests"` |
| `approveResetRequest(token, requestId, username)` | [L19434](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19434) | — | `"Reset_Requests"`, `"Users"` |
| `getPendingResetCount(token)` | [L19451](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19451) | — | `"Reset_Requests"` |
| `validateDocument(trxId)` | [L19459](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19459) | — | `"Config"`, `"Honor_History"`, `"Users"` |
| `getGuruJournalHistoryPaginated( token, page, limit, filterDateFrom, filterDateTo, searchQuery, )` | [L19524](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19524) | — | `"Schedules"`, `"Teaching_Logs"` |
| `generateAutoJurnalForHoliday(token, targetDate)` | [L19748](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19748) | — | Melalui helper/konteks atau tidak ada |
| `_runAutoJurnalForHoliday_(actorUserId, actorName, targetDate)` | [L19757](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19757) | — | `"Academic_Calendar"`, `"Ceremony_Schedules"`, `"Config"`, `"Picket_Schedules"`, `"Schedules"`, `"System_Locks"`, `"Teaching_Logs"` |
| `checkAutoJurnalStatus(token, targetDate)` | [L20127](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20127) | — | `"Academic_Calendar"`, `"Config"`, `"Schedules"`, `"System_Locks"`, `"Teaching_Logs"` |
| `cancelAutoJurnalForHoliday(token, targetDate)` | [L20238](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20238) | — | `"Schedules"`, `"System_Locks"`, `"Teaching_Logs"`, `"Users"` |
| `runAutoJurnalScheduler()` | [L20365](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20365) | — | `"Academic_Calendar"` |
| `installAutoJurnalScheduler()` | [L20415](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20415) | — | Melalui helper/konteks atau tidak ada |
| `uninstallAutoJurnalScheduler()` | [L20439](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20439) | — | Melalui helper/konteks atau tidak ada |
| `getAutoJurnalSchedulerStatus(token)` | [L20458](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20458) | — | Melalui helper/konteks atau tidak ada |
| `installAutoJurnalSchedulerByAdmin(token)` | [L20483](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20483) | — | Melalui helper/konteks atau tidak ada |
| `uninstallAutoJurnalSchedulerByAdmin(token)` | [L20493](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20493) | — | Melalui helper/konteks atau tidak ada |
| `runReminderScheduler()` | [L20503](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20503) | — | Melalui helper/konteks atau tidak ada |
| `_reminderMissingJournal_(dateStr)` | [L20544](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20544) | `events`, `kbm` | `"Schedules"`, `"Substitutes"`, `"Teaching_Logs"`, `EVENT_SHEET.ATTENDANCE`, `EVENT_SHEET.DEFINITIONS` |
| `_reminderMissingBap_(dateStr)` | [L20768](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20768) | — | `EXAM_SHEET.BAP`, `EXAM_SHEET.PERIODS`, `EXAM_SHEET.ROOMS`, `EXAM_SHEET.SESSIONS`, `EXAM_SHEET.SUPERVISORS` |
| `_reminderPendingKbm_(dateStr)` | [L20875](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20875) | — | `"Daily_Attendance"`, `"Picket_Schedules"`, `"Schedules"`, `"Substitutes"`, `"Teaching_Logs"`, `"Users"` |
| `_reminderPendingSupervisor_(dateStr)` | [L20995](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20995) | — | `"Users"`, `EXAM_SHEET.COMMITTEE`, `EXAM_SHEET.PERIODS`, `EXAM_SHEET.ROOMS`, `EXAM_SHEET.SESSIONS`, `EXAM_SHEET.SUPERVISORS` |
| `formatPeriode(periodeValue)` | [L21097](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L21097) | — | Melalui helper/konteks atau tidak ada |
| `getPeriodeSortKey(periodeValue)` | [L21148](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L21148) | — | Melalui helper/konteks atau tidak ada |
| `_invalidateDataSnapshot()` | [L21185](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L21185) | — | Melalui helper/konteks atau tidak ada |
| `_getDataSnapshot(forceRefresh = false)` | [L21189](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L21189) | — | `"Academic_Calendar"`, `"Allowances"`, `"Attendance_Leaves"`, `"Ceremony_Schedules"`, `"Daily_Attendance"`, `"Event_Attendance"`, `"Honor_History"`, `"Picket_Schedules"`, `"Schedules"`, `"Substitutes"`, `"Teaching_Logs"`, `"Users"` |
| `getHonorariumSlipByHistory(token, periode, userId)` | [L21299](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L21299) | — | `"Allowances"`, `"Honor_History"`, `"Users"`, `EVENT_SHEET.ATTENDANCE` |
| `addHolidayRange(token, dateFrom, dateTo, desc, isHoliday)` | [L21524](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L21524) | — | `"Academic_Calendar"` |
| `getAdminDashboardExtendedStats(token)` | [L21561](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L21561) | — | `"Daily_Attendance"`, `"Event_Attendance"`, `"Reset_Requests"`, `"Schedules"`, `"Substitutes"`, `"Teaching_Logs"`, `"Users"`, `EXAM_SHEET.BAP`, `EXAM_SHEET.COMMITTEE`, `EXAM_SHEET.PERIODS`, `EXAM_SHEET.ROOMS`, `EXAM_SHEET.SESSIONS`, `EXAM_SHEET.SUPERVISORS` |
| `getAdminDashboardPicketStatus(token)` | [L21876](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L21876) | — | `"Picket_Schedules"` |
| `adminInputPicketTime(token, payload)` | [L22010](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22010) | `att_id`, `time_in`, `time_out`, `user_id` | `SHEET_NAME.ATTENDANCE` |
| `getGuruTodayScheduleProgress(token)` | [L22110](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22110) | — | `"Daily_Attendance"`, `"Event_Attendance"`, `"Schedules"`, `"Substitutes"`, `"Teaching_Logs"`, `"Users"` |
| `_examNow_()` | [L22374](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22374) | — | Melalui helper/konteks atau tidak ada |
| `_examToday_()` | [L22381](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22381) | — | Melalui helper/konteks atau tidak ada |
| `_examGetSession_(session_id)` | [L22384](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22384) | — | `EXAM_SHEET.SESSIONS` |
| `_examGetRoom_(room_id)` | [L22391](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22391) | — | `EXAM_SHEET.ROOMS` |
| `_examGetRoomsBySession_(session_id)` | [L22397](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22397) | — | `EXAM_SHEET.ROOMS` |
| `_examGetSessionsByPeriod_(period_id)` | [L22402](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22402) | — | `EXAM_SHEET.SESSIONS` |
| `_examDeleteBySet_(sheetName, colIndex, valueSet)` | [L22407](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22407) | `length` | Melalui helper/konteks atau tidak ada |
| `_examDeleteById_(sheetName, id)` | [L22417](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22417) | `length` | Melalui helper/konteks atau tidak ada |
| `_examFormatTime_(val)` | [L22428](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22428) | — | Melalui helper/konteks atau tidak ada |
| `_examCheckSupervisorConflict_(user_id, session_id, exclude_sup_id)` | [L22434](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22434) | — | `EXAM_SHEET.SUPERVISORS` |
| `_examCheckCommitteeConflict_(user_id, date, exclude_com_id)` | [L22453](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22453) | — | `EXAM_SHEET.COMMITTEE` |
| `getExamPeriods(token)` | [L22467](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22467) | — | `EXAM_SHEET.PERIODS` |
| `addExamPeriod(token, data)` | [L22502](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22502) | `date_end`, `date_start`, `description`, `jtm_committee_per_day`, `name` | `EXAM_SHEET.PERIODS` |
| `editExamPeriod(token, data)` | [L22554](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22554) | `date_end`, `date_start`, `description`, `id`, `jtm_committee_per_day`, `name` | `EXAM_SHEET.PERIODS` |
| `deleteExamPeriod(token, id, force)` | [L22621](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22621) | — | `EXAM_SHEET.COMMITTEE`, `EXAM_SHEET.PERIODS`, `EXAM_SHEET.ROOMS`, `EXAM_SHEET.SESSIONS`, `EXAM_SHEET.SUPERVISORS` |
| `addExamSession(token, data)` | [L22694](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22694) | `date`, `jtm_val`, `period_id`, `session_name`, `time_end`, `time_start` | `EXAM_SHEET.PERIODS`, `EXAM_SHEET.SESSIONS` |
| `editExamSession(token, data)` | [L22769](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22769) | `id`, `jtm_val`, `session_name`, `time_end`, `time_start` | `EXAM_SHEET.SESSIONS`, `EXAM_SHEET.SUPERVISORS` |
| `deleteExamSession(token, id)` | [L22839](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22839) | — | `EXAM_SHEET.SUPERVISORS` |
| `addExamRoom(token, data)` | [L22875](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22875) | `class_name`, `room_name`, `session_id`, `subject`, `total_siswa` | `EXAM_SHEET.ROOMS` |
| `editExamRoom(token, data)` | [L22918](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22918) | `class_name`, `id`, `room_name`, `subject`, `total_siswa` | `EXAM_SHEET.ROOMS`, `EXAM_SHEET.SUPERVISORS` |
| `deleteExamRoom(token, id)` | [L22971](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22971) | — | `EXAM_SHEET.SUPERVISORS` |
| `assignExamSupervisor(token, data)` | [L23004](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23004) | `jtm_val`, `room_id`, `user_id` | `"Users"`, `EXAM_SHEET.SUPERVISORS` |
| `editExamSupervisor(token, data)` | [L23059](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23059) | `id`, `jtm_val`, `user_id` | `"Users"`, `EXAM_SHEET.SUPERVISORS` |
| `removeExamSupervisor(token, supervisor_id)` | [L23144](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23144) | — | `EXAM_SHEET.SUPERVISORS` |
| `assignExamCommittee(token, data)` | [L23178](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23178) | `date`, `period_id`, `user_id` | `"Users"`, `EXAM_SHEET.COMMITTEE`, `EXAM_SHEET.PERIODS` |
| `removeExamCommittee(token, committee_id)` | [L23245](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23245) | — | `EXAM_SHEET.COMMITTEE` |
| `getExamAdminMasterData(token)` | [L23278](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23278) | — | `"Users"` |
| `getExamPeriodDetail(token, period_id)` | [L23301](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23301) | — | `"Users"`, `EXAM_SHEET.BAP`, `EXAM_SHEET.COMMITTEE`, `EXAM_SHEET.PERIODS`, `EXAM_SHEET.ROOMS`, `EXAM_SHEET.SESSIONS`, `EXAM_SHEET.SUPERVISORS` |
| `_examAddJtmLog_( scheduleId, userId, date, materi, hadir, absen, jtmVal, refId, )` | [L23426](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23426) | — | `SHEET_NAME.LOGS` |
| `_examDeleteLogByRef_(refId)` | [L23451](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23451) | — | `SHEET_NAME.LOGS` |
| `_examUpdateLogByRef_(refId, hadir, absen)` | [L23464](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23464) | — | `SHEET_NAME.LOGS` |
| `_examGetBap_(supervisor_id)` | [L23477](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23477) | — | `EXAM_SHEET.BAP` |
| `_examIsConfirmedPanitia_(user_id, date)` | [L23484](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23484) | — | `EXAM_SHEET.COMMITTEE` |
| `_isPanitiaStudentAttendanceComplete_(dateStr)` | [L23498](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23498) | — | `"Schedules"`, `"Student_Attendance"` |
| `_isExamSupervisorForDate_(userId, dateStr)` | [L23532](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23532) | — | `EXAM_SHEET.PERIODS`, `EXAM_SHEET.ROOMS`, `EXAM_SHEET.SESSIONS`, `EXAM_SHEET.SUPERVISORS` |
| `_examCheckAdminOrConfirmedPanitia_(user, date)` | [L23555](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23555) | — | Melalui helper/konteks atau tidak ada |
| `_examCheckBapTiming_(sessionDate, timeEnd)` | [L23569](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23569) | — | Melalui helper/konteks atau tidak ada |
| `confirmCommitteeAttendance(token, committee_id)` | [L23595](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23595) | — | `EXAM_SHEET.COMMITTEE`, `EXAM_SHEET.PERIODS` |
| `revokeCommitteeAttendance(token, committee_id)` | [L23667](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23667) | — | `EXAM_SHEET.COMMITTEE` |
| `confirmSupervisorAttendance(token, supervisor_id)` | [L23719](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23719) | — | `EXAM_SHEET.SUPERVISORS` |
| `revokeSupervisorAttendance(token, supervisor_id, force)` | [L23798](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23798) | — | `EXAM_SHEET.SUPERVISORS` |
| `submitExamBAP(token, supervisor_id, bapData)` | [L23895](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23895) | `catatan`, `peserta_absen`, `peserta_hadir` | `EXAM_SHEET.BAP`, `EXAM_SHEET.PERIODS`, `EXAM_SHEET.SUPERVISORS` |
| `editExamBAP(token, supervisor_id, bapData)` | [L24047](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L24047) | `catatan`, `peserta_absen`, `peserta_hadir` | `EXAM_SHEET.BAP`, `EXAM_SHEET.PERIODS`, `EXAM_SHEET.SUPERVISORS` |
| `substituteExamSupervisor(token, supervisor_id, new_user_id)` | [L24161](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L24161) | — | `"Users"`, `EXAM_SHEET.SUPERVISORS` |
| `cancelExamSupervisorSubstitution(token, supervisor_id, force)` | [L24272](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L24272) | — | `EXAM_SHEET.SUPERVISORS` |
| `substituteExamCommittee(token, committee_id, new_user_id)` | [L24399](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L24399) | — | `"Users"`, `EXAM_SHEET.COMMITTEE` |
| `cancelExamCommitteeSubstitution(token, committee_id, force)` | [L24481](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L24481) | — | `EXAM_SHEET.COMMITTEE` |
| `getExamPageData(token, dateStr)` | [L24577](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L24577) | — | `"Users"`, `EXAM_SHEET.BAP`, `EXAM_SHEET.COMMITTEE`, `EXAM_SHEET.PERIODS`, `EXAM_SHEET.ROOMS`, `EXAM_SHEET.SESSIONS`, `EXAM_SHEET.SUPERVISORS` |
| `getSupervisorBapDetail(token, supervisorId)` | [L24765](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L24765) | — | `EXAM_SHEET.BAP`, `EXAM_SHEET.PERIODS`, `EXAM_SHEET.ROOMS`, `EXAM_SHEET.SESSIONS`, `EXAM_SHEET.SUPERVISORS` |
| `getExamRecapData(token, period_id)` | [L24857](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L24857) | — | `"Users"`, `EXAM_SHEET.BAP`, `EXAM_SHEET.COMMITTEE`, `EXAM_SHEET.PERIODS`, `EXAM_SHEET.ROOMS`, `EXAM_SHEET.SESSIONS`, `EXAM_SHEET.SUPERVISORS` |
| `_cleanup(token, periodId)` | [L25066](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25066) | — | Melalui helper/konteks atau tidak ada |
| `_jtmNowIso_()` | [L25108](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25108) | — | Melalui helper/konteks atau tidak ada |
| `_jtmGetAdjustmentsSheet_()` | [L25115](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25115) | — | Melalui helper/konteks atau tidak ada |
| `_jtmGetReallocationsSheet_()` | [L25125](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25125) | — | Melalui helper/konteks atau tidak ada |
| `_jtmColMap_(sheet)` | [L25135](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25135) | — | Melalui helper/konteks atau tidak ada |
| `_jtmRowToObject_(row, headers)` | [L25144](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25144) | — | Melalui helper/konteks atau tidak ada |
| `_jtmBuildAdjustmentRecord_(params)` | [L25164](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25164) | — | Melalui helper/konteks atau tidak ada |
| `_jtmAdjustmentRecordToRow_(record)` | [L25186](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25186) | — | Melalui helper/konteks atau tidak ada |
| `_jtmFindAdjustmentRow_(occurrenceType, occurrenceRef)` | [L25192](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25192) | `length` | Melalui helper/konteks atau tidak ada |
| `_jtmReadAdjustment_(occurrenceType, occurrenceRef)` | [L25211](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25211) | — | Melalui helper/konteks atau tidak ada |
| `_jtmBuildPiketAdjustmentMap_()` | [L25215](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25215) | `length` | Melalui helper/konteks atau tidak ada |
| `_jtmResolvePiketLogJtm_(map, logUserId, logDate, fallback)` | [L25235](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25235) | — | Melalui helper/konteks atau tidak ada |
| `_jtmBuildKbmAdjustmentMap_()` | [L25247](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25247) | `length` | Melalui helper/konteks atau tidak ada |
| `_jtmResolveKbmLogJtm_(map, scheduleId, logDate, fallback)` | [L25274](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25274) | — | Melalui helper/konteks atau tidak ada |
| `_jtmUpsertAdjustment_(record)` | [L25287](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25287) | — | Melalui helper/konteks atau tidak ada |
| `_jtmDeleteAdjustment_(occurrenceType, occurrenceRef)` | [L25302](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25302) | `length` | Melalui helper/konteks atau tidak ada |
| `_jtmReallocationRecordToRow_(record)` | [L25320](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25320) | — | Melalui helper/konteks atau tidak ada |
| `_jtmCreateReallocation_(params)` | [L25326](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25326) | — | Melalui helper/konteks atau tidak ada |
| `_jtmReadReallocations_(occurrenceType, occurrenceRef)` | [L25342](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25342) | `length` | Melalui helper/konteks atau tidak ada |
| `_jtmReadReallocationById_(reallocationId)` | [L25359](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25359) | `length` | Melalui helper/konteks atau tidak ada |
| `_jtmDeleteReallocation_(reallocationId)` | [L25373](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25373) | `length` | Melalui helper/konteks atau tidak ada |
| `_jtmDeleteReallocationsForOccurrence_(occurrenceType, occurrenceRef)` | [L25388](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25388) | `length` | Melalui helper/konteks atau tidak ada |
| `adjustOccurrenceJtm(token, payload)` | [L25407](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25407) | `adjusted_jtm`, `date`, `occurrence_type`, `reason`, `schedule_id`, `supervisor_id`, `target_user_id` | `"Schedules"`, `"Teaching_Logs"`, `EXAM_SHEET.SUPERVISORS` |
| `getOccurrenceJtmState(token, occurrence_type, occurrence_ref)` | [L25595](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25595) | — | Melalui helper/konteks atau tidak ada |
| `_getOccurrenceJtmState_(token, occurrence_type, occurrence_ref)` | [L25605](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25605) | — | `"Schedules"`, `"Teaching_Logs"`, `EXAM_SHEET.SUPERVISORS` |
| `reallocateJtmDifference(token, payload)` | [L25702](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25702) | `allocations`, `date`, `occurrence_ref`, `occurrence_type` | `"Schedules"`, `"Teaching_Logs"`, `"Users"`, `EXAM_SHEET.SUPERVISORS` |
| `_jtmAddReallocationCreditLog_( scheduleId, userId, date, jtmVal, reallocationId, )` | [L25972](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25972) | — | `SHEET_NAME.LOGS` |
| `_jtmSetReallocationLogId_(reallocationId, logId)` | [L25994](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25994) | `length` | Melalui helper/konteks atau tidak ada |
| `removeReallocation(token, reallocation_id)` | [L26011](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26011) | — | Melalui helper/konteks atau tidak ada |
| `resetOccurrenceJtm(token, payload)` | [L26093](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26093) | `date`, `occurrence_ref`, `occurrence_type` | `"Schedules"`, `EXAM_SHEET.SUPERVISORS` |
| `_jtmDeleteAllReallocationsForOccurrence_( occurrenceType, occurrenceRef, )` | [L26231](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26231) | `length` | Melalui helper/konteks atau tidak ada |
| `_jtmDeleteKbmOriginalLog_(scheduleId, occurrenceDate, userId)` | [L26252](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26252) | `length` | `SHEET_NAME.LOGS` |
| `_jtmReverseOccurrence_(type, ref, date, originalUserId)` | [L26292](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26292) | — | Melalui helper/konteks atau tidak ada |
| `getTransportConfig(token)` | [L26330](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26330) | — | Melalui helper/konteks atau tidak ada |
| `saveTransportConfig(token, payload)` | [L26352](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26352) | `tarif_per_km`, `transport_allowance_enabled` | `"Config"` |
| `_minutesBetween(timeStart, timeEnd)` | [L26412](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26412) | — | Melalui helper/konteks atau tidak ada |
| `_calcAttendancePercent(durasiAktual, durasiJadwal)` | [L26431](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26431) | — | Melalui helper/konteks atau tidak ada |
| `_calcDailyTransport( kmDistance, tarifPerKm, durasiAktual, durasiJadwal, transportEnabled, )` | [L26440](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26440) | — | Melalui helper/konteks atau tidak ada |
| `_applyThreePointRounding(totalDesimal)` | [L26470](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26470) | — | Melalui helper/konteks atau tidak ada |
| `_getMonthlyTransportSum(userId, periodeStr)` | [L26483](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26483) | — | `EVENT_SHEET.ATTENDANCE`, `SHEET_NAME.ATTENDANCE`, `SHEET_NAME.ATTENDANCE_LEAVES`, `SHEET_NAME.USERS` |
| `_getMonthlyTransportSumFast(userId, periodeStr, snapshot)` | [L26628](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26628) | — | Melalui helper/konteks atau tidak ada |
| `getDailyAttendanceList(token, dateStr)` | [L26775](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26775) | — | `"Allowances"`, `EVENT_SHEET.ATTENDANCE`, `EXAM_SHEET.COMMITTEE`, `EXAM_SHEET.PERIODS`, `EXAM_SHEET.ROOMS`, `EXAM_SHEET.SESSIONS`, `EXAM_SHEET.SUPERVISORS`, `SHEET_NAME.ATTENDANCE`, `SHEET_NAME.ATTENDANCE_LEAVES`, `SHEET_NAME.ATTENDANCE_SCHED_TEMPLATES`, `SHEET_NAME.CEREMONY_SCHEDULES`, `SHEET_NAME.PICKET_SCHEDULES`, `SHEET_NAME.SCHEDULES`, `SHEET_NAME.SUBSTITUTES`, `SHEET_NAME.USERS` |
| `saveAttendanceTimeIn(token, payload)` | [L27380](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L27380) | `date`, `time_in`, `user_id` | `SHEET_NAME.ATTENDANCE`, `SHEET_NAME.PICKET_SCHEDULES`, `SHEET_NAME.SCHEDULES`, `SHEET_NAME.SUBSTITUTES` |
| `saveAttendanceTimeOut(token, payload)` | [L27612](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L27612) | `date`, `time_out`, `user_id` | `SHEET_NAME.ATTENDANCE`, `SHEET_NAME.PICKET_SCHEDULES`, `SHEET_NAME.SCHEDULES`, `SHEET_NAME.SUBSTITUTES` |
| `getAttendanceRecord(token, targetUserId, dateStr)` | [L27884](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L27884) | — | `SHEET_NAME.ATTENDANCE`, `SHEET_NAME.ATTENDANCE_LEAVES` |
| `getMyAttendanceHistory(token, month, year)` | [L27956](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L27956) | — | `EXAM_SHEET.COMMITTEE`, `EXAM_SHEET.ROOMS`, `EXAM_SHEET.SESSIONS`, `EXAM_SHEET.SUPERVISORS`, `SHEET_NAME.ATTENDANCE`, `SHEET_NAME.ATTENDANCE_LEAVES`, `SHEET_NAME.CALENDAR`, `SHEET_NAME.CEREMONY_SCHEDULES`, `SHEET_NAME.PICKET_SCHEDULES`, `SHEET_NAME.SCHEDULES`, `SHEET_NAME.SUBSTITUTES`, `SHEET_NAME.USERS` |
| `addExtraAttendee(token, payload)` | [L28247](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L28247) | `date`, `reason`, `target_user_id` | `EXAM_SHEET.PERIODS`, `SHEET_NAME.ATTENDANCE`, `SHEET_NAME.ATTENDANCE_SCHED_TEMPLATES`, `SHEET_NAME.PICKET_SCHEDULES`, `SHEET_NAME.SUBSTITUTES`, `SHEET_NAME.USERS` |
| `saveAttendanceManual(token, payload)` | [L28453](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L28453) | `date`, `status`, `time_in`, `time_out`, `user_id` | `SHEET_NAME.ATTENDANCE` |
| `getAttendanceSchedTemplates(token, dateStr)` | [L28561](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L28561) | — | `EXAM_SHEET.PERIODS`, `SHEET_NAME.ATTENDANCE_SCHED_TEMPLATES` |
| `saveAttendanceSchedTemplate(token, payload)` | [L28618](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L28618) | `apply_date`, `day_index`, `sched_time_in`, `sched_time_out`, `sched_type` | `SHEET_NAME.ATTENDANCE_SCHED_TEMPLATES` |
| `deleteAttendanceSchedTemplate(token, id)` | [L28737](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L28737) | — | `SHEET_NAME.ATTENDANCE_SCHED_TEMPLATES` |
| `_applyTemplateToDateInternal(schedTimeIn, schedTimeOut, dateStr)` | [L28768](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L28768) | — | `EXAM_SHEET.COMMITTEES`, `EXAM_SHEET.PERIODS`, `EXAM_SHEET.PROCTORS`, `SHEET_NAME.ATTENDANCE`, `SHEET_NAME.PICKET_SCHEDULES`, `SHEET_NAME.SCHEDULES`, `SHEET_NAME.SUBSTITUTES`, `SHEET_NAME.USERS` |
| `applySchedTemplatesToDate(token, payload)` | [L28921](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L28921) | `date`, `template_id` | `EXAM_SHEET.PERIODS`, `SHEET_NAME.ATTENDANCE_SCHED_TEMPLATES` |
| `saveAttendanceSched(token, payload)` | [L29008](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29008) | `date`, `sched_time_in`, `sched_time_out`, `user_id` | `SHEET_NAME.ATTENDANCE` |
| `saveAttendanceLeave(token, payload)` | [L29121](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29121) | `date`, `leave_time`, `reason`, `return_time`, `user_id` | `SHEET_NAME.ATTENDANCE`, `SHEET_NAME.ATTENDANCE_LEAVES`, `SHEET_NAME.PICKET_SCHEDULES`, `SHEET_NAME.SUBSTITUTES` |
| `deleteAttendanceLeave(token, leaveId)` | [L29307](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29307) | — | `SHEET_NAME.ATTENDANCE_LEAVES`, `SHEET_NAME.PICKET_SCHEDULES`, `SHEET_NAME.SUBSTITUTES` |
| `getEventDefinitions(token)` | [L29394](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29394) | — | `EVENT_SHEET.DEFINITIONS` |
| `saveEventDefinition(token, payload)` | [L29412](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29412) | `dates_json`, `description`, `id`, `jtm_val`, `name`, `recurrence_day_index`, `time_end`, `time_start`, `type` | `EVENT_SHEET.DEFINITIONS` |
| `deleteEventDefinition(token, eventId, force)` | [L29563](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29563) | — | `EVENT_SHEET.ATTENDANCE`, `EVENT_SHEET.DEFINITIONS`, `EVENT_SHEET.JOURNALS` |
| `getTodayEvents(token)` | [L29634](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29634) | — | `EVENT_SHEET.DEFINITIONS` |
| `getEventAttendance(token, eventId, date)` | [L29693](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29693) | — | `EVENT_SHEET.ATTENDANCE`, `SHEET_NAME.USERS` |
| `_upsertAttendanceRecord( existing, newTimeIn, confirmedBy, confirmedAt, )` | [L29760](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29760) | — | Melalui helper/konteks atau tidak ada |
| `saveEventAttendance(token, payload)` | [L29785](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29785) | `date`, `event_id`, `time_in`, `user_id` | `EVENT_SHEET.ATTENDANCE`, `EVENT_SHEET.DEFINITIONS`, `SHEET_NAME.USERS` |
| `getMyPendingJournals(token)` | [L30043](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L30043) | — | `EVENT_SHEET.ATTENDANCE`, `EVENT_SHEET.DEFINITIONS` |
| `saveEventJournal(token, payload)` | [L30106](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L30106) | `attendance_id`, `description` | `EVENT_SHEET.ATTENDANCE`, `EVENT_SHEET.DEFINITIONS`, `EVENT_SHEET.JOURNALS` |
| `getEventAttendanceHistory(token, month, year)` | [L30238](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L30238) | — | `EVENT_SHEET.ATTENDANCE`, `EVENT_SHEET.DEFINITIONS` |
| `getEventJournalHistory(token, month, year)` | [L30294](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L30294) | — | `EVENT_SHEET.DEFINITIONS`, `EVENT_SHEET.JOURNALS`, `SHEET_NAME.USERS` |

## Lampiran C. Daftar pemeriksaan per fungsi mutasi

Potongan di bawah merupakan ekspresi guard dan pesan/kode yang ditemukan pada fungsi sumber. Ini membantu menurunkan pengujian tambahan dan menjaga pesan domain; bukan blok kode yang dapat dijalankan atau spesifikasi untuk mempertahankan kelemahan sumber. Beberapa baris kondisi multiline hanya menampilkan awal ekspresi, sehingga pembacaan sumber lengkap tetap diperlukan. Semua penguatan pada bagian utama mengungguli guard lama yang kurang ketat. Pemanggilan `_ext*` dan password default yang tercantum berikut hanyalah bukti sumber historis; implementasi target menggantinya dengan kredensial privat internal dan tidak menjalankannya.

### _validateEventDefinition

```text
if (!name) {
return { ok: false, message: "Nama acara tidak boleh kosong." };
if (!HH_MM.test(timeStart) || !HH_MM.test(timeEnd)) {
message: "Jam mulai harus lebih awal dari jam selesai.",
if (timeStart >= timeEnd) {
if (typeof raw === "number") {
} else if (typeof raw === "string") {
if (!Number.isInteger(jtm) || jtm < 1 || jtm > 99) {
message: "Nilai JTM harus berupa bilangan bulat antara 1 dan 99.",
```

### _jtmValidateAdjusted

```text
code: JTM_ERROR_CODES.ADJUSTED_INVALID,
message: "Adjusted JTM harus berupa bilangan bulat antara 0 dan " + scheduledJtm + ".",
if (typeof rawAdjusted === "number") {
} else if (typeof rawAdjusted === "string") {
if (trimmed === "") return invalid;
if (typeof value !== "number" || isNaN(value) || !isFinite(value))
if (!Number.isInteger(value) || value < 0) return invalid;
if (value > scheduledJtm) {
code: JTM_ERROR_CODES.ADJUSTED_EXCEEDS_SCHEDULED,
message: "Adjusted JTM tidak boleh melebihi Scheduled JTM (" + scheduledJtm + ").",
```

### _jtmValidateReason

```text
if (typeof rawReason === "string") {
} else if ( rawReason !== null && rawReason !== undefined && typeof rawReason !== "object" ) {
if (!(adjustedJtm < scheduledJtm)) return { ok: true, reason: trimmed };
if (trimmed.length === 0) {
code: JTM_ERROR_CODES.REASON_REQUIRED,
message: "Alasan penyesuaian wajib diisi ketika JTM dikurangi.",
if (trimmed.length > JTM_REASON_MAX_LENGTH) {
code: JTM_ERROR_CODES.REASON_TOO_LONG,
message: "Alasan penyesuaian tidak boleh melebihi " + JTM_REASON_MAX_LENGTH + " karakter.",
```

### _jtmValidateAllocation

```text
code: JTM_ERROR_CODES.ALLOCATION_INVALID,
message: "Alokasi JTM harus berupa angka lebih besar dari 0.",
if (typeof rawAllocation === "number") {
} else if (typeof rawAllocation === "string") {
if (trimmed === "") return invalid;
if (typeof value !== "number" || isNaN(value) || !isFinite(value))
if (value <= 0) return invalid;
if (substituteUserId === originalUserId) {
code: JTM_ERROR_CODES.SUBSTITUTE_IS_ORIGINAL,
message: "Guru pengganti tidak boleh sama dengan guru/pengawas asli untuk kegiatan ini.", }; }
if (isSubstituteAdmin) {
code: JTM_ERROR_CODES.SUBSTITUTE_IS_ADMIN,
message: "Guru pengganti tidak boleh seorang Admin.",
```

### _jtmCheckConservation

```text
if (existingAllocations && typeof existingAllocations.length === "number") {
if (!isNaN(entry) && isFinite(entry)) sumExisting += entry;
if (isNaN(addition) || !isFinite(addition)) addition = 0;
if (isNaN(base) || !isFinite(base)) base = 0;
if (total <= scheduledJtm) return { ok: true, total: total };
code: JTM_ERROR_CODES.CONSERVATION_VIOLATION,
message: "Total JTM (" + total + ") melebihi Scheduled JTM (" +
```

### saveStudentAttendance

```text
if (!user) return { status: "error", message: "Unauthorized" };
if (!isAdmin && !isPicket && !isPanitia) {
return { status: "error", message: "Akses Ditolak." };
if (isPanitia && !_hasTimeInToday(user.id)) {
return { status: "error", message: "Akses Ditolak: Jam masuk aktual Anda belum diinput admin." };
if (!className) return { status: "error", message: "Nama kelas wajib diisi." };
if (hadir < 0 || sakit < 0 || izin < 0 || alpa < 0) return { status: "error", message: "Nilai tidak boleh negatif." };
if ((hadir + sakit + izin + alpa) === 0) return { status: "error", message: "Total siswa tidak boleh nol." };
if (rowDate === todayStr && rowClass === className) { existingRow = i; break; }
if (existingRow > 0) {
return { status: "error", message: "Server Error (SaveSA): " + e.toString() };
```

### updateUserProfile

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali" };
if (userRowIndex === -1)
return { status: "error", message: "User tidak ditemukan" };
if (payload.full_name && !payload.phone && payload.phone !== "") {
return { status: "success", message: "Nama berhasil diubah" };
if (typeof payload.phone === "string") {
if (payload.phone.trim() !== "" && !cleaned.valid) {
message: cleaned.message || "Format nomor HP tidak valid.",
if (payload.full_name)
message: "Data berhasil disimpan",
if (payload.new_password && payload.old_password) {
if ( currentExtPass === null || String(currentExtPass) !== String(payload.old_password) ) { return {
message: "Password lama yang Anda masukkan salah.",
if (String(payload.new_password) === String(payload.old_password)) {
message: "Password baru tidak boleh sama dengan password lama.",
if (!complexityCheck.valid) {
return { status: "error", message: complexityCheck.message };
if (!extOk) {
message: "Gagal memperbarui password. Hubungi Administrator.",
return { status: "success", message: "Password berhasil diubah" };
return { status: "error", message: "Data tidak lengkap" };
```

### updateGuruProfileDetails

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali" };
if (userRowIndex === -1)
return { status: "error", message: "User tidak ditemukan" };
return { status: "success", message: "Profil guru berhasil disimpan" };
```

### requestEmailOTP

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali" };
if (!email) return { status: "error", message: "Email wajib diisi." };
if (!_isValidEmail_(email)) {
return { status: "error", message: "Format email tidak valid." };
if (otherWithEmail) {
message: "Email ini sudah digunakan oleh akun lain.",
if (lastReq && now - lastReq < SECS * 1000) {
message: "Mohon tunggu " + wait + " detik sebelum meminta kode lagi.",
code: code,
message: "Gagal mengirim email verifikasi: " + (mailErr && mailErr.message ? mailErr.message : mailErr), };
(mailErr && mailErr.message ? mailErr.message : mailErr),
message: "Kode OTP telah dikirim ke " + email + ". Kode berlaku 10 menit.", expires_in: 600, cooldown: SECS,
message: "Server error: " + (e && e.message ? e.message : e),
```

### verifyEmailOTP

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali" };
if (!_isValidEmail_(email))
return { status: "error", message: "Format email tidak valid." };
if (!/^\d{6}$/.test(code))
return { status: "error", message: "Kode OTP harus 6 digit angka." };
if (!raw)
message: "Tidak ada permintaan OTP aktif. Minta kode baru.",
return { status: "error", message: "Data OTP rusak. Minta kode baru." };
if (Date.now() > Number(data.expires || 0)) {
message: "Kode OTP sudah kedaluwarsa. Minta kode baru.",
if (String(data.email).toLowerCase() !== email) {
message: "Email yang Anda masukkan berbeda dengan permintaan OTP terakhir. Minta kode baru.", }; }
if (Number(data.attempts || 0) >= 5) {
message: "Terlalu banyak percobaan salah. Minta kode baru.",
if (String(data.code) !== code) {
message: "Kode OTP salah. " + (remain > 0 ? "Sisa percobaan: " + remain : "Percobaan habis."), };
if (userRowIndex === -1)
return { status: "error", message: "User tidak ditemukan" };
if (otherWithEmail) {
message: "Email ini sudah digunakan oleh akun lain.",
message: "Email berhasil diverifikasi & disimpan.",
message: "Server error: " + (e && e.message ? e.message : e),
```

### _checkPasswordComplexity

```text
if (password.length < 8) {
return { valid: false, message: "Password baru minimal harus 8 karakter." };
if (!/[A-Z]/.test(password)) {
return { valid: false, message: "Password harus mengandung huruf besar." };
if (!/[a-z]/.test(password)) {
return { valid: false, message: "Password harus mengandung huruf kecil." };
if (!/[0-9]/.test(password)) {
return { valid: false, message: "Password harus mengandung angka." };
if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
message: "Password harus mengandung karakter khusus (simbol).",
if (username && lowerPass.includes(username.toLowerCase())) {
message: "Password tidak boleh mengandung username Anda.",
if (fullName) {
if (lowerPass.includes(part.toLowerCase())) {
message: "Password tidak boleh mengandung unsur nama Anda (" + part + ").", }; }
```

### saveScheduleAdmin

```text
if (!user || user.role !== "admin")
return { status: "error", message: "Akses ditolak" };
if (data.id) {
if (String(rows[i][0]) === String(data.id)) {
```

### deleteMultipleSchedulesAdmin

```text
if (!user || user.role !== "admin") {
return { status: "error", message: "Akses ditolak." };
if (!Array.isArray(ids) || ids.length === 0) {
return { status: "error", message: "Tidak ada data yang dipilih." };
if (res && res.status === "success") {
message: `${successCount} dari ${ids.length} jadwal berhasil dihapus.`,
```

### saveTeachingJournal

```text
if (!user) return { status: "error", message: "Unauthorized" };
if (targetSchedule) {
if (!isNaN(dbTotal)) {
if (inputTotal !== dbTotal) {
code: "STUDENT_COUNT_MISMATCH",
message: "Validasi Gagal: Total siswa (" + inputTotal + ") tidak sesuai dengan standar kelas " +
if (data.date && /^\d{4}-\d{2}-\d{2}$/.test(String(data.date))) {
if (targetDateStr === todayStr) {
} else if (targetDateStr === yesterdayStr) {
if (String(_h1CfgMap["allow_h_minus_1_journal"] || "").toLowerCase() === "true") {
code: "H1_DISABLED",
message: "Fitur input jurnal H-1 tidak aktif. Hubungi Admin untuk mengaktifkannya.",
} else if (targetDateStr < todayStr) {
code: "DATE_EXPIRED",
message: "Batas waktu input jurnal telah berakhir. Anda hanya dapat mengisi jurnal pada hari yang sama atau H-1 (jika fitur aktif).",
code: "FUTURE_DATE",
message: "Tidak dapat mengisi jurnal untuk tanggal yang belum terjadi.",
if (targetSchedule && String(targetSchedule.user_id).trim() !== String(user.id).trim()) {
if (!_isSubForSchedule) {
code: "UNAUTHORIZED_SCHEDULE",
message: "Jadwal ini bukan milik Anda.",
if (inputType === "H_MINUS_1" && targetSchedule) {
if (!_h1AttConfirmed) {
code: "H1_NOT_CONFIRMED",
message: "Kehadiran Anda pada jadwal tersebut (kemarin, " + yesterdayStr + ") belum dikonfirmasi oleh Admin atau Guru Piket. Hubungi Admin untuk konfirmasi terlebih dahulu.",
if (!_isUserSubForThisSchedule) {
if (_h1IsReplaced) {
code: "H1_REPLACED",
message: "Jadwal Anda pada kemarin (" + yesterdayStr + ") telah digantikan oleh guru lain. Jurnal H-1 tidak dapat diisi.",
if (_saRekap) {
if (_saActHadir !== _saExpHadir || _saActAbsen !== _saExpAbsen) {
code: "STUDENT_ATTENDANCE_MISMATCH",
message: "Data absensi tidak sesuai rekap guru piket " + _saDateLabel + " untuk kelas " + _saClassName +
if (isDuplicate) {
code: "DUPLICATE",
message: "Jurnal untuk jadwal ini sudah pernah diisi pada tanggal yang sama. Anda tidak dapat mengisi jurnal yang sama dua kali.", }; }
if (jtmAdjustment) {
if ( adjDateStr === targetDateStr && storedAdjusted !== null && storedAdjusted !== undefined && storedAdjusted !== "" &&
```

### updateTeachingLog

```text
if (!user) return { status: "error", message: "Unauthorized" };
if (!logId) return { status: "error", message: "Log ID wajib diisi." };
if ( [idCol, schedCol, userCol, matCol, hadirCol, absenCol, notesCol].some( (c) => c < 0, ) ) {
message: "Struktur sheet Teaching_Logs tidak sesuai.",
if (String(values[i][idCol]).trim() === String(logId).trim()) {
if (rowIndex === -1)
return { status: "error", message: "Jurnal tidak ditemukan." };
if (!isOwner && !isAdmin) {
message: "Anda tidak memiliki akses untuk mengubah jurnal ini.",
if (sched) {
if (!isNaN(dbTotal) && inputTotal !== dbTotal) {
code: "STUDENT_COUNT_MISMATCH",
message: "Validasi Gagal: Total siswa (" + inputTotal + ") tidak sesuai dengan standar kelas " +
if (_saRekap2) {
if (_saActHadir2 !== _saExpHadir2 || _saActAbsen2 !== _saExpAbsen2) {
code: "STUDENT_ATTENDANCE_MISMATCH",
message: "Data absensi tidak sesuai rekap guru piket untuk kelas " + _saClassName2 +
if (!materi)
return { status: "error", message: "Materi pembelajaran wajib diisi." };
return { status: "error", message: "Server Error: " + e.toString() };
```

### saveSystemConfig

```text
if (!user || user.role !== "admin")
return { status: "error", message: "Akses hanya untuk Admin" };
if (existingData[i][0] === key) {
if (rowIndex > 0) {
if (key === "app_version" || key === "maintenance_start" || key === "maintenance_end") cell.setNumberFormat("@");
return { status: "error", message: "Terjadi kesalahan server. Coba lagi." };
```

### saveSubject

```text
if (!user || user.role !== "admin")
return { status: "error", message: "Unauthorized" };
if (!nameTrimmed)
return { status: "error", message: "Nama mapel tidak boleh kosong." };
if (String(rows[i][1]).trim().toLowerCase() === nameTrimmed.toLowerCase()) {
if (!data.id || String(rows[i][0]) !== String(data.id)) {
message: "Mata pelajaran dengan nama tersebut sudah ada.",
if (data.id) {
if (rows[i][0] === data.id) {
if (!found)
return { status: "error", message: "Data Mapel tidak ditemukan." };
```

### saveAllowance

```text
if (!user || user.role !== "admin")
return { status: "error", message: "Unauthorized" };
if (data.id) {
if (rows[i][0] === data.id) {
if (!found)
return { status: "error", message: "Tunjangan tidak ditemukan." };
```

### addHoliday

```text
if (!user || user.role !== "admin")
return { status: "error", message: "Unauthorized" };
if (id) {
if (String(data[i][0]) === String(id)) {
if (existingDate < todayStr) {
message: "Hari libur yang sudah lewat tidak dapat diubah",
if (!found) return { status: "error", message: "Data tidak ditemukan" };
```

### deleteHoliday

```text
if (!user || user.role !== "admin")
return { status: "error", message: "Unauthorized" };
if (String(data[i][0]) === String(id)) {
if (existingDate < todayStr) {
message: "Hari libur yang sudah lewat tidak dapat dihapus",
return { status: "error", message: "Data tidak ditemukan" };
```

### deleteRowById

```text
if (!user || user.role !== "admin")
return { status: "error", message: "Unauthorized" };
if (String(data[i][0]) === String(id)) {
return { status: "error", message: "Data tidak ditemukan" };
```

### saveAnnouncement

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Hanya admin yang dapat menyimpan pengumuman.",
if (!data || !String(data.title || "").trim()) {
return { status: "error", message: "Judul pengumuman wajib diisi." };
if (!String(data.body || "").trim()) {
return { status: "error", message: "Isi pengumuman wajib diisi." };
if (starts && !/^\d{4}-\d{2}-\d{2}$/.test(starts)) {
message: "Format tanggal mulai tidak valid (yyyy-MM-dd).",
if (ends && !/^\d{4}-\d{2}-\d{2}$/.test(ends)) {
message: "Format tanggal selesai tidak valid (yyyy-MM-dd).",
if (starts && ends && ends < starts) {
message: "Tanggal selesai harus setelah tanggal mulai.",
if (ctaUrl && !/^https?:\/\//i.test(ctaUrl)) {
message: "CTA URL harus diawali http:// atau https://",
if (u && u.id != null) validIds[String(u.id)] = true;
if (!s) return;
if (validIds[s]) clean.push(s);
if ( targetCheck.invalid.length || dismCheck.invalid.length || ndCheck.invalid.length ) {
message: "Beberapa ID pengguna tidak ditemukan: " + [] .concat(targetCheck.invalid, dismCheck.invalid, ndCheck.invalid)
if (conflict.length) {
message: 'Pengguna tidak boleh berada di kedua daftar "boleh tutup" dan "tidak boleh tutup": ' + conflict.join(", "), };
if (data.id) {
if (String(rows[i][0]) === String(data.id)) {
if (sendEmailNotification) {
message: "Pengumuman diperbarui.",
return { status: "error", message: "Pengumuman tidak ditemukan." };
return { status: "success", message: "Pengumuman dibuat.", id: newId };
```

### toggleAnnouncement

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
return { status: "error", message: "Hanya admin." };
if (String(rows[i][0]) === String(id)) {
return { status: "error", message: "Pengumuman tidak ditemukan." };
```

### simpanBlokJurnal

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
return { status: "error", message: "Akses ditolak." };
if (!mapel) return { status: "error", message: "Mata pelajaran wajib dipilih." };
if (!mulai || !/^\d{4}-\d{2}-\d{2}$/.test(mulai)) {
return { status: "error", message: "Tanggal mulai tidak valid (format: YYYY-MM-DD)." };
if (!selesai || !/^\d{4}-\d{2}-\d{2}$/.test(selesai)) {
return { status: "error", message: "Tanggal selesai tidak valid (format: YYYY-MM-DD)." };
if (selesai < mulai) {
return { status: "error", message: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
if (!pesan) return { status: "error", message: "Pesan blokir wajib diisi." };
if (data.id) {
if (String(rows[i][0]) === String(data.id)) {
return { status: "error", message: "Data blokir tidak ditemukan." };
return { status: "error", message: "Server Error (simpanBlokJurnal): " + e.toString() };
```

### hapusBlokJurnal

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
return { status: "error", message: "Akses ditolak." };
return { status: "error", message: "Server Error (hapusBlokJurnal): " + e.toString() };
```

### simpanBlokAcara

```text
if (!user) return { status: "error", message: "Unauthorized" };
if (String(user.role).toLowerCase() !== "admin") return { status: "error", message: "Akses Ditolak" };
if (!tipeAcara) return { status: "error", message: "Tipe acara wajib dipilih." };
if (!tanggalMulai) return { status: "error", message: "Tanggal mulai wajib diisi." };
if (!tanggalSelesai) return { status: "error", message: "Tanggal selesai wajib diisi." };
if (tanggalSelesai < tanggalMulai) return { status: "error", message: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
if (!pesan) return { status: "error", message: "Pesan wajib diisi." };
if (existingId) {
if (String(rows[i][headers.indexOf("id")]) === existingId) {
return { status: "error", message: "Data tidak ditemukan." };
return { status: "error", message: "Server Error: " + e.toString() };
```

### hapusBlokAcara

```text
if (!user) return { status: "error", message: "Unauthorized" };
if (String(user.role).toLowerCase() !== "admin") return { status: "error", message: "Akses Ditolak" };
if (String(rows[i][idCol]) === String(id)) {
return { status: "error", message: "Data tidak ditemukan." };
return { status: "error", message: "Server Error: " + e.toString() };
```

### simpanBlokTransport

```text
if (!user) return { status: "error", message: "Sesi habis, silakan login kembali." };
if (String(user.role).toLowerCase() !== "admin") {
return { status: "error", message: "Akses hanya untuk Admin." };
if (!tanggalMulai || !rDate.test(tanggalMulai)) {
return { status: "error", message: "Tanggal mulai tidak valid (format: YYYY-MM-DD)." };
if (!tanggalSelesai || !rDate.test(tanggalSelesai)) {
return { status: "error", message: "Tanggal selesai tidak valid (format: YYYY-MM-DD)." };
if (tanggalSelesai < tanggalMulai) {
return { status: "error", message: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
if (!keterangan) return { status: "error", message: "Keterangan wajib diisi." };
if (existingId) {
if (String(rows[i][headers.indexOf("id")]) === existingId) {
return { status: "success", message: "Blokir transport diperbarui." };
return { status: "error", message: "Data tidak ditemukan." };
return { status: "success", message: "Blokir transport ditambahkan.", id: newId };
return { status: "error", message: "Terjadi kesalahan server. Coba lagi." };
```

### hapusBlokTransport

```text
if (!user) return { status: "error", message: "Sesi habis, silakan login kembali." };
if (String(user.role).toLowerCase() !== "admin") {
return { status: "error", message: "Akses hanya untuk Admin." };
if (!blokId) return { status: "error", message: "ID tidak valid." };
if (idCol === -1) idCol = 0;
if (String(rows[i][idCol]) === blokId) {
return { status: "success", message: "Blokir transport dihapus." };
return { status: "error", message: "Data tidak ditemukan." };
return { status: "error", message: "Terjadi kesalahan server. Coba lagi." };
```

### deleteTeachingLog

```text
if (!user) return { status: "error", message: "Unauthorized" };
if (!isAdmin) {
if (!log) return { status: "error", message: "Jurnal tidak ditemukan." };
if (String(log.user_id).trim() !== String(user.id).trim()) {
return { status: "error", message: "Anda tidak memiliki akses untuk menghapus jurnal ini." };
if (String(log.notes || "").includes("Auto-generated: Libur Bonus")) {
return { status: "error", message: "Jurnal yang dibuat otomatis oleh sistem tidak dapat dihapus." };
if (String(data[i][0]) === String(id)) {
return { status: "error", message: "Data tidak ditemukan." };
return { status: "error", message: "Server Error: " + e.toString() };
```

### confirmTeacherPresence

```text
if (!user) return { status: "error", message: "Unauthorized" };
if (!isAdmin && !isSelf && !isPicketToday) {
message: "Anda tidak berwenang mengonfirmasi kehadiran guru lain.",
if ( String(rows[i][2]) === String(targetUserId) && Utilities.formatDate( new Date(rows[i][1]), Session.getScriptTimeZone(),
return { status: "success", message: "Sudah dikonfirmasi" };
```

### revokeTeacherPresence

```text
if (!user) return { status: "error", message: "Unauthorized" };
if (!isAdmin && !isSelf && !isPicketToday) {
message: "Anda tidak berwenang membatalkan kehadiran guru lain.",
if ( String(rows[i][2]) === String(targetUserId) && rowDate === todayStr && rowSched === schedId ) {
code: JTM_ERROR_CODES.NO_ACTIVE_CONFIRMATION,
message: "Data tidak ditemukan",
```

### savePicketSchedule

```text
if (!user || user.role !== "admin")
return { status: "error", message: "Unauthorized" };
if (isNaN(dayIdx) || dayIdx < 0 || dayIdx > 6) {
return { status: "error", message: "Hari tidak valid." };
if (!userId) {
return { status: "error", message: "Pilih guru terlebih dahulu." };
if (!targetUser) return { status: "error", message: "Guru tidak ditemukan." };
if (String(targetUser.role).toLowerCase() === "admin") {
message: "Admin tidak dapat dijadwalkan sebagai piket.",
if (dup) {
code: "DUPLICATE",
message: "Guru ini sudah terdaftar piket pada hari yang sama.",
return { status: "success", message: "Jadwal piket berhasil disimpan." };
```

### revokePicketDaily

```text
if (!user) return { status: "error" };
if ( String(rows[i][2]) === String(userId) && rowDate === todayStr && rows[i][1] === "PICKET-DUTY" ) {
if (attUserId === String(userId) && attDate === todayStr &&
return { status: "error", message: "Data tidak ditemukan" };
```

### cancelPicketSubstituteAttendance

```text
if (!user) return { status: "error", message: "Unauthorized" };
if (String(rows[i][0]) === String(logId)) {
if (!deletedUserId) {
return { status: "error", message: "Data tidak ditemukan" };
if (deletedDate) {
if ( String(attRows[i][2]) === deletedUserId && attDate === deletedDate && !attSched ) {
message: "Data piket pengganti berhasil dihapus",
```

### confirmPicketDaily

```text
if (!user) return { status: "error", message: "Unauthorized" };
if (!isAdmin && !isSelf && !isPicketToday) {
message: "Anda tidak berwenang mengonfirmasi kehadiran piket guru lain.",
if (!isPicket && !picketSubRecord)
return { status: "error", message: "Anda bukan petugas piket hari ini" };
if (isAdmin) roleLabel = "Admin";
if (existing) return { status: "success", message: "Sudah ada" };
```

### confirmPicketSubPresenceBackend

```text
if (rowUserId === String(targetUserId) && rowDate === todayStr &&
if (!piketAttExists) {
if (res1.status !== "success" && res1.message !== "Sudah dikonfirmasi") {
if (res2.status !== "success" && res2.message !== "Sudah ada") {
```

### saveMonthlyHonorarium

```text
if (!user || user.role !== "admin")
return { status: "error", message: "Akses ditolak" };
```

### _validateKmDistance_

```text
if (raw === null || raw === undefined || raw === "") {
if (s === "") return { ok: true, value: 0 };
if (isNaN(num) || !isFinite(num)) {
message: "Jarak harus berupa angka antara 0,01 dan 999,99 dengan maksimal 2 angka di belakang koma.", }; }
if (num === 0) return { ok: true, value: 0 };
if (num < 0.01 || num > 999.99) {
if (decimalMatch && decimalMatch[1].length > 2) {
```

### _validateAdditionalRole_

```text
if (raw === null || raw === undefined || raw === "") {
if (s === "") return { ok: true, value: "" };
if (s === "KEPALA_SEKOLAH") return { ok: true, value: "KEPALA_SEKOLAH" };
message: "Nilai additional_role tidak valid. Gunakan KEPALA_SEKOLAH atau kosongkan.", }; }
```

### saveUser

```text
if (!admin || admin.role !== "admin")
return { status: "error", message: "Akses ditolak" };
if (!kmValidation.ok)
return { status: "error", message: kmValidation.message };
if (!roleValidation.ok)
return { status: "error", message: roleValidation.message };
if (data.id) {
if ( String(rows[j][0]) !== String(data.id) && String(rows[j][1]).toLowerCase() === String(data.username).toLowerCase() ) { return {
message: "Username sudah digunakan oleh pengguna lain",
if (String(rows[i][0]) === String(data.id)) {
if (Object.prototype.hasOwnProperty.call(data, "nip")) {
if (oldUsername !== String(data.username)) {
if (Object.prototype.hasOwnProperty.call(data, "km_distance")) {
if (Object.prototype.hasOwnProperty.call(data, "additional_role")) {
return { status: "error", message: "User tidak ditemukan" };
if ( String(rows[j][1]).toLowerCase() === String(data.username).toLowerCase() ) { return { status: "error", message: "Username sudah digunakan" }; }
return { status: "error", message: "Username sudah digunakan" };
if (!extOk) {
if (String(rows[i][0]) === newId) {
message: "Gagal menambah user ke sumber credential. Coba lagi.",
```

### deleteUser

```text
if (!admin || admin.role !== "admin")
return { status: "error", message: "Akses ditolak" };
if (target && target.username) {
```

### resetUserPassword

```text
if (!admin || admin.role !== "admin")
return { status: "error", message: "Akses ditolak" };
if (String(rows[i][0]) === String(id)) {
if (!extOk) {
message: "Gagal reset password di sumber credential. Hubungi Administrator.", }; }
message: "Password berhasil direset ke 123456",
return { status: "error", message: "User tidak ditemukan" };
```

### saveCeremonySchedule

```text
if (!user || user.role !== "admin") return { status: "error" };
if (d.getDay() !== 1)
message: "Jadwal upacara hanya boleh pada hari Senin!",
if (duplicate)
message: "Tanggal ini sudah memiliki jadwal pembina upacara!",
if (!headers.some((h) => String(h).toLowerCase().trim() === "tahun_pelajaran")) {
if (!headers.some((h) => String(h).toLowerCase().trim() === "semester")) {
if (key === "id") newRow[i] = newId;
```

### confirmCeremonyLeader

```text
if (!user) return { status: "error", message: "Unauthorized" };
if (!isAdmin && !isSelf) {
message: "Hanya admin atau pembina upacara yang berwenang.",
if (attRes.status === "error" && attRes.message !== "Sudah dikonfirmasi" && attRes.message !== "Anda tidak berwenang mengonfirmasi kehadiran guru lain.") {
if (existing) return { status: "success", message: "Sudah ada" };
```

### revokeCeremonyLeader

```text
if (!user) return { status: "error" };
if ( String(rows[i][2]) === String(userId) && rowDate === todayStr && rows[i][1] === "CEREMONY-DUTY" ) {
```

### assignSubstitute

```text
if (!user) return { status: "error", message: "Unauthorized" };
if (existingSubs.length > 0) {
code: "COLLISION",
message: `Jadwal ini sudah memiliki guru pengganti: ${existingName}. Silakan batalkan terlebih dahulu jika ingin mengganti.`,
if (!sched) return { status: "error", message: "Jadwal tidak ditemukan." };
if (String(subId) === String(originalUser)) {
message: "Guru tidak dapat ditugaskan sebagai pengganti untuk jadwalnya sendiri.", }; }
if (!subUser)
return { status: "error", message: "Guru pengganti tidak ditemukan." };
if (String(subUser.role).toLowerCase() === "admin") {
message: "Admin tidak dapat ditugaskan sebagai pengganti mengajar.",
message: `Berhasil menetapkan ${subUser.full_name} sebagai guru pengganti.`,
```

### replaceSubstitute

```text
if (!user) return { status: "error", message: "Unauthorized" };
if (!isAdmin && !isPicketToday) {
message: "Hanya admin atau guru piket hari ini yang dapat mengganti pengganti.", }; }
if (revokeRes.status !== "success") {
if ( !revokeRes.message || revokeRes.message.indexOf("tidak ditemukan") === -1 ) { return revokeRes;
if (assignRes.status !== "success") return assignRes;
message: "Pengganti berhasil diganti.",
return { status: "error", message: "Server error: " + e.toString() };
```

### revokeSubstitute

```text
if (!user) return { status: "error", message: "Unauthorized" };
if (!isAdmin && !isPicketToday) {
message: "Hanya admin atau guru piket hari ini yang dapat membatalkan guru pengganti.", }; }
if (String(rows[i][4]) === String(scheduleId) && rowDate === todayStr) {
if (deletedRow === -1) {
message: "Data guru pengganti tidak ditemukan atau sudah dibatalkan.",
if ( logDate === todayStr && logScheduleId === targetLogScheduleId && logUserId === String(deletedData.substitute_user_id) ) {
if ( String(attRows[i][2]) === String(deletedData.substitute_user_id) && attDate === todayStr && isTargetSched ) {
if (isPicketSub) {
message: `Berhasil membatalkan guru pengganti ${subUser ? subUser.full_name : ""}. ${origUser ? origUser.full_name : "Guru asli"} kembali bertugas.`,
return { status: "error", message: "Server error: " + error.toString() };
```

### verifyForgotSecurityAnswer

```text
if (!uname)
return { status: "error", message: "Username tidak boleh kosong." };
if (!user) return { status: "error", message: "Username tidak ditemukan." };
if (!storedQuestion) {
message: "Akun ini belum memiliki pertanyaan keamanan. Hubungi Admin.",
if (!givenAnswer)
message: "Jawaban keamanan tidak boleh kosong.",
if (storedAnswer !== givenAnswer) {
message: "Jawaban keamanan tidak sesuai. Periksa kembali jawaban Anda.",
message: "Verifikasi berhasil. Silakan buat password baru.",
message: "Server error: " + (e && e.message ? e.message : e),
```

### requestForgotPasswordOTP

```text
if (!uname)
return { status: "error", message: "Username tidak boleh kosong." };
if (!user) return { status: "error", message: "Username tidak ditemukan." };
if (!email || !_isValidEmail_(email)) {
message: "Akun ini belum memiliki email terverifikasi. Hubungi Admin atau gunakan pertanyaan keamanan.", }; }
if (lastReq && now - lastReq < SECS * 1000) {
message: "Mohon tunggu " + wait + " detik sebelum meminta kode lagi.",
code: code,
message: "Gagal mengirim email: " + (mailErr && mailErr.message ? mailErr.message : mailErr), };
(mailErr && mailErr.message ? mailErr.message : mailErr),
message: "Kode OTP telah dikirim ke " + _maskEmail_(email) + ".",
message: "Server error: " + (e && e.message ? e.message : e),
```

### requestPasswordResetByOTP

```text
if (!uname)
return { status: "error", message: "Username tidak boleh kosong." };
if (!/^\d{6}$/.test(code))
return { status: "error", message: "Kode OTP harus 6 digit angka." };
if (!user) return { status: "error", message: "Username tidak ditemukan." };
if (!raw)
message: "Tidak ada permintaan OTP aktif. Minta kode baru.",
return { status: "error", message: "Data OTP rusak. Minta kode baru." };
if (Date.now() > Number(data.expires || 0)) {
message: "Kode OTP sudah kedaluwarsa. Minta kode baru.",
if (Number(data.attempts || 0) >= 5) {
message: "Terlalu banyak percobaan salah. Minta kode baru.",
if (String(data.code) !== code) {
message: "Kode OTP salah. " + (remain > 0 ? "Sisa percobaan: " + remain : "Percobaan habis."), };
message: "Verifikasi OTP berhasil. Silakan buat password baru.",
message: "Server error: " + (e && e.message ? e.message : e),
```

### resetPasswordWithToken

```text
if (!consumed.ok)
message: consumed.message || "Token tidak valid.",
if (!uname)
message: "Token tidak terkait dengan akun manapun.",
if (!user) return { status: "error", message: "Akun tidak ditemukan." };
if (!newPass)
return { status: "error", message: "Password baru wajib diisi." };
if (newPass === "123456") {
message: "Password baru tidak boleh password default.",
if (currentExtPass !== null && String(currentExtPass) === newPass) {
message: "Password baru tidak boleh sama dengan password lama.",
if (!complexityCheck.valid) {
return { status: "error", message: complexityCheck.message };
if (!extOk)
message: "Gagal memperbarui password. Hubungi Administrator.",
if (userRowIndex !== -1) {
if ( String(rows[i][1]) === uname && String(rows[i][3]).toLowerCase() === "pending" ) { sheet.deleteRow(i + 1);
if (email && _isValidEmail_(email)) {
message: "Password berhasil diubah. Silakan login dengan password baru Anda.", }; } catch (e) {
message: "Server error: " + (e && e.message ? e.message : e),
```

### saveSecurityQuestion

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali" };
if (!question || !answer)
return { status: "error", message: "Pertanyaan dan jawaban harus diisi" };
if (String(answer).trim().length < 2)
return { status: "error", message: "Jawaban terlalu pendek" };
if (sqIdx === -1) {
if (userRowIndex === -1)
return { status: "error", message: "User tidak ditemukan" };
message: "Pertanyaan keamanan berhasil disimpan",
```

### approveResetRequest

```text
if (!user || user.role !== "admin") return { status: "error" };
if (targetUser) {
if (String(rows[i][0]) === String(requestId)) {
```

### cancelAutoJurnalForHoliday

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Unauthorized: Hanya admin yang dapat membatalkan",
if (autoLogs.length === 0) {
message: "Tidak ada jurnal otomatis yang dapat dibatalkan untuk hari ini", date: dateStr, };
if ( rowDate === dateStr && notes.includes("Auto-generated: Libur Bonus") ) { const userId = String(row[2]);
if (String(lockData[i][0]) === lockId) {
message: `Berhasil membatalkan ${deletedLogs.length} jurnal otomatis`,
message: "Server error saat pembatalan: " + error.toString(),
```

### addHolidayRange

```text
if (!user || user.role !== "admin")
return { status: "error", message: "Unauthorized" };
if (!dateFrom || !dateTo || !desc)
return { status: "error", message: "Data tidak lengkap" };
if (dTo < dFrom)
message: "Tanggal selesai tidak boleh kurang dari tanggal mulai",
message: `Berhasil menambahkan ${count} hari libur`,
```

### addExamPeriod

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat membuat periode ujian.",
if (!data.name || !String(data.name).trim()) {
return { status: "error", message: "Nama periode ujian wajib diisi." };
if (!data.date_start) {
return { status: "error", message: "Tanggal mulai wajib diisi." };
if (!data.date_end) {
return { status: "error", message: "Tanggal selesai wajib diisi." };
if (String(data.date_start) > String(data.date_end)) {
message: "Tanggal mulai tidak boleh setelah tanggal selesai.",
if (isNaN(jtm) || jtm < 0) {
message: "Nilai JTM Panitia per hari harus berupa angka (minimal 0).",
message: "Periode ujian berhasil dibuat.",
return { status: "error", message: e.message };
```

### editExamPeriod

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat mengedit periode ujian.", }; }
if (!data.id)
return { status: "error", message: "ID periode tidak ditemukan." };
if (!data.name || !String(data.name).trim()) {
return { status: "error", message: "Nama periode wajib diisi." };
if (!data.date_start || !data.date_end) {
message: "Tanggal mulai dan selesai wajib diisi.",
if (String(data.date_start) > String(data.date_end)) {
message: "Tanggal mulai tidak boleh setelah tanggal selesai.",
if (isNaN(jtm) || jtm < 0) {
message: "Nilai JTM Panitia per hari harus berupa angka (minimal 0).",
if (!existing)
return { status: "error", message: "Periode ujian tidak ditemukan." };
if (_examToday_() >= String(existing.date_start)) {
message: "Periode yang sudah dimulai atau selesai tidak dapat diedit.",
if (String(rows[i][0]) === String(data.id)) {
message: "Periode ujian berhasil diperbarui.",
return { status: "error", message: e.message };
```

### deleteExamPeriod

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat menghapus periode ujian.", }; }
if (!id) return { status: "error", message: "ID periode tidak ditemukan." };
if (!existing)
return { status: "error", message: "Periode ujian tidak ditemukan." };
if (!force) {
if (hasConfirmedSup || hasConfirmedCom) {
message: "Periode ini sudah memiliki data konfirmasi dan JTM terhitung. " + "Penghapusan akan menghapus semua data terkait secara permanen. Lanjutkan?", };
if (String(sesData[i][1]) === String(id)) sesSheet.deleteRow(i + 1);
if (String(comData[i][1]) === String(id)) comSheet.deleteRow(i + 1);
message: "Periode ujian dan semua data terkait berhasil dihapus.",
return { status: "error", message: e.message };
```

### addExamSession

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat menambah sesi ujian.",
if (!data.period_id)
return { status: "error", message: "ID periode wajib diisi." };
if (!data.date)
return { status: "error", message: "Tanggal sesi wajib diisi." };
if (!data.session_name || !String(data.session_name).trim()) {
return { status: "error", message: "Nama sesi wajib diisi." };
if (!data.time_start)
return { status: "error", message: "Jam mulai sesi wajib diisi." };
if (!data.time_end)
return { status: "error", message: "Jam selesai sesi wajib diisi." };
if (ts >= te) {
message: "Jam mulai harus sebelum jam selesai.",
if (isNaN(jtm) || jtm < 0) {
message: "Nilai JTM per sesi harus berupa angka (minimal 0).",
if (!period)
return { status: "error", message: "Periode ujian tidak ditemukan." };
if ( sesDate < String(period.date_start) || sesDate > String(period.date_end) ) { return {
message: "Tanggal sesi harus berada dalam rentang periode ujian (" + period.date_start + " s.d. " +
message: "Sesi ujian berhasil ditambahkan.",
return { status: "error", message: e.message };
```

### editExamSession

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat mengedit sesi ujian.",
if (!data.id)
return { status: "error", message: "ID sesi tidak ditemukan." };
if (!data.session_name || !String(data.session_name).trim()) {
return { status: "error", message: "Nama sesi wajib diisi." };
if (!data.time_start || !data.time_end) {
message: "Jam mulai dan jam selesai wajib diisi.",
if (ts >= te) {
message: "Jam mulai harus sebelum jam selesai.",
if (isNaN(jtm) || jtm < 0) {
message: "Nilai JTM per sesi harus berupa angka (minimal 0).",
if (hasConfirmed) {
message: "Sesi ini sudah memiliki pengawas yang dikonfirmasi kehadirannya dan tidak dapat diedit.", }; }
if (String(rows[i][0]) === String(data.id)) {
message: "Sesi ujian berhasil diperbarui.",
return { status: "error", message: "Sesi ujian tidak ditemukan." };
return { status: "error", message: e.message };
```

### deleteExamSession

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat menghapus sesi ujian.",
if (!id) return { status: "error", message: "ID sesi tidak ditemukan." };
if (hasConfirmed) {
message: "Sesi ini sudah memiliki pengawas yang dikonfirmasi kehadirannya dan tidak dapat dihapus.", }; }
return { status: "success", message: "Sesi ujian berhasil dihapus." };
return { status: "error", message: e.message };
```

### addExamRoom

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat menambah ruang ujian.",
if (!data.session_id)
return { status: "error", message: "ID sesi wajib diisi." };
if (!data.room_name || !String(data.room_name).trim())
return { status: "error", message: "Nama/nomor ruang wajib diisi." };
if (!data.subject || !String(data.subject).trim())
return { status: "error", message: "Mata ujian wajib diisi." };
if (!data.class_name || !String(data.class_name).trim())
return { status: "error", message: "Nama kelas wajib diisi." };
if (totalSiswa < 0) {
return { status: "error", message: "Total siswa tidak boleh negatif." };
if (!_examGetSession_(data.session_id)) {
return { status: "error", message: "Sesi ujian tidak ditemukan." };
message: "Ruang ujian berhasil ditambahkan.",
return { status: "error", message: e.message };
```

### editExamRoom

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat mengedit ruang ujian.",
if (!data.id)
return { status: "error", message: "ID ruang tidak ditemukan." };
if (!data.room_name || !String(data.room_name).trim())
return { status: "error", message: "Nama/nomor ruang wajib diisi." };
if (!data.subject || !String(data.subject).trim())
return { status: "error", message: "Mata ujian wajib diisi." };
if (!data.class_name || !String(data.class_name).trim())
return { status: "error", message: "Nama kelas wajib diisi." };
if (totalSiswa < 0) {
return { status: "error", message: "Total siswa tidak boleh negatif." };
if (hasConfirmed) {
message: "Ruang ini sudah memiliki pengawas yang dikonfirmasi dan tidak dapat diedit.", }; }
if (String(rows[i][0]) === String(data.id)) {
message: "Ruang ujian berhasil diperbarui.",
return { status: "error", message: "Ruang ujian tidak ditemukan." };
return { status: "error", message: e.message };
```

### deleteExamRoom

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat menghapus ruang ujian.",
if (!id) return { status: "error", message: "ID ruang tidak ditemukan." };
if (hasConfirmed) {
message: "Ruang ini sudah memiliki pengawas yang dikonfirmasi dan tidak dapat dihapus.", }; }
return { status: "success", message: "Ruang ujian berhasil dihapus." };
return { status: "error", message: e.message };
```

### assignExamSupervisor

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat menetapkan pengawas.",
if (!data.room_id)
return { status: "error", message: "ID ruang wajib diisi." };
if (!data.user_id)
return { status: "error", message: "ID guru wajib diisi." };
if (!room)
return { status: "error", message: "Ruang ujian tidak ditemukan." };
if (!targetGuru)
return { status: "error", message: "Guru tidak ditemukan." };
if (conflict) return { status: "error", message: conflict };
if (isNaN(jtmVal) || jtmVal < 0) {
message: "Pengawas berhasil ditetapkan.",
return { status: "error", message: e.message };
```

### editExamSupervisor

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat mengedit pengawas.",
if (!data || !data.id)
return { status: "error", message: "ID pengawas tidak ditemukan." };
if (!data.user_id)
return { status: "error", message: "ID guru wajib diisi." };
if (!target)
return { status: "error", message: "Data pengawas tidak ditemukan." };
if (target.confirmed_by && String(target.confirmed_by).trim() !== "") {
message: "Pengawas yang sudah dikonfirmasi kehadirannya tidak dapat diedit. " + "Cabut konfirmasi kehadiran terlebih dahulu.", };
if (isSub) {
message: "Pengawas pengganti tidak dapat diedit langsung. Gunakan tombol Batal Ganti terlebih dahulu.", }; }
if (!room)
message: "Ruang ujian tidak ditemukan untuk pengawas ini.",
if (!targetGuru)
return { status: "error", message: "Guru tidak ditemukan." };
if (userChanged) {
if (conflict) return { status: "error", message: conflict };
if (isNaN(jtmVal) || jtmVal < 0) {
if (String(rows[i][0]) === String(data.id)) {
if (!updated)
message: "Gagal memperbarui data pengawas (baris tidak ditemukan).",
return { status: "success", message: "Data pengawas berhasil diperbarui." };
return { status: "error", message: e.message };
```

### removeExamSupervisor

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat menghapus pengawas.",
if (!supervisor_id)
return { status: "error", message: "ID pengawas tidak ditemukan." };
if (!target)
return { status: "error", message: "Data pengawas tidak ditemukan." };
if (target.confirmed_by && String(target.confirmed_by).trim() !== "") {
message: "Pengawas yang sudah dikonfirmasi kehadirannya tidak dapat dihapus langsung. " + "Cabut konfirmasi kehadiran terlebih dahulu.", };
message: "Pengawas berhasil dihapus dari jadwal.",
return { status: "error", message: e.message };
```

### assignExamCommittee

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat menetapkan panitia.",
if (!data.period_id)
return { status: "error", message: "ID periode wajib diisi." };
if (!data.date) return { status: "error", message: "Tanggal wajib diisi." };
if (!data.user_id)
return { status: "error", message: "ID guru wajib diisi." };
if (!period)
return { status: "error", message: "Periode ujian tidak ditemukan." };
if ( comDate < String(period.date_start) || comDate > String(period.date_end) ) { return {
message: "Tanggal panitia harus berada dalam rentang periode ujian (" + period.date_start + " s.d. " +
if (!targetGuru)
return { status: "error", message: "Guru tidak ditemukan." };
if (conflict) return { status: "error", message: conflict };
message: "Panitia berhasil ditetapkan.",
return { status: "error", message: e.message };
```

### removeExamCommittee

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat menghapus panitia.",
if (!committee_id)
return { status: "error", message: "ID panitia tidak ditemukan." };
if (!target)
return { status: "error", message: "Data panitia tidak ditemukan." };
if (target.confirmed_by && String(target.confirmed_by).trim() !== "") {
message: "Panitia yang sudah dikonfirmasi kehadirannya tidak dapat dihapus langsung. " + "Cabut konfirmasi kehadiran terlebih dahulu.", };
message: "Panitia berhasil dihapus dari jadwal.",
return { status: "error", message: e.message };
```

### confirmCommitteeAttendance

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat mengonfirmasi kehadiran Panitia.", }; }
if (!committee_id)
return { status: "error", message: "ID panitia tidak ditemukan." };
if (!target)
return { status: "error", message: "Data panitia tidak ditemukan." };
if (_examToday_() !== String(target.date)) {
message: "Konfirmasi hanya dapat dilakukan pada hari pelaksanaan (hari H).", }; }
if (String(target.status) !== "active") {
return { status: "error", message: "Rekord panitia ini tidak aktif." };
if (target.confirmed_by && String(target.confirmed_by).trim() !== "") {
message: "Panitia ini sudah dikonfirmasi kehadirannya.",
if (String(rows[i][0]) === String(committee_id)) {
if (!found)
return { status: "error", message: "Gagal memperbarui data konfirmasi." };
message: "Kehadiran Panitia berhasil dikonfirmasi. JTM telah dicatat.",
return { status: "error", message: e.message };
```

### revokeCommitteeAttendance

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat mencabut konfirmasi Panitia.", }; }
if (!committee_id)
return { status: "error", message: "ID panitia tidak ditemukan." };
if (!target)
return { status: "error", message: "Data panitia tidak ditemukan." };
if (_examToday_() !== String(target.date)) {
message: "Konfirmasi hanya dapat dicabut pada hari pelaksanaan (hari H).", }; }
if (!target.confirmed_by || String(target.confirmed_by).trim() === "") {
message: "Panitia ini belum dikonfirmasi kehadirannya.",
if (String(rows[i][0]) === String(committee_id)) {
message: "Konfirmasi kehadiran Panitia berhasil dicabut. JTM telah dihapus dari honorarium.", }; } catch (e) {
return { status: "error", message: e.message };
```

### confirmSupervisorAttendance

```text
if (!user)
message: "Sesi tidak valid, silakan login kembali.",
if (!supervisor_id)
return { status: "error", message: "ID pengawas tidak ditemukan." };
if (!target)
return { status: "error", message: "Data pengawas tidak ditemukan." };
if (!room)
return { status: "error", message: "Ruang ujian tidak ditemukan." };
if (!session)
return { status: "error", message: "Sesi ujian tidak ditemukan." };
if (_examToday_() !== sessionDate) {
message: "Konfirmasi hanya dapat dilakukan pada hari pelaksanaan (hari H).", }; }
if (!auth.ok) return { status: "error", message: auth.error };
if (String(target.status) !== "active") {
return { status: "error", message: "Rekord pengawas ini tidak aktif." };
if (target.confirmed_by && String(target.confirmed_by).trim() !== "") {
message: "Pengawas ini sudah dikonfirmasi kehadirannya.",
if (String(rows[i][0]) === String(supervisor_id)) {
message: "Kehadiran Pengawas berhasil dikonfirmasi. Pengawas dapat mengisi BAP setelah sesi berakhir + 5 menit.", }; }
return { status: "error", message: "Gagal memperbarui data konfirmasi." };
return { status: "error", message: e.message };
```

### revokeSupervisorAttendance

```text
if (!user)
message: "Sesi tidak valid, silakan login kembali.",
if (!supervisor_id)
return { status: "error", message: "ID pengawas tidak ditemukan." };
if (!target)
return { status: "error", message: "Data pengawas tidak ditemukan." };
if (!room)
return { status: "error", message: "Ruang ujian tidak ditemukan." };
if (!session)
return { status: "error", message: "Sesi ujian tidak ditemukan." };
if (_examToday_() !== sessionDate) {
message: "Konfirmasi hanya dapat dicabut pada hari pelaksanaan (hari H).", }; }
if (!auth.ok) return { status: "error", message: auth.error };
if (!target.confirmed_by || String(target.confirmed_by).trim() === "") {
code: JTM_ERROR_CODES.NO_ACTIVE_CONFIRMATION,
message: "Pengawas ini belum dikonfirmasi kehadirannya.",
if (hasBap && !force) {
message: "Pencabutan konfirmasi akan mengunci BAP Pengawas dan menghapus JTM-nya dari honorarium. Lanjutkan?", }; }
if (hasBap) {
if (String(rows[i][0]) === String(supervisor_id)) {
message: hasBap
return { status: "error", message: e.message };
```

### submitExamBAP

```text
if (!user)
message: "Sesi tidak valid, silakan login kembali.",
if (!supervisor_id)
return { status: "error", message: "ID pengawas tidak ditemukan." };
if (!target)
return { status: "error", message: "Data pengawas tidak ditemukan." };
if (String(target.user_id) !== String(user.id)) {
message: "Anda tidak terdaftar sebagai pengawas pada jadwal ini.",
if (String(target.status) === "cancelled") {
message: "Substitusi Anda pada jadwal ini telah dibatalkan.",
if (String(target.status) !== "active") {
return { status: "error", message: "Rekord pengawas ini tidak aktif." };
if (!target.confirmed_by || String(target.confirmed_by).trim() === "") {
message: "Kehadiran Anda belum dikonfirmasi Panitia. BAP belum dapat diisi.", }; }
if (!room)
return { status: "error", message: "Ruang ujian tidak ditemukan." };
if (!session)
return { status: "error", message: "Sesi ujian tidak ditemukan." };
if (!period)
return { status: "error", message: "Periode ujian tidak ditemukan." };
if (_examToday_() > String(period.date_end)) {
message: "Periode ujian sudah selesai. BAP tidak dapat diubah.",
if (timingError) return { status: "error", message: timingError };
if ( existing && existing.submitted_at && String(existing.submitted_at).trim() !== "" ) {
message: "BAP sudah pernah disubmit. Gunakan fitur Edit BAP untuk mengubah isian.", }; }
if (isNaN(hadir) || hadir < 0 || isNaN(absen) || absen < 0) {
message: "Jumlah peserta hadir dan tidak hadir wajib diisi dan tidak boleh negatif.", }; }
if (totalSiswaAdmin > 0 && totalSiswaBAP !== totalSiswaAdmin) {
message: `Jumlah total siswa tidak sesuai. Total siswa di ruang ini: ${totalSiswaAdmin} (Hadir: ${hadir} + Alpa: ${absen} = ${totalSiswaBAP}). Silakan periksa kembali data kehadiran.`,
if (jtmAdjustment) {
if ( dateMatches && storedAdjusted !== null && storedAdjusted !== undefined && storedAdjusted !== "" &&
message: "BAP berhasil dikirim. JTM Pengawas telah dicatat ke sistem honorarium.", }; } catch (e) {
return { status: "error", message: e.message };
```

### editExamBAP

```text
if (!user)
message: "Sesi tidak valid, silakan login kembali.",
if (!supervisor_id)
return { status: "error", message: "ID pengawas tidak ditemukan." };
if (!target)
return { status: "error", message: "Data pengawas tidak ditemukan." };
if (String(target.user_id) !== String(user.id)) {
message: "Anda tidak terdaftar sebagai pengawas pada jadwal ini.",
if (String(target.status) === "cancelled") {
message: "Substitusi Anda pada jadwal ini telah dibatalkan. BAP bersifat read-only.", }; }
if (String(target.status) !== "active") {
return { status: "error", message: "Rekord pengawas ini tidak aktif." };
if (!target.confirmed_by || String(target.confirmed_by).trim() === "") {
message: "Kehadiran Anda belum dikonfirmasi. BAP tidak dapat diedit.",
if (!room)
return { status: "error", message: "Ruang ujian tidak ditemukan." };
if (!session)
return { status: "error", message: "Sesi ujian tidak ditemukan." };
if (!period)
return { status: "error", message: "Periode ujian tidak ditemukan." };
if (_examToday_() > String(period.date_end)) {
message: "Periode ujian sudah selesai. BAP tidak dapat diubah.",
if (timingError) return { status: "error", message: timingError };
if ( !existing || !existing.submitted_at || String(existing.submitted_at).trim() === "" ) {
message: "BAP belum pernah disubmit. Gunakan Submit BAP terlebih dahulu.", }; }
if (isNaN(hadir) || hadir < 0 || isNaN(absen) || absen < 0) {
message: "Jumlah peserta hadir dan tidak hadir wajib diisi dan tidak boleh negatif.", }; }
if (totalSiswaAdmin > 0 && totalSiswaBAP !== totalSiswaAdmin) {
message: `Jumlah total siswa tidak sesuai. Total siswa di ruang ini: ${totalSiswaAdmin} (Hadir: ${hadir} + Alpa: ${absen} = ${totalSiswaBAP}). Silakan periksa kembali data kehadiran.`,
if (String(bapRows[i][1]) === String(supervisor_id)) {
if (!updated)
return { status: "error", message: "Gagal memperbarui data BAP." };
return { status: "success", message: "BAP berhasil diperbarui." };
return { status: "error", message: e.message };
```

### cancelExamSupervisorSubstitution

```text
if (!user)
message: "Sesi tidak valid, silakan login kembali.",
if (!supervisor_id)
return { status: "error", message: "ID pengawas tidak ditemukan." };
if (!target)
return { status: "error", message: "Data pengawas tidak ditemukan." };
if (!( target.is_substitute === true || String(target.is_substitute) === "true" )) { return { status: "error",
message: "Rekord ini bukan pengganti. Pembatalan tidak berlaku.",
if (String(target.status) !== "active") {
return { status: "error", message: "Substitusi ini sudah tidak aktif." };
if (!room)
return { status: "error", message: "Ruang ujian tidak ditemukan." };
if (!session)
return { status: "error", message: "Sesi ujian tidak ditemukan." };
if (_examToday_() !== sessionDate) {
message: "Pembatalan substitusi hanya dapat dilakukan pada hari H.",
if (!auth.ok) return { status: "error", message: auth.error };
if (isConfirmed && hasBap && !force) {
message: "Guru pengganti sudah mengisi dan menyerahkan BAP. " + "Pembatalan akan mengunci BAP pengganti dan menghapus JTM-nya dari honorarium. " + "Guru asli akan dikembalikan ke jadwal. Lanjutkan?",
if (isConfirmed && hasBap) {
if (String(supRows[i][0]) === String(supervisor_id)) {
if ( String(freshRows[i][1]) === String(target.room_id) && String(freshRows[i][2]) === originalUserId && String(freshRows[i][3]) === "substituted" ) {
message: "Substitusi pengawas berhasil dibatalkan. Guru asli telah dikembalikan ke jadwal.", }; } catch (e) {
return { status: "error", message: e.message };
```

### cancelExamCommitteeSubstitution

```text
if (!user || String(user.role).toLowerCase() !== "admin") {
message: "Akses ditolak. Hanya Admin yang dapat membatalkan substitusi Panitia.", }; }
if (!committee_id)
return { status: "error", message: "ID panitia tidak ditemukan." };
if (!target)
return { status: "error", message: "Data panitia tidak ditemukan." };
if (!( target.is_substitute === true || String(target.is_substitute) === "true" )) { return { status: "error",
message: "Rekord ini bukan pengganti. Pembatalan tidak berlaku.",
if (String(target.status) !== "active") {
return { status: "error", message: "Substitusi ini sudah tidak aktif." };
if (_examToday_() !== comDate) {
message: "Pembatalan substitusi hanya dapat dilakukan pada hari H.",
if (isConfirmed && !force) {
message: "Guru pengganti sudah dikonfirmasi kehadirannya dan JTM-nya sudah terhitung. " + "Pembatalan akan menghapus JTM pengganti dari honorarium. " + "Guru asli akan dikembalikan ke jadwal. Lanjutkan?",
if (isConfirmed) {
if (String(comRows[i][0]) === String(committee_id)) {
if ( String(freshRows[i][1]) === String(target.period_id) && String(freshRows[i][2]) === comDate && String(freshRows[i][3]) === originalUserId && String(freshRows[i][5]) === "substituted"
message: "Substitusi panitia berhasil dibatalkan. Guru asli telah dikembalikan ke jadwal.", }; } catch (e) {
return { status: "error", message: e.message };
```

### adjustOccurrenceJtm

```text
if (!user) {
message: "Sesi tidak valid, silakan login kembali.",
if (occurrenceType === "KBM") {
if (!occurrenceRef) {
message: "ID jadwal (schedule_id) tidak ditemukan.",
if (!schedule) {
return { status: "error", message: "Jadwal KBM tidak ditemukan." };
} else if (occurrenceType === "PIKET") {
if (!picketTargetUid) {
message: "target_user_id tidak ditemukan untuk penyesuaian piket.",
if (!picketLog) {
message: "Kehadiran piket belum dikonfirmasi. Konfirmasi kehadiran terlebih dahulu sebelum menyesuaikan JTM.", }; }
} else if (occurrenceType === "EXAM") {
message: "ID pengawas (supervisor_id) tidak ditemukan.",
if (!supervisor) {
return { status: "error", message: "Data pengawas tidak ditemukan." };
if (!room) {
return { status: "error", message: "Ruang ujian tidak ditemukan." };
if (!session) {
return { status: "error", message: "Sesi ujian tidak ditemukan." };
message: "Jenis kegiatan (occurrence_type) tidak valid.",
if (!authResult.ok) {
code: authResult.code,
message: authResult.message,
if (!adjRes.ok) {
return { status: "error", code: adjRes.code, message: adjRes.message };
if (!reasonRes.ok) {
code: reasonRes.code,
message: reasonRes.message,
if (!consRes.ok) {
return { status: "error", code: consRes.code, message: consRes.message };
code: JTM_ERROR_CODES.PERSISTENCE_FAILED,
message: "Sistem sedang sibuk memproses penyesuaian lain. Silakan coba lagi.", }; }
message: "Penyesuaian JTM berhasil disimpan.",
message: "Penyesuaian JTM tidak dapat disimpan. Silakan coba lagi.",
```

### reallocateJtmDifference

```text
if (!user) {
message: "Sesi tidak valid, silakan login kembali.",
if (occurrenceType === "KBM") {
if (!occurrenceRef) {
message: "ID jadwal (schedule_id) tidak ditemukan.",
if (!schedule) {
return { status: "error", message: "Jadwal KBM tidak ditemukan." };
} else if (occurrenceType === "PIKET") {
if (!picketUid) {
message: "occurrence_ref tidak valid untuk tipe PIKET.",
if (!pLog) {
message: "Kehadiran piket belum dikonfirmasi. Konfirmasi kehadiran terlebih dahulu.", }; }
} else if (occurrenceType === "EXAM") {
message: "ID pengawas (supervisor_id) tidak ditemukan.",
if (!supervisor) {
return { status: "error", message: "Data pengawas tidak ditemukan." };
if (!room) {
return { status: "error", message: "Ruang ujian tidak ditemukan." };
if (!session) {
return { status: "error", message: "Sesi ujian tidak ditemukan." };
message: "Jenis kegiatan (occurrence_type) tidak valid.",
if (!authResult.ok) {
code: authResult.code,
message: authResult.message,
if ( !rawAllocations || typeof rawAllocations.length !== "number" || rawAllocations.length === 0 ) {
return { status: "error", message: "Tidak ada alokasi JTM yang dikirim." };
if (!substituteUserId) {
code: JTM_ERROR_CODES.ALLOCATION_INVALID,
message: "ID guru pengganti (substitute_user_id) tidak ditemukan.",
if (!allocRes.ok) {
code: allocRes.code,
message: allocRes.message,
if (!consRes.ok) {
return { status: "error", code: consRes.code, message: consRes.message };
code: JTM_ERROR_CODES.PERSISTENCE_FAILED,
message: "Sistem sedang sibuk memproses penyesuaian lain. Silakan coba lagi.", }; }
if (remainingDifference < 0) remainingDifference = 0;
message: "Alokasi JTM pengganti sebagian berhasil disimpan.",
if (written[k].logId) {
message: "Alokasi JTM tidak dapat disimpan. Silakan coba lagi.",
```

### removeReallocation

```text
if (!user) {
message: "Sesi tidak valid, silakan login kembali.",
if (!reallocationId) {
message: "ID alokasi (reallocation_id) tidak ditemukan.",
if (!record) {
message: "Alokasi JTM tidak ditemukan atau sudah dihapus.",
if (occurrenceType === "KBM" || occurrenceType === "PIKET") {
} else if (occurrenceType === "EXAM") {
message: "Jenis kegiatan (occurrence_type) tidak valid.",
if (!authResult.ok) {
code: authResult.code,
message: authResult.message,
code: JTM_ERROR_CODES.PERSISTENCE_FAILED,
message: "Sistem sedang sibuk memproses penyesuaian lain. Silakan coba lagi.", }; }
message: "Alokasi JTM pengganti sebagian berhasil dihapus.",
message: "Alokasi JTM tidak dapat dihapus. Silakan coba lagi.",
```

### resetOccurrenceJtm

```text
if (!user) {
message: "Sesi tidak valid, silakan login kembali.",
if (occurrenceType === "KBM") {
if (!occurrenceRef) {
message: "ID jadwal (schedule_id) tidak ditemukan.",
if (!schedule) {
return { status: "error", message: "Jadwal KBM tidak ditemukan." };
} else if (occurrenceType === "EXAM") {
message: "ID pengawas (supervisor_id) tidak ditemukan.",
if (!supervisor) {
return { status: "error", message: "Data pengawas tidak ditemukan." };
if (!room)
return { status: "error", message: "Ruang ujian tidak ditemukan." };
if (!session)
return { status: "error", message: "Sesi ujian tidak ditemukan." };
} else if (occurrenceType === "PIKET") {
message: "occurrence_ref tidak ditemukan untuk tipe PIKET.",
message: "Jenis kegiatan (occurrence_type) tidak valid.",
if (!authResult.ok) {
code: authResult.code,
message: authResult.message,
if (!existing) {
code: "NOT_FOUND",
message: "Tidak ada penyesuaian JTM aktif untuk kegiatan ini.",
code: JTM_ERROR_CODES.PERSISTENCE_FAILED,
message: "Sistem sedang sibuk. Silakan coba lagi.",
if (realloc.id) {
message: "Penyesuaian JTM berhasil dibatalkan. JTM kembali ke nilai terjadwal.", }; } catch (writeErr) {
message: "Gagal membatalkan penyesuaian JTM: " + writeErr.message,
return { status: "error", message: "Terjadi kesalahan: " + e.message };
```

### saveTransportConfig

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali" };
if (String(user.role).toLowerCase() !== "admin") {
return { status: "error", message: "Akses hanya untuk Admin" };
if ( rawTarif === null || rawTarif === undefined || rawTarif === "" || isNaN(tarif) ||
message: "Tarif per KM harus berupa angka positif antara 1 dan 999.999.999.", }; }
if (String(existingData[i][0]) === key) {
if (rowIndex > 0) {
message: "Konfigurasi tunjangan transportasi berhasil disimpan.",
return { status: "error", message: "Terjadi kesalahan server. Coba lagi." };
```

### saveAttendanceTimeIn

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali." };
if (!targetUserId || !dateStr) {
return { status: "error", message: "user_id dan date wajib diisi." };
if (!rTime.test(timeIn)) {
message: "Format jam tidak valid. Gunakan format HH:mm (contoh: 07:30).", }; }
if (!isAdmin) {
if ( String(s.substitute_user_id) !== String(user.id) || String(s.date) !== dateStr ) return false;
if (sid === "PICKET-DUTY" || sid === "PIKET") return true;
if (callerIsPicket) {
if (!callerHasTimeIn) {
message: "Kehadiran piket Anda belum dikonfirmasi admin. Hubungi admin untuk konfirmasi terlebih dahulu.", }; }
if ( String(s.substitute_user_id) !== String(targetUserId) || String(s.date) !== dateStr ) return false;
if (targetIsPicket) {
if (isSelf) {
if (!hasTeachingToday) {
message: "Pencatatan jam kehadiran guru piket hanya dapat dilakukan oleh admin.", }; }
if (callerIsPanitia) {
if (!targetIsExamSupervisor) {
message: "Panitia ujian hanya dapat mencatat jam kehadiran pengawas ujian.", }; }
message: "Jam masuk aktual Anda belum diinput admin. Hubungi admin terlebih dahulu.", }; }
} else if (!isSelfRecord) {
message: "Anda tidak memiliki wewenang untuk mencatat kehadiran guru lain.", }; }
if (colIdx[colName] !== undefined) return;
if (rowUserId === targetUserId && rowDateStr === dateStr) {
if (!foundSchedTimeIn || !rTime.test(foundSchedTimeIn)) {
message: "Jam jadwal masuk belum diatur oleh admin.",
if (inMinutes < schedMinutes) {
message: "Jam datang tidak boleh lebih awal dari jadwal masuk (" + foundSchedTimeIn + ").",
if (foundRowNum > 0) {
message: "Record kehadiran tidak ditemukan. Muat ulang halaman dan coba lagi.", }; }
return { status: "success", message: "Jam datang berhasil dicatat." };
return { status: "error", message: "Terjadi kesalahan server. Coba lagi." };
```

### saveAttendanceTimeOut

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali." };
if (!targetUserId || !dateStr) {
return { status: "error", message: "user_id dan date wajib diisi." };
if (!rTime.test(timeOut)) {
message: "Format jam tidak valid. Gunakan format HH:mm (contoh: 14:30).", }; }
if (!isAdmin) {
if ( String(s.substitute_user_id) !== String(user.id) || String(s.date) !== dateStr ) return false;
if (sid === "PICKET-DUTY" || sid === "PIKET") return true;
if (callerIsPicket) {
if (!callerHasTimeIn) {
message: "Kehadiran piket Anda belum dikonfirmasi admin. Hubungi admin untuk konfirmasi terlebih dahulu.", }; }
if ( String(s.substitute_user_id) !== String(targetUserId) || String(s.date) !== dateStr ) return false;
if (targetIsPicket) {
if (isSelf) {
if (!hasTeachingToday) {
message: "Pencatatan jam kehadiran guru piket hanya dapat dilakukan oleh admin.", }; }
if (callerIsPanitia) {
if (!targetIsExamSupervisor) {
message: "Panitia ujian hanya dapat mencatat jam kehadiran pengawas ujian.", }; }
message: "Jam masuk aktual Anda belum diinput admin. Hubungi admin terlebih dahulu.", }; }
} else if (!isSelfRecord) {
message: "Anda tidak memiliki wewenang untuk mencatat kehadiran guru lain.", }; }
if (colIdx[colName] !== undefined) return;
if (rowUserId === targetUserId && rowDateStr === dateStr) {
if (!foundTimeIn || !rTime.test(foundTimeIn)) {
message: "Jam datang belum dicatat. Catat jam datang terlebih dahulu.",
if (!foundSchedTimeOut || !rTime.test(foundSchedTimeOut)) {
message: "Jam jadwal pulang belum diatur oleh admin.",
if (!isAdmin && nowJkt < availableFromMinutes) {
message: "Input jam pulang tersedia pada pukul " + availStr + ".",
if (outMinutes > schedOutMinutes) {
message: "Jam pulang tidak boleh melebihi jadwal pulang (" + foundSchedTimeOut + ").",
if (foundRowNum > 0) {
if (colIdx["id"] !== undefined) newRow[colIdx["id"]] = generateId("ATT");
if (colIdx["date"] !== undefined) newRow[colIdx["date"]] = dateStr;
if (colIdx["user_id"] !== undefined)
if (colIdx["status"] !== undefined) newRow[colIdx["status"]] = "";
if (colIdx["time_out"] !== undefined)
return { status: "success", message: "Jam pulang berhasil dicatat." };
return { status: "error", message: "Terjadi kesalahan server. Coba lagi." };
```

### addExtraAttendee

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali." };
if (!targetUserId || !dateStr) {
message: "target_user_id dan date wajib diisi.",
if (!reason) {
return { status: "error", message: "Alasan penambahan wajib diisi." };
if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
return { status: "error", message: "Format tanggal tidak valid." };
if (!isAdmin) {
if (!isPicketOriginal && !isPicketSub) {
message: "Hanya admin atau guru piket yang dapat menambahkan guru.",
if (!myRec || !String(myRec.time_in || "").trim()) {
message: "Kehadiran piket Anda belum dikonfirmasi admin.",
if (!targetUser) {
return { status: "error", message: "Guru yang dipilih tidak ditemukan." };
if (String(targetUser.role).toLowerCase() === "admin") {
message: "Akun admin tidak dapat ditambahkan ke daftar kehadiran guru.",
if (attCI[col] !== undefined) return;
if (rowUid === targetUserId && rowDateStr === dateStr) {
if (existingRecord) {
if (existingSchedIn) {
message: String(targetUser.full_name) + " sudah memiliki jadwal resmi hari ini dan sudah ada di Daftar Kehadiran.", };
if (!rTime3.test(tplSchedIn)) tplSchedIn = "";
if (!rTime3.test(tplSchedOut)) tplSchedOut = "";
if (foundRowNum > 0) {
if (attCI["notes"] !== undefined)
if (attCI["extra_attendee"] !== undefined)
if (tplSchedIn && attCI["sched_time_in"] !== undefined)
if (tplSchedOut && attCI["sched_time_out"] !== undefined)
if (attCI["id"] !== undefined) newRow[attCI["id"]] = generateId("ATT");
if (attCI["date"] !== undefined) newRow[attCI["date"]] = dateStr;
if (attCI["user_id"] !== undefined)
if (attCI["notes"] !== undefined) newRow[attCI["notes"]] = noteValue;
message: String(targetUser.full_name) + " berhasil ditambahkan ke Daftar Kehadiran.", };
return { status: "error", message: "Terjadi kesalahan server." };
```

### saveAttendanceManual

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali." };
if (!isAdmin) {
message: "Hanya admin yang dapat menyimpan detail.",
if (!targetUserId || !dateStr) {
return { status: "error", message: "user_id dan date wajib diisi." };
if (timeIn && !rTime.test(timeIn)) {
message: "Format jam datang tidak valid. Gunakan HH:mm (contoh: 07:30).", }; }
if (timeOut && !rTime.test(timeOut)) {
message: "Format jam pulang tidak valid. Gunakan HH:mm (contoh: 14:30).", }; }
if (timeIn && timeOut) {
if (outMins < inMins) {
message: "Jam pulang tidak boleh lebih awal dari jam datang.",
if (colIdx[colName] !== undefined) return;
if (rowUserId === String(targetUserId) && rowDateStr === dateStr) {
if (foundRowNum > 0) {
if (colIdx["id"] !== undefined) newRow[colIdx["id"]] = generateId("ATT");
if (colIdx["date"] !== undefined) newRow[colIdx["date"]] = dateStr;
if (colIdx["user_id"] !== undefined)
if (colIdx["status"] !== undefined) newRow[colIdx["status"]] = attStatus;
if (colIdx["time_in"] !== undefined) newRow[colIdx["time_in"]] = timeIn;
if (colIdx["time_out"] !== undefined)
return { status: "success", message: "Data kehadiran berhasil disimpan." };
return { status: "error", message: "Terjadi kesalahan server." };
```

### saveAttendanceSchedTemplate

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali." };
if (String(user.role).toLowerCase() !== "admin")
message: "Hanya Admin yang dapat mengatur jam jadwal.",
if (isNaN(dayIndex) || dayIndex < 1 || dayIndex > 6)
return { status: "error", message: "Hari tidak valid." };
if (schedType !== "KBM" && schedType !== "UJIAN")
return { status: "error", message: "Tipe jadwal tidak valid." };
if (!rTime.test(schedTimeIn) || !rTime.test(schedTimeOut))
message: "Format jam tidak valid. Gunakan HH:mm.",
if (outMins <= inMins)
message: "Jam pulang harus lebih akhir dari jam masuk.",
if (colIdx["sched_type"] === undefined) {
if (rDay === dayIndex && rType === schedType) {
if (foundRow > 0) {
if (colIdx["id"] !== undefined)
if (colIdx["day_index"] !== undefined)
if (colIdx["sched_type"] !== undefined)
if (colIdx["sched_time_in"] !== undefined)
if (colIdx["sched_time_out"] !== undefined)
if (applyDate && /^\d{4}-\d{2}-\d{2}$/.test(applyDate)) {
if (applyResult)
return { status: "success", message: msg };
return { status: "error", message: "Terjadi kesalahan server." };
```

### deleteAttendanceSchedTemplate

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali." };
if (String(user.role).toLowerCase() !== "admin")
message: "Hanya Admin yang dapat menghapus jam jadwal.",
if (colId < 0) colId = 0;
if (String(rows[i][colId]) === String(id)) {
return { status: "success", message: "Jam jadwal berhasil dihapus." };
return { status: "error", message: "Data tidak ditemukan." };
return { status: "error", message: "Terjadi kesalahan server." };
```

### saveAttendanceSched

```text
if (!caller) {
return { status: "error", message: "Sesi habis, silakan login kembali." };
if (String(caller.role || "").toLowerCase() !== "admin") {
message: "Hanya Admin yang dapat mengatur jam jadwal.",
if (!userId || !dateStr) {
message: "Data tidak lengkap (user_id dan date wajib diisi).",
if (!TIME_RE.test(schedTimeIn) || !TIME_RE.test(schedTimeOut)) {
message: "Format jam jadwal tidak valid. Gunakan format HH:mm (contoh: 07:20).", }; }
if (outMins <= inMins) {
message: "Jam pulang jadwal harus lebih akhir dari jam masuk jadwal.",
if (missingCol) {
message: 'Struktur sheet Daily_Attendance tidak sesuai (kolom "' + missingCol + '" tidak ditemukan).',
if (rowDate instanceof Date) {
if (rowUserId === userId && rowDate === dateStr) {
if (targetRowIndex >= 0) {
if (colIdx["id"] !== undefined) {
return { status: "success", message: "Jam jadwal berhasil disimpan." };
return { status: "error", message: "Terjadi kesalahan server. Coba lagi." };
```

### saveAttendanceLeave

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali." };
if (!targetUserId || !dateStr) {
return { status: "error", message: "user_id dan date wajib diisi." };
if (!reason) {
return { status: "error", message: "Keterangan wajib diisi." };
if (!rTime.test(leaveTime)) {
message: "Format jam keluar tidak valid. Gunakan HH:mm.",
if (!rTime.test(returnTime)) {
message: "Format jam kembali tidak valid. Gunakan HH:mm.",
if (returnMins <= leaveMins) {
message: "Jam kembali harus lebih besar dari jam keluar.",
if (!isAdmin) {
if (callerIsPicket) {
if (!callerRec || !String(callerRec.time_in || "").trim()) {
message: "Kehadiran piket Anda belum dikonfirmasi admin.",
if (targetIsPicket) {
message: "Pencatatan izin keluar guru piket hanya dapat dilakukan oleh admin.", }; }
if (String(targetUserId) !== String(user.id)) {
message: "Anda tidak memiliki wewenang untuk mencatat kehadiran guru lain.", }; }
if (!attRec || !String(attRec.time_in || "").trim()) {
message: "Jam datang guru belum dicatat. Catat jam datang terlebih dahulu.", }; }
if (!rTime.test(exLeave) || !rTime.test(exReturn)) continue;
if (leaveMins < exReturnMins && returnMins > exLeaveMins) {
message: "Rentang waktu tumpang tindih dengan izin keluar yang sudah ada (" + exLeave + "–" +
message: "Izin keluar sementara berhasil dicatat.",
return { status: "error", message: "Terjadi kesalahan server. Coba lagi." };
```

### deleteAttendanceLeave

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali." };
if (rowId === String(leaveId)) {
if (foundRow < 0) {
return { status: "error", message: "Entri izin keluar tidak ditemukan." };
if (!isAdmin) {
if (!callerIsPicket && String(entryUserId) !== String(user.id)) {
message: "Anda tidak berwenang menghapus entri ini.",
message: "Entri izin keluar berhasil dihapus.",
return { status: "error", message: "Terjadi kesalahan server. Coba lagi." };
```

### saveEventDefinition

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali." };
if (!_authorizeEventWriter(user)) {
message: "Akses Ditolak: Halaman ini hanya untuk Admin.",
if (!validation.ok) {
return { status: "error", message: validation.message };
if (duplicate) {
message: "Nama acara sudah digunakan oleh acara lain.",
if (payloadId) {
if ( String(rows[i][colIdx["id"] !== undefined ? colIdx["id"] : 0]) === payloadId ) { foundRowNum = i + 1;
if (foundRowNum === -1) {
return { status: "error", message: "Definisi acara tidak ditemukan." };
return { status: "error", message: "Terjadi kesalahan server." };
```

### deleteEventDefinition

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali." };
if (!_authorizeEventWriter(user)) {
message: "Akses Ditolak: Halaman ini hanya untuk Admin.",
if (!eId) return { status: "error", message: "ID acara tidak valid." };
if (force !== true) {
if (jEventIdCol === -1) jEventIdCol = 1;
if (String(journalRows[j][jEventIdCol]) === eId) {
if (aEventIdCol === -1) aEventIdCol = 1;
if (String(attRows[a][aEventIdCol]) === eId) {
if (dIdCol === -1) dIdCol = 0;
if (String(defRows[d][dIdCol]) === eId) {
return { status: "error", message: "Terjadi kesalahan server." };
```

### saveEventAttendance

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali." };
if (!_authorizeAttendanceWriter(user, isPicketConfirmed)) {
message: _isPanitiaForEvent === false && !_isPicketOfficer(user)
if (timeIn !== "" && !HH_MM.test(timeIn)) {
message: "Format jam masuk tidak valid (gunakan HH:mm).",
if (!YYYY_MM_DD.test(dateStr)) {
message: "Format tanggal tidak valid (gunakan YYYY-MM-DD).",
if (!eventId)
return { status: "error", message: "event_id tidak boleh kosong." };
if (!userId)
return { status: "error", message: "user_id tidak boleh kosong." };
if (!eventDef) {
message: "Acara dengan event_id tersebut tidak ditemukan.",
if (timeIn !== "" && eventTimeStart && HH_MM.test(eventTimeStart) && timeIn < eventTimeStart) {
message: "Jam masuk (" + timeIn + ") tidak boleh kurang dari jam mulai acara (" + eventTimeStart + ").",
if (timeIn !== "" && eventTimeEnd && HH_MM.test(eventTimeEnd) && timeIn >= eventTimeEnd) {
message: "Jam masuk (" + timeIn + ") tidak boleh melebihi jam selesai acara (" + eventTimeEnd + ").",
if (!targetUser || String(targetUser.role || "").toLowerCase() !== "guru") {
message: "Pengguna dengan user_id tersebut bukan guru yang terdaftar.",
if (existing) {
if (String(attRows[i][idCol]) === existingId) {
if (timeIn === "") {
if (js === true || String(js).toUpperCase() === "TRUE") {
message: "Tidak dapat membatalkan kehadiran karena jurnal acara sudah diisi.", }; }
if (email) {
return { status: "error", message: "Terjadi kesalahan server." };
```

### saveEventJournal

```text
if (!user)
return { status: "error", message: "Sesi habis, silakan login kembali." };
if (String(user.role || "").toLowerCase() !== "guru") {
return { status: "error", message: "Akses Ditolak." };
if (!attendanceRecord) {
return { status: "error", message: "Catatan kehadiran tidak ditemukan." };
if (String(attendanceRecord.user_id) !== String(user.id)) {
message: "Akses Ditolak: Jurnal ini bukan milik Anda.",
if (js === true || String(js).toUpperCase() === "TRUE") {
message: "Jurnal untuk acara ini sudah pernah diisi.",
if (!isSameDay && !isH1Entry) {
message: "Jurnal hanya dapat diisi pada hari yang sama dengan kehadiran.", }; }
if (isH1Entry) {
if (!h1EnabledJrn) {
code: "H1_DISABLED",
message: "Fitur input jurnal H-1 tidak aktif. Hubungi Admin untuk mengaktifkannya.",
if (!description) {
message: "Deskripsi jurnal tidak boleh kosong.",
if (description.length > 1000) {
message: "Deskripsi jurnal tidak boleh melebihi 1000 karakter.",
return { status: "error", message: "Terjadi kesalahan server." };
if (String(attRows[i][idCol]) === String(attendanceRecord.id)) {
```

## Lampiran D. Referensi halaman dan interaksi client

### D.1 Seluruh nama halaman terdeteksi

`Page_AdminDailyAttendance`, `Page_Attendance`, `Page_AttendanceList`, `Page_AttendanceSchedule`, `Page_Dashboard`, `Page_EventAttendance`, `Page_EventAttendance_Admin`, `Page_EventJournal`, `Page_EventJournalHistory`, `Page_EventJournalHistory_Admin`, `Page_EventManagement`, `Page_ExamPanitia`, `Page_ExamSchedule`, `Page_Honorarium`, `Page_HonorariumHistory`, `Page_HonorariumHistory_Admin`, `Page_Honorarium_Admin`, `Page_Journal`, `Page_Journal_Admin`, `Page_Login`, `Page_ManageSchedule`, `Page_MyAttendance`, `Page_MySchedule`, `Page_Picket`, `Page_Picket_Admin`, `Page_Profile`, `Page_Settings_BlokAcara`, `Page_Settings_BlokJurnal`, `Page_Settings_BlokTransport`, `Page_Settings_Config`, `Page_Settings_Kalender`, `Page_Settings_Maintenance`, `Page_Settings_Mapel`, `Page_Settings_Pengumuman`, `Page_Settings_Transportasi`, `Page_Settings_Tunjangan`, `Page_StudentAttendance`, `Page_StudentAttendanceHistory`, `Page_StudentAttendanceHistory_Admin`, `Page_StudentAttendanceInput`, `Page_StudentAttendanceInput_Admin`, `Page_Users`

### D.2 Indeks fungsi client

Indeks ini termasuk callback/nested functions dan nama yang didefinisikan ulang. Nama ganda seperti `openSubModalCeremony`, `initSidebarState` atau modal BAP harus ditelaah urutan definisinya; jangan memindahkan keduanya ke React tanpa menggabungkan perilaku efektif yang benar. Fungsi presentasi diganti komponen/hooks; fungsi transaksi harus mengarah ke layanan domain.

| Fungsi | Baris Index.html |
|---|---|
| `formatDateID` | 1109 |
| `formatTimeID` | 1119 |
| `showToast` | 1135 |
| `showConfirm` | 1163 |
| `closeConfirmModal` | 1215 |
| `executeConfirm` | 1220 |
| `setupGlobalModalUX` | 1229 |
| `checkModalState` | 1362 |
| `_getScrollTop` | 1373 |
| `handleTouchStart` | 1384 |
| `handleTouchMove` | 1389 |
| `handleTouchEnd` | 1415 |
| `triggerRefresh` | 1425 |
| `performPageRefresh` | 1436 |
| `resetIndicator` | 1499 |
| `_forceLogout` | 1588 |
| `_stopAllTimers` | 1598 |
| `_runSessionCheck` | 1603 |
| `_resetIdleTimer` | 1620 |
| `_showIdleWarning` | 1635 |
| `_onActivity` | 1659 |
| `_startIdleWatcher` | 1664 |
| `_stopIdleWatcher` | 1670 |
| `_onLoginSuccess` | 1693 |
| `_onLogoutStart` | 1696 |
| `handleNav` | 1704 |
| `_startNavClock` | 1714 |
| `_tick` | 1715 |
| `loadPage` | 1740 |
| `handleLogin` | 1884 |
| `_markFieldError` | 1894 |
| `_restoreBtn` | 1921 |
| `_showLoginError` | 1931 |
| `showMaintenanceModal` | 1995 |
| `closeMaintenanceModal` | 2035 |
| `updateMaintenanceCardStyle` | 2047 |
| `toggleMaintenanceMsgField` | 2076 |
| `toggleScheduledMsgField` | 2084 |
| `saveMaintenanceModeUI` | 2091 |
| `_showLoginInlineError` | 2157 |
| `openLoginModal` | 2171 |
| `closeLoginModal` | 2204 |
| `initLoginPage` | 2216 |
| `_bindCapsHint` | 2217 |
| `updateFromEvent` | 2223 |
| `_bindLiveValidate` | 2239 |
| `updateBtnState` | 2247 |
| `clearError` | 2251 |
| `_bindEyeIcon` | 2268 |
| `onTouchStart` | 2336 |
| `onTouchMove` | 2343 |
| `onTouchEnd` | 2353 |
| `actionLogout` | 2385 |
| `initSettings` | 2394 |
| `saveSystemConfig` | 2456 |
| `saveTransportConfigUI` | 2574 |
| `populateGlobalClassSelects` | 2609 |
| `renderHolidaysList` | 2642 |
| `editHolidayAction` | 2685 |
| `deleteHoliday` | 2695 |
| `resetLiburForm` | 2714 |
| `_syncParallelMaxOptions` | 2758 |
| `renderClassInputs` | 2777 |
| `renderSubjectsList` | 2829 |
| `renderAllowancesList` | 2854 |
| `updateSidebarVisibility` | 2885 |
| `checkExamPanitiaAccess` | 2903 |
| `_applyExamPanitiaNavVisibility` | 2948 |
| `_applyPicketNavVisibility` | 2964 |
| `updateNavbarUser` | 2982 |
| `filterSidebarMenu` | 2999 |
| `footerScrollToTop` | 3082 |
| `_isScrollable` | 3083 |
| `_setupFloatingScrollTopBtn` | 3118 |
| `_findPageScroller` | 3123 |
| `_updateBtnVisibility` | 3133 |
| `_onScroll` | 3148 |
| `_attachScrollListener` | 3154 |
| `_elIsActuallyVisible` | 3168 |
| `_isAnyModalOpen` | 3185 |
| `_refreshModalState` | 3202 |
| `_refreshModalStateThrottled` | 3208 |
| `_setupModalObserver` | 3215 |
| `refreshFloatingScrollTop` | 3238 |
| `navLoadingBarStart` | 3255 |
| `navLoadingBarFinish` | 3264 |
| `updateSidebarActive` | 3277 |
| `initStudentAttendance` | 3347 |
| `_renderStudentAttendanceClasses` | 3379 |
| `_updateSaProgress` | 3442 |
| `openStudentAttendanceModal` | 3455 |
| `closeStudentAttendanceModal` | 3479 |
| `adjustSaInput` | 3485 |
| `updateSaTotal` | 3492 |
| `submitStudentAttendance` | 3559 |
| `initStudentAttendanceHistory` | 3594 |
| `loadStudentAttendanceHistory` | 3612 |
| `renderStudentAttendanceHistoryTable` | 3643 |
| `initPicket` | 3687 |
| `_doInitPicket` | 3716 |
| `refreshPicketPage` | 3837 |
| `_renderPicketHeaderStats` | 3840 |
| `_refreshSubModalTeacherSelect` | 3874 |
| `_refreshPicketAndCeremonySelects` | 3890 |
| `onPicketDayChange` | 3913 |
| `renderPicketSchedule` | 3916 |
| `revokePicketAction` | 3941 |
| `renderAdminPicketSubstitutes` | 3969 |
| `confirmPicketSubPresence` | 4094 |
| `_jsStr` | 4120 |
| `renderTodayPickets` | 4123 |
| `renderDailyScheduleStatus` | 4169 |
| `_jtmSid` | 4382 |
| `toggleJtmAdjustPanel` | 4385 |
| `toggleJtmAdjustPanelSub` | 4396 |
| `loadJtmAdjustState` | 4416 |
| `_jtmAdjStateHandler` | 4443 |
| `recomputeJtmDifferenceDisplay` | 4476 |
| `saveJtmAdjustment` | 4496 |
| `_jtmTeacherName` | 4599 |
| `_jtmPopulateAllocSelect` | 4607 |
| `_jtmRenderAllocList` | 4620 |
| `renderJtmAllocationPanel` | 4647 |
| `addJtmAllocation` | 4672 |
| `removeJtmAllocation` | 4738 |
| `cancelJtmAdjustment` | 4781 |
| `_onCancelSuccess` | 4789 |
| `_onCancelFail` | 4812 |
| `savePicketScheduleAction` | 4831 |
| `deletePicketAction` | 4866 |
| `renderCeremonyAdmin` | 4892 |
| `renderCeremonyPicket` | 4952 |
| `_busyButton` | 5005 |
| `noop` | 5007 |
| `restore` | 5028 |
| `_setRowLoading` | 5040 |
| `noop` | 5041 |
| `noop` | 5043 |
| `noop` | 5044 |
| `restore` | 5052 |
| `_setBlockLoading` | 5060 |
| `noop` | 5061 |
| `noop` | 5064 |
| `restore` | 5072 |
| `_annLoadSeen` | 5085 |
| `_annSaveSeen` | 5091 |
| `_annMarkSeen` | 5094 |
| `_annIsAlreadySeen` | 5100 |
| `_annSanitize` | 5106 |
| `walk` | 5111 |
| `_annFormatDate` | 5163 |
| `_annFormatDateRange` | 5195 |
| `_annSeverityIconSvg` | 5203 |
| `_annSeverityLabel` | 5210 |
| `_annRenderItem` | 5213 |
| `annNav` | 5325 |
| `annPickSeverity` | 5336 |
| `_annOpenModal` | 5345 |
| `closeAnnouncementModal` | 5351 |
| `annAcknowledge` | 5380 |
| `maybeShowAnnouncements` | 5439 |
| `_process` | 5445 |
| `_annUserPickKeys` | 5477 |
| `_annInitUserPickers` | 5478 |
| `_annUserPickRender` | 5524 |
| `annUserPickToggle` | 5561 |
| `annUserPickFilter` | 5587 |
| `annUserPickAll` | 5593 |
| `annUserPickClear` | 5615 |
| `_annUserPickGet` | 5621 |
| `_annAdminLoadList` | 5626 |
| `openAnnouncementEditor` | 5729 |
| `closeAnnouncementEditor` | 5753 |
| `annAdminEdit` | 5757 |
| `annAdminPreview` | 5770 |
| `_doPreview` | 5773 |
| `annAdminToggle` | 5792 |
| `annAdminDelete` | 5812 |
| `submitAnnouncement` | 5839 |
| `previewAnnouncementFromForm` | 5888 |
| `renderUpcomingCeremonies` | 5916 |
| `deleteCeremonyAction` | 5940 |
| `checkCeremonyDate` | 5966 |
| `saveCeremonyAction` | 5990 |
| `loadActiveSubstitutes` | 6031 |
| `initProfile` | 6083 |
| `initPasswordValidation` | 6210 |
| `copyUsernameAction` | 6310 |
| `saveProfileName` | 6345 |
| `saveGuruProfileDetails` | 6402 |
| `_normalizePhoneClient` | 6428 |
| `profile_normalizePhoneOnInput` | 6446 |
| `_refreshEmailVerifyBanner` | 6459 |
| `profile_focusEmailField` | 6466 |
| `_setEmailFieldReadOnly` | 6472 |
| `profile_startChangeEmail` | 6513 |
| `profile_cancelChangeEmail` | 6534 |
| `_isValidEmailClient` | 6552 |
| `profile_validateEmailOnInput` | 6556 |
| `_resetOtpUI` | 6602 |
| `profile_requestEmailOtp` | 6614 |
| `_startOtpCooldown` | 6654 |
| `profile_updateOtpVerifyButton` | 6674 |
| `profile_verifyEmailOtp` | 6680 |
| `changePasswordAction` | 6721 |
| `_checkPasswordRules` | 6777 |
| `togglePassword` | 6797 |
| `showSecurityQuestionOverlay` | 6809 |
| `switchProfileTab` | 6868 |
| `saveSecurityQuestionAction` | 6894 |
| `exportElementToPDF` | 6948 |
| `deleteSubjectAction` | 7022 |
| `deleteAllowanceAction` | 7041 |
| `scrollToDashboardSchedule` | 7064 |
| `_findScrollParent` | 7067 |
| `initDashboard` | 7089 |
| `startDashboardLiveTicker` | 7115 |
| `refreshDashboard` | 7136 |
| `setText` | 7145 |
| `initAdminDashboard` | 7149 |
| `checkAdminAutoJurnalStatus` | 7159 |
| `loadAutoJurnalSchedulerStatus` | 7202 |
| `toggleAutoJurnalScheduler` | 7238 |
| `generateAutoJurnalAction` | 7292 |
| `cancelAutoJurnalAction` | 7332 |
| `renderCancelResult` | 7376 |
| `showAutoJurnalResult` | 7444 |
| `confirmPresenceAction` | 7496 |
| `revokePresenceAction` | 7524 |
| `loadAdminDashboardData` | 7552 |
| `loadGuruDashboardData` | 7631 |
| `_guruStatsCacheKey` | 7686 |
| `_readGuruStatsCache` | 7690 |
| `_writeGuruStatsCache` | 7699 |
| `refreshGuruDashboardCards` | 7704 |
| `_applyGuruDashboardStats` | 7739 |
| `checkAndDisplayHolidayBonus` | 7813 |
| `animateValue` | 7855 |
| `animateRupiah` | 7878 |
| `renderScheduleTable` | 7903 |
| `checkJournalAccess` | 8019 |
| `openH1JournalModal` | 8035 |
| `initJournal` | 8041 |
| `_openViewJournalWithObject` | 8072 |
| `closeViewJournalModal` | 8137 |
| `copyJournalMateri` | 8142 |
| `_fallbackCopy` | 8162 |
| `deleteJournalFromView` | 8173 |
| `editJournalFromView` | 8180 |
| `deleteJournalAction` | 8186 |
| `openJournalModal` | 8219 |
| `_openJournalModalInternal` | 8241 |
| `openJournalEditModal` | 8271 |
| `_resetJournalForm` | 8312 |
| `_renderJournalDurationFromRange` | 8346 |
| `_fetchExpectedStudents` | 8365 |
| `_attachJournalNumberListeners` | 8429 |
| `adjustNumberInput` | 8438 |
| `updateMateriCounter` | 8451 |
| `updateCatatanCounter` | 8465 |
| `updateStudentTotalIndicator` | 8473 |
| `closeJournalModal` | 8602 |
| `openBlokirJurnalModal` | 8617 |
| `closeBlokirJurnalModal` | 8624 |
| `openBlokirAcaraModal` | 8630 |
| `closeBlokirAcaraModal` | 8639 |
| `submitJournal` | 8645 |
| `initUsers` | 8846 |
| `_renderUsersTable` | 8866 |
| `filterUsersTable` | 8938 |
| `filterUsersByRole` | 8939 |
| `openUserModal` | 8954 |
| `editUser` | 8969 |
| `closeUserModal` | 8970 |
| `submitUser` | 8973 |
| `deleteUserAction` | 9017 |
| `resetPassAction` | 9030 |
| `openAllowanceModal` | 9043 |
| `editAllowanceAction` | 9082 |
| `closeAllowanceModal` | 9102 |
| `_maybeReleaseBodyLock` | 9106 |
| `_settingsPreviewAllowance` | 9119 |
| `_settingsUpdateSubjectCounter` | 9138 |
| `submitAllowance` | 9147 |
| `initHonorarium` | 9193 |
| `loadAdminHonorByFilter` | 9210 |
| `continueInitHonorarium` | 9326 |
| `_renderPeriodOptions` | 9359 |
| `_applyTargetPeriode` | 9380 |
| `changeHonorPeriod` | 9424 |
| `downloadSlipPDF` | 9429 |
| `printSlipNative` | 9441 |
| `loadGuruSlip` | 9456 |
| `renderHonorariumTable` | 9565 |
| `getMonthName` | 9588 |
| `checkValidationAction` | 9592 |
| `_restore` | 9621 |
| `showDocVerifyModal` | 9645 |
| `finalizeHonorarium` | 9945 |
| `_restoreBtn` | 9960 |
| `_formatTanggalFinal` | 9998 |
| `filterAdminHistoryByPeriod` | 10011 |
| `filterAdminHistorySearchDebounced` | 10029 |
| `clearAdminHistorySearch` | 10036 |
| `clearAdminHistoryFilter` | 10043 |
| `exportAdminHonorHistoryExcel` | 10052 |
| `_renderAdminFilterMeta` | 10078 |
| `_getInitials` | 10083 |
| `renderAdminHonorHistoryTable` | 10092 |
| `_renderAdminHonorPagination` | 10183 |
| `_getAdminHonorPageNums` | 10231 |
| `changeAdminHonorPage` | 10255 |
| `changeAdminHonorItemsPerPage` | 10267 |
| `showHonorSlip` | 10274 |
| `renderSlipContent` | 10337 |
| `closeSlipModal` | 10435 |
| `exportSlipToPDF` | 10461 |
| `restoreStyles` | 10497 |
| `escapeHtml` | 10545 |
| `fmtTglBlok` | 10561 |
| `sanitizeDateForInput` | 10581 |
| `formatHHmm` | 10587 |
| `initHonorariumHistory` | 10598 |
| `viewSlipFromHistory` | 10767 |
| `_buildGuruHonorFilter` | 10771 |
| `selectGuruHonorYear` | 10796 |
| `selectGuruHonorMonth` | 10823 |
| `resetGuruHonorFilter` | 10830 |
| `_applyGuruHonorFilter` | 10833 |
| `_renderGuruHonorCards` | 10878 |
| `initManageSchedule` | 10965 |
| `_populateScheduleTeacherSelect` | 11005 |
| `_populateScheduleSubjectSelect` | 11014 |
| `_updateFilterIndicators` | 11024 |
| `clearScheduleSearch` | 11055 |
| `clearScheduleFilters` | 11060 |
| `applyScheduleFilters` | 11070 |
| `renderManageScheduleTable` | 11101 |
| `_escJsArg` | 11246 |
| `openScheduleModal` | 11249 |
| `closeScheduleModal` | 11272 |
| `_schedAutoCalcEnd` | 11278 |
| `_schedUpdateDuration` | 11296 |
| `_schedClearConflict` | 11323 |
| `_schedCheckLocalConflict` | 11327 |
| `editScheduleAction` | 11373 |
| `submitSchedule` | 11409 |
| `deleteScheduleAction` | 11450 |
| `toggleAllScheduleCheckboxes` | 11473 |
| `updateScheduleCheckboxes` | 11478 |
| `updateDeleteSelectedButton` | 11489 |
| `deleteSelectedSchedules` | 11501 |
| `openSubjectModal` | 11533 |
| `closeSubjectModal` | 11547 |
| `submitSubject` | 11551 |
| `openForgotModal` | 11582 |
| `closeForgotModal` | 11597 |
| `_checkForgotLockout` | 11604 |
| `_showForgotStep` | 11619 |
| `forgotNextStep` | 11639 |
| `_renderForgotMethodStep` | 11674 |
| `forgotBackToStep1` | 11696 |
| `forgotBackToMethod` | 11703 |
| `forgotChooseMethod` | 11711 |
| `_forgotStartSecurityQuestion` | 11721 |
| `_forgotStartOtp` | 11746 |
| `forgotRequestOtp` | 11758 |
| `_startForgotOtpCooldown` | 11796 |
| `submitForgotAction` | 11820 |
| `submitForgotOtpAction` | 11875 |
| `_enterForgotFinalStep` | 11907 |
| `forgotTogglePassVis` | 11922 |
| `_forgotCheckPassRules` | 11928 |
| `forgotEvalPassword` | 11940 |
| `submitForgotNewPassword` | 12005 |
| `_startForgotCountdown` | 12042 |
| `handleForgotPassword` | 12062 |
| `initResetRequests` | 12065 |
| `approveResetAction` | 12114 |
| `initMySchedule` | 12141 |
| `renderMyWeeklyScheduleTable` | 12294 |
| `openMyScheduleDetailModal` | 12357 |
| `closeMyScheduleDetailModal` | 12373 |
| `refreshMySchedule` | 12377 |
| `filterMySchedule` | 12386 |
| `resetMyScheduleFilter` | 12471 |
| `printMySchedule` | 12478 |
| `onload` | 12638 |
| `updatePicketBadge` | 12644 |
| `updateNotificationBadges` | 12659 |
| `openSubModal` | 12687 |
| `openSubModalPicket` | 12691 |
| `openSubModalCeremony` | 12695 |
| `_openSubModalCommon` | 12699 |
| `closeSubModal` | 12740 |
| `submitSubstitute` | 12759 |
| `showReplaceConfirmModal` | 12837 |
| `closeReplaceConfirmModal` | 12886 |
| `executeReplaceSubstitute` | 12890 |
| `showLoadingOverlay` | 12910 |
| `hideLoadingOverlay` | 12931 |
| `confirmSubstituteAction` | 12937 |
| `revokeSubstituteAction` | 12965 |
| `doRevokeSubstitute` | 12980 |
| `refreshSubstitutesTable` | 13014 |
| `renderSubstitutesData` | 13034 |
| `refreshTeacherStatusTable` | 13118 |
| `confirmCeremonyAction` | 13164 |
| `revokeCeremonyAction` | 13191 |
| `openSubModalCeremony` | 13218 |
| `confirmPicketPresence` | 13224 |
| `exportJournalPDF` | 13251 |
| `_restore` | 13316 |
| `ensureAnimationsExist` | 13363 |
| `_fixMobileLayouts` | 13379 |
| `skeletonTableRows` | 13496 |
| `errorStateHTML` | 13510 |
| `errorTableRows` | 13527 |
| `actionBtn` | 13540 |
| `renderGreetingCard` | 13543 |
| `toggleSidebar` | 13625 |
| `initSidebarState` | 13668 |
| `_todayISO` | 13689 |
| `_addDaysISO` | 13690 |
| `_firstOfMonthISO` | 13694 |
| `_renderJournalFilterSummary` | 13698 |
| `onGuruJournalSearchInput` | 13709 |
| `filterGuruJournalTable` | 13713 |
| `setGuruJournalQuickRange` | 13718 |
| `resetGuruJournalFilter` | 13733 |
| `_renderAttendanceBar` | 13743 |
| `loadGuruJournalDataPaginated` | 13756 |
| `renderGuruJournalTable` | 13791 |
| `openViewJournalByCacheIdx` | 13870 |
| `renderGuruJournalPagination` | 13905 |
| `_renderPagination` | 13922 |
| `generatePageNumbers` | 13947 |
| `createPageButton` | 13968 |
| `guruJournalGoToPage` | 13972 |
| `changeGuruJournalPage` | 13977 |
| `changeGuruJournalLimit` | 13990 |
| `jumpToGuruJournalPage` | 13998 |
| `onAdminFilterInput` | 14016 |
| `setAdminJournalQuickRange` | 14020 |
| `loadAdminJournalData` | 14039 |
| `renderAdminJournalTable` | 14077 |
| `_renderAdminJournalRows` | 14082 |
| `editAdminJournalAction` | 14159 |
| `editGuruJournalAction` | 14177 |
| `filterAdminJournalTable` | 14196 |
| `resetAdminJournalFilter` | 14201 |
| `renderAdminJournalPagination` | 14215 |
| `adminJournalGoToPage` | 14232 |
| `changeJournalPage` | 14237 |
| `jumpToAdminJournalPage` | 14250 |
| `_csvEscape` | 14263 |
| `_downloadCSV` | 14271 |
| `exportGuruJournalCSV` | 14280 |
| `exportAdminJournalCSV` | 14303 |
| `toggleHonorVisibility` | 14327 |
| `updateHonorVisibilityUI` | 14332 |
| `toggleTransportVisibility` | 14354 |
| `updateTransportVisibilityUI` | 14359 |
| `setLiburMode` | 14381 |
| `addHolidayAction` | 14399 |
| `loadAdminExtendedStats` | 14458 |
| `_initDashboardMarquees` | 14650 |
| `loadAdminDashboardPicket` | 14685 |
| `_apmRenderPanel` | 14715 |
| `_apmBuildCard` | 14767 |
| `openAdminPicketModal` | 14844 |
| `closeAdminPicketModal` | 15030 |
| `apmDoKonfirmasi` | 15042 |
| `apmDoRevokeKonfirmasi` | 15079 |
| `apmDoTunjukPengganti` | 15122 |
| `_apmRefreshModalAfterSubstitute` | 15186 |
| `apmDoSaveTimeOrig` | 15275 |
| `apmDoSaveTimeSubst` | 15318 |
| `loadGuruTodayProgress` | 15373 |
| `_markScheduleItemDone` | 15529 |
| `reloadScheduleWithFilters` | 15590 |
| `_buildRekapStatBadge` | 15614 |
| `_getRekapSchedules` | 15620 |
| `openRekapKelas` | 15634 |
| `closeRekapKelasModal` | 15646 |
| `_renderRekapKelas` | 15651 |
| `openRekapGuru` | 15753 |
| `closeRekapGuruModal` | 15765 |
| `_renderRekapGuru` | 15770 |
| `openRekapHari` | 15857 |
| `closeRekapHariModal` | 15869 |
| `_renderRekapHari` | 15874 |
| `openRekapKelasHari` | 15954 |
| `closeRekapKelasHariModal` | 15966 |
| `_rekapFilter` | 15971 |
| `_renderRekapKelasHari` | 15994 |
| `downloadRekapDirectPDF` | 16119 |
| `loadActiveSubstitutesForPicketTeacher` | 16143 |
| `switchAdminPicketTab` | 16232 |
| `_restoreAdminPicketTab` | 16249 |
| `initExamSchedule` | 16258 |
| `_examModalLock` | 16274 |
| `_examModalIsLocked` | 16289 |
| `_examOpenModal` | 16293 |
| `_examCloseModal` | 16305 |
| `exam_showLoading` | 16313 |
| `exam_hideLoading` | 16319 |
| `exam_switchTab` | 16323 |
| `statusBadge` | 16348 |
| `populateTeacherSelect` | 16356 |
| `escHtml` | 16367 |
| `getTeacherName` | 16370 |
| `fmtDate` | 16375 |
| `fmtTime` | 16376 |
| `refreshDetail` | 16377 |
| `loadData` | 16381 |
| `renderPeriodList` | 16420 |
| `_examPeriodSearch` | 16496 |
| `_examTogglePeriodFilter` | 16501 |
| `_examResetPeriodFilters` | 16505 |
| `exam_selectPeriod` | 16510 |
| `exam_backToPeriodList` | 16564 |
| `renderDetail` | 16574 |
| `renderSessionBlock` | 16718 |
| `escJsAttr` | 16827 |
| `exam_toggleSession` | 16830 |
| `exam_toggleDateAccordion` | 16844 |
| `exam_toggleAllSessionsForDate` | 16861 |
| `_examPeriodPreviewDuration` | 16872 |
| `_examSessionPreviewDuration` | 16906 |
| `_examFilterTeacherSelect` | 16942 |
| `renderRoomBlock` | 16966 |
| `exam_openPeriodModal` | 17086 |
| `exam_closePeriodModal` | 17108 |
| `exam_savePeriod` | 17112 |
| `exam_deletePeriod` | 17162 |
| `exam_openSessionModal` | 17195 |
| `exam_closeSessionModal` | 17217 |
| `exam_saveSession` | 17221 |
| `exam_deleteSession` | 17263 |
| `exam_openRoomModal` | 17275 |
| `exam_closeRoomModal` | 17295 |
| `exam_saveRoom` | 17299 |
| `exam_deleteRoom` | 17339 |
| `exam_openSupModal` | 17351 |
| `exam_closeSupModal` | 17404 |
| `exam_editSupModal` | 17408 |
| `exam_saveAssignSup` | 17424 |
| `exam_removeSup` | 17464 |
| `exam_openComModal` | 17476 |
| `exam_closeComModal` | 17490 |
| `exam_saveAssignCom` | 17494 |
| `exam_removeCom` | 17531 |
| `exam_confirmCom` | 17543 |
| `exam_revokeCom` | 17553 |
| `exam_confirmSup` | 17565 |
| `exam_revokeSup` | 17575 |
| `exam_openSubstModal` | 17604 |
| `exam_closeSubstModal` | 17632 |
| `exam_saveSubst` | 17636 |
| `exam_cancelSubst` | 17665 |
| `exam_loadRekapJtm` | 17696 |
| `exam_loadRekapBap` | 17753 |
| `_gExamToday` | 17827 |
| `_gExamNowTime` | 17831 |
| `_gExamFmtDate` | 17835 |
| `_gExamEsc` | 17839 |
| `checkExamBannerForDashboard` | 17842 |
| `hideTeachingCardsDuringExam` | 17859 |
| `showTeachingCards` | 17865 |
| `renderExamDashboardCard` | 17871 |
| `gExam_openBapModal` | 17996 |
| `gExam_closeBapModal` | 18041 |
| `_gExam_fillBapFromDetail` | 18081 |
| `_gExam_fillBapFromPageData` | 18150 |
| `gExam_closeBapModal` | 18165 |
| `updateBapCatatanCounter` | 18170 |
| `updateBapTotalIndicator` | 18178 |
| `_bapBtnLabel` | 18202 |
| `gExam_submitBap` | 18205 |
| `checkExamForMySchedule` | 18261 |
| `renderExamMyScheduleSection` | 18275 |
| `loadExamPanitiaPanel` | 18401 |
| `initExamPanitiaPage` | 18427 |
| `renderExamPanitiaPanel` | 18505 |
| `_examJtmEnsureTeachers` | 18723 |
| `toggleExamJtmPanel` | 18736 |
| `loadExamJtmState` | 18747 |
| `recomputeExamJtmDiff` | 18792 |
| `saveExamJtmAdjustment` | 18812 |
| `_examJtmPopulateAllocSelect` | 18892 |
| `_examJtmRenderAllocList` | 18905 |
| `renderExamJtmAllocPanel` | 18932 |
| `addExamJtmAllocation` | 18959 |
| `removeExamJtmAllocation` | 19019 |
| `cancelExamJtmAdjustment` | 19061 |
| `gExam_picketConfirmSup` | 19108 |
| `gExam_picketRevokeSup` | 19132 |
| `gExam_picketOpenSubst` | 19183 |
| `panitia_closeSubstModal` | 19227 |
| `panitia_filterSubstTeacher` | 19232 |
| `panitia_saveSubst` | 19244 |
| `gExam_picketCancelSubst` | 19273 |
| `onAttendanceDateChange` | 19316 |
| `refreshActiveAttendanceTab` | 19320 |
| `switchAttendanceTab` | 19324 |
| `_initAttendancePage` | 19345 |
| `_updateDateLabel` | 19362 |
| `initAttendance` | 19369 |
| `initMyAttendance` | 19383 |
| `loadMyAttendanceHistory` | 19410 |
| `_mahSumChip` | 19470 |
| `_mahRenderDay` | 19476 |
| `exportMyAttendancePDF` | 19602 |
| `_mahRestoreBtn` | 19824 |
| `_loadAttendanceList` | 19841 |
| `renderAttendanceList` | 19863 |
| `_updateAddAttendeeBarVisibility` | 19933 |
| `openAddAttendeeModal` | 19944 |
| `_populateAddAttendeeSelect` | 19970 |
| `_filterAddAttendeeSelect` | 19982 |
| `closeAddAttendeeModal` | 19993 |
| `submitAddAttendee` | 19997 |
| `openSetJadwalModal` | 20040 |
| `closeSetJadwalModal` | 20049 |
| `submitSetJadwal` | 20053 |
| `openTimeInModal` | 20078 |
| `closeTimeInModal` | 20087 |
| `submitTimeIn` | 20091 |
| `openTimeOutModal` | 20115 |
| `closeTimeOutModal` | 20124 |
| `submitTimeOut` | 20128 |
| `openAttendanceDetail` | 20152 |
| `closeAttendanceDetailModal` | 20211 |
| `_renderDetailLeaveList` | 20215 |
| `submitDetailLeave` | 20257 |
| `_deleteDetailLeave` | 20305 |
| `submitAttendanceDetail` | 20323 |
| `_openLeaveFromBtn` | 20360 |
| `_openLeaveModal` | 20379 |
| `closeLeaveModal` | 20400 |
| `_renderLeaveList` | 20407 |
| `submitLeave` | 20452 |
| `_deleteLeave` | 20498 |
| `initSchedTemplates` | 20524 |
| `renderSchedTemplates` | 20549 |
| `renderRows` | 20567 |
| `openSchedTemplateModal` | 20600 |
| `closeSchedTemplateModal` | 20623 |
| `submitSchedTemplate` | 20626 |
| `deleteSchedTemplate` | 20654 |
| `applyTemplateToDate` | 20665 |
| `_wireEventNavItems` | 20701 |
| `initEventManagementPage` | 20716 |
| `renderEventMgmtTable` | 20749 |
| `_evtEdit` | 20790 |
| `toggleEventTypeFields` | 20794 |
| `addEventDateRow` | 20805 |
| `openEventDefinitionModal` | 20823 |
| `closeEventDefModal` | 20852 |
| `submitEventDefForm` | 20856 |
| `deleteEventWithConfirm` | 20899 |
| `initEventAttendancePage` | 20928 |
| `_loadEvtAttEventList` | 20937 |
| `loadEventAttendance` | 20981 |
| `renderEvtAttTable` | 21001 |
| `editAttendanceRow` | 21060 |
| `cancelEditAttendance` | 21070 |
| `cancelAttendanceRow` | 21083 |
| `saveAttendanceRow` | 21124 |
| `restoreSaveBtn` | 21154 |
| `initEventJournalPage` | 21194 |
| `renderEvtJournalList` | 21231 |
| `openEvtJournalModal` | 21294 |
| `_openEvtJournalModalInternal` | 21324 |
| `closeEvtJournalModal` | 21343 |
| `submitEvtJournal` | 21347 |
| `renderEventHistorySection` | 21370 |
| `initEventJournalHistoryPage` | 21399 |
| `renderEventJournalHistorySection` | 21416 |
| `openEventJournalDetailModal` | 21477 |
| `closeEventJournalDetailModal` | 21505 |
| `_updateTransportEventInfo` | 21517 |
| `_attachCollapsedTooltips` | 21524 |
| `_getSidebarTip` | 21545 |
| `_showSidebarTooltip` | 21570 |
| `_hideSidebarTooltip` | 21577 |
| `initSidebarState` | 21588 |
| `toggleNavAccordion` | 21593 |
| `toggleNestedNavAccordion` | 21608 |
| `openAccordionForPage` | 21622 |
| `initAttendanceList` | 21709 |
| `initAttendanceSchedule` | 21714 |
| `initAdminDailyAttendance` | 21725 |
| `loadAdminDailyAttendance` | 21733 |
| `filterAdminDailyAttendance` | 21774 |
| `renderAdminDailyAttendanceTable` | 21786 |
| `initBlokJurnal` | 21851 |
| `_populateBlokJurnalMapelDropdown` | 21900 |
| `renderBlokJurnalTable` | 21912 |
| `blokJurnal_openForm` | 21949 |
| `blokJurnal_editForm` | 21968 |
| `blokJurnal_batalForm` | 21989 |
| `blokJurnal_simpan` | 21994 |
| `blokJurnal_hapus` | 22033 |
| `initBlokAcara` | 22061 |
| `renderBlokAcaraTable` | 22082 |
| `blokAcara_openForm` | 22119 |
| `blokAcara_editForm` | 22137 |
| `blokAcara_batalForm` | 22157 |
| `blokAcara_simpan` | 22162 |
| `blokAcara_hapus` | 22201 |
| `initBlokTransport` | 22230 |
| `renderBlokTransportTable` | 22251 |
| `blokTransport_openForm` | 22283 |
| `blokTransport_editForm` | 22300 |
| `blokTransport_batalForm` | 22319 |
| `blokTransport_simpan` | 22324 |
| `blokTransport_hapus` | 22369 |

### D.3 Ketergantungan browser sumber

Tailwind CDN, Google Fonts (Inter dan font pada templat), html2pdf.js 0.10.1, dan SheetJS `xlsx-latest`. Target memasang dependensi dengan versi terkunci, memuat ekspor secara lazy dan tidak menggantungkan proses kritis pada URL latest tanpa kontrol. Style templat dan HTML inline dipindahkan ke Tailwind/shadcn/ui dengan komponen beraksesibilitas baik.

## Lampiran E. Bukti sumber dan checklist akhir dokumen

- `Code.gs`: SHA-256 `11c5db196f2d5ab4e325e69ea02eabfe5d88804c48c1da79cb32edaa056de0e2`; 30,363 baris.
- `Index.html`: SHA-256 `78e8e39863ea499c6b8840e6296ed71b61e776c0b6994b719892ac0c9e7ebec0`; 22,461 baris.
- Backend: 343 deklarasi fungsi tingkat atas, seluruhnya masuk indeks Lampiran B.
- Pengujian yang dijalankan pada helper sumber: 17 assertion lulus pada 9 helper; belum menjalankan integrasi GAS/Spreadsheet/email atau E2E deployment.
- Keluaran ini adalah satu dokumen Markdown; schema SQL, kode aplikasi, endpoint autentikasi internal, deployment Vercel dan migrasi produksi belum dibuat oleh tugas penyusunan dokumen ini.
- Tidak ada perubahan terhadap repositori GitHub atau data produksi.
- Sebelum mulai implementasi, tetapkan kebijakan aktivasi/pemulihan internal, konfigurasi email dan keputusan policy yang ditandai; gunakan data sintetis untuk bagian yang tidak menunggu akses produksi. Tidak ada kontrak layanan identitas eksternal yang diperlukan.
