import "server-only";
import { randomBytes, createHash, createCipheriv, createDecipheriv } from "node:crypto";
import { z } from "zod";
export const activationBindingSchema=z.object({outboxId:z.uuid(),challengeId:z.uuid(),userId:z.uuid(),email:z.email(),keyVersion:z.literal(1)}).strict();
export type ActivationBinding=z.infer<typeof activationBindingSchema>;
export type EncryptedActivation={ciphertextHex:string;nonceHex:string;tagHex:string;keyVersion:1};
const tokenSchema=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
function keyFromHex(key: string): Buffer {
  if (!/^[a-fA-F0-9]{64}$/u.test(key)) throw new Error("AUTH_OUTBOX_KEY_INVALID");
  return Buffer.from(key,"hex");
}
function aad(binding: ActivationBinding): Buffer {
  const b=activationBindingSchema.parse(binding);
  return Buffer.from(JSON.stringify(["sim-guru:activation:v1",b.outboxId,b.challengeId,b.userId,b.email,b.keyVersion]));
}
export function createActivationToken(): { token:string; digest:string } {
  const token=randomBytes(32).toString("base64url");
  return {token,digest:activationTokenDigest(token)};
}
export function activationTokenDigest(token: string): string {
  return createHash("sha256").update(tokenSchema.parse(token),"utf8").digest("hex");
}
export function encryptActivationToken(token: string,key: string,binding: ActivationBinding): EncryptedActivation {
  tokenSchema.parse(token);
  const nonce=randomBytes(12),cipher=createCipheriv("aes-256-gcm",keyFromHex(key),nonce);
  cipher.setAAD(aad(binding));
  const ciphertext=Buffer.concat([cipher.update(token,"utf8"),cipher.final()]);
  return {ciphertextHex:ciphertext.toString("hex"),nonceHex:nonce.toString("hex"),tagHex:cipher.getAuthTag().toString("hex"),keyVersion:1};
}
export function decryptActivationToken(payload: EncryptedActivation,key: string,binding: ActivationBinding): string {
  try {
    if(payload.keyVersion!==binding.keyVersion || !/^[a-f0-9]{24}$/u.test(payload.nonceHex) || !/^[a-f0-9]{32}$/u.test(payload.tagHex) || !/^[a-f0-9]{86}$/u.test(payload.ciphertextHex)) throw new Error();
    const decipher=createDecipheriv("aes-256-gcm",keyFromHex(key),Buffer.from(payload.nonceHex,"hex"));
    decipher.setAAD(aad(binding));decipher.setAuthTag(Buffer.from(payload.tagHex,"hex"));
    return tokenSchema.parse(Buffer.concat([decipher.update(Buffer.from(payload.ciphertextHex,"hex")),decipher.final()]).toString("utf8"));
  } catch { throw new Error("ACTIVATION_PAYLOAD_INVALID"); }
}
