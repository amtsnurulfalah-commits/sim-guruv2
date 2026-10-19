import nodemailer from "nodemailer";
import { requireEnvironment } from "../src/server/env";
async function main() {
  const mail = requireEnvironment("mail");
  if (mail.MAIL_PROVIDER !== "gmail") throw new Error("PROVIDER");
  const transport = nodemailer.createTransport({
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
  });
  try {
    await transport.verify();
    console.log(
      JSON.stringify({ gmailSmtp: "authenticated", emailSent: false }),
    );
  } finally {
    transport.close();
  }
}
main().catch(() => {
  console.error(
    JSON.stringify({ gmailSmtp: "verification_failed", emailSent: false }),
  );
  process.exitCode = 1;
});
