import { loadEnvConfig } from "@next/env";
import { readFile, open } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { profileExport } from "../src/lib/migration/profile";
import { planSchema, planHash } from "../src/lib/migration/plan";
import { openNativeDatabase } from "./lib/native-database";
import { applyImportPlan } from "./migration/apply-plan";
import { reconcilePlan } from "./migration/reconcile-plan";
async function main() {
  loadEnvConfig(process.cwd());
  const args = process.argv.slice(2),
    action = args.shift(),
    file = args.shift(),
    out = args.shift();
  if (
    !file ||
    !out ||
    !["profile", "plan", "apply", "reconcile"].includes(action ?? "")
  )
    throw new Error("USAGE_ACTION_INPUT_OUTPUT_REQUIRED");
  const flags = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--allow-remote") flags.set(a, "true");
    else if (a === "--expected-hash" && args[i + 1]) flags.set(a, args[++i]!);
    else throw new Error("INVALID_ARGUMENT");
  }
  if (resolve(file) === resolve(out))
    throw new Error("OUTPUT_MUST_DIFFER_FROM_SOURCE");
  // Reserve the private report before any database mutation; never overwrite evidence.
  const report = await open(out, "wx", 0o600);
  try {
    const bytes = await readFile(file);
    if (bytes.length > 6 * 1024 * 1024) throw new Error("INPUT_TOO_LARGE");
    const input = JSON.parse(bytes.toString("utf8"));
    let result: unknown;
    if (action === "profile")
      result = {
        ...profileExport(input),
        fileChecksum: createHash("sha256").update(bytes).digest("hex"),
      };
    else if (action === "plan") {
      const p = planSchema.parse(input);
      result = {
        planHash: planHash(p),
        entries: p.entries.length,
        targets: [...new Set(p.entries.map((e) => e.targetTable))],
        applied: false,
      };
    } else {
      const connection = process.env.MIGRATION_DATABASE_URL;
      if (!connection) throw new Error("MIGRATION_DATABASE_URL_REQUIRED");
      const url = new URL(connection);
      if (!["postgres:", "postgresql:"].includes(url.protocol))
        throw new Error("INVALID_DATABASE_URL");
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (!local && !flags.has("--allow-remote"))
        throw new Error("REMOTE_OPERATION_REQUIRES_EXPLICIT_FLAG");
      const db = openNativeDatabase(connection, !local);
      try {
        if (action === "apply") {
          const expected = flags.get("--expected-hash");
          if (!expected) throw new Error("EXPECTED_HASH_REQUIRED");
          result = await applyImportPlan(db, input, expected);
        } else result = await reconcilePlan(db, input);
      } finally {
        await db.close();
      }
    }
    await report.writeFile(JSON.stringify(result, null, 2) + "\n");
  } finally {
    await report.close();
  }
  console.log("Laporan privat dibuat.");
}
main().catch((e) => {
  console.error(
    e instanceof Error && /^[A-Z_]+$/.test(e.message)
      ? e.message
      : "LEGACY_MIGRATION_FAILED",
  );
  process.exitCode = 1;
});
