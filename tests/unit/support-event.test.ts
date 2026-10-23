import test from "node:test";
import assert from "node:assert/strict";
import { supportEvent } from "../../src/lib/feedback/support";
test("support metadata excludes raw exceptions and sanitizes module/code",()=>{
 const event = supportEvent("reference","/api/auth?token=secret","SQL secret",500);
 assert.equal(event.module,"unknown"); assert.equal(event.code,"INTERNAL_ERROR");
 assert.doesNotMatch(JSON.stringify(event),/secret|SQL/);
 assert.deepEqual(Object.keys(event).sort(),["code","module","occurredAt","requestId","status"]);
});

test("lookup schema accepts database timestamps and rejects unsafe or malformed metadata", async () => {
 const { supportLookupSchema, supportReferenceSchema } = await import("../../src/lib/feedback/support");
 const report = {requestId:"48bfc3a0-adb3-45d0-a97f-eb27186062b0",occurredAt:"2026-10-23T10:00:00+00:00",module:"activities",code:"JOURNAL_BLOCKED",status:403};
 assert.equal(supportLookupSchema.safeParse(report).success,true);
 assert.equal(supportLookupSchema.safeParse(null).success,true);
 for (const change of [{occurredAt:"invalid"},{occurredAt:"2026-02-30T10:00:00Z"},{status:200},{status:500.5},{module:"toString"},{code:"<script>"},{requestId:"bad"},{body:"private"}])
  assert.equal(supportLookupSchema.safeParse({...report,...change}).success,false);
 assert.equal(supportReferenceSchema.safeParse("ffffffff-ffff-ffff-ffff-ffffffffffff").success,true);
 assert.equal(supportReferenceSchema.safeParse("11111111-1111-1111-1111-111111111111").success,false);
});
