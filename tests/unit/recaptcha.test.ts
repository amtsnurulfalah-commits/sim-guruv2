import test from "node:test";
import assert from "node:assert/strict";
import { parseRecaptcha, publicRecaptcha } from "../../src/lib/accounts/recaptcha";
import { loginRequestSchema, loginSchema } from "../../src/lib/accounts/login";
test("reCAPTCHA public configuration never includes secret key", () => {
  const source = { RECAPTCHA_ENABLED: "true", RECAPTCHA_SITE_KEY: "synthetic-public-key", RECAPTCHA_SECRET_KEY: "synthetic-secret-key" };
  assert.equal(parseRecaptcha(source).state, "ready");
  assert.deepEqual(publicRecaptcha(source), { enabled: true, siteKey: source.RECAPTCHA_SITE_KEY });
  assert.deepEqual(publicRecaptcha({ ...source, RECAPTCHA_SECRET_KEY: "" }), { enabled: true, siteKey: null });
  assert.deepEqual(publicRecaptcha({ ...source, RECAPTCHA_ENABLED: "TRUE" }), { enabled: true, siteKey: null });
  assert.deepEqual(publicRecaptcha({}), { enabled: false, siteKey: null });
});
test("login transport accepts bounded CAPTCHA separately from business credentials", () => {
  const credentials = { username: "guru", password: "legacy" };
  assert.equal(loginRequestSchema.safeParse({ ...credentials, captchaToken: "single-use-token" }).success, true);
  assert.equal(loginRequestSchema.safeParse(credentials).success, true);
  for (const captchaToken of ["", "x".repeat(4097), null, 1]) assert.equal(loginRequestSchema.safeParse({ ...credentials, captchaToken }).success, false);
  assert.equal(loginSchema.safeParse({ ...credentials, captchaToken: "token" }).success, false);
  assert.equal(loginRequestSchema.safeParse({ ...credentials, role: "admin" }).success, false);
});
