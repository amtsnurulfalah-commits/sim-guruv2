import test from "node:test";
import assert from "node:assert/strict";
import { GmailMailAdapter } from "../../src/server/mail/adapter";
const message = {
  id: "test-id",
  to: "recipient@example.test",
  subject: "OTP",
  text: "123456",
};
test("Gmail adapter reports acceptance and disables file/url content access", async () => {
  const adapter = new GmailMailAdapter(
    {
      async sendMail(value) {
        assert.equal(value.disableFileAccess, true);
        assert.equal(value.disableUrlAccess, true);
        assert.equal(value.from, "sender@gmail.com");
        return { accepted: [value.to] };
      },
    },
    "sender@gmail.com",
  );
  assert.equal(await adapter.send(message), "sent");
});
test("Gmail adapter distinguishes rejected, temporary and uncertain SMTP delivery", async () => {
  for (const [error, expected] of [
    [{ responseCode: 535 }, "failed"],
    [{ responseCode: 421 }, "retry_wait"],
    [{ command: "CONN" }, "retry_wait"],
    [{ command: "DATA" }, "unknown"],
    [new Error("secret"), "unknown"],
  ] as const) {
    const adapter = new GmailMailAdapter(
      {
        async sendMail() {
          throw error;
        },
      },
      "sender@gmail.com",
    );
    assert.equal(await adapter.send(message), expected);
  }
});
