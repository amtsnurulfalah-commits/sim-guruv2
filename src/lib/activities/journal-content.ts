import { z } from "zod";

export const journalContentFields = [
  {
    name: "learningObjectives",
    label: "Tujuan pembelajaran",
    help: "Apa yang diharapkan dapat dilakukan siswa setelah pembelajaran?",
  },
  {
    name: "obstacles",
    label: "Kendala",
    help: "Catat kesulitan yang ditemukan; boleh dikosongkan jika tidak ada.",
  },
  {
    name: "followUp",
    label: "Tindak lanjut",
    help: "Jelaskan tindakan untuk menangani kendala atau langkah pertemuan berikutnya.",
  },
  {
    name: "reflection",
    label: "Refleksi guru",
    help: "Evaluasi proses, respons siswa, dan efektivitas pembelajaran.",
  },
] as const;
export const journalContentSchema = {
  learningObjectives: z.string().trim().max(2000).optional(),
  obstacles: z.string().trim().max(2000).optional(),
  followUp: z.string().trim().max(2000).optional(),
  reflection: z.string().trim().max(2000).optional(),
};
