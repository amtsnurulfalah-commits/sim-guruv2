import test from "node:test";
import assert from "node:assert/strict";
import { verifyLoginRecaptcha } from "../../src/server/auth/recaptcha";
import { AuthError, LocalAuthService } from "../../src/server/auth/service";
import type { SqlDatabase } from "../../scripts/lib/sql-database";
import type { PasswordService } from "../../src/server/auth/passwords";
const config = { RECAPTCHA_ENABLED: "true", RECAPTCHA_SITE_KEY: "synthetic-public-key", RECAPTCHA_SECRET_KEY: "synthetic-secret-key" };
const appUrl = "https://school.example";
const reply = (data: unknown, status = 200): typeof fetch => async () => new Response(JSON.stringify(data), { status });
const isCode = (code: string) => (error: unknown) => error instanceof AuthError && error.code === code;

test("reCAPTCHA disabled is explicit; incomplete/invalid configuration never bypasses verification", async () => {
  let calls = 0;
  const send: typeof fetch = async () => { calls++; throw Error("Do not call"); };
  await verifyLoginRecaptcha(undefined, appUrl, {}, send);
  await verifyLoginRecaptcha(undefined, appUrl, { ...config, RECAPTCHA_ENABLED: "false" }, send);
  for (const patch of [{ RECAPTCHA_SECRET_KEY: "" }, { RECAPTCHA_SITE_KEY: "" }, { RECAPTCHA_ENABLED: "yes" }])
    await assert.rejects(verifyLoginRecaptcha("token", appUrl, { ...config, ...patch }, send), isCode("CAPTCHA_UNAVAILABLE"));
  await assert.rejects(verifyLoginRecaptcha(undefined, appUrl, config, send), isCode("CAPTCHA_REQUIRED"));
  assert.equal(calls, 0);
});
test("reCAPTCHA verifies via POST, no cache/redirect; expected hostname required", async () => {
  let calls = 0;
  const send: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, "https://www.google.com/recaptcha/api/siteverify");
    assert.equal(init?.method, "POST");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    const values = new URLSearchParams(String(init?.body));
    assert.equal(values.get("secret"), config.RECAPTCHA_SECRET_KEY);
    assert.equal(values.get("response"), "single-use-token");
    assert.equal(values.get("remoteip"), null);
    return new Response(JSON.stringify({ success: true, hostname: "school.example" }));
  };
  await verifyLoginRecaptcha("single-use-token", appUrl, config, send);
  assert.equal(calls, 1);
  for (const data of [{ success: false, "error-codes": ["timeout-or-duplicate"] }, { success: true }, { success: true, hostname: "evil.example" }, { success: true, hostname: "school.example.evil.test" }])
    await assert.rejects(verifyLoginRecaptcha("token", appUrl, config, reply(data)), isCode("CAPTCHA_INVALID"));
});
test("reCAPTCHA upstream/network/secret errors fail closed without leaking details", async () => {
  for (const send of [reply({ success: true }, 503), reply({ success: "true" }), reply({ success: false, "error-codes": ["invalid-input-secret"] }), (async () => { throw Error("private-provider-details"); }) as typeof fetch])
    await assert.rejects(verifyLoginRecaptcha("token", appUrl, config, send), error => isCode("CAPTCHA_UNAVAILABLE")(error) && !(error as Error).message.includes("private"));
});
test("source rate limit precedes CAPTCHA; CAPTCHA failure never queries credentials or issues a session", async () => {
  let queries = 0, captchaCalls = 0, transactions = 0;
  let wait = 0;
  const database = {
    query: async () => { queries++; return { rows: [{ wait }] }; },
    transaction: async () => { transactions++; throw Error("credential access forbidden"); },
  } as unknown as SqlDatabase;
  const service = new LocalAuthService(database, {} as PasswordService, "synthetic-rate-secret");
  const before = async () => { captchaCalls++; throw new AuthError("CAPTCHA_INVALID", 422); };
  await assert.rejects(service.login({ username: "guru", password: "x" }, "synthetic-ip", "synthetic-request", undefined, before), isCode("CAPTCHA_INVALID"));
  assert.equal(queries, 1); assert.equal(captchaCalls, 1); assert.equal(transactions, 0);
  wait = 60;
  await assert.rejects(service.login({ username: "guru", password: "x" }, "synthetic-ip", "synthetic-request", undefined, before), isCode("RATE_LIMITED"));
  assert.equal(captchaCalls, 1); assert.equal(transactions, 0);
});
