import { z } from "zod";

export type LoginCaptcha = { enabled: boolean; siteKey: string | null };
const key = z.string().min(10).max(200).regex(/^[A-Za-z0-9_-]+$/);
const configuration = z.object({
  RECAPTCHA_SITE_KEY: key,
  RECAPTCHA_SECRET_KEY: key,
});

/** Explicit rollout switch; malformed/enabled-but-incomplete config fails closed. */
export function parseRecaptcha(source: Readonly<Record<string, string | undefined>>) {
  const flag = source.RECAPTCHA_ENABLED;
  if (!flag || flag === "false") return { state: "disabled" } as const;
  if (flag !== "true") return { state: "unavailable" } as const;
  const result = configuration.safeParse(source);
  return result.success
    ? { state: "ready", siteKey: result.data.RECAPTCHA_SITE_KEY, secretKey: result.data.RECAPTCHA_SECRET_KEY } as const
    : { state: "unavailable" } as const;
}

export function publicRecaptcha(source: Readonly<Record<string, string | undefined>>): LoginCaptcha {
  const config = parseRecaptcha(source);
  return { enabled: config.state !== "disabled", siteKey: config.state === "ready" ? config.siteKey : null };
}
