export type AppRole = "admin" | "guru";
export type AppModule = {
  slug: string;
  title: string;
  description: string;
  group: "Kegiatan" | "Administrasi";
  stage: string;
  adminOnly?: boolean;
  href?: string;
  available?: boolean;
};
export const modules: readonly AppModule[] = [
  {
    slug: "jadwal",
    href: "/jadwal",
    available: true,
    title: "Jadwal mengajar",
    description: "Jadwal KBM, waktu mengajar dan pemeriksaan bentrok jadwal.",
    group: "Kegiatan",
    stage: "2.4",
  },
  {
    slug: "jurnal",
    href: "/jurnal",
    available: true,
    title: "Jurnal pembelajaran",
    description: "Catatan pembelajaran, rekap siswa dan riwayat jurnal.",
    group: "Kegiatan",
    stage: "3.6",
  },
  {
    slug: "kegiatan",
    href: "/kegiatan",
    available: true,
    title: "Konfirmasi KBM",
    description: "Penugasan bertanggal dan konfirmasi kegiatan mengajar.",
    group: "Kegiatan",
    stage: "3.1",
  },
  {
    slug: "absensi-siswa",
    href: "/absensi-siswa/input",
    available: true,
    title: "Absensi siswa",
    description: "Rekap kelas dan progres kelengkapan harian.",
    group: "Kegiatan",
    stage: "3.4",
  },
  {
    slug: "piket",
    href: "/piket",
    available: true,
    title: "Piket dan upacara",
    description:
      "Penugasan, konfirmasi dan pencatatan kegiatan piket serta upacara.",
    group: "Kegiatan",
    stage: "4.1–4.4",
  },
  {
    slug: "ujian",
    href: "/ujian",
    available: true,
    title: "Ujian dan BAP",
    description:
      "Penugasan panitia/pengawas dan berita acara pelaksanaan ujian.",
    group: "Kegiatan",
    stage: "5.1–5.3",
  },
  {
    slug: "kehadiran",
    href: "/kehadiran",
    available: true,
    title: "Kehadiran",
    description: "Kehadiran, waktu masuk/keluar dan izin sesuai kewenangan.",
    group: "Kegiatan",
    stage: "3.2–3.3",
  },
  {
    slug: "acara",
    href: "/acara",
    available: true,
    title: "Kegiatan dan acara",
    description: "Penugasan peserta, kehadiran dan jurnal kegiatan madrasah.",
    group: "Kegiatan",
    stage: "5.4–5.5",
  },
  {
    slug: "honorarium",
    href: "/honorarium",
    available: true,
    title: "Honorarium",
    description:
      "Perhitungan, finalisasi dan slip honorarium dari kegiatan yang sah.",
    group: "Kegiatan",
    stage: "6",
  },
  {
    slug: "pengguna",
    href: "/admin/pengguna",
    available: true,
    title: "Manajemen pengguna",
    description: "Kelola pengguna, peran dan status akses akun madrasah.",
    group: "Administrasi",
    stage: "2.1",
    adminOnly: true,
  },
  {
    slug: "master",
    href: "/admin/master",
    available: true,
    title: "Data master",
    description: "Tahun pelajaran, semester, mata pelajaran dan kelas.",
    group: "Administrasi",
    stage: "2.2",
    adminOnly: true,
  },
  {
    slug: "kalender",
    href: "/admin/kalender",
    available: true,
    title: "Kalender akademik",
    description: "Kalender akademik dan pengelolaan hari libur.",
    group: "Administrasi",
    stage: "2.3",
    adminOnly: true,
  },
  {
    slug: "pengumuman",
    href: "/admin/pengumuman",
    available: true,
    title: "Pengumuman",
    description: "Pengumuman bagi guru dan pengelolaan sasaran informasi.",
    group: "Administrasi",
    stage: "7.1",
    adminOnly: true,
  },
  {
    slug: "operasional",
    href: "/admin/operasional",
    available: true,
    title: "Pengaturan operasional",
    description:
      "Pemblokiran, pemeliharaan dan pemantauan pekerjaan terjadwal.",
    group: "Administrasi",
    stage: "7.2–7.4",
    adminOnly: true,
  },
  {
    slug: "migrasi",
    href: "/admin/migrasi",
    available: true,
    title: "Migrasi data",
    description:
      "Periksa data lama, selesaikan perbedaan, dan tinjau bukti migrasi.",
    group: "Administrasi",
    stage: "8.1–8.5",
    adminOnly: true,
  },
];
export function modulesFor(role: AppRole) {
  return modules.filter((module) => !module.adminOnly || role === "admin");
}
export function moduleBySlug(slug: string) {
  return modules.find((module) => module.slug === slug);
}
export function canViewModule(role: AppRole, module: AppModule) {
  return !module.adminOnly || role === "admin";
}
