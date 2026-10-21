import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { handleAuthRequest } from "../../src/server/auth/http";
import { PasswordPolicyError } from "../../src/server/auth/passwords";
import { changePasswordSchema } from "../../src/lib/accounts/schemas";
test("HTTP validation sends field constraints without echoing submitted secrets", async () => {
  const res = await handleAuthRequest(async () => {
    z.object({ reason: z.string().min(5), email: z.email() }).parse({
      reason: "x",
      email: "private-secret",
    });
    throw Error("unreachable");
  });
  assert.equal(res.status, 422);
  const v = await res.json();
  assert.equal(v.error.code, "VALIDATION_ERROR");
  assert.match(v.error.fieldErrors.reason[0], /5 karakter/);
  assert.ok(v.error.fieldErrors.email);
  assert.doesNotMatch(JSON.stringify(v), /private-secret/);
  assert.ok(v.requestId);
});
test("Password confirmation is associated with its actual field", async () => {
  const res = await handleAuthRequest(async () => {
    changePasswordSchema.parse({
      currentPassword: "synthetic",
      newPassword: "Different9!",
      confirmation: "Other9!",
    });
    throw Error("unreachable");
  });
  const v = await res.json();
  assert.match(v.error.fieldErrors.confirmation[0], /harus sama/);
  assert.doesNotMatch(JSON.stringify(v), /Different9|Other9/);
});
test("Password policy gives exact unmet requirements and reuse guidance", async () => {
  const res = await handleAuthRequest(async () => {
    throw new PasswordPolicyError([
      "UPPERCASE_REQUIRED",
      "NUMBER_REQUIRED",
      "PASSWORD_REUSE",
    ]);
  });
  const v = await res.json();
  assert.match(v.error.fieldErrors.newPassword.join(" "), /huruf besar/);
  assert.match(v.error.fieldErrors.newPassword.join(" "), /angka/);
  assert.match(v.error.fieldErrors.newPassword.join(" "), /berbeda/);
});
test("Unexpected internal exception remains sanitized", async () => {
  const res = await handleAuthRequest(async () => {
    throw Error("select credential from private password=synthetic-secret");
  });
  assert.equal(res.status, 500);
  const v = await res.json();
  assert.equal(v.error.code, "INTERNAL_ERROR");
  assert.equal(v.error.fieldErrors, undefined);
  assert.doesNotMatch(JSON.stringify(v), /credential|synthetic-secret|select/);
});
