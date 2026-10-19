export type AppRole = "admin" | "guru";
export type AppModule = {
  slug: string;
  title: string;
  description: string;
  group: "Kegiatan" | "Administrasi";
  stage: string;
  adminOnly?: boolean;
};
export const modules: readonly AppModule[] = [
  {
    slug: "jadwal",
    title: "Jadwal mengajar",
    description: "Jadwal KBM, waktu mengajar dan pemeriksaan bentrok jadwal.",
    group: "Kegiatan",
    stage: "2.4",
  },
  {
    slug: "jurnal",
    title: "Jurnal pembelajaran",
    description: "Catatan pembelajaran, rekap siswa dan riwayat jurnal.",
    group: "Kegiatan",
    stage: "3.6",
  },
  {
    slug: "piket",
    title: "Piket dan upacara",
    description:
      "Penugasan, konfirmasi dan pencatatan kegiatan piket serta upacara.",
    group: "Kegiatan",
    stage: "3.1–3.4",
  },
  {
    slug: "ujian",
    title: "Ujian dan BAP",
    description:
      "Penugasan panitia/pengawas dan berita acara pelaksanaan ujian.",
    group: "Kegiatan",
    stage: "4",
  },
  {
    slug: "kehadiran",
    title: "Kehadiran",
    description: "Kehadiran, waktu masuk/keluar dan izin sesuai kewenangan.",
    group: "Kegiatan",
    stage: "5",
  },
  {
    slug: "acara",
    title: "Kegiatan dan acara",
    description: "Penugasan peserta, kehadiran dan jurnal kegiatan madrasah.",
    group: "Kegiatan",
    stage: "5",
  },
  {
    slug: "honorarium",
    title: "Honorarium",
    description:
      "Perhitungan, finalisasi dan slip honorarium dari kegiatan yang sah.",
    group: "Kegiatan",
    stage: "6",
  },
  {
    slug: "pengguna",
    title: "Manajemen pengguna",
    description: "Kelola pengguna, peran dan status akses akun madrasah.",
    group: "Administrasi",
    stage: "2.1",
    adminOnly: true,
  },
  {
    slug: "master",
    title: "Data master",
    description: "Tahun pelajaran, semester, mata pelajaran dan kelas.",
    group: "Administrasi",
    stage: "2.2",
    adminOnly: true,
  },
  {
    slug: "kalender",
    title: "Kalender akademik",
    description: "Kalender akademik dan pengelolaan hari libur.",
    group: "Administrasi",
    stage: "2.3",
    adminOnly: true,
  },
  {
    slug: "pengumuman",
    title: "Pengumuman",
    description: "Pengumuman bagi guru dan pengelolaan sasaran informasi.",
    group: "Administrasi",
    stage: "7.1",
    adminOnly: true,
  },
  {
    slug: "operasional",
    title: "Pengaturan operasional",
    description:
      "Pemblokiran, pemeliharaan dan pemantauan pekerjaan terjadwal.",
    group: "Administrasi",
    stage: "7.2–7.4",
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
