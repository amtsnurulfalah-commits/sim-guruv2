/** User-facing labels only. Never include submitted values or raw database errors. */
export const fieldLabels: Record<string, string> = {
  username: "Username",
  maintenanceStart: "Mulai pemeliharaan (WIB)",
  maintenanceEnd: "Selesai pemeliharaan (WIB)",
  sent: "Hasil pemeriksaan penerimaan email",

  ctaText: "Teks tautan",
  ctaUrl: "URL tautan",
  targetUsers: "Sasaran pengguna",
  allowDismiss: "Pengecualian boleh menutup",
  denyDismiss: "Pengecualian tidak boleh menutup",
  password: "Kata sandi",
  currentPassword: "Kata sandi saat ini",
  newPassword: "Kata sandi baru",
  confirmation: "Konfirmasi kata sandi",
  fullName: "Nama lengkap",
  email: "Alamat email",
  phone: "Nomor telepon",
  address: "Alamat",
  photoUrl: "URL foto",
  question: "Pertanyaan keamanan",
  answer: "Jawaban keamanan",
  otp: "Kode OTP",
  reason: "Alasan",
  material: "Materi pembelajaran",
  notes: "Catatan",
  present: "Siswa hadir",
  absent: "Siswa absen",
  hadir: "Siswa hadir",
  sakit: "Siswa sakit",
  izin: "Siswa izin",
  alpa: "Siswa alpa",
  date: "Tanggal kegiatan",
  from: "Tanggal mulai",
  to: "Tanggal akhir",
  q: "Pencarian",
  dateStart: "Tanggal mulai",
  dateEnd: "Tanggal akhir",
  validFrom: "Mulai berlaku",
  validTo: "Akhir berlaku",
  timeStart: "Jam mulai",
  timeEnd: "Jam selesai",
  timeIn: "Jam masuk",
  timeOut: "Jam pulang",
  scheduledIn: "Jadwal masuk",
  scheduledOut: "Jadwal pulang",
  actualIn: "Jam masuk aktual",
  actualOut: "Jam pulang aktual",
  leaveTime: "Jam keluar sementara",
  returnTime: "Jam kembali",
  scheduledJtm: "JTM terjadwal",
  restMinutes: "Menit istirahat",
  dayIndex: "Hari",
  dayIndices: "Hari",
  dates: "Tanggal",
  userId: "Guru / pengguna",
  teacherId: "Guru",
  subjectId: "Mata pelajaran",
  classId: "Kelas",
  academicYearId: "Tahun pelajaran",
  academicPeriodId: "Semester",
  occurrenceId: "Kegiatan",
  periodId: "Periode",
  sessionId: "Sesi",
  roomId: "Ruang",
  targetUserId: "Guru tujuan",
  amount: "Nominal",
  rate: "Tarif",
  jtm: "Jumlah JTM",
  kmDistance: "Jarak tempat tinggal",
  name: "Nama",
  code: "Kode",
  kind: "Jenis",
  type: "Jenis",
  status: "Status",
  role: "Peran",
  additionalRole: "Jabatan tambahan",
  nip: "NIP",
  expectedStudents: "Jumlah siswa kelas",
  standardStudents: "Jumlah siswa kelas",
  level: "Tingkat kelas",
  parallel: "Paralel kelas",
  message: "Pesan",
  title: "Judul",
  body: "Isi",
  stopFrom: "Tanggal penghentian",
  version: "Versi data",
  previewId: "Pratinjau",
  challengeId: "Permintaan verifikasi",
  token: "Tautan verifikasi",
  evidence: "Bukti verifikasi",
  method: "Metode",
  delivery: "Metode penyerahan akun",
};
export function fieldLabel(path: string) {
  const key =
    path
      .split(".")
      .filter((p) => !/^\d+$/.test(p))
      .at(-1) ?? "";
  return Object.hasOwn(fieldLabels, key) ? fieldLabels[key]! : "Isian formulir";
}
export const guidance: Record<string, string> = {
  FORM_NOT_READY: "Coba kembali untuk menyiapkan formulir. Jika masih gagal, hubungi administrator dengan referensi bantuan bila tersedia.",
  VALIDATION_ERROR:
    "Perbaiki isian yang disebutkan, lalu kirim kembali. Periksa kembali formulir sebelum mengirim ulang.",
  INVALID_CREDENTIALS:
    "Periksa username dan kata sandi yang Anda masukkan. Gunakan pemulihan akun bila lupa kata sandi.",
  UNAUTHENTICATED:
    "Masuk kembali, lalu buka halaman yang diperlukan. Simpan catatan pekerjaan Anda sebelum meninggalkan halaman.",
  ONBOARDING_REQUIRED:
    "Buka Akun dan Profil, lalu lengkapi kata sandi, verifikasi email, dan pertanyaan keamanan.",
  FORBIDDEN:
    "Periksa peran dan penugasan Anda. Hubungi administrator jika tugas ini seharusnya menjadi kewenangan Anda.",
  CSRF_INVALID:
    "Muat ulang halaman untuk memperbarui formulir, lalu periksa isian sebelum mengirim kembali.",
  RATE_LIMITED:
    "Tunggu sampai batas percobaan berakhir. Hindari menekan tombol kirim berulang kali.",
  CONFLICT:
    "Muat ulang daftar untuk memperoleh data terbaru. Untuk akun baru, periksa apakah username atau email sudah digunakan.",
  PREVIEW_STALE:
    "Buat pratinjau baru, periksa kembali dampaknya, lalu konfirmasikan perubahan.",
  SCHEDULE_COLLISION:
    "Periksa guru, kelas, hari, dan jam pada hasil pemeriksaan bentrok. Ubah jadwal yang beririsan lalu periksa lagi.",
  SCHEDULE_INVALID:
    "Periksa semester, guru, mata pelajaran, kelas, jam mulai, JTM, istirahat, dan rentang tanggal. Jam selesai harus sebelum tengah malam.",
  SCHEDULE_HISTORICAL:
    "Gunakan tanggal perubahan mendatang pada jadwal aktif. Hubungi administrator untuk koreksi riwayat.",
  MASTER_OVERLAP:
    "Periksa tanggal mulai dan akhir. Pilih rentang yang tidak bertumpang tindih dengan data tersimpan.",
  MASTER_REFERENCED:
    "Periksa data terkait terlebih dahulu. Gunakan pengarsipan atau penghentian yang diizinkan jika riwayat harus dipertahankan.",
  MASTER_INVALID:
    "Periksa isian dan relasinya, termasuk tahun pelajaran, semester, tanggal, dan nilai nominal.",
  MASTER_PAST:
    "Ubah tanggal mulai berlaku menjadi hari ini atau tanggal mendatang sesuai aturan formulir.",
  CALENDAR_INVALID:
    "Periksa tanggal awal/akhir dan periode akademik pada kalender.",
  CALENDAR_PREVIEW_STALE:
    "Muat ulang kalender, buat pratinjau baru, dan periksa perubahan sebelum menyimpan.",
  CALENDAR_PREVIEW_INVALID:
    "Buat pratinjau baru pada akun dan tindakan yang sama sebelum mengonfirmasi.",
  STUDENT_COUNT_MISMATCH:
    "Periksa jumlah hadir, sakit, izin, alpa, atau absen. Totalnya harus sesuai jumlah siswa kelas.",
  STUDENT_ATTENDANCE_MISMATCH:
    "Samakan jumlah siswa hadir dan absen dengan rekap absensi atau jurnal pada kelas dan tanggal yang sama.",
  NO_ACTIVE_CONFIRMATION:
    "Buka Konfirmasi KBM dan pastikan kegiatan pada tanggal yang dipilih sudah disahkan.",
  H1_NOT_CONFIRMED:
    "Periksa konfirmasi KBM pada tanggal kemarin sebelum mengisi jurnal H-1.",
  H1_DISABLED:
    "Pilih kegiatan hari ini, atau hubungi administrator untuk memeriksa kebijakan jurnal H-1.",
  JOURNAL_BLOCKED:
    "Periksa mata pelajaran dan tanggal kegiatan. Hubungi administrator untuk mengetahui atau meninjau pemblokirannya.",
  DUPLICATE_JOURNAL:
    "Buka Riwayat dan Detail Jurnal, temukan kegiatan tersebut, lalu gunakan Ubah jurnal bila diperlukan.",
  FUTURE_DATE:
    "Ubah tanggal kegiatan ke tanggal yang telah tiba sesuai batas pengisian jurnal.",
  DATE_EXPIRED:
    "Periksa tanggal kegiatan. Hubungi administrator untuk meninjau kebutuhan koreksi melalui prosedur yang berlaku.",
  ATTENDANCE_TIME_INVALID:
    "Periksa urutan jam masuk dan pulang serta kesesuaiannya dengan jadwal kehadiran.",
  LEAVE_OVERLAP:
    "Jam kembali harus setelah jam keluar dan tidak beririsan dengan izin lain pada hari yang sama.",
  TODAY_ONLY: "Pilih tanggal hari ini menurut WIB untuk tindakan ini.",
  DUTY_COLLISION:
    "Periksa guru, tanggal, dan penugasan yang sudah ada sebelum menunjuk pengganti.",
  FINAL_PERIOD:
    "Pilih periode terbuka atau gunakan alur koreksi. Data periode final dilindungi.",
  FINANCE_BLOCKED:
    "Buka pratinjau honorarium dan selesaikan setiap temuan, termasuk tarif yang belum tersedia.",
  EXPORT_TOO_LARGE:
    "Persempit rentang tanggal atau filter guru, lalu unduh kembali.",
  CHALLENGE_INVALID:
    "Periksa kode OTP atau gunakan tautan terbaru. Jika kedaluwarsa, ajukan verifikasi atau pemulihan kembali.",
  EMAIL_DELIVERY_UNAVAILABLE:
    "Hubungi administrator agar pengiriman email diperiksa, lalu minta kode kembali setelah layanan tersedia.",
  MAINTENANCE:
    "Tunggu hingga pemeliharaan selesai, lalu muat ulang halaman. Hubungi administrator bila perlu kepastian waktu.",
  UNAVAILABLE:
    "Coba muat ulang data beberapa saat lagi. Jika tetap gagal, sampaikan nomor referensi kepada administrator.",
  INTERNAL_ERROR:
    "Jika ini tindakan penyimpanan, periksa riwayat sebelum mengirim ulang agar tidak membuat data ganda. Hubungi administrator dengan nomor referensi bila berlanjut.",
};
