import "server-only";
import { z } from "zod";
import type { SqlExecutor } from "../../../scripts/lib/sql-database";
import { decryptActivationToken } from "../auth/activation-secrets";
import { decryptOtp } from "../accounts/lifecycle-secrets";
const payloadSchema = z.object({
  id: z.uuid(),
  lease: z.uuid(),
  userId: z.uuid(),
  email: z.email(),
  template: z.enum([
    "account_activation",
    "email_verify",
    "reset_otp",
    "password_changed",
  ]),
  public: z.object({
    fullName: z.string(),
    username: z.string(),
    appUrl: z.url(),
    expiresAt: z.string(),
  }),
  secret: z
    .object({
      challengeId: z.uuid(),
      ciphertextHex: z.string(),
      nonceHex: z.string(),
      tagHex: z.string(),
      keyVersion: z.literal(1),
    })
    .nullable(),
});
export type DeliveryResult = "sent" | "retry_wait" | "failed" | "unknown";
export type MailMessage = {
  id: string;
  to: string;
  subject: string;
  text: string;
};
export interface MailAdapter {
  send(message: MailMessage): Promise<DeliveryResult>;
}
export class ResendMailAdapter implements MailAdapter {
  constructor(
    private readonly key: string,
    private readonly from: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  async send(message: MailMessage): Promise<DeliveryResult> {
    try {
      const response = await this.fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "sim-guru-security/" + message.id,
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
        signal: AbortSignal.timeout(12000),
        redirect: "error",
      });
      // No raw provider body or error is logged (it may contain recipient/token details).
      if (response.ok) return "sent";
      if (response.status === 429 || response.status >= 500)
        return "retry_wait";
      if (response.status === 409) return "unknown";
      return "failed";
    } catch {
      return "retry_wait";
    } // Same stable provider idempotency key on every retry.
  }
}
export class SecurityOutboxWorker {
  constructor(
    private readonly db: SqlExecutor,
    private readonly mail: MailAdapter,
    private readonly key: string,
    private readonly appUrl: string,
  ) {}
  async deliverOne(challengeId?: string) {
    if (challengeId) z.uuid().parse(challengeId);
    const raw = (
      await this.db.query<{ value: unknown }>(
        challengeId
          ? "select auth_private.claim_security_otp($1) as value"
          : "select auth_private.claim_security_outbox() as value",
        challengeId ? [challengeId] : [],
      )
    ).rows[0]?.value;
    if (!raw) return { processed: 0 };
    const value = payloadSchema.parse(raw);
    let result: DeliveryResult;
    try {
      const app = new URL(this.appUrl),
        publicApp = new URL(value.public.appUrl);
      if (
        app.origin !== publicApp.origin ||
        new Date(value.public.expiresAt).getTime() <= Date.now()
      )
        throw new Error("STALE_OUTBOX");
      let subject = "Perubahan kata sandi SiM-Guru",
        text =
          "Kata sandi akun SiM-Guru Anda telah diubah. Jika Anda tidak melakukannya, hubungi administrator madrasah. Kata sandi tidak disertakan dalam pesan ini.";
      if (value.template === "account_activation") {
        if (!value.secret) throw new Error("SECRET_MISSING");
        const token = decryptActivationToken(value.secret, this.key, {
          outboxId: value.id,
          challengeId: value.secret.challengeId,
          userId: value.userId,
          email: value.email,
          keyVersion: 1,
        });
        const link = new URL("/aktivasi", app);
        link.hash = new URLSearchParams({
          challengeId: value.secret.challengeId,
          token,
        }).toString();
        subject = "Aktivasi akun SiM-Guru";
        text = `Buka tautan untuk mengaktifkan akun SiM-Guru Anda: ${link.toString()}\nTautan berlaku hingga ${value.public.expiresAt} dan hanya dapat digunakan sekali. Abaikan jika Anda tidak mengenali permintaan ini.`;
      } else if (value.template !== "password_changed") {
        if (!value.secret) throw new Error("SECRET_MISSING");
        const otp = decryptOtp(value.secret, this.key, {
          outboxId: value.id,
          challengeId: value.secret.challengeId,
          email: value.email,
          purpose: value.template,
        });
        subject =
          value.template === "email_verify"
            ? "Verifikasi email SiM-Guru"
            : "Pemulihan akun SiM-Guru";
        text = `Kode ${value.template === "email_verify" ? "verifikasi email" : "pemulihan akun"} SiM-Guru Anda: ${otp}\nKode berlaku 10 menit, maksimal 5 percobaan. Jangan bagikan kode ini. Abaikan jika Anda tidak mengajukannya.`;
      }
      result = await this.mail.send({
        id: value.id,
        to: value.email,
        subject,
        text,
      });
    } catch {
      result = "failed";
    }
    const changed = (
      await this.db.query<{ ok: boolean }>(
        "select auth_private.finish_security_outbox($1,$2,$3) as ok",
        [value.id, value.lease, result],
      )
    ).rows[0]!.ok;
    return { processed: 1, result: changed ? result : "lease_lost" };
  }
}
