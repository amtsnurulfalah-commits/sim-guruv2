import { z } from "zod";

// Modul murni agar validasi dapat diuji tanpa memuat server-only atau rahasia.
export type EnvironmentSource = Readonly<Record<string, string | undefined>>;
export type EnvironmentScope =
  | "core"
  | "database"
  | "auth"
  | "storage"
  | "mail"
  | "jobs"
  | "worker";
const nonempty = z.string().min(1);
const secret = z.string().min(32);
const databaseUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    ["postgres:", "postgresql:"].includes(url.protocol) &&
    Boolean(url.username) &&
    url.pathname.length > 1
  );
}, "URL PostgreSQL tidak valid.");
const httpUrl = z
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol));
const schemas = {
  core: z.object({ APP_URL: httpUrl, APP_TIMEZONE: z.literal("Asia/Jakarta") }),
  database: z.object({
    DATABASE_URL: databaseUrl,
    AUTH_DATABASE_URL: databaseUrl,
    DB_POOL_MAX: z.coerce.number().int().min(1).max(10),
    DB_SSL_CA: z
      .string()
      .refine(
        (value) =>
          !value.trim() ||
          (value.includes("-----BEGIN CERTIFICATE-----") &&
            value.includes("-----END CERTIFICATE-----")),
      )
      .optional(),
  }),
  auth: z.object({
    SESSION_SECRET: secret,
    AUTH_CHALLENGE_HMAC_SECRET: secret,
    AUTH_OUTBOX_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  }),
  storage: z.object({ SUPABASE_URL: httpUrl, SUPABASE_SECRET_KEY: nonempty }),
  worker: z.object({
    WORKER_DATABASE_URL: databaseUrl.refine((value) => {
      try {
        return /^sim_guru_worker_login(?:\.[a-z0-9]+)?$/.test(
          decodeURIComponent(new URL(value).username),
        );
      } catch {
        return false;
      }
    }),
  }),
  mail: z.object({
    MAIL_PROVIDER: z.literal("resend"),
    MAIL_API_KEY: z.string().trim().min(1),
    MAIL_FROM: z.email(),
  }),
  jobs: z.object({ CRON_SECRET: secret }),
} as const;
export const environmentScopes = [
  "core",
  "database",
  "auth",
  "storage",
  "mail",
  "jobs",
  "worker",
] as const;
export type ScopeEnvironment<S extends EnvironmentScope> = z.output<
  (typeof schemas)[S]
>;
export type EnvironmentIssue = { field: string; code: "MISSING" | "INVALID" };
export type EnvironmentResult<S extends EnvironmentScope> =
  | { ok: true; value: ScopeEnvironment<S> }
  | { ok: false; issues: EnvironmentIssue[] };

export function parseEnvironment<S extends EnvironmentScope>(
  scope: S,
  source: EnvironmentSource,
): EnvironmentResult<S> {
  const production = source.NODE_ENV === "production";
  const values: Record<string, string | undefined> = {
    ...source,
    APP_URL:
      source.APP_URL || (production ? undefined : "http://localhost:3000"),
    APP_TIMEZONE: source.APP_TIMEZONE || "Asia/Jakarta",
    DB_POOL_MAX: source.DB_POOL_MAX || "2",
    MAIL_PROVIDER:
      source.MAIL_PROVIDER || (source.RESEND_API_KEY ? "resend" : undefined),
    MAIL_API_KEY: source.MAIL_API_KEY || source.RESEND_API_KEY,
  };
  const result = schemas[scope].safeParse(values);
  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((issue) => {
        const field = String(issue.path[0] ?? scope);
        return { field, code: !values[field] ? "MISSING" : "INVALID" };
      }),
    };
  }
  const issues: EnvironmentIssue[] = [];
  if (
    production &&
    scope === "core" &&
    new URL(values.APP_URL!).protocol !== "https:"
  ) {
    issues.push({ field: "APP_URL", code: "INVALID" });
  }
  if (scope === "database") {
    const business = new URL(values.DATABASE_URL!);
    const auth = new URL(values.AUTH_DATABASE_URL!);
    if (business.username === auth.username)
      issues.push({ field: "AUTH_DATABASE_URL", code: "INVALID" });
    if (business.pathname !== auth.pathname)
      issues.push({ field: "AUTH_DATABASE_URL", code: "INVALID" });
    // Pool/session/direct host/port bisa berbeda pada proyek DB yang sama; identitas proyek dibuktikan saat provisioning 1.2.
    if (production) {
      for (const field of ["DATABASE_URL", "AUTH_DATABASE_URL"] as const) {
        const url = new URL(values[field]!);
        if (url.searchParams.get("sslmode") === "disable")
          issues.push({ field, code: "INVALID" });
      }
    }
  }
  if (scope === "auth") {
    const secrets = [
      values.SESSION_SECRET,
      values.AUTH_CHALLENGE_HMAC_SECRET,
      values.AUTH_OUTBOX_ENCRYPTION_KEY,
    ];
    if (new Set(secrets).size !== secrets.length)
      issues.push({ field: "AUTH_CHALLENGE_HMAC_SECRET", code: "INVALID" });
  }
  return issues.length
    ? { ok: false, issues }
    : { ok: true, value: result.data as ScopeEnvironment<S> };
}
