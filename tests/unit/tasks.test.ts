import test from "node:test";
import assert from "node:assert/strict";
import {
  tasksSchema,
  taskPriority,
  preferenceCommand,
  inboxQuery,
} from "../../src/lib/tasks/contracts";
const base = {
  id: "journal:example",
  source_id: "example",
  kind: "journal" as const,
  title: "Jurnal",
  reason: "Belum lengkap",
  date: "2026-10-24",
  deadline: "2026-10-25T00:00:00+07:00",
  href: "/jurnal?date=2026-10-24",
  blocked: false,
};
test("task urgency uses absolute WIB deadline and prerequisite status", () => {
  assert.equal(
    taskPriority(base, Date.parse("2026-10-24T12:00:00+07:00")),
    "Segera",
  );
  assert.equal(
    taskPriority(base, Date.parse("2026-10-23T12:00:00+07:00")),
    "Berikutnya",
  );
  assert.equal(taskPriority({ ...base, blocked: true }), "Perlu prasyarat");
});
test("task contracts reject external/credential URLs and malformed source status", () => {
  for (const href of [
    "https://evil.example",
    "//evil.example",
    "/jurnal?token=secret",
    "/admin/pengguna",
  ])
    assert.equal(
      tasksSchema.safeParse({
        date: base.date,
        generatedAt: "2026-10-24T12:00:00+07:00",
        items: [{ ...base, href }],
      }).success,
      false,
    );
});
test("inbox filters and preferences reject spoofed identity and unbounded pagination", () => {
  assert.equal(inboxQuery.safeParse({ page: 100001 }).success, false);
  assert.equal(inboxQuery.safeParse({ unread: "yes" }).success, false);
  assert.equal(
    preferenceCommand.safeParse({
      version: "0",
      emailEnabled: true,
      reminderEmail: false,
      userId: "forged",
    }).success,
    false,
  );
});
