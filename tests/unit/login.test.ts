import test from "node:test";
import assert from "node:assert/strict";
import { loginSchema, loginCsrfSchema, loginResultSchema, loginNotice } from "../../src/lib/accounts/login";

test("Login keeps server normalization and existing credential acceptance", () => {
  const password = "  Kata😀 sandi!  ";
  assert.deepEqual(loginSchema.parse({ username: "  GURU.TEST  ", password }), { username: "guru.test", password });
  for (const password of ["x", " ", "😀".repeat(128)]) assert.equal(loginSchema.safeParse({ username: "a.b", password }).success, true);
  for (const password of ["", "😀".repeat(129), "x".repeat(129), null]) assert.equal(loginSchema.safeParse({ username: "a.b", password }).success, false);
  for (const username of ["ab", "user@example.test", "a/b", "u".repeat(65), null]) assert.equal(loginSchema.safeParse({ username, password: "x" }).success, false);
  assert.equal(loginSchema.safeParse({ username: "guru", password: "x", role: "admin" }).success, false);
});
test("Login rejects incomplete transport responses and unapproved redirects", () => {
  for (const data of [{}, null, { csrfToken: "" }, { csrfToken: "bad token" }, { csrfToken: 3 }]) assert.equal(loginCsrfSchema.safeParse(data).success, false);
  assert.equal(loginCsrfSchema.safeParse({ csrfToken: "1234567890.nonce.signature" }).success, true);
  for (const redirectTo of [undefined, null, "https://evil.example", "//evil.example", "/dashboard?url=evil", "/admin/pengguna"]) assert.equal(loginResultSchema.safeParse({ redirectTo }).success, false);
  for (const redirectTo of ["/dashboard", "/akun"]) assert.equal(loginResultSchema.parse({ redirectTo, session: {} }).redirectTo, redirectTo);
});
test("Login notices only expose predefined status messages", () => {
  for (const status of ["updated", "activated", "logout", "expired"]) assert.ok(loginNotice(status).length > 0);
  for (const status of [null, "", "constructor", "__proto__", "<script>"]) assert.equal(loginNotice(status), "");
});
