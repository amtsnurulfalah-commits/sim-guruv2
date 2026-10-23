import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  eventBoardSchema,
  eventDeletePreviewSchema,
  readEventResponse,
  validateEventSave,
  eventJournalDateMessage,
  eventDefinitionSchema,
} from "../../src/lib/programs/event-contracts";
import { eventBlockSchema } from "../../src/lib/programs/schemas";
const id = "11111111-1111-4111-8111-111111111111",
  today = "2090-01-02";
const data = {
  name: "Rapat",
  type: "rutin",
  days: [1],
  dates: [],
  timeStart: "09:00",
  timeEnd: "10:00",
  dateStart: today,
  dateEnd: today,
  jtm: 3,
  description: "",
};
const save = (d: object) =>
  validateEventSave(
    { version: "0", reason: "Pengujian acara", data: { ...data, ...d } },
    today,
    null,
  );
const field = (d: object, key: string) =>
  assert.throws(
    () => save(d),
    (e: unknown) =>
      e instanceof z.ZodError && e.issues.some((i) => i.path[0] === key),
  );
test("event form reports time, period, recurring and incidental errors on their fields", () => {
  field({ timeEnd: "09:00" }, "timeEnd");
  field({ dateEnd: "2090-01-01" }, "dateEnd");
  field({ dateEnd: "2092-01-01" }, "dateEnd");
  field({ days: [] }, "days");
  field({ days: [1, 1] }, "days");
  field({ type: "insidental", days: [], dates: [] }, "dates");
  field({ type: "insidental", days: [], dates: ["2090-01-03"] }, "dates");
  field({ type: "insidental", days: [], dates: [today, today] }, "dates");
  field({ dateStart: "2090-01-01" }, "dateStart");
  assert.equal(
    save({ type: "insidental", days: [], dates: [today] }).data.jtm,
    3,
  );
});
test("event edits keep original past start while new past dates are rejected", () => {
  const previous = eventDefinitionSchema.parse({
    id,
    name: "Rapat",
    type: "rutin",
    days: [1],
    dates: [],
    time_start: "09:00:00",
    time_end: "10:00:00",
    jtm: 3,
    description: "",
    date_start: "2090-01-01",
    date_end: today,
    version: "1",
  });
  assert.equal(
    validateEventSave(
      {
        id,
        version: "1",
        reason: "Perubahan acara",
        data: { ...data, dateStart: previous.date_start },
      },
      today,
      previous,
    ).data.dateStart,
    previous.date_start,
  );
});
test("event board rejects malformed structures, duplicate keys and missing definitions", () => {
  const board = {
    date: today,
    canOperate: true,
    events: [],
    today: [],
    attendance: [],
    teachers: [],
    blocks: [],
  };
  assert.equal(readEventResponse(eventBoardSchema, board).date, today);
  assert.throws(
    () => readEventResponse(eventBoardSchema, { ...board, attendance: null }),
    /belum dapat diverifikasi/,
  );
  assert.equal(
    eventBoardSchema.safeParse({
      ...board,
      teachers: [
        { id, name: "Guru" },
        { id, name: "Guru" },
      ],
    }).success,
    false,
  );
});
test("delete impact requires counts, precise expiry and numeric credit", () => {
  const preview = {
    previewId: id,
    expiresAt: "2090-01-02T12:00:00+07:00",
    attendance: 1,
    journals: 1,
    netJtm: "2.4000",
  };
  assert.equal(eventDeletePreviewSchema.safeParse(preview).success, true);
  for (const v of [
    { ...preview, expiresAt: "tomorrow" },
    { ...preview, netJtm: "NaN" },
    { ...preview, journals: -1 },
    { previewId: id },
  ])
    assert.equal(eventDeletePreviewSchema.safeParse(v).success, false);
});
test("journal availability follows WIB dates across month/year boundaries", () => {
  assert.equal(eventJournalDateMessage("2089-12-31", "2090-01-01"), "");
  assert.equal(eventJournalDateMessage(today, today), "");
  assert.match(eventJournalDateMessage("2090-01-03", today), /belum/);
  assert.match(eventJournalDateMessage("2089-12-31", today), /berakhir/);
});
test("block end date reports field-specific errors", () => {
  const r = eventBlockSchema.safeParse({
    version: "0",
    reason: "Pengujian blok",
    eventId: null,
    eventType: null,
    dateStart: today,
    dateEnd: "2090-01-01",
    message: "Blok sementara",
    active: true,
  });
  assert.equal(r.success, false);
  if (!r.success) assert.equal(r.error.issues[0]?.path[0], "dateEnd");
});
