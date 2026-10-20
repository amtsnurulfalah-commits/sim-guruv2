import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
export function encryptBackup(bytes: Uint8Array, key: string) {
  if (!/^[a-f0-9]{64}$/i.test(key))
    throw new Error("BACKUP_ENCRYPTION_KEY_REQUIRED");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  cipher.setAAD(Buffer.from("sim-guru-backup-v1"));
  const data = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return {
    data,
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    checksum: createHash("sha256").update(data).digest("hex"),
    plainChecksum: createHash("sha256").update(bytes).digest("hex"),
  };
}
export function decryptBackup(
  data: Uint8Array,
  m: { iv: string; tag: string; checksum: string; plainChecksum: string },
  key: string,
) {
  if (!/^[a-f0-9]{64}$/i.test(key))
    throw new Error("BACKUP_ENCRYPTION_KEY_REQUIRED");
  if (createHash("sha256").update(data).digest("hex") !== m.checksum)
    throw new Error("BACKUP_CHECKSUM_MISMATCH");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    Buffer.from(m.iv, "hex"),
  );
  decipher.setAAD(Buffer.from("sim-guru-backup-v1"));
  decipher.setAuthTag(Buffer.from(m.tag, "hex"));
  const bytes = Buffer.concat([decipher.update(data), decipher.final()]);
  if (createHash("sha256").update(bytes).digest("hex") !== m.plainChecksum)
    throw new Error("BACKUP_PLAINTEXT_MISMATCH");
  return bytes;
}
