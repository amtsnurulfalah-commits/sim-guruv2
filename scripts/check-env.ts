import { parseRecaptcha } from "../src/lib/accounts/recaptcha";
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

if (requested === "auth" || requested === "all") {
  const captcha = parseRecaptcha(process.env);
  if (captcha.state === "unavailable") {
    console.error("reCAPTCHA: konfigurasi belum valid — periksa RECAPTCHA_ENABLED, RECAPTCHA_SITE_KEY dan RECAPTCHA_SECRET_KEY (nilai tidak ditampilkan).");
    process.exitCode = 1;
  } else console.log(`reCAPTCHA: ${captcha.state === "ready" ? "aktif, bentuk key valid (provider belum diuji)" : "nonaktif"}.`);
}
