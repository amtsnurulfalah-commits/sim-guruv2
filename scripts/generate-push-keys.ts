import { writeFile } from "node:fs/promises";
import { generatePushKeys } from "../src/server/notifications/keys";
async function main() {
  const [environment, output, ...extra] = process.argv.slice(2);
  if (!environment || !["development", "staging", "production"].includes(environment) || !output || extra.length) throw Error();
  const keys = generatePushKeys();
  await writeFile(output, [
    "PUSH_ENVIRONMENT=" + environment,
    "PUSH_VAPID_KEY_ID=" + environment + "-v1",
    "PUSH_VAPID_PUBLIC_KEY=" + keys.publicKey,
    "PUSH_VAPID_PRIVATE_KEY=" + keys.privateKey,
    "PUSH_ENCRYPTION_KEY_ID=" + environment + "-v1",
    "PUSH_ENCRYPTION_KEY=" + keys.encryptionKey,
    "",
  ].join("\n"), { mode: 0o600, flag: "wx" });
  console.log("File kunci privat berhasil dibuat.");
}
main().catch(() => { console.error("PUSH_KEYS_NOT_WRITTEN"); process.exitCode = 1; });
