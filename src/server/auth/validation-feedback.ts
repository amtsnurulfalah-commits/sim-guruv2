import { ZodError } from "zod";
import type { FieldErrors } from "../../lib/feedback/api-error";
import { PasswordPolicyError } from "./passwords";
const policy: Record<string, string> = {
  PASSWORD_REUSE:
    "Gunakan kata sandi baru yang berbeda dari kata sandi saat ini.",
  LENGTH_8_128: "Gunakan 8–128 karakter.",
  UPPERCASE_REQUIRED: "Tambahkan huruf besar.",
  LOWERCASE_REQUIRED: "Tambahkan huruf kecil.",
  NUMBER_REQUIRED: "Tambahkan angka.",
  SYMBOL_REQUIRED: 'Tambahkan salah satu simbol !@#$%^&*(),.?":{}|<>.',
  CONTAINS_USERNAME: "Jangan memakai username dalam kata sandi.",
  CONTAINS_NAME: "Jangan memakai bagian nama Anda dalam kata sandi.",
  ANSWER_LENGTH_3_128: "Gunakan jawaban sepanjang 3–128 karakter.",
  INVALID_CURRENT_PASSWORD:
    "Kata sandi saat ini tidak sesuai. Periksa kembali isian ini.",
};
/** Return constraints and approved labels, never values, SQL errors or arbitrary property names. */
export function validationFieldErrors(error: unknown): FieldErrors | undefined {
  const fields: FieldErrors = Object.create(null);
  if (error instanceof ZodError)
    for (const issue of error.issues.slice(0, 30)) {
      const key = issue.path.length
        ? issue.path.map(String).join(".")
        : "_form";
      if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(key)) continue;
      let message =
        "Nilai atau hubungan antar-isian belum sesuai. Periksa format dan pilihan data.";
      if (issue.code === "too_small")
        message =
          issue.origin === "string"
            ? `Isi minimal ${issue.minimum} karakter.`
            : issue.origin === "array"
              ? `Pilih minimal ${issue.minimum} data.`
              : `Gunakan nilai ${issue.inclusive ? "minimal" : "lebih dari"} ${issue.minimum}.`;
      if (issue.code === "too_big")
        message =
          issue.origin === "string"
            ? `Gunakan maksimal ${issue.maximum} karakter.`
            : issue.origin === "array"
              ? `Pilih maksimal ${issue.maximum} data.`
              : `Gunakan nilai ${issue.inclusive ? "maksimal" : "kurang dari"} ${issue.maximum}.`;
      if (issue.code === "invalid_type")
        message = "Isian wajib diisi dengan jenis nilai yang sesuai.";
      if (issue.code === "invalid_format")
        message =
          "Format belum sesuai. Periksa penulisan email, tanggal, jam, angka, atau pilihan pada isian ini.";
      if (issue.code === "invalid_value")
        message = "Pilih salah satu nilai yang tersedia pada formulir.";
      if (issue.code === "unrecognized_keys")
        message =
          "Struktur formulir tidak sesuai versi layanan. Muat ulang halaman sebelum mencoba lagi.";
      // Only known schema messages are exposed, without interpolated user values.
      if (
        issue.code === "custom" &&
        [
          "Konfirmasi kata sandi harus sama dengan kata sandi baru.",
          "Pilih semester tujuan yang berbeda.",
          "Tanggal akhir harus setelah atau sama dengan tanggal mulai, maksimal 366 hari.",
          "Jam pulang harus setelah jam masuk.",
          "Tanggal akhir blok harus setelah atau sama dengan tanggal mulai.",
          "Jumlah hadir, sakit, izin, dan alpa harus antara 1 dan 1000 siswa.",
          "Isi waktu selesai pemeliharaan atau kosongkan kedua waktu.",
          "Isi waktu mulai pemeliharaan atau kosongkan kedua waktu.",
          "Waktu selesai harus setelah waktu mulai pemeliharaan.",
          "Jam kembali harus setelah jam keluar.",
        ].includes(issue.message)
      )
        message = issue.message;
      (fields[key] ??= []).push(message);
    }
  if (error instanceof PasswordPolicyError)
    for (const code of error.codes) {
      const key =
        code === "ANSWER_LENGTH_3_128"
          ? "answer"
          : code === "INVALID_CURRENT_PASSWORD"
            ? "currentPassword"
            : "newPassword";
      (fields[key] ??= []).push(
        policy[code] ?? "Periksa kembali kebijakan kata sandi.",
      );
    }
  return Object.keys(fields).length ? fields : undefined;
}
