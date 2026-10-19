import "server-only";
import nodemailer from "nodemailer";
import type { ScopeEnvironment } from "../../lib/env/schema";
import {
  ResendMailAdapter,
  type MailAdapter,
  type MailMessage,
  type DeliveryResult,
} from "./security-outbox";

type Sender = {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    messageId: string;
    disableFileAccess: boolean;
    disableUrlAccess: boolean;
  }): Promise<{ accepted: unknown[] }>;
};
export class GmailMailAdapter implements MailAdapter {
  constructor(
    private readonly sender: Sender,
    private readonly from: string,
  ) {}
  async send(message: MailMessage): Promise<DeliveryResult> {
    try {
      const result = await this.sender.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        messageId: `<sim-guru-${message.id}@${this.from.split("@")[1]}>`,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      return result.accepted.length ? "sent" : "failed";
    } catch (error) {
      // Never log SMTP responses, credentials, recipients or message bodies.
      const e = error as {
        responseCode?: number;
        command?: string;
        code?: string;
      } | null;
      if (e?.responseCode && e.responseCode >= 500) return "failed";
      if (e?.responseCode && e.responseCode >= 400) return "retry_wait";
      if (e?.code === "EAUTH") return "failed";
      // A dropped DATA connection can mean Gmail accepted the email. Do not retry blindly.
      if (e?.command === "DATA") return "unknown";
      if (
        [
          "CONN",
          "EHLO",
          "HELO",
          "AUTH PLAIN",
          "AUTH LOGIN",
          "MAIL FROM",
          "RCPT TO",
          "STARTTLS",
        ].includes(e?.command ?? "")
      )
        return "retry_wait";
      return "unknown";
    }
  }
}
export function createMailAdapter(mail: ScopeEnvironment<"mail">): MailAdapter {
  if (mail.MAIL_PROVIDER === "resend")
    return new ResendMailAdapter(mail.MAIL_API_KEY, mail.MAIL_FROM);
  const sender = nodemailer.createTransport({
    host: mail.SMTP_HOST,
    port: Number(mail.SMTP_PORT),
    secure: true,
    auth: { user: mail.SMTP_USER, pass: mail.SMTP_PASSWORD },
    tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
    logger: false,
    debug: false,
    pool: false,
  });
  return new GmailMailAdapter(sender, mail.MAIL_FROM);
}
