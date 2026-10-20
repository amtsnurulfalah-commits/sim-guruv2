# Tahap 0.1 — Matriks Kesetaraan Pembangunan Ulang SiM-Guru

Tanggal: 18 Oktober 2026 | Versi: 1.0 | Status: pemetaan dokumen selesai; implementasi belum dibuat.

## 1. Dasar dan batas pemetaan

Sumber utama: `Dasar_Pembangunan_Ulang_SIM_GURU.md`, SHA-256 `4a0b387de74ac6fbc8da57758ea34b1f0ea3ec8afce2c01c119398e1bd076ef5`; 3900 baris. Commit legacy yang disebut dokumen: `28014207da58e3d295db5bf09f52b0d7bc26de5b`. Pemetaan ini berasal dari spesifikasi dan inventaris lampirannya, bukan audit ulang checkout GitHub atau data produksi. Referensi Code.gs pada tabel backend adalah referensi bukti yang diwarisi dari dokumen.

Prioritas: keputusan target dan koreksi B01–B25 mengungguli guard legacy yang lemah. Tidak ada integrasi Central SSO atau Supabase Auth pada baseline. Satu instalasi sekolah/madrasah. Seluruh UI/dokumen Indonesia dan waktu operasional Asia/Jakarta.

## 2. Cara membaca dan status

Setiap baris backend memiliki ID stabil B001 dst.; halaman P001 dst. Kolom F menunjukkan pemilik utama, bukan seluruh dependensi transitif. Fungsi terkait lebih dari satu domain tetap menggunakan layanan bersama. `X01` adalah fondasi lintas domain (setting/master/utilitas/framework), bukan fitur tambahan. Rute dan nama layanan adalah rancangan target, belum berkas atau endpoint yang tersedia.

Status seluruh fitur/operasi/halaman saat ini: **belum dibuat**; status tes: **belum dijalankan**. Status pemetaan tidak berarti implementasi teruji. Kemajuan: belum dibuat → dikerjakan → dibuat → teruji → diterima. Setiap perubahan status harus disertai path/commit implementasi, ID tes, hasil eksekusi dan bukti penerimaan.

## 3. Matriks fitur F01–F20

| ID | Fitur dan cakupan wajib | Pemilik layanan | Rute/surface target | Tahap | Tes penerimaan | Status |
|---|---|---|---|---|---|---|
| F01 | Autentikasi dan profil: Login username/password, sesi, logout dengan konfirmasi, kedaluwarsa, pemulihan, perubahan profil dan kata sandi, verifikasi email OTP, pertanyaan keamanan sebagai faktor tambahan dan reset internal | LocalAuthService / ProfileService | /login; /profil; /lupa-password | 1.3–1.5 | T01,T03,T04,T42–T50 | Belum dibuat |
| F02 | Dashboard: Ringkasan guru/admin, jadwal dan progres hari ini, status kehadiran, piket, ujian, jurnal/BAP tertunda, bonus libur, estimasi honorarium | DashboardQueryService | /dashboard | 1.6;7.5 | T02,T09,T29,T31,T37,T40 | Belum dibuat |
| F03 | Pengguna: Daftar/cari/filter role, tambah/edit, NIP, kontak, jarak, jabatan tambahan, pengelolaan status akses, reset kredensial sesuai kewenangan identitas | UserService | /admin/pengguna | 2.1 | T02,T42,T43,T45,T48 | Belum dibuat |
| F04 | Jadwal KBM: CRUD, filter guru/mapel/kelas/hari/tahun/semester, pencarian, hapus terpilih, hitung waktu selesai, deteksi bentrok, rekap/cetak | SchedulingService | /admin/jadwal; /jadwal-saya | 2.4 | T05,T17,T39 | Belum dibuat |
| F05 | Jurnal KBM: Input hari H dan H-1 bersyarat, hadir/absen, materi/catatan, validasi rekap, detail/edit/hapus, riwayat paginasi, CSV/PDF | JournalService | /jurnal; /admin/jurnal | 3.6 | T06–T12,T17,T33,T39 | Belum dibuat |
| F06 | Absensi siswa: Rekap per kelas/tanggal: hadir, sakit, izin, alpa; progres kelengkapan; riwayat dan pembatasan akses | StudentAttendanceService | /absensi-siswa/input; /absensi-siswa/riwayat | 3.4 | T07,T08,T36 | Belum dibuat |
| F07 | Piket: Jadwal mingguan, konfirmasi/cabut, pengganti, pembatalan, panel operasional dan kredit 4 JTM | PicketService | /piket; /admin/piket | 4.1 | T02,T13,T15,T16 | Belum dibuat |
| F08 | Upacara: Jadwal pembina hari Senin, konfirmasi/cabut, penggantian pembina, kredit 5 JTM | CeremonyService | /admin/upacara; /jadwal-saya | 4.2 | T02,T14,T29 | Belum dibuat |
| F09 | Substitusi KBM: Penunjukan, penggantian pengganti, konfirmasi, pencabutan dan pembersihan dampak terkait | SubstitutionService | /piket; /admin/piket; /jadwal-saya | 4.3 | T05,T11,T13 | Belum dibuat |
| F10 | Ujian: Periode, sesi, ruang, mapel/kelas/jumlah siswa, pengawas, panitia, konflik, konfirmasi, substitusi, rekap | ExamService | /admin/ujian; /ujian/panitia | 5.1–5.2 | T02,T05,T18,T21 | Belum dibuat |
| F11 | BAP: Input/edit setelah batas waktu, validasi peserta, pemilik dan periode, hubungan kredit pengawas | ExamBapService | /ujian/bap; /admin/ujian | 5.3 | T19–T21 | Belum dibuat |
| F12 | Penyesuaian JTM: Kurangi kredit, alasan, alokasikan selisih ke beberapa guru, hapus alokasi, reset; KBM/ujian/piket | JtmService | panel /piket; /admin/piket; /ujian/panitia; /admin/ujian | 3.5;4.4;5.3 | T09,T13,T15–T17,T20 | Belum dibuat |
| F13 | Absensi guru: Jam jadwal/aktual, daftar harian, detail, manual admin, tambahan peserta, izin keluar, template KBM/ujian, riwayat pribadi/PDF | AttendanceService | /kehadiran; /kehadiran-saya; /admin/jadwal-kehadiran; /admin/kehadiran-harian | 3.1–3.3 | T02,T25,T27,T38,T39 | Belum dibuat |
| F14 | Acara: Rutin/insidental, kehadiran, jurnal, H-1, riwayat, kredit JTM dan dependensi penghapusan | EventService | /admin/acara; /acara/kehadiran; /acara/jurnal; /acara/riwayat | 5.4–5.5 | T12,T22,T23,T33 | Belum dibuat |
| F15 | Transportasi: Tarif/km, jarak guru, rasio durasi efektif, izin keluar, blokir tanggal, pembulatan bulanan | TransportService | /admin/pengaturan/transportasi; /honorarium | 6.2 | T24–T28 | Belum dibuat |
| F16 | Honorarium: Estimasi, rekap admin, finalisasi manual/otomatis, tunjangan tambahan, snapshot, riwayat, slip/PDF/cetak, Excel, ID transaksi/verifikasi | HonorariumService / DocumentService / ExportService | /honorarium; /admin/honorarium; /honorarium/riwayat; /admin/honorarium/riwayat; /verifikasi-dokumen | 6.3–6.5 | T09,T26,T29,T31–T34,T39 | Belum dibuat |
| F17 | Kalender dan jurnal libur: Libur tunggal/rentang, kalender akademik, estimasi bonus, generate/cancel otomatis, status scheduler | CalendarService / HolidayCreditService / JobService | /admin/pengaturan/kalender; /admin/operasi | 2.3;6.1;7.4 | T29,T30,T41 | Belum dibuat |
| F18 | Pengumuman: CRUD, status aktif, tingkat urgensi, target role/user, dismissibility, CTA, email dan pengingat | AnnouncementService | /admin/pengaturan/pengumuman; /dashboard | 7.1;7.3 | T34,T35 | Belum dibuat |
| F19 | Pemblokiran dan maintenance: Blok jurnal per mapel, acara per tipe, transportasi per rentang; maintenance langsung/terjadwal dengan pengecualian admin | BlockPolicyService / MaintenanceService | /admin/pemblokiran/*; /admin/pengaturan/maintenance | 7.2 | T12,T28,T37 | Belum dibuat |
| F20 | Otomasi dan pengalaman pengguna: Email transaksional/pengingat, retry, mobile, sidebar collapse/accordion, loading/error/empty state, toast, modal, filter dan ekspor | NotificationService / JobService / UI | lintas halaman; /admin/operasi; /api/cron/* | 1.6;7.3–7.4 | T03,T34,T39,T40,T41 | Belum dibuat |

Fondasi X01: SettingsService, SubjectService, AcademicPeriodService, ClassService, DAL, AuditService, date/money utilities, UI shell dan migrasi; tahap 0.3–2.3. Pengujian lintas fitur T02,T05,T38,T40,T41 serta tes tambahan A01–A08 di bawah.

## 4. Dependensi dan sumber kebenaran

| Komponen | Sumber kebenaran dan batas wajib |
|---|---|
| Identitas | app_users.id + kredensial privat Argon2id; tidak memakai actor dari browser |
| Kewenangan | Policy server per resource/date; assigned, confirmed, time-in dan manage-others berbeda |
| Jadwal | Master berulang → occurrence bertanggal dengan snapshot periode |
| Konteks hari | DayContext tunggal; kalender nonlibur tidak menonaktifkan aktivitas |
| Bukti hadir | daily_attendance terpisah dari activity_confirmations |
| JTM | Ledger sumber unik + reversal; adjustment dan relokasi terikat occurrence |
| Honor | Satu engine decimal untuk estimasi/rekap/final/slip; snapshot final immutable |
| Notifikasi | Outbox setelah transaksi; gagal kirim tidak membatalkan bisnis |
| Job | Lock + idempotency key; cron UTC dengan pengecekan waktu WIB |

Urutan dependensi: identitas/policy dan master → jadwal/DayContext → occurrence/konfirmasi/kehadiran → jurnal dan kredit → honor final → dokumen. Adapter email/outbox minimum dibangun pada 1.5 untuk OTP; notifikasi domain dan worker lengkap diselesaikan 7.3. Maintenance minimal untuk login/mutasi perlu tersedia saat auth dibuat; UI lengkap pada 7.2. Blok server dipasang sebelum modul jurnal/acara/transport dinyatakan diterima, meskipun UI pengelolaannya diselesaikan 7.2.

## 5. Matriks seluruh fungsi backend

Cakupan: 343 deklarasi Lampiran B. Helper dipindah/digabung sesuai tanggung jawab; tidak wajib mempertahankan nama API GAS. Setiap baris mewarisi rute, tahap dan tes dari pemilik F pada bagian 3; X01 mengikuti fondasi di bagian 3. Penggabungan bukan penghapusan kemampuan.

| ID | Fungsi legacy | Bukti Code.gs | F | Implementasi/pengganti target |
|---|---|---|---|---|
| B001 | `_validateEventDefinition(payload)` | [L40](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L40) | F14 | EventService — helper internal/repository; bukan endpoint publik |
| B002 | `_authorizeEventWriter(user)` | [L85](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L85) | F14 | EventService — helper internal/repository; bukan endpoint publik |
| B003 | `_computeEventJtm(attendanceRecords)` | [L88](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L88) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B004 | `_computeTransportDates(regularDates, eventAttendanceRecords)` | [L99](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L99) | F15 | TransportService — helper internal/repository; bukan endpoint publik |
| B005 | `_authorizeAttendanceWriter(user, isPicketConfirmed)` | [L114](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L114) | F13 | AttendanceService — helper internal/repository; bukan endpoint publik |
| B006 | `_jtmValidateAdjusted(scheduledJtm, rawAdjusted)` | [L134](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L134) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B007 | `_jtmComputeDifference(scheduledJtm, adjustedJtm)` | [L168](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L168) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B008 | `_jtmValidateReason(adjustedJtm, scheduledJtm, rawReason)` | [L172](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L172) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B009 | `_jtmValidateAllocation( rawAllocation, originalUserId, substituteUserId, isSubstituteAdmin, )` | [L203](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L203) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B010 | `_jtmCheckConservation( scheduledJtm, adjustedJtm, existingAllocations, newAllocation, )` | [L244](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L244) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B011 | `_jtmAuthorizeKbm(user, isPicketToday, todayDate, occurrenceDate)` | [L275](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L275) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B012 | `_jtmAuthorizeExam(authResult, todayDate, sessionDate)` | [L298](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L298) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B013 | `doSetup()` | [L318](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L318) | X01 | Migrasi SQL dan seed aman; tidak ada endpoint setup publik |
| B014 | `getStudentAttendancePageData(token)` | [L595](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L595) | F06 | StudentAttendanceService — operasi getStudentAttendancePageData melalui layanan/policy bersama |
| B015 | `saveStudentAttendance(token, payload)` | [L658](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L658) | F06 | StudentAttendanceService — operasi saveStudentAttendance melalui layanan/policy bersama |
| B016 | `checkStudentAttendanceToday(token)` | [L720](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L720) | F06 | StudentAttendanceService — operasi checkStudentAttendanceToday melalui layanan/policy bersama |
| B017 | `getStudentAttendanceHistory(token, params)` | [L764](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L764) | F06 | StudentAttendanceService — operasi getStudentAttendanceHistory melalui layanan/policy bersama |
| B018 | `createSheetIfNeeded_(ss, sheetName, headers)` | [L818](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L818) | X01 | Migrasi SQL bertipe |
| B019 | `getDbId()` | [L837](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L837) | X01 | Konfigurasi environment server tervalidasi |
| B020 | `getSheet(name)` | [L847](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L847) | X01 | Repository PostgreSQL; tidak menerima nama tabel bebas dari browser |
| B021 | `getData(sheetName)` | [L858](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L858) | X01 | Repository dengan query terarah dan scope actor |
| B022 | `findData(sheetName, key, value)` | [L904](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L904) | X01 | Repository bertipe dan index |
| B023 | `generateId(prefix)` | [L908](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L908) | X01 | UUID database/runtime |
| B024 | `formatRupiah(num)` | [L911](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L911) | X01 | Formatter locale id-ID |
| B025 | `formatDateIndo(dateInput)` | [L920](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L920) | X01 | Formatter tanggal Asia/Jakarta |
| B026 | `loginUser(username, password)` | [L943](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L943) | F01 | LocalAuthService / ProfileService — operasi loginUser melalui layanan/policy bersama |
| B027 | `logoutUser(token)` | [L1035](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1035) | F01 | LocalAuthService / ProfileService — operasi logoutUser melalui layanan/policy bersama |
| B028 | `verifySession(token)` | [L1046](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1046) | F01 | LocalAuthService / ProfileService — operasi verifySession melalui layanan/policy bersama |
| B029 | `checkSessionStatus(token)` | [L1057](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1057) | F01 | LocalAuthService / ProfileService — operasi checkSessionStatus melalui layanan/policy bersama |
| B030 | `updateUserProfile(token, payload)` | [L1067](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1067) | F01 | LocalAuthService / ProfileService — operasi updateUserProfile melalui layanan/policy bersama |
| B031 | `updateGuruProfileDetails(token, payload)` | [L1142](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1142) | F01 | LocalAuthService / ProfileService — operasi updateGuruProfileDetails melalui layanan/policy bersama |
| B032 | `getMyProfile(token)` | [L1164](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1164) | F01 | LocalAuthService / ProfileService — operasi getMyProfile melalui layanan/policy bersama |
| B033 | `_ensureUserColumn_(sheetObj, headerName, defaultPos)` | [L1229](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1229) | F03 | UserService — helper internal/repository; bukan endpoint publik |
| B034 | `_normalizePhoneNumber_(input)` | [L1244](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1244) | F01 | LocalAuthService / ProfileService — helper internal/repository; bukan endpoint publik |
| B035 | `requestEmailOTP(token, newEmail)` | [L1279](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1279) | F01 | LocalAuthService / ProfileService — operasi requestEmailOTP melalui layanan/policy bersama |
| B036 | `verifyEmailOTP(token, newEmail, otpCode)` | [L1384](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1384) | F01 | LocalAuthService / ProfileService — operasi verifyEmailOTP melalui layanan/policy bersama |
| B037 | `_isValidEmail_(s)` | [L1481](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1481) | F01 | LocalAuthService / ProfileService — helper internal/repository; bukan endpoint publik |
| B038 | `_escHtml_(s)` | [L1485](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1485) | X01 | Escaping React dan sanitasi konten terformat |
| B039 | `_notifGetEmail_(userId)` | [L1492](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1492) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B040 | `_notifGetName_(userId)` | [L1509](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1509) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B041 | `_notifBuildHtml_(opts)` | [L1519](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1519) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B042 | `_notifSend_(toEmail, subject, htmlBody, textBody)` | [L1606](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1606) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B043 | `_notifToUser_(userId, subject, htmlBody, textBody)` | [L1625](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1625) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B044 | `_notifIsHoliday_(dateStr)` | [L1630](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1630) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B045 | `_notifIsKbmEnabled_(dateStr)` | [L1651](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1651) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B046 | `_notifIsTeachingDay_(dateStr)` | [L1661](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1661) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B047 | `_notifIsExamEnabled_(dateStr)` | [L1672](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1672) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B048 | `_notifPicketConfirmed_(userId, opts)` | [L1687](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1687) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B049 | `_notifPicketRevoked_(userId)` | [L1715](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1715) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B050 | `_notifPicketSubstituted_(originalUserId, substituteUserId)` | [L1737](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1737) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B051 | `_notifPicketSubCancelled_(substituteUserId)` | [L1778](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1778) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B052 | `_notifKbmConfirmed_(userId, opts)` | [L1800](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1800) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B053 | `_notifKbmRevoked_(userId, opts)` | [L1823](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1823) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B054 | `_notifKbmSubstituted_( originalUserId, substituteUserId, scheduleInfo, byName, )` | [L1847](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1847) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B055 | `_notifKbmSubCancelled_(substituteUserId, scheduleInfo, byName)` | [L1897](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1897) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B056 | `_notifAutoJurnalLiburGenerated_( generatedLogs, dateStr, holidayDesc, actorName, )` | [L1920](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L1920) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B057 | `_notifCommitteeConfirmed_(userId, dateStr)` | [L2064](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2064) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B058 | `_notifCommitteeRevoked_(userId, dateStr)` | [L2083](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2083) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B059 | `_notifCommitteeSubstituted_( originalUserId, substituteUserId, dateStr, )` | [L2102](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2102) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B060 | `_notifCommitteeSubCancelled_(substituteUserId, dateStr)` | [L2144](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2144) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B061 | `_notifSupervisorConfirmed_(userId, dateStr, byName, sessionInfo)` | [L2163](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2163) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B062 | `_notifSupervisorRevoked_(userId, dateStr, byName, sessionInfo)` | [L2186](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2186) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B063 | `_notifSupervisorSubstituted_( originalUserId, substituteUserId, dateStr, byName, sessionInfo, )` | [L2208](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2208) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B064 | `_notifSupervisorSubCancelled_( substituteUserId, dateStr, byName, sessionInfo, )` | [L2261](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2261) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B065 | `_notifTodayID_()` | [L2288](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2288) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B066 | `_notifFmtTime_(val)` | [L2291](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2291) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B067 | `_notifResolveDate_(value)` | [L2308](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2308) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B068 | `_notifFmtDate_(value)` | [L2345](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2345) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B069 | `_notifFmtDateLong_(value)` | [L2368](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2368) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B070 | `_notifFmtDateTime_(value)` | [L2401](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2401) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B071 | `_notifFmtDateLongTime_(value)` | [L2410](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2410) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B072 | `_checkPasswordComplexity(password, fullName, username)` | [L2418](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2418) | F01 | LocalAuthService / ProfileService — helper internal/repository; bukan endpoint publik |
| B073 | `_extUsersSheet_()` | [L2458](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2458) | F01 | LocalAuthService + repository kredensial privat; ketergantungan spreadsheet dihapus |
| B074 | `_extFindUserRow_(username)` | [L2463](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2463) | F01 | LocalAuthService + repository kredensial privat; ketergantungan spreadsheet dihapus |
| B075 | `_extGetPassword_(username)` | [L2474](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2474) | F01 | LocalAuthService + repository kredensial privat; ketergantungan spreadsheet dihapus |
| B076 | `_extSetPassword_(username, newPassword)` | [L2478](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2478) | F01 | LocalAuthService + repository kredensial privat; ketergantungan spreadsheet dihapus |
| B077 | `_extAddUser_(username, password)` | [L2491](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2491) | F01 | LocalAuthService + repository kredensial privat; ketergantungan spreadsheet dihapus |
| B078 | `_extUpdateUsername_(oldUsername, newUsername)` | [L2498](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2498) | F01 | LocalAuthService + repository kredensial privat; ketergantungan spreadsheet dihapus |
| B079 | `_extDeleteUser_(username)` | [L2511](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2511) | F01 | LocalAuthService + repository kredensial privat; ketergantungan spreadsheet dihapus |
| B080 | `getAllSchedulesAdmin(token)` | [L2524](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2524) | F04 | SchedulingService — operasi getAllSchedulesAdmin melalui layanan/policy bersama |
| B081 | `saveScheduleAdmin(token, data)` | [L2564](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2564) | F04 | SchedulingService — operasi saveScheduleAdmin melalui layanan/policy bersama |
| B082 | `deleteScheduleAdmin(token, id)` | [L2604](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2604) | F04 | SchedulingService — operasi deleteScheduleAdmin melalui layanan/policy bersama |
| B083 | `deleteMultipleSchedulesAdmin(token, ids)` | [L2607](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2607) | F04 | SchedulingService — operasi deleteMultipleSchedulesAdmin melalui layanan/policy bersama |
| B084 | `getMyWeeklyData(token)` | [L2627](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2627) | F04 | SchedulingService — operasi getMyWeeklyData melalui layanan/policy bersama |
| B085 | `getDayName(index)` | [L2739](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2739) | X01 | Util tanggal dan label hari Indonesia |
| B086 | `saveTeachingJournal(token, data)` | [L2743](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2743) | F05 | JournalService — operasi saveTeachingJournal melalui layanan/policy bersama |
| B087 | `getClassExpectedStudents(token, scheduleId)` | [L2989](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L2989) | F06 | StudentAttendanceService — operasi getClassExpectedStudents melalui layanan/policy bersama |
| B088 | `getPicketRekapForDate(token, scheduleId, dateStr)` | [L3012](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3012) | F06 | StudentAttendanceService — operasi getPicketRekapForDate melalui layanan/policy bersama |
| B089 | `updateTeachingLog(token, payload)` | [L3050](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3050) | F05 | JournalService — operasi updateTeachingLog melalui layanan/policy bersama |
| B090 | `getSettingsMasterData(token)` | [L3177](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3177) | X01 | SettingsQueryService untuk admin |
| B091 | `saveSystemConfig(token, data)` | [L3225](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3225) | X01 | SettingsService dengan schema setting bertipe |
| B092 | `saveSubject(token, data)` | [L3263](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3263) | X01 | SubjectService CRUD admin |
| B093 | `deleteSubject(token, id)` | [L3299](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3299) | X01 | SubjectService dengan pemeriksaan dependensi |
| B094 | `saveAllowance(token, data)` | [L3302](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3302) | F16 | HonorariumService / DocumentService / ExportService — operasi saveAllowance melalui layanan/policy bersama |
| B095 | `deleteAllowance(token, id)` | [L3330](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3330) | F16 | HonorariumService / DocumentService / ExportService — operasi deleteAllowance melalui layanan/policy bersama |
| B096 | `addHoliday(token, date, desc, isHoliday, id)` | [L3333](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3333) | F17 | CalendarService / HolidayCreditService / JobService — operasi addHoliday melalui layanan/policy bersama |
| B097 | `deleteHoliday(token, id)` | [L3373](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3373) | F17 | CalendarService / HolidayCreditService / JobService — operasi deleteHoliday melalui layanan/policy bersama |
| B098 | `deleteRowById(token, sheetName, id)` | [L3402](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3402) | X01 | Operasi delete khusus per resource; hapus primitive mutasi tabel bebas |
| B099 | `_annBool_(v)` | [L3419](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3419) | F18 | AnnouncementService — helper internal/repository; bukan endpoint publik |
| B100 | `_annDateOnly_(v)` | [L3425](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3425) | F18 | AnnouncementService — helper internal/repository; bukan endpoint publik |
| B101 | `_annParseIdList_(v)` | [L3441](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3441) | F18 | AnnouncementService — helper internal/repository; bukan endpoint publik |
| B102 | `_annStringifyIdList_(arr)` | [L3468](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3468) | F18 | AnnouncementService — helper internal/repository; bukan endpoint publik |
| B103 | `_annEnsureSheet_()` | [L3480](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3480) | F18 | AnnouncementService — helper internal/repository; bukan endpoint publik |
| B104 | `getActiveAnnouncementsForUser(token)` | [L3534](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3534) | F18 | AnnouncementService — operasi getActiveAnnouncementsForUser melalui layanan/policy bersama |
| B105 | `listAnnouncementsAdmin(token)` | [L3595](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3595) | F18 | AnnouncementService — operasi listAnnouncementsAdmin melalui layanan/policy bersama |
| B106 | `saveAnnouncement(token, data)` | [L3633](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3633) | F18 | AnnouncementService — operasi saveAnnouncement melalui layanan/policy bersama |
| B107 | `toggleAnnouncement(token, id, isActive)` | [L3841](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3841) | F18 | AnnouncementService — operasi toggleAnnouncement melalui layanan/policy bersama |
| B108 | `deleteAnnouncement(token, id)` | [L3865](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3865) | F18 | AnnouncementService — operasi deleteAnnouncement melalui layanan/policy bersama |
| B109 | `getBlokJurnal(token)` | [L3871](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3871) | F19 | BlockPolicyService / MaintenanceService — operasi getBlokJurnal melalui layanan/policy bersama |
| B110 | `simpanBlokJurnal(token, data)` | [L3898](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3898) | F19 | BlockPolicyService / MaintenanceService — operasi simpanBlokJurnal melalui layanan/policy bersama |
| B111 | `hapusBlokJurnal(token, id)` | [L3948](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3948) | F19 | BlockPolicyService / MaintenanceService — operasi hapusBlokJurnal melalui layanan/policy bersama |
| B112 | `cekBlokJurnal(token, mataPelajaran, tanggal)` | [L3960](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3960) | F19 | BlockPolicyService / MaintenanceService — operasi cekBlokJurnal melalui layanan/policy bersama |
| B113 | `getBlokAcara(token)` | [L3997](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L3997) | F19 | BlockPolicyService / MaintenanceService — operasi getBlokAcara melalui layanan/policy bersama |
| B114 | `simpanBlokAcara(token, data)` | [L4020](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4020) | F19 | BlockPolicyService / MaintenanceService — operasi simpanBlokAcara melalui layanan/policy bersama |
| B115 | `hapusBlokAcara(token, id)` | [L4065](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4065) | F19 | BlockPolicyService / MaintenanceService — operasi hapusBlokAcara melalui layanan/policy bersama |
| B116 | `cekBlokAcara(token, tipeAcara, tanggal)` | [L4087](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4087) | F19 | BlockPolicyService / MaintenanceService — operasi cekBlokAcara melalui layanan/policy bersama |
| B117 | `isTransportBlocked(tanggal)` | [L4118](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4118) | F19 | BlockPolicyService / MaintenanceService — operasi isTransportBlocked melalui layanan/policy bersama |
| B118 | `_loadBlokTransportActive()` | [L4134](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4134) | F19 | BlockPolicyService / MaintenanceService — helper internal/repository; bukan endpoint publik |
| B119 | `_isDateBlockedByList(dateStr, blokList)` | [L4152](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4152) | F19 | BlockPolicyService / MaintenanceService — helper internal/repository; bukan endpoint publik |
| B120 | `getBlokTransport(token)` | [L4167](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4167) | F19 | BlockPolicyService / MaintenanceService — operasi getBlokTransport melalui layanan/policy bersama |
| B121 | `simpanBlokTransport(token, data)` | [L4195](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4195) | F19 | BlockPolicyService / MaintenanceService — operasi simpanBlokTransport melalui layanan/policy bersama |
| B122 | `hapusBlokTransport(token, id)` | [L4247](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4247) | F19 | BlockPolicyService / MaintenanceService — operasi hapusBlokTransport melalui layanan/policy bersama |
| B123 | `checkAndSendAnnouncementEmails()` | [L4275](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4275) | F18 | AnnouncementService — operasi checkAndSendAnnouncementEmails melalui layanan/policy bersama |
| B124 | `installAnnouncementTrigger()` | [L4421](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4421) | F20 | JobService: konfigurasi enable/status + scheduler deployment; tidak mereplikasi trigger GAS |
| B125 | `doGet(e)` | [L4440](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4440) | X01 | App Router entry dan middleware/guard yang sesuai |
| B126 | `_sidebar()` | [L4465](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L4465) | X01 | Komponen sidebar responsif |
| B127 | `_navbar()` | [L5149](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L5149) | X01 | Komponen navigasi |
| B128 | `_footer()` | [L5305](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L5305) | X01 | Komponen footer |
| B129 | `_modal()` | [L5443](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L5443) | X01 | Dialog shadcn/ui dengan fokus dan konfirmasi |
| B130 | `getPageContent(pageName)` | [L7425](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L7425) | X01 | App Router pages/layout; bukan pengiriman HTML dinamis |
| B131 | `getDashboardStats(token)` | [L15165](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15165) | F02 | DashboardQueryService — operasi getDashboardStats melalui layanan/policy bersama |
| B132 | `_calculateMonthlyBonusFast_Detailed(userId, month, year, snapshot)` | [L15334](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15334) | F17 | CalendarService / HolidayCreditService / JobService — helper internal/repository; bukan endpoint publik |
| B133 | `_getIndoDayIndex()` | [L15389](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15389) | X01 | Util tanggal eksplisit Asia/Jakarta |
| B134 | `_getConfigMap()` | [L15395](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15395) | X01 | SettingsRepository server |
| B135 | `getTodaySchedule(token)` | [L15401](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15401) | F04 | SchedulingService — operasi getTodaySchedule melalui layanan/policy bersama |
| B136 | `deleteTeachingLog(token, id)` | [L15585](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15585) | F05 | JournalService — operasi deleteTeachingLog melalui layanan/policy bersama |
| B137 | `getAdminDashboardData_V2(token)` | [L15617](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15617) | F02 | DashboardQueryService — operasi getAdminDashboardData_V2 melalui layanan/policy bersama |
| B138 | `getAdminDailyAttendance(token)` | [L15800](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15800) | F13 | AttendanceService — operasi getAdminDailyAttendance melalui layanan/policy bersama |
| B139 | `getAdminDailyAttendanceHistory(token, dateStr)` | [L15871](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15871) | F13 | AttendanceService — operasi getAdminDailyAttendanceHistory melalui layanan/policy bersama |
| B140 | `_attendanceScheduleColIndex_(sheet)` | [L15999](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L15999) | F13 | AttendanceService — helper internal/repository; bukan endpoint publik |
| B141 | `confirmTeacherPresence(token, targetUserId, scheduleId)` | [L16014](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16014) | F13 | AttendanceService — operasi confirmTeacherPresence melalui layanan/policy bersama |
| B142 | `revokeTeacherPresence(token, targetUserId, scheduleId)` | [L16068](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16068) | F13 | AttendanceService — operasi revokeTeacherPresence melalui layanan/policy bersama |
| B143 | `getPicketPageData(token)` | [L16126](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16126) | F07 | PicketService — operasi getPicketPageData melalui layanan/policy bersama |
| B144 | `_isPicketOfficer(user)` | [L16372](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16372) | F07 | PicketService — helper internal/repository; bukan endpoint publik |
| B145 | `_hasTimeInToday(userId)` | [L16418](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16418) | F13 | AttendanceService — helper internal/repository; bukan endpoint publik |
| B146 | `savePicketSchedule(token, data)` | [L16427](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16427) | F07 | PicketService — operasi savePicketSchedule melalui layanan/policy bersama |
| B147 | `revokePicketDaily(token, userId)` | [L16465](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16465) | F07 | PicketService — operasi revokePicketDaily melalui layanan/policy bersama |
| B148 | `substitutePicketDaily(token, originalUserId, substituteUserId)` | [L16527](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16527) | F07 | PicketService — operasi substitutePicketDaily melalui layanan/policy bersama |
| B149 | `cancelPicketSubstituteAttendance(token, logId)` | [L16625](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16625) | F07 | PicketService — operasi cancelPicketSubstituteAttendance melalui layanan/policy bersama |
| B150 | `deletePicketSchedule(token, id)` | [L16686](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16686) | F07 | PicketService — operasi deletePicketSchedule melalui layanan/policy bersama |
| B151 | `confirmPicketDaily(token, userId)` | [L16689](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16689) | F07 | PicketService — operasi confirmPicketDaily melalui layanan/policy bersama |
| B152 | `confirmPicketSubPresenceBackend(token, targetUserId)` | [L16771](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16771) | F07 | PicketService — operasi confirmPicketSubPresenceBackend melalui layanan/policy bersama |
| B153 | `getPicketStatus(token)` | [L16807](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16807) | F07 | PicketService — operasi getPicketStatus melalui layanan/policy bersama |
| B154 | `calculateMonthlyBonus(userId, month, year)` | [L16818](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16818) | F17 | CalendarService / HolidayCreditService / JobService — operasi calculateMonthlyBonus melalui layanan/policy bersama |
| B155 | `getAvailableHonorPeriods(token)` | [L16822](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16822) | F16 | HonorariumService / DocumentService / ExportService — operasi getAvailableHonorPeriods melalui layanan/policy bersama |
| B156 | `_sendHonorariumEmail( user, periodId, finalJtm, totalAllow, grandTotal, allowancesInfo, transportTotal = 0, kbmJtm = 0, bonusJtm = 0, eventJtm = 0, )` | [L16853](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L16853) | F16 | HonorariumService / DocumentService / ExportService — helper internal/repository; bukan endpoint publik |
| B157 | `_processHonorariumFinalization(useMonth, useYear)` | [L17008](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17008) | F16 | HonorariumService / DocumentService / ExportService — helper internal/repository; bukan endpoint publik |
| B158 | `saveMonthlyHonorarium(token, targetMonth, targetYear)` | [L17169](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17169) | F16 | HonorariumService / DocumentService / ExportService — operasi saveMonthlyHonorarium melalui layanan/policy bersama |
| B159 | `autoFinalizeHonorarium()` | [L17184](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17184) | F16 | HonorariumService / DocumentService / ExportService — operasi autoFinalizeHonorarium melalui layanan/policy bersama |
| B160 | `setupAutoFinalizeTrigger()` | [L17194](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17194) | F20 | JobService: konfigurasi enable/status + scheduler deployment; tidak mereplikasi trigger GAS |
| B161 | `getMyHonorariumData(token, period)` | [L17208](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17208) | F16 | HonorariumService / DocumentService / ExportService — operasi getMyHonorariumData melalui layanan/policy bersama |
| B162 | `_calculateMonthlyBonusFast(userId, month, year, snapshot)` | [L17583](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17583) | F17 | CalendarService / HolidayCreditService / JobService — helper internal/repository; bukan endpoint publik |
| B163 | `getAdminHonorRecap(token, targetMonth, targetYear)` | [L17627](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17627) | F16 | HonorariumService / DocumentService / ExportService — operasi getAdminHonorRecap melalui layanan/policy bersama |
| B164 | `getHonorariumHistoryGuru(token)` | [L17785](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17785) | F16 | HonorariumService / DocumentService / ExportService — operasi getHonorariumHistoryGuru melalui layanan/policy bersama |
| B165 | `getHonorariumHistoryAdmin(token)` | [L17853](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17853) | F16 | HonorariumService / DocumentService / ExportService — operasi getHonorariumHistoryAdmin melalui layanan/policy bersama |
| B166 | `getAllUsers(token)` | [L17931](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17931) | F03 | UserService — operasi getAllUsers melalui layanan/policy bersama |
| B167 | `_validateKmDistance_(raw)` | [L17946](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17946) | F03 | UserService — helper internal/repository; bukan endpoint publik |
| B168 | `_validateAdditionalRole_(raw)` | [L17978](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17978) | F03 | UserService — helper internal/repository; bukan endpoint publik |
| B169 | `saveUser(token, data)` | [L17991](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L17991) | F03 | UserService — operasi saveUser melalui layanan/policy bersama |
| B170 | `deleteUser(token, id)` | [L18110](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18110) | F03 | UserService — operasi deleteUser melalui layanan/policy bersama |
| B171 | `resetUserPassword(token, id)` | [L18122](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18122) | F01 | LocalAuthService / ProfileService — operasi resetUserPassword melalui layanan/policy bersama |
| B172 | `getConfigValue(key)` | [L18148](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18148) | X01 | SettingsRepository server |
| B173 | `savePdfToDrive(base64, filename)` | [L18153](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18153) | F16 | HonorariumService / DocumentService / ExportService — operasi savePdfToDrive melalui layanan/policy bersama |
| B174 | `getAdminJournalHistory( token, page, limit, filterDateFrom, filterDateTo, filterGuru, filterClass, )` | [L18168](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18168) | F05 | JournalService — operasi getAdminJournalHistory melalui layanan/policy bersama |
| B175 | `saveCeremonySchedule(token, date, userId)` | [L18392](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18392) | F08 | CeremonyService — operasi saveCeremonySchedule melalui layanan/policy bersama |
| B176 | `deleteCeremonySchedule(token, id)` | [L18438](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18438) | F08 | CeremonyService — operasi deleteCeremonySchedule melalui layanan/policy bersama |
| B177 | `confirmCeremonyLeader(token, userId)` | [L18441](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18441) | F08 | CeremonyService — operasi confirmCeremonyLeader melalui layanan/policy bersama |
| B178 | `revokeCeremonyLeader(token, userId)` | [L18484](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18484) | F08 | CeremonyService — operasi revokeCeremonyLeader melalui layanan/policy bersama |
| B179 | `substituteCeremonyLeader(token, subId)` | [L18511](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18511) | F08 | CeremonyService — operasi substituteCeremonyLeader melalui layanan/policy bersama |
| B180 | `assignSubstitute(token, scheduleId, subId)` | [L18589](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18589) | F09 | SubstitutionService — operasi assignSubstitute melalui layanan/policy bersama |
| B181 | `replaceSubstitute(token, scheduleId, newSubId)` | [L18670](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18670) | F09 | SubstitutionService — operasi replaceSubstitute melalui layanan/policy bersama |
| B182 | `revokeSubstitute(token, scheduleId)` | [L18703](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18703) | F09 | SubstitutionService — operasi revokeSubstitute melalui layanan/policy bersama |
| B183 | `getTodaySubstitutes(token)` | [L18851](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18851) | F09 | SubstitutionService — operasi getTodaySubstitutes melalui layanan/policy bersama |
| B184 | `safeDate(val)` | [L18919](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18919) | X01 | Parser date yang ketat; nilai invalid ditolak |
| B185 | `safeTime(val)` | [L18925](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18925) | X01 | Parser time yang ketat |
| B186 | `verifyForgotSecurityAnswer(username, securityAnswer)` | [L18931](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18931) | F01 | LocalAuthService / ProfileService — operasi verifyForgotSecurityAnswer melalui layanan/policy bersama |
| B187 | `_issueForgotResetToken_(username, method)` | [L18976](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18976) | F01 | LocalAuthService / ProfileService — helper internal/repository; bukan endpoint publik |
| B188 | `_consumeForgotResetToken_(resetToken)` | [L18990](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L18990) | F01 | LocalAuthService / ProfileService — helper internal/repository; bukan endpoint publik |
| B189 | `getForgotMethods(username)` | [L19029](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19029) | F01 | LocalAuthService / ProfileService — operasi getForgotMethods melalui layanan/policy bersama |
| B190 | `_maskEmail_(email)` | [L19044](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19044) | F01 | LocalAuthService / ProfileService — helper internal/repository; bukan endpoint publik |
| B191 | `requestForgotPasswordOTP(username)` | [L19057](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19057) | F01 | LocalAuthService / ProfileService — operasi requestForgotPasswordOTP melalui layanan/policy bersama |
| B192 | `requestPasswordResetByOTP(username, otpCode)` | [L19160](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19160) | F01 | LocalAuthService / ProfileService — operasi requestPasswordResetByOTP melalui layanan/policy bersama |
| B193 | `resetPasswordWithToken(resetToken, newPassword)` | [L19225](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19225) | F01 | LocalAuthService / ProfileService — operasi resetPasswordWithToken melalui layanan/policy bersama |
| B194 | `getSecurityQuestion(username)` | [L19343](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19343) | F01 | LocalAuthService / ProfileService — operasi getSecurityQuestion melalui layanan/policy bersama |
| B195 | `getMySecurityQuestion(token)` | [L19356](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19356) | F01 | LocalAuthService / ProfileService — operasi getMySecurityQuestion melalui layanan/policy bersama |
| B196 | `saveSecurityQuestion(token, question, answer)` | [L19362](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19362) | F01 | LocalAuthService / ProfileService — operasi saveSecurityQuestion melalui layanan/policy bersama |
| B197 | `getResetRequests(token)` | [L19403](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19403) | F01 | LocalAuthService / ProfileService — operasi getResetRequests melalui layanan/policy bersama |
| B198 | `approveResetRequest(token, requestId, username)` | [L19434](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19434) | F01 | LocalAuthService / ProfileService — operasi approveResetRequest melalui layanan/policy bersama |
| B199 | `getPendingResetCount(token)` | [L19451](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19451) | F01 | LocalAuthService / ProfileService — operasi getPendingResetCount melalui layanan/policy bersama |
| B200 | `validateDocument(trxId)` | [L19459](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19459) | F16 | HonorariumService / DocumentService / ExportService — operasi validateDocument melalui layanan/policy bersama |
| B201 | `getGuruJournalHistoryPaginated( token, page, limit, filterDateFrom, filterDateTo, searchQuery, )` | [L19524](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19524) | F05 | JournalService — operasi getGuruJournalHistoryPaginated melalui layanan/policy bersama |
| B202 | `generateAutoJurnalForHoliday(token, targetDate)` | [L19748](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19748) | F17 | CalendarService / HolidayCreditService / JobService — operasi generateAutoJurnalForHoliday melalui layanan/policy bersama |
| B203 | `_runAutoJurnalForHoliday_(actorUserId, actorName, targetDate)` | [L19757](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L19757) | F17 | CalendarService / HolidayCreditService / JobService — helper internal/repository; bukan endpoint publik |
| B204 | `checkAutoJurnalStatus(token, targetDate)` | [L20127](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20127) | F17 | CalendarService / HolidayCreditService / JobService — operasi checkAutoJurnalStatus melalui layanan/policy bersama |
| B205 | `cancelAutoJurnalForHoliday(token, targetDate)` | [L20238](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20238) | F17 | CalendarService / HolidayCreditService / JobService — operasi cancelAutoJurnalForHoliday melalui layanan/policy bersama |
| B206 | `runAutoJurnalScheduler()` | [L20365](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20365) | F20 | NotificationService / JobService / UI — operasi runAutoJurnalScheduler melalui layanan/policy bersama |
| B207 | `installAutoJurnalScheduler()` | [L20415](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20415) | F20 | JobService: konfigurasi enable/status + scheduler deployment; tidak mereplikasi trigger GAS |
| B208 | `uninstallAutoJurnalScheduler()` | [L20439](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20439) | F20 | JobService: konfigurasi enable/status + scheduler deployment; tidak mereplikasi trigger GAS |
| B209 | `getAutoJurnalSchedulerStatus(token)` | [L20458](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20458) | F20 | NotificationService / JobService / UI — operasi getAutoJurnalSchedulerStatus melalui layanan/policy bersama |
| B210 | `installAutoJurnalSchedulerByAdmin(token)` | [L20483](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20483) | F20 | JobService: konfigurasi enable/status + scheduler deployment; tidak mereplikasi trigger GAS |
| B211 | `uninstallAutoJurnalSchedulerByAdmin(token)` | [L20493](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20493) | F20 | JobService: konfigurasi enable/status + scheduler deployment; tidak mereplikasi trigger GAS |
| B212 | `runReminderScheduler()` | [L20503](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20503) | F20 | NotificationService / JobService / UI — operasi runReminderScheduler melalui layanan/policy bersama |
| B213 | `_reminderMissingJournal_(dateStr)` | [L20544](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20544) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B214 | `_reminderMissingBap_(dateStr)` | [L20768](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20768) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B215 | `_reminderPendingKbm_(dateStr)` | [L20875](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20875) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B216 | `_reminderPendingSupervisor_(dateStr)` | [L20995](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L20995) | F20 | NotificationService / JobService / UI — helper internal/repository; bukan endpoint publik |
| B217 | `formatPeriode(periodeValue)` | [L21097](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L21097) | F16 | HonorariumService / DocumentService / ExportService — operasi formatPeriode melalui layanan/policy bersama |
| B218 | `getPeriodeSortKey(periodeValue)` | [L21148](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L21148) | F16 | HonorariumService / DocumentService / ExportService — operasi getPeriodeSortKey melalui layanan/policy bersama |
| B219 | `_invalidateDataSnapshot()` | [L21185](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L21185) | X01 | Invalidasi cache per domain setelah commit |
| B220 | `_getDataSnapshot(forceRefresh = false)` | [L21189](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L21189) | X01 | Query scoped actor; finalisasi membaca data fresh |
| B221 | `getHonorariumSlipByHistory(token, periode, userId)` | [L21299](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L21299) | F16 | HonorariumService / DocumentService / ExportService — operasi getHonorariumSlipByHistory melalui layanan/policy bersama |
| B222 | `addHolidayRange(token, dateFrom, dateTo, desc, isHoliday)` | [L21524](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L21524) | F17 | CalendarService / HolidayCreditService / JobService — operasi addHolidayRange melalui layanan/policy bersama |
| B223 | `getAdminDashboardExtendedStats(token)` | [L21561](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L21561) | F02 | DashboardQueryService — operasi getAdminDashboardExtendedStats melalui layanan/policy bersama |
| B224 | `getAdminDashboardPicketStatus(token)` | [L21876](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L21876) | F07 | PicketService — operasi getAdminDashboardPicketStatus melalui layanan/policy bersama |
| B225 | `adminInputPicketTime(token, payload)` | [L22010](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22010) | F13 | AttendanceService — operasi adminInputPicketTime melalui layanan/policy bersama |
| B226 | `getGuruTodayScheduleProgress(token)` | [L22110](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22110) | F04 | SchedulingService — operasi getGuruTodayScheduleProgress melalui layanan/policy bersama |
| B227 | `_examNow_()` | [L22374](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22374) | F10 | ExamService — helper internal/repository; bukan endpoint publik |
| B228 | `_examToday_()` | [L22381](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22381) | F10 | ExamService — helper internal/repository; bukan endpoint publik |
| B229 | `_examGetSession_(session_id)` | [L22384](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22384) | F01 | LocalAuthService / ProfileService — helper internal/repository; bukan endpoint publik |
| B230 | `_examGetRoom_(room_id)` | [L22391](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22391) | F10 | ExamService — helper internal/repository; bukan endpoint publik |
| B231 | `_examGetRoomsBySession_(session_id)` | [L22397](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22397) | F01 | LocalAuthService / ProfileService — helper internal/repository; bukan endpoint publik |
| B232 | `_examGetSessionsByPeriod_(period_id)` | [L22402](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22402) | F01 | LocalAuthService / ProfileService — helper internal/repository; bukan endpoint publik |
| B233 | `_examDeleteBySet_(sheetName, colIndex, valueSet)` | [L22407](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22407) | F10 | ExamService — helper internal/repository; bukan endpoint publik |
| B234 | `_examDeleteById_(sheetName, id)` | [L22417](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22417) | F10 | ExamService — helper internal/repository; bukan endpoint publik |
| B235 | `_examFormatTime_(val)` | [L22428](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22428) | F10 | ExamService — helper internal/repository; bukan endpoint publik |
| B236 | `_examCheckSupervisorConflict_(user_id, session_id, exclude_sup_id)` | [L22434](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22434) | F10 | ExamService — helper internal/repository; bukan endpoint publik |
| B237 | `_examCheckCommitteeConflict_(user_id, date, exclude_com_id)` | [L22453](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22453) | F10 | ExamService — helper internal/repository; bukan endpoint publik |
| B238 | `getExamPeriods(token)` | [L22467](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22467) | F10 | ExamService — operasi getExamPeriods melalui layanan/policy bersama |
| B239 | `addExamPeriod(token, data)` | [L22502](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22502) | F10 | ExamService — operasi addExamPeriod melalui layanan/policy bersama |
| B240 | `editExamPeriod(token, data)` | [L22554](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22554) | F10 | ExamService — operasi editExamPeriod melalui layanan/policy bersama |
| B241 | `deleteExamPeriod(token, id, force)` | [L22621](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22621) | F10 | ExamService — operasi deleteExamPeriod melalui layanan/policy bersama |
| B242 | `addExamSession(token, data)` | [L22694](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22694) | F01 | LocalAuthService / ProfileService — operasi addExamSession melalui layanan/policy bersama |
| B243 | `editExamSession(token, data)` | [L22769](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22769) | F01 | LocalAuthService / ProfileService — operasi editExamSession melalui layanan/policy bersama |
| B244 | `deleteExamSession(token, id)` | [L22839](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22839) | F01 | LocalAuthService / ProfileService — operasi deleteExamSession melalui layanan/policy bersama |
| B245 | `addExamRoom(token, data)` | [L22875](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22875) | F10 | ExamService — operasi addExamRoom melalui layanan/policy bersama |
| B246 | `editExamRoom(token, data)` | [L22918](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22918) | F10 | ExamService — operasi editExamRoom melalui layanan/policy bersama |
| B247 | `deleteExamRoom(token, id)` | [L22971](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L22971) | F10 | ExamService — operasi deleteExamRoom melalui layanan/policy bersama |
| B248 | `assignExamSupervisor(token, data)` | [L23004](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23004) | F10 | ExamService — operasi assignExamSupervisor melalui layanan/policy bersama |
| B249 | `editExamSupervisor(token, data)` | [L23059](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23059) | F10 | ExamService — operasi editExamSupervisor melalui layanan/policy bersama |
| B250 | `removeExamSupervisor(token, supervisor_id)` | [L23144](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23144) | F10 | ExamService — operasi removeExamSupervisor melalui layanan/policy bersama |
| B251 | `assignExamCommittee(token, data)` | [L23178](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23178) | F10 | ExamService — operasi assignExamCommittee melalui layanan/policy bersama |
| B252 | `removeExamCommittee(token, committee_id)` | [L23245](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23245) | F10 | ExamService — operasi removeExamCommittee melalui layanan/policy bersama |
| B253 | `getExamAdminMasterData(token)` | [L23278](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23278) | F10 | ExamService — operasi getExamAdminMasterData melalui layanan/policy bersama |
| B254 | `getExamPeriodDetail(token, period_id)` | [L23301](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23301) | F10 | ExamService — operasi getExamPeriodDetail melalui layanan/policy bersama |
| B255 | `_examAddJtmLog_( scheduleId, userId, date, materi, hadir, absen, jtmVal, refId, )` | [L23426](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23426) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B256 | `_examDeleteLogByRef_(refId)` | [L23451](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23451) | F10 | ExamService — helper internal/repository; bukan endpoint publik |
| B257 | `_examUpdateLogByRef_(refId, hadir, absen)` | [L23464](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23464) | F10 | ExamService — helper internal/repository; bukan endpoint publik |
| B258 | `_examGetBap_(supervisor_id)` | [L23477](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23477) | F11 | ExamBapService — helper internal/repository; bukan endpoint publik |
| B259 | `_examIsConfirmedPanitia_(user_id, date)` | [L23484](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23484) | F10 | ExamService — helper internal/repository; bukan endpoint publik |
| B260 | `_isPanitiaStudentAttendanceComplete_(dateStr)` | [L23498](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23498) | F10 | ExamService — helper internal/repository; bukan endpoint publik |
| B261 | `_isExamSupervisorForDate_(userId, dateStr)` | [L23532](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23532) | F10 | ExamService — helper internal/repository; bukan endpoint publik |
| B262 | `_examCheckAdminOrConfirmedPanitia_(user, date)` | [L23555](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23555) | F10 | ExamService — helper internal/repository; bukan endpoint publik |
| B263 | `_examCheckBapTiming_(sessionDate, timeEnd)` | [L23569](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23569) | F11 | ExamBapService — helper internal/repository; bukan endpoint publik |
| B264 | `confirmCommitteeAttendance(token, committee_id)` | [L23595](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23595) | F10 | ExamService — operasi confirmCommitteeAttendance melalui layanan/policy bersama |
| B265 | `revokeCommitteeAttendance(token, committee_id)` | [L23667](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23667) | F10 | ExamService — operasi revokeCommitteeAttendance melalui layanan/policy bersama |
| B266 | `confirmSupervisorAttendance(token, supervisor_id)` | [L23719](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23719) | F10 | ExamService — operasi confirmSupervisorAttendance melalui layanan/policy bersama |
| B267 | `revokeSupervisorAttendance(token, supervisor_id, force)` | [L23798](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23798) | F10 | ExamService — operasi revokeSupervisorAttendance melalui layanan/policy bersama |
| B268 | `submitExamBAP(token, supervisor_id, bapData)` | [L23895](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L23895) | F11 | ExamBapService — operasi submitExamBAP melalui layanan/policy bersama |
| B269 | `editExamBAP(token, supervisor_id, bapData)` | [L24047](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L24047) | F11 | ExamBapService — operasi editExamBAP melalui layanan/policy bersama |
| B270 | `substituteExamSupervisor(token, supervisor_id, new_user_id)` | [L24161](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L24161) | F10 | ExamService — operasi substituteExamSupervisor melalui layanan/policy bersama |
| B271 | `cancelExamSupervisorSubstitution(token, supervisor_id, force)` | [L24272](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L24272) | F10 | ExamService — operasi cancelExamSupervisorSubstitution melalui layanan/policy bersama |
| B272 | `substituteExamCommittee(token, committee_id, new_user_id)` | [L24399](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L24399) | F10 | ExamService — operasi substituteExamCommittee melalui layanan/policy bersama |
| B273 | `cancelExamCommitteeSubstitution(token, committee_id, force)` | [L24481](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L24481) | F10 | ExamService — operasi cancelExamCommitteeSubstitution melalui layanan/policy bersama |
| B274 | `getExamPageData(token, dateStr)` | [L24577](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L24577) | F10 | ExamService — operasi getExamPageData melalui layanan/policy bersama |
| B275 | `getSupervisorBapDetail(token, supervisorId)` | [L24765](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L24765) | F11 | ExamBapService — operasi getSupervisorBapDetail melalui layanan/policy bersama |
| B276 | `getExamRecapData(token, period_id)` | [L24857](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L24857) | F10 | ExamService — operasi getExamRecapData melalui layanan/policy bersama |
| B277 | `_cleanup(token, periodId)` | [L25066](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25066) | F10 | ExamService: pembersihan dependensi dalam transaksi terotorisasi; scope legacy ditelusuri saat implementasi |
| B278 | `_jtmNowIso_()` | [L25108](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25108) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B279 | `_jtmGetAdjustmentsSheet_()` | [L25115](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25115) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B280 | `_jtmGetReallocationsSheet_()` | [L25125](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25125) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B281 | `_jtmColMap_(sheet)` | [L25135](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25135) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B282 | `_jtmRowToObject_(row, headers)` | [L25144](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25144) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B283 | `_jtmBuildAdjustmentRecord_(params)` | [L25164](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25164) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B284 | `_jtmAdjustmentRecordToRow_(record)` | [L25186](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25186) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B285 | `_jtmFindAdjustmentRow_(occurrenceType, occurrenceRef)` | [L25192](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25192) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B286 | `_jtmReadAdjustment_(occurrenceType, occurrenceRef)` | [L25211](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25211) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B287 | `_jtmBuildPiketAdjustmentMap_()` | [L25215](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25215) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B288 | `_jtmResolvePiketLogJtm_(map, logUserId, logDate, fallback)` | [L25235](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25235) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B289 | `_jtmBuildKbmAdjustmentMap_()` | [L25247](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25247) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B290 | `_jtmResolveKbmLogJtm_(map, scheduleId, logDate, fallback)` | [L25274](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25274) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B291 | `_jtmUpsertAdjustment_(record)` | [L25287](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25287) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B292 | `_jtmDeleteAdjustment_(occurrenceType, occurrenceRef)` | [L25302](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25302) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B293 | `_jtmReallocationRecordToRow_(record)` | [L25320](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25320) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B294 | `_jtmCreateReallocation_(params)` | [L25326](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25326) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B295 | `_jtmReadReallocations_(occurrenceType, occurrenceRef)` | [L25342](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25342) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B296 | `_jtmReadReallocationById_(reallocationId)` | [L25359](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25359) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B297 | `_jtmDeleteReallocation_(reallocationId)` | [L25373](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25373) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B298 | `_jtmDeleteReallocationsForOccurrence_(occurrenceType, occurrenceRef)` | [L25388](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25388) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B299 | `adjustOccurrenceJtm(token, payload)` | [L25407](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25407) | F12 | JtmService — operasi adjustOccurrenceJtm melalui layanan/policy bersama |
| B300 | `getOccurrenceJtmState(token, occurrence_type, occurrence_ref)` | [L25595](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25595) | F12 | JtmService — operasi getOccurrenceJtmState melalui layanan/policy bersama |
| B301 | `_getOccurrenceJtmState_(token, occurrence_type, occurrence_ref)` | [L25605](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25605) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B302 | `reallocateJtmDifference(token, payload)` | [L25702](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25702) | F12 | JtmService — operasi reallocateJtmDifference melalui layanan/policy bersama |
| B303 | `_jtmAddReallocationCreditLog_( scheduleId, userId, date, jtmVal, reallocationId, )` | [L25972](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25972) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B304 | `_jtmSetReallocationLogId_(reallocationId, logId)` | [L25994](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L25994) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B305 | `removeReallocation(token, reallocation_id)` | [L26011](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26011) | F12 | JtmService — operasi removeReallocation melalui layanan/policy bersama |
| B306 | `resetOccurrenceJtm(token, payload)` | [L26093](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26093) | F12 | JtmService — operasi resetOccurrenceJtm melalui layanan/policy bersama |
| B307 | `_jtmDeleteAllReallocationsForOccurrence_( occurrenceType, occurrenceRef, )` | [L26231](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26231) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B308 | `_jtmDeleteKbmOriginalLog_(scheduleId, occurrenceDate, userId)` | [L26252](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26252) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B309 | `_jtmReverseOccurrence_(type, ref, date, originalUserId)` | [L26292](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26292) | F12 | JtmService — helper internal/repository; bukan endpoint publik |
| B310 | `getTransportConfig(token)` | [L26330](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26330) | F15 | TransportService — operasi getTransportConfig melalui layanan/policy bersama |
| B311 | `saveTransportConfig(token, payload)` | [L26352](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26352) | F15 | TransportService — operasi saveTransportConfig melalui layanan/policy bersama |
| B312 | `_minutesBetween(timeStart, timeEnd)` | [L26412](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26412) | F15 | TransportService — helper internal/repository; bukan endpoint publik |
| B313 | `_calcAttendancePercent(durasiAktual, durasiJadwal)` | [L26431](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26431) | F15 | TransportService — helper internal/repository; bukan endpoint publik |
| B314 | `_calcDailyTransport( kmDistance, tarifPerKm, durasiAktual, durasiJadwal, transportEnabled, )` | [L26440](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26440) | F15 | TransportService — helper internal/repository; bukan endpoint publik |
| B315 | `_applyThreePointRounding(totalDesimal)` | [L26470](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26470) | F15 | TransportService — helper internal/repository; bukan endpoint publik |
| B316 | `_getMonthlyTransportSum(userId, periodeStr)` | [L26483](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26483) | F15 | TransportService — helper internal/repository; bukan endpoint publik |
| B317 | `_getMonthlyTransportSumFast(userId, periodeStr, snapshot)` | [L26628](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26628) | F15 | TransportService — helper internal/repository; bukan endpoint publik |
| B318 | `getDailyAttendanceList(token, dateStr)` | [L26775](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L26775) | F13 | AttendanceService — operasi getDailyAttendanceList melalui layanan/policy bersama |
| B319 | `saveAttendanceTimeIn(token, payload)` | [L27380](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L27380) | F13 | AttendanceService — operasi saveAttendanceTimeIn melalui layanan/policy bersama |
| B320 | `saveAttendanceTimeOut(token, payload)` | [L27612](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L27612) | F13 | AttendanceService — operasi saveAttendanceTimeOut melalui layanan/policy bersama |
| B321 | `getAttendanceRecord(token, targetUserId, dateStr)` | [L27884](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L27884) | F13 | AttendanceService — operasi getAttendanceRecord melalui layanan/policy bersama |
| B322 | `getMyAttendanceHistory(token, month, year)` | [L27956](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L27956) | F13 | AttendanceService — operasi getMyAttendanceHistory melalui layanan/policy bersama |
| B323 | `addExtraAttendee(token, payload)` | [L28247](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L28247) | F13 | AttendanceService — operasi addExtraAttendee melalui layanan/policy bersama |
| B324 | `saveAttendanceManual(token, payload)` | [L28453](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L28453) | F13 | AttendanceService — operasi saveAttendanceManual melalui layanan/policy bersama |
| B325 | `getAttendanceSchedTemplates(token, dateStr)` | [L28561](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L28561) | F13 | AttendanceService — operasi getAttendanceSchedTemplates melalui layanan/policy bersama |
| B326 | `saveAttendanceSchedTemplate(token, payload)` | [L28618](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L28618) | F13 | AttendanceService — operasi saveAttendanceSchedTemplate melalui layanan/policy bersama |
| B327 | `deleteAttendanceSchedTemplate(token, id)` | [L28737](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L28737) | F13 | AttendanceService — operasi deleteAttendanceSchedTemplate melalui layanan/policy bersama |
| B328 | `_applyTemplateToDateInternal(schedTimeIn, schedTimeOut, dateStr)` | [L28768](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L28768) | F13 | AttendanceService — helper internal/repository; bukan endpoint publik |
| B329 | `applySchedTemplatesToDate(token, payload)` | [L28921](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L28921) | F13 | AttendanceService — operasi applySchedTemplatesToDate melalui layanan/policy bersama |
| B330 | `saveAttendanceSched(token, payload)` | [L29008](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29008) | F13 | AttendanceService — operasi saveAttendanceSched melalui layanan/policy bersama |
| B331 | `saveAttendanceLeave(token, payload)` | [L29121](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29121) | F13 | AttendanceService — operasi saveAttendanceLeave melalui layanan/policy bersama |
| B332 | `deleteAttendanceLeave(token, leaveId)` | [L29307](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29307) | F13 | AttendanceService — operasi deleteAttendanceLeave melalui layanan/policy bersama |
| B333 | `getEventDefinitions(token)` | [L29394](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29394) | F14 | EventService — operasi getEventDefinitions melalui layanan/policy bersama |
| B334 | `saveEventDefinition(token, payload)` | [L29412](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29412) | F14 | EventService — operasi saveEventDefinition melalui layanan/policy bersama |
| B335 | `deleteEventDefinition(token, eventId, force)` | [L29563](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29563) | F14 | EventService — operasi deleteEventDefinition melalui layanan/policy bersama |
| B336 | `getTodayEvents(token)` | [L29634](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29634) | F14 | EventService — operasi getTodayEvents melalui layanan/policy bersama |
| B337 | `getEventAttendance(token, eventId, date)` | [L29693](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29693) | F14 | EventService — operasi getEventAttendance melalui layanan/policy bersama |
| B338 | `_upsertAttendanceRecord( existing, newTimeIn, confirmedBy, confirmedAt, )` | [L29760](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29760) | F13 | AttendanceService — helper internal/repository; bukan endpoint publik |
| B339 | `saveEventAttendance(token, payload)` | [L29785](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L29785) | F14 | EventService — operasi saveEventAttendance melalui layanan/policy bersama |
| B340 | `getMyPendingJournals(token)` | [L30043](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L30043) | F14 | EventService — operasi getMyPendingJournals melalui layanan/policy bersama |
| B341 | `saveEventJournal(token, payload)` | [L30106](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L30106) | F14 | EventService — operasi saveEventJournal melalui layanan/policy bersama |
| B342 | `getEventAttendanceHistory(token, month, year)` | [L30238](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L30238) | F14 | EventService — operasi getEventAttendanceHistory melalui layanan/policy bersama |
| B343 | `getEventJournalHistory(token, month, year)` | [L30294](https://github.com/amtsnurulfalah-commits/sim-guru/blob/28014207da58e3d295db5bf09f52b0d7bc26de5b/Code.gs#L30294) | F14 | EventService — operasi getEventJournalHistory melalui layanan/policy bersama |

### 5.1 Catatan penggantian dan dependensi lintas domain

- `_ext*`: diganti sepenuhnya oleh auth lokal; password plaintext/default dan spreadsheet identitas tidak dibawa.
- `savePdfToDrive`: DocumentService/ExportService dan Storage privat; wajib otorisasi pemilik.
- `deleteRowById`, helper sheet dan setup: migrasi/DAL/operasi khusus resource; tidak menyediakan primitive akses tabel arbitrer.
- Helper `_exam*JtmLog*` dan `_jtm*`: satu ledger yang sama, bukan mesin kredit ujian terpisah.
- Piket pengganti dan partial piket: capability resolver bersama F07/F09/F12/F13/F06/F14; tidak hanya memeriksa role.
- Bonus libur F17 dikonsumsi engine F16; transport F15 membaca kehadiran F13 dan blok F19.
- Scheduler/trigger/reminder dipetakan F20; job libur F17, honor F16 dan pengumuman F18 tetap menjadi pemilik aturan bisnis.
- Nama underscore bukan bukti fungsi aman dibuka publik atau dead code. Callback/trigger dan pemanggilan dinamis harus ditelusuri saat implementasi.

## 6. Matriks seluruh halaman legacy

42 nama halaman/alias terdeteksi. Alias admin/guru boleh memakai satu halaman dengan scope server berbeda; kemampuan dan batas akses tetap dipertahankan.

| ID | Halaman/alias legacy | F | Rute target | Ketentuan |
|---|---|---|---|---|
| P001 | `Page_AdminDailyAttendance` | F13 | `/admin/kehadiran-harian` | Scope admin; akses langsung juga diperiksa server |
| P002 | `Page_Attendance` | F13 | `/kehadiran` | Scope actor/penugasan; DTO minimum dari server |
| P003 | `Page_AttendanceList` | F13 | `/kehadiran` | Scope actor/penugasan; DTO minimum dari server |
| P004 | `Page_AttendanceSchedule` | F13 | `/admin/jadwal-kehadiran` | Scope admin; akses langsung juga diperiksa server |
| P005 | `Page_Dashboard` | F02 | `/dashboard` | Scope actor/penugasan; DTO minimum dari server |
| P006 | `Page_EventAttendance` | F14 | `/acara/kehadiran` | Scope actor/penugasan; DTO minimum dari server |
| P007 | `Page_EventAttendance_Admin` | F14 | `/acara/kehadiran` | Scope admin; akses langsung juga diperiksa server |
| P008 | `Page_EventJournal` | F14 | `/acara/jurnal` | Scope actor/penugasan; DTO minimum dari server |
| P009 | `Page_EventJournalHistory` | F14 | `/acara/riwayat` | Scope actor/penugasan; DTO minimum dari server |
| P010 | `Page_EventJournalHistory_Admin` | F14 | `/acara/riwayat` | Scope admin; akses langsung juga diperiksa server |
| P011 | `Page_EventManagement` | F14 | `/admin/acara` | Scope admin; akses langsung juga diperiksa server |
| P012 | `Page_ExamPanitia` | F10 | `/ujian/panitia` | Scope actor/penugasan; DTO minimum dari server |
| P013 | `Page_ExamSchedule` | F10 | `/admin/ujian` | Scope admin; akses langsung juga diperiksa server |
| P014 | `Page_Honorarium` | F16 | `/honorarium` | Scope actor/penugasan; DTO minimum dari server |
| P015 | `Page_HonorariumHistory` | F16 | `/honorarium/riwayat` | Scope actor/penugasan; DTO minimum dari server |
| P016 | `Page_HonorariumHistory_Admin` | F16 | `/admin/honorarium/riwayat` | Scope admin; akses langsung juga diperiksa server |
| P017 | `Page_Honorarium_Admin` | F16 | `/admin/honorarium` | Scope admin; akses langsung juga diperiksa server |
| P018 | `Page_Journal` | F05 | `/jurnal` | Scope actor/penugasan; DTO minimum dari server |
| P019 | `Page_Journal_Admin` | F05 | `/admin/jurnal` | Scope admin; akses langsung juga diperiksa server |
| P020 | `Page_Login` | F01 | `/login` | Publik; auth lokal, respons generik dan rate limit |
| P021 | `Page_ManageSchedule` | F04 | `/admin/jadwal` | Scope admin; akses langsung juga diperiksa server |
| P022 | `Page_MyAttendance` | F13 | `/kehadiran-saya` | Scope actor/penugasan; DTO minimum dari server |
| P023 | `Page_MySchedule` | F04 | `/jadwal-saya` | Scope actor/penugasan; DTO minimum dari server |
| P024 | `Page_Picket` | F07 | `/piket` | Scope actor/penugasan; DTO minimum dari server |
| P025 | `Page_Picket_Admin` | F07 | `/admin/piket` | Scope admin; akses langsung juga diperiksa server |
| P026 | `Page_Profile` | F01 | `/profil` | Scope actor/penugasan; DTO minimum dari server |
| P027 | `Page_Settings_BlokAcara` | F19 | `/admin/pemblokiran/acara` | Scope admin; akses langsung juga diperiksa server |
| P028 | `Page_Settings_BlokJurnal` | F19 | `/admin/pemblokiran/jurnal` | Scope admin; akses langsung juga diperiksa server |
| P029 | `Page_Settings_BlokTransport` | F19 | `/admin/pemblokiran/transportasi` | Scope admin; akses langsung juga diperiksa server |
| P030 | `Page_Settings_Config` | X01 | `/admin/pengaturan/umum` | Scope admin; akses langsung juga diperiksa server |
| P031 | `Page_Settings_Kalender` | F17 | `/admin/pengaturan/kalender` | Scope admin; akses langsung juga diperiksa server |
| P032 | `Page_Settings_Maintenance` | F19 | `/admin/pengaturan/maintenance` | Scope admin; akses langsung juga diperiksa server |
| P033 | `Page_Settings_Mapel` | X01 | `/admin/pengaturan/mapel` | Scope admin; akses langsung juga diperiksa server |
| P034 | `Page_Settings_Pengumuman` | F18 | `/admin/pengaturan/pengumuman` | Scope admin; akses langsung juga diperiksa server |
| P035 | `Page_Settings_Transportasi` | F15 | `/admin/pengaturan/transportasi` | Scope admin; akses langsung juga diperiksa server |
| P036 | `Page_Settings_Tunjangan` | F16 | `/admin/pengaturan/tunjangan` | Scope admin; akses langsung juga diperiksa server |
| P037 | `Page_StudentAttendance` | F06 | `/absensi-siswa/input` | Scope actor/penugasan; DTO minimum dari server |
| P038 | `Page_StudentAttendanceHistory` | F06 | `/absensi-siswa/riwayat` | Scope actor/penugasan; DTO minimum dari server |
| P039 | `Page_StudentAttendanceHistory_Admin` | F06 | `/absensi-siswa/riwayat` | Scope admin; akses langsung juga diperiksa server |
| P040 | `Page_StudentAttendanceInput` | F06 | `/absensi-siswa/input` | Scope actor/penugasan; DTO minimum dari server |
| P041 | `Page_StudentAttendanceInput_Admin` | F06 | `/absensi-siswa/input` | Scope admin; akses langsung juga diperiksa server |
| P042 | `Page_Users` | F03 | `/admin/pengguna` | Scope admin; akses langsung juga diperiksa server |

Surface target tambahan bukan klaim halaman legacy: /lupa-password, aktivasi/onboarding, /verifikasi-dokumen, /admin/upacara, /ujian/bap, /admin/operasi. Dapat diwujudkan sebagai halaman/modal sesuai UX dengan kemampuan yang sama.

## 7. Interaksi client yang wajib dipertahankan

Lampiran D.2 tetap menjadi indeks detail interaksi client; bukan daftar endpoint. Seluruh kelompoknya diterjemahkan sebagai berikut.

| Kelompok interaksi | Pengganti target | F | Bukti penerimaan |
|---|---|---|---|
| Login, idle warning, logout multi-tab | Form auth + session server + sinkronisasi tab | F01 | T03,T40,T44–T50 |
| Navigasi, sidebar/accordion, badge, timer, refresh | Layout dan komponen/hooks; status dari server | F02,F20 | T40 |
| Modal/form, indikator count/durasi, anti double submit | shadcn/ui + Zod; validasi akhir server | Semua | T06,T07,T20,T40 |
| Jadwal, filter, rekap, detail, pemilihan/hapus batch | Query server + komponen tabel | F04 | T05,T39 |
| Jurnal dan rekap siswa | Form eligibility yang sama dengan mutasi | F05,F06 | T06–T12,T36 |
| Konfirmasi, pengganti, adjustment dan reset | Action domain bertransaksi + pratinjau dampak | F07–F12 | T13–T21 |
| Jam, template, izin, tambahan peserta | Action scoped actor/date | F13 | T02,T25,T27 |
| Acara, hadir, jurnal dan riwayat | EventService dan form terotorisasi | F14 | T22,T23 |
| Honor, privasi nominal, slip, verifikasi | Engine tunggal dan snapshot; toggle layar lokal | F15–F16 | T24–T33,T39 |
| Kalender, auto-jurnal, status scheduler | Admin job controls; riwayat run | F17,F20 | T29,T30,T41 |
| Pengumuman, blok, maintenance | Komponen + policy server | F18,F19 | T12,T28,T35,T37 |
| Ekspor PDF/CSV/XLSX dan cetak | ExportService scoped filter; render yang diperiksa | F05,F13,F16,F20 | T39,T40 |

Nama client ganda seperti initSidebarState, openSubModalCeremony dan modal BAP harus digabung berdasarkan perilaku efektif, bukan disalin sebagai definisi React ganda.

## 8. Register koreksi B01–B25

| Koreksi | Pemilik | Tes terkait |
|---|---|---|
| B01–B02 | F01 | T03,T43,T44,T48–T50 |
| B03–B04 | F07–F09,F16,F17 | T02,T13,T38,T39 |
| B05–B06 | F05 | T06–T12 |
| B07–B09 | F05,F16,F17 | T09,T29,T31 |
| B10 | F12 | T17 |
| B11–B12 | F16 | T31–T33 |
| B13 | F15 | T27 |
| B14–B15 | F05,F09,F10,F12,F14,F16 | T06,T13,T16,T21,T22,T32 |
| B16 | Migrasi/X01 | A07 |
| B17 | F14 | A06 |
| B18 | F04,F10 | T05,A04 |
| B19 | F06 | T36 |
| B20 | Semua | T02,T38,T43 |
| B21 | Semua/F02/F16 | A05,T31,T33 |
| B22 | F16,F17 | T29,A08 |
| B23 | F07,F12,F13 | A03,T02 |
| B24 | F20 | T34,A02 |
| B25 | F17,F20 | T41 |

## 9. Tes penerimaan T01–T50

Daftar berikut disalin dari kontrak penerimaan sumber agar expected result tetap dapat ditelusuri. Seluruhnya belum dijalankan dalam Tahap 0.1.

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
| T42 | Admin membuat akun dan username berbeda hanya kapital | Satu username kanonis; duplicate ditolak; profil+kredensial atomik |
| T43 | Baca user/ekspor/REST langsung dengan role bisnis/anon | Tidak memperoleh password_hash, answer_hash, token atau OTP |
| T44 | Buat, login dan ganti password | Argon2id valid; password lama salah ditolak; password baru bekerja dan lama gagal |
| T45 | Ubah password/reset admin/nonaktifkan akun dengan sesi lama aktif | auth_version berubah; semua sesi lama ditolak server |
| T46 | Reset token/OTP dipakai dua request paralel | Hanya satu sukses; hash baru dan konsumsi token satu transaksi |
| T47 | Pertanyaan keamanan benar tanpa OTP/persetujuan admin | Tidak bisa reset atau memperoleh sesi bisnis |
| T48 | Akun migrasi belum aktivasi/password sementara | Hanya aktivasi/onboarding/logout; tidak dapat mutasi bisnis |
| T49 | Login brute force lintas instance, akun tidak ditemukan | Rate limit persisten, respons umum dan tanpa kebocoran akun |
| T50 | Operasi auth tidak dapat mengakses layanan identitas eksternal | Seluruh lifecycle lokal tetap berfungsi; tidak ada request identitas keluar |
| T41 | Tanggal kalender dengan is_holiday=false | KBM/ujian/reminder tetap mengikuti DayContext; tidak dianggap libur |

### 9.1 Tes tambahan untuk celah cakupan

| ID baru | Skenario dan expected result |
|---|---|
| A01 | Master/settings: jenjang/paralel/standar kelas, tahun-semester dan durasi tervalidasi; overflow hari ditolak; NIP tetap teks |
| A02 | Job dipanggil tanpa secret/diulang/paralel atau worker gagal: akses ditolak atau satu hasil; retry tidak menggandakan efek |
| A03 | Piket asli/pengganti/partial dan panitia: capabilities konsisten lintas rekap siswa, waktu, acara dan konfirmasi; tidak memperoleh hak global |
| A04 | Pengawas dua sesi berbeda yang waktunya bertumpang tindih ditolak; interval tidak bentrok diterima sesuai policy |
| A05 | Setelah mutasi committed, query dashboard/rekap relevan tidak memakai cache lama atau cache pengguna lain |
| A06 | Detail jurnal acara memakai PK kanonis; riwayat→detail tepat dan akses pengguna lain ditolak |
| A07 | Impor staging: jumlah, legacy_id, orphan, timezone dan saldo per komponen direkonsiliasi; snapshot final legacy tidak dihitung ulang |
| A08 | Estimasi seluruh bulan dan realisasi sampai hari ini diberi label dan cutoff berbeda; hak libur dihitung tepat sekali |

## 10. Keputusan terbuka untuk Tahap 0.2

| ID | Keputusan | Domain terdampak |
|---|---|---|
| K01 | Konfirmasi mandiri vs klaim check-in, termasuk pengecualian pembina/piket; tulis policy per operasi | F01,F07,F08,F13 |
| K02 | Aktivasi tautan sekali pakai vs password sementara; mekanisme akun tanpa email dan verifikasi admin | F01,F03 |
| K03 | Presisi decimal alokasi JTM, batas maksimum password dan parameter hashing hasil benchmark | F01,F12,F16 |
| K04 | Estimasi bonus libur mendatang dan aturan penutupan hak periode | F16,F17 |
| K05 | Prosedur koreksi pascafinal dan batas perubahan data lama tanpa menyentuh snapshot | F05,F10,F12,F14,F16 |
| K06 | Provider email, worker/scheduler serta batas operasional deployment | F01,F20 |
| K07 | H-1: penerimaan konfirmasi umum vs specific; satu eligibility policy pada query/mutasi | F05,F13 |
| K08 | Template kehadiran: bagian utama memakai day_index valid, guard lampiran membatasi 1–6; tetapkan apakah Minggu didukung | F13 |
| K09 | Policy bentrok lintas KBM/ujian/substitusi dan kombinasi panitia-pengawas berdasarkan interval nyata | F04,F09,F10 |

Keputusan terbuka tidak dianggap fitur selesai atau alasan mengurangi cakupan. Akses data produksi diperlukan pada migrasi; fondasi dan fixtures sintetis dapat dibangun sebelumnya.

## 11. Hasil verifikasi Tahap 0.1

- F01–F20: 20/20 modul terpetakan.
- Backend Lampiran B: 343/343 deklarasi memiliki ID, bukti baris dan pengganti target.
- Halaman Lampiran D.1: 42/42 nama/alias memiliki rute dan pemilik.
- Kontrak penerimaan: T01–T50 lengkap, termasuk T41 dari Lampiran A.2.
- Koreksi B01–B25 memiliki pemilik dan pengujian; tambahan A01–A08 menutup kebutuhan yang belum eksplisit.
- Pemeriksaan struktural dijalankan saat penyusunan: keunikan ID, cakupan modul, jumlah deklarasi, cakupan halaman dan kelengkapan ID tes.
- Belum ada aplikasi, schema SQL, deployment, pengujian runtime atau rekonsiliasi data produksi yang dibuat/dijalankan pada tahap ini.

Syarat keluar Tahap 0.1 terpenuhi pada tingkat pemetaan dokumen. Berikutnya Tahap 0.2 menetapkan keputusan K01–K09, kemudian 0.3 merinci model dan kontrak teknis. Saat repositori legacy dibaca ulang pada implementasi, selisih inventaris harus dicatat terhadap commit beku; pemetaan ini tidak membuktikan dependensi transitif lengkap.

### Pembaruan implementasi Tahap 5.1–5.5

F10/F11/F12(ujian)/F14 mempunyai implementasi pada migrasi `exams_bap_stage5` dan `events_journals_stage5`, layanan `src/server/programs`, serta halaman `/ujian` dan `/acara`. Lihat `docs/operations/Ujian_Acara_Tahap_5.md` dan `docs/verification/Tahap_5.md` untuk perilaku, cakupan uji dan keterbatasan verifikasi. Status baris awal merupakan baseline perencanaan; kelulusan produksi mengikuti bukti verifikasi Tahap5.
