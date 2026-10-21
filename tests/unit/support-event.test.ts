import test from "node:test";
import assert from "node:assert/strict";
import { supportEvent } from "../../src/lib/feedback/support";
test("support metadata excludes raw exceptions and sanitizes module/code",()=>{
 const event = supportEvent("reference","/api/auth?token=secret","SQL secret",500);
 assert.equal(event.module,"unknown"); assert.equal(event.code,"INTERNAL_ERROR");
 assert.doesNotMatch(JSON.stringify(event),/secret|SQL/);
 assert.deepEqual(Object.keys(event).sort(),["code","module","occurredAt","requestId","status"]);
});
