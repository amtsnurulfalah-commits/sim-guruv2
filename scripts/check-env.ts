import { loadEnvConfig } from "@next/env";
import { environmentScopes, parseEnvironment, type EnvironmentScope } from "../src/lib/env/schema";
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
const requested = process.argv[2] ?? "core";
if (requested !== "all" && !environmentScopes.includes(requested as EnvironmentScope)) {
  console.error("Lingkup tidak valid. Pilih core, database, auth, storage, mail, jobs, atau all.");
  process.exitCode = 2;
} else {
  const scopes = requested === "all" ? environmentScopes : [requested as EnvironmentScope];
  for (const scope of scopes) {
    const result = parseEnvironment(scope, process.env);
    if (result.ok) console.log(`${scope}: konfigurasi valid secara bentuk (koneksi belum diuji).`);
    else {
      console.error(`${scope}: belum valid — ${result.issues.map(({ field, code }) => `${field} (${code})`).join(", ")}`);
      process.exitCode = 1;
    }
  }
}
