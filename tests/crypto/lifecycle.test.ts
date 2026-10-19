import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import {
  createOtp,
  decryptOtp,
  encryptOtp,
  otpDigest,
  type OtpBinding,
} from "../../src/server/accounts/lifecycle-secrets";
test("OTP cryptography: six digits including leading zeros; purpose/address binding and authenticated encryption", () => {
  const key = randomBytes(32).toString("hex"),
    hmac = randomBytes(40).toString("hex"),
    binding: OtpBinding = {
      challengeId: randomUUID(),
      outboxId: randomUUID(),
      email: "synthetic@example.test",
      purpose: "email_verify",
    };
  for (let i = 0; i < 100; i++) assert.match(createOtp(), /^\d{6}$/);
  const otp = "000012",
    cipher = encryptOtp(otp, key, binding);
  assert.equal(decryptOtp(cipher, key, binding), otp);
  assert.equal(cipher.ciphertextHex.length, 12);
  const digest = otpDigest(
    otp,
    hmac,
    binding.purpose,
    binding.challengeId,
    binding.email,
  );
  assert.notEqual(
    digest,
    otpDigest(otp, hmac, "reset_otp", binding.challengeId, binding.email),
  );
  assert.notEqual(
    digest,
    otpDigest(otp, hmac, binding.purpose, randomUUID(), binding.email),
  );
  for (const changed of [
    { ...binding, purpose: "reset_otp" as const },
    { ...binding, outboxId: randomUUID() },
    { ...binding, challengeId: randomUUID() },
    { ...binding, email: "other@example.test" },
  ])
    assert.throws(() => decryptOtp(cipher, key, changed));
  assert.throws(() =>
    decryptOtp({ ...cipher, tagHex: "0".repeat(32) }, key, binding),
  );
  assert.throws(() =>
    decryptOtp(cipher, randomBytes(32).toString("hex"), binding),
  );
});
