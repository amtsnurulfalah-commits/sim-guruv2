import test from "node:test";
import assert from "node:assert/strict";
import { handleModuleRequest } from "../../src/server/auth/http";
import { AuthError } from "../../src/server/auth/service";
test("request rejection logs the same safe reference returned to the caller",async t=>{
 const events: string[]=[];
 t.mock.method(console,"warn",(message: string)=>events.push(message));
 const res=await handleModuleRequest("activities",async()=>{throw new AuthError("JOURNAL_BLOCKED",403);});
 const body=await res.json();
 const logged=JSON.parse(events[0]!);
 assert.equal(res.status,403); assert.equal(logged.requestId,body.requestId);
 assert.equal(logged.module,"activities"); assert.equal(logged.code,"JOURNAL_BLOCKED");
 assert.deepEqual(Object.keys(logged).sort(),["code","event","module","occurredAt","requestId","status"]);
});
