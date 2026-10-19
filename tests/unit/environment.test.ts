import test from "node:test";
import assert from "node:assert/strict";
import { parseEnvironment } from "../../src/lib/env/schema";

test("core development dapat dibangun tanpa secrets", () => {
  const result = parseEnvironment("core", { NODE_ENV: "development" });
  assert.equal(result.ok, true);
});
test("core production wajib URL eksplisit HTTPS dan timezone Jakarta", () => {
  assert.equal(parseEnvironment("core", { NODE_ENV: "production" }).ok, false);
  assert.equal(parseEnvironment("core", { NODE_ENV: "production", APP_URL: "http://example.test" }).ok, false);
  assert.equal(parseEnvironment("core", { NODE_ENV: "production", APP_URL: "https://example.test", APP_TIMEZONE: "UTC" }).ok, false);
  assert.equal(parseEnvironment("core", { NODE_ENV: "production", APP_URL: "https://example.test" }).ok, true);
});
test("database hilang ditolak dan output tidak memuat rahasia", () => {
  const result = parseEnvironment("database", { DATABASE_URL: "https://private-password@example.test" });
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes("private-password"), false);
});
test("database memerlukan role berbeda dan nama database sama", () => {
  const source = { DATABASE_URL: "postgresql://business:secret@local/simguru", AUTH_DATABASE_URL: "postgresql://auth:secret@pool/simguru" };
  assert.equal(parseEnvironment("database", source).ok, true);
  assert.equal(parseEnvironment("database", { ...source, AUTH_DATABASE_URL: "postgresql://business:other@local/simguru" }).ok, false);
  assert.equal(parseEnvironment("database", { ...source, AUTH_DATABASE_URL: "postgresql://auth:secret@pool/other" }).ok, false);
  assert.equal(parseEnvironment("database", { ...source, DB_POOL_MAX: "99" }).ok, false);
});
test("production database menolak sslmode disable", () => {
  assert.equal(parseEnvironment("database", { NODE_ENV: "production", DATABASE_URL: "postgresql://business:secret@local/simguru?sslmode=disable", AUTH_DATABASE_URL: "postgresql://auth:secret@pool/simguru" }).ok, false);
});
test("auth gagal tertutup tanpa secrets atau key enkripsi pendek", () => {
  assert.equal(parseEnvironment("auth", {}).ok, false);
  assert.equal(parseEnvironment("auth", { SESSION_SECRET: "s".repeat(32), AUTH_CHALLENGE_HMAC_SECRET: "h".repeat(32), AUTH_OUTBOX_ENCRYPTION_KEY: "a".repeat(63) }).ok, false);
  assert.equal(parseEnvironment("auth", { SESSION_SECRET: "s".repeat(32), AUTH_CHALLENGE_HMAC_SECRET: "h".repeat(32), AUTH_OUTBOX_ENCRYPTION_KEY: "a".repeat(64) }).ok, true);
});
test("secret session dan HMAC tidak boleh sama", () => {
  assert.equal(parseEnvironment("auth", { SESSION_SECRET: "s".repeat(32), AUTH_CHALLENGE_HMAC_SECRET: "s".repeat(32), AUTH_OUTBOX_ENCRYPTION_KEY: "a".repeat(64) }).ok, false);
});
test("service yang belum disiapkan tidak lolos validasi", () => {
  for (const scope of ["storage", "mail", "jobs"] as const) assert.equal(parseEnvironment(scope, {}).ok, false);
});
test("CA database bersifat opsional dan URL sertifikat bukan nilai PEM", () => {
  const source={DATABASE_URL:"postgresql://business:secret@local/simguru",AUTH_DATABASE_URL:"postgresql://auth:secret@pool/simguru"};
  assert.equal(parseEnvironment("database",{...source,DB_SSL_CA:""}).ok,true);
  assert.equal(parseEnvironment("database",{...source,DB_SSL_CA:"https://untrusted.example/ca.crt"}).ok,false);
});
