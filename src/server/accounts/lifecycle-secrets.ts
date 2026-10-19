import "server-only";
import {
  createHmac,
  randomBytes,
  randomInt,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
export type OtpPurpose = "email_verify" | "reset_otp";
export type OtpBinding = {
  challengeId: string;
  outboxId: string;
  email: string;
  purpose: OtpPurpose;
};
export const createOtp = () =>
  randomInt(0, 1_000_000).toString().padStart(6, "0");
export function otpDigest(
  otp: string,
  key: string,
  purpose: OtpPurpose,
  challengeId: string,
  email: string,
) {
  if (!/^\d{6}$/u.test(otp)) throw new Error("INVALID_OTP");
  return createHmac("sha256", key)
    .update(
      JSON.stringify(["sim-guru:otp:v1", purpose, challengeId, email, otp]),
    )
    .digest("hex");
}
const aad = (b: OtpBinding) =>
  Buffer.from(
    JSON.stringify([
      "sim-guru:otp-outbox:v1",
      b.purpose,
      b.challengeId,
      b.outboxId,
      b.email,
      1,
    ]),
  );
export function encryptOtp(otp: string, key: string, binding: OtpBinding) {
  if (!/^\d{6}$/u.test(otp) || !/^[a-f0-9]{64}$/iu.test(key))
    throw new Error("INVALID_OTP_PAYLOAD");
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), nonce);
  cipher.setAAD(aad(binding));
  return {
    ciphertextHex: Buffer.concat([cipher.update(otp), cipher.final()]).toString(
      "hex",
    ),
    nonceHex: nonce.toString("hex"),
    tagHex: cipher.getAuthTag().toString("hex"),
    keyVersion: 1 as const,
  };
}
export function decryptOtp(
  payload: {
    ciphertextHex: string;
    nonceHex: string;
    tagHex: string;
    keyVersion: number;
  },
  key: string,
  binding: OtpBinding,
) {
  try {
    if (
      payload.keyVersion !== 1 ||
      !/^[a-f0-9]{12}$/u.test(payload.ciphertextHex) ||
      !/^[a-f0-9]{24}$/u.test(payload.nonceHex) ||
      !/^[a-f0-9]{32}$/u.test(payload.tagHex)
    )
      throw new Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key, "hex"),
      Buffer.from(payload.nonceHex, "hex"),
    );
    decipher.setAAD(aad(binding));
    decipher.setAuthTag(Buffer.from(payload.tagHex, "hex"));
    const result = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertextHex, "hex")),
      decipher.final(),
    ]).toString();
    if (!/^\d{6}$/u.test(result)) throw new Error();
    return result;
  } catch {
    throw new Error("INVALID_OTP_PAYLOAD");
  }
}
