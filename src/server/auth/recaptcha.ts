import "server-only";
import { z } from "zod";
import { parseRecaptcha } from "@/lib/accounts/recaptcha";
import { AuthError } from "./service";

const answerSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
});

export async function verifyLoginRecaptcha(
  token: string | undefined,
  appUrl: string,
  source: Readonly<Record<string, string | undefined>> = process.env,
  send: typeof fetch = fetch,
) {
  const config = parseRecaptcha(source);
  if (config.state === "disabled") return;
  if (config.state !== "ready") throw new AuthError("CAPTCHA_UNAVAILABLE", 503);
  if (!token) throw new AuthError("CAPTCHA_REQUIRED", 422);
  if (token.length > 4096 || !token.trim()) throw new AuthError("CAPTCHA_INVALID", 422);
  let answer: z.infer<typeof answerSchema>;
  try {
    const response = await send("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: config.secretKey, response: token }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error("UPSTREAM_UNAVAILABLE");
    answer = answerSchema.parse(await response.json());
  } catch {
    // Do not log tokens, provider response bodies or secrets.
    throw new AuthError("CAPTCHA_UNAVAILABLE", 503);
  }
  if (answer["error-codes"]?.some(code => ["missing-input-secret", "invalid-input-secret", "bad-request"].includes(code)))
    throw new AuthError("CAPTCHA_UNAVAILABLE", 503);
  if (!answer.success || answer.hostname?.toLowerCase() !== new URL(appUrl).hostname.toLowerCase())
    throw new AuthError("CAPTCHA_INVALID", 422);
}
