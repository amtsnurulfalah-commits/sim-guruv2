import { z } from "zod";
import { usernameSchema } from "./schemas";

/** Login accepts existing credentials, including short legacy passwords. */
export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().refine(value => {
    const length = Array.from(value).length;
    return length >= 1 && length <= 128;
  }),
}).strict();

export const loginCsrfSchema = z.object({
  csrfToken: z.string().min(1).max(150).regex(/^[A-Za-z0-9._-]+$/),
});
export const loginResultSchema = z.object({
  redirectTo: z.enum(["/dashboard", "/akun"]),
});
const notices: Record<string, string> = {
  updated: "Pengamanan akun diperbarui. Silakan masuk kembali.",
  activated: "Akun berhasil diaktifkan. Silakan masuk dan selesaikan pengamanan akun.",
  logout: "Anda berhasil keluar.",
  expired: "Sesi berakhir. Silakan masuk kembali.",
};
export function loginNotice(status: string | null) {
  return status && Object.hasOwn(notices, status) ? notices[status]! : "";
}
