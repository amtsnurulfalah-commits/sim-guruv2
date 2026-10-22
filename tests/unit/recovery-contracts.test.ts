import test from "node:test";
import assert from "node:assert/strict";
import { recoveryCompletedSchema, resetSchema } from "../../src/lib/accounts/schemas";
test("Recovery only accepts an explicit completion acknowledgement", () => {
  for (const data of [null, {}, { loginRequired: false }, { loginRequired: "true" }, { accepted: true }])
    assert.equal(recoveryCompletedSchema.safeParse(data).success, false);
  assert.deepEqual(recoveryCompletedSchema.parse({ loginRequired: true }), { loginRequired: true });
});
test("Recovery schema retains full Unicode password range and matching confirmation", () => {
  const proof = { challengeId: "33333333-3333-4333-8333-333333333333", token: "A".repeat(43) };
  const newPassword = "😀".repeat(128);
  assert.equal(resetSchema.safeParse({ ...proof, newPassword, confirmation: newPassword }).success, true);
  assert.equal(resetSchema.safeParse({ ...proof, newPassword: newPassword + "x", confirmation: newPassword + "x" }).success, false);
  const mismatch = resetSchema.safeParse({ ...proof, newPassword: "NewSynthetic9!", confirmation: "OtherSynthetic9!" });
  assert.equal(mismatch.success, false);
  if (!mismatch.success) assert.equal(mismatch.error.issues[0]?.path.join("."), "confirmation");
});
