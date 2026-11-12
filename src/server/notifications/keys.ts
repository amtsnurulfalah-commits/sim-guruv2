import "server-only";
import { createCipheriv, createDecipheriv, createECDH, randomBytes } from "node:crypto";
import { pushSubscription } from "../../lib/notifications/contracts";

export type Binding = { userId: string; installationId: string; generation: string; environment: string; keyId: string };
export type SealedSubscription = { kid: string; iv: string; tag: string; data: string };
const context = (b: Binding) => Buffer.from(JSON.stringify(["sim-guru:push:v1", b.environment, b.userId, b.installationId, b.generation, b.keyId]));
function key(value: string) {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw Error("PUSH_KEY_INVALID");
  return Buffer.from(value, "hex");
}
export function sealSubscription(value: unknown, binding: Binding, secret: string): SealedSubscription {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(context(binding));
  const data = Buffer.concat([cipher.update(JSON.stringify(pushSubscription.parse(value))), cipher.final()]);
  return { kid: binding.keyId, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}
export function openSubscription(value: SealedSubscription, binding: Binding, keyring: Readonly<Record<string, string>>) {
  try {
    const secret = Object.hasOwn(keyring, value.kid) ? keyring[value.kid] : undefined;
    if (value.kid !== binding.keyId || !secret) throw Error();
    const decipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(value.iv, "base64"));
    decipher.setAAD(context(binding));
    decipher.setAuthTag(Buffer.from(value.tag, "base64"));
    return pushSubscription.parse(JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, "base64")), decipher.final()]).toString()));
  } catch {
    throw Error("PUSH_SUBSCRIPTION_UNAVAILABLE");
  }
}
export function generatePushKeys() {
  const ec = createECDH("prime256v1");
  ec.generateKeys();
  const privateKey = Buffer.alloc(32);
  const scalar = ec.getPrivateKey();
  scalar.copy(privateKey, 32 - scalar.length);
  return { publicKey: ec.getPublicKey().toString("base64url"), privateKey: privateKey.toString("base64url"), encryptionKey: randomBytes(32).toString("hex") };
}
