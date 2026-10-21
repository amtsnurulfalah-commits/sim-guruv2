import type { z } from "zod";
import { ApiRequestError } from "../feedback/api-error";
/** Reuse the account schemas; never include submitted secrets in feedback. */
export function validateAccount<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_form";
    const message = issue.code === "too_small" ? (issue.origin === "string" ? `Isi minimal ${issue.minimum} karakter.` : issue.origin === "array" ? `Pilih minimal ${issue.minimum} data.` : `Gunakan nilai minimal ${issue.minimum}.`)
      : issue.code === "too_big" ? (issue.origin === "string" ? `Gunakan maksimal ${issue.maximum} karakter.` : issue.origin === "array" ? `Pilih maksimal ${issue.maximum} data.` : `Gunakan nilai maksimal ${issue.maximum}.`)
      : issue.code === "custom" && key === "confirmation" ? "Konfirmasi kata sandi harus sama dengan kata sandi baru."
      : issue.code === "custom" && issue.message === "Tanggal akhir harus setelah atau sama dengan tanggal mulai, maksimal 366 hari." ? issue.message
      : "Periksa format dan ketentuan isian ini.";
    (fields[key] ??= []).push(message);
  }
  throw new ApiRequestError("VALIDATION_ERROR", "Periksa isian yang ditandai sebelum melanjutkan.", 422, fields);
}
