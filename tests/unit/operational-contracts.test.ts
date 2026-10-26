import test from "node:test";
import assert from "node:assert/strict";
import { commands } from "../../src/lib/operations/schemas";
import { operationsSchema, readOperationsResponse, fromWibInput, toWibInput } from "../../src/lib/operations/operational-contracts";
const config = {mailEnabled:false,securityMailEnabled:false,jobsEnabled:false,maintenance:false,maintenanceStart:null,maintenanceEnd:null};
test("maintenance validation identifies the missing or reversed schedule endpoint", () => {
 for (const [change, field] of [
  [{maintenanceStart:"2026-10-23T10:00:00+07:00"},"maintenanceEnd"],
  [{maintenanceEnd:"2026-10-23T10:00:00+07:00"},"maintenanceStart"],
  [{maintenanceStart:"2026-10-23T10:00:00+07:00",maintenanceEnd:"2026-10-23T09:00:00+07:00"},"maintenanceEnd"],
 ] as const) {
  const result=commands.settings.safeParse({version:"1",reason:"Pengujian aturan",config:{...config,...change}});
  assert.equal(result.success,false);
  if (!result.success) assert.deepEqual(result.error.issues[0]?.path,["config",field]);
 }
 assert.equal(commands.settings.safeParse({version:"1",reason:"Pengujian aturan",config}).success,true);
});
test("WIB datetime-local conversion preserves seconds, instant and timezone independently of device settings", () => {
 const stamp="2026-10-23T20:15:42.123Z";
 assert.equal(toWibInput(stamp),"2026-10-24T03:15:42.123");
 assert.equal(Date.parse(fromWibInput(toWibInput(stamp))!),Date.parse(stamp));
 assert.equal(toWibInput(null),"");assert.equal(fromWibInput(""),null);
 assert.equal(Date.parse(fromWibInput("2026-10-24T03:15")!),Date.parse("2026-10-23T20:15:00Z"));
 assert.equal(commands.settings.safeParse({version:"1",reason:"Pengujian WIB",config:{...config,maintenanceStart:fromWibInput("2026-10-24T03:15"),maintenanceEnd:fromWibInput("2026-10-24T04:15")}}).success,true);
});
test("operational DTO rejects invalid dates, configuration and states before rendering", () => {
 const data={config:{value:config,version:"9007199254740993"},maintenanceActive:false,lastWorkerAt:null,outbox:[],jobs:[]};
 assert.equal(operationsSchema.safeParse(data).success,true);
 for (const change of [{config:null},{lastWorkerAt:"bad"},{outbox:null},{jobs:[{state:"constructor"}]},{maintenanceActive:"false"}])
  assert.equal(operationsSchema.safeParse({...data,...change}).success,false);
 // Diagnostic job results are arbitrary JSON in SQL; optional metadata must not disable all controls.
 const job={business_key:"synthetic",kind:"synthetic",state:"paused",attempts:0};
 for(const result of [null,[],"legacy",{code:42},{code:"not a safe diagnostic"}])assert.equal(operationsSchema.safeParse({...data,jobs:[{...job,result}]}).success,true);
 assert.equal(operationsSchema.parse({...data,jobs:[{...job,result:{code:"42501"}}]}).jobs[0]?.result?.code,"42501");
 assert.throws(()=>readOperationsResponse(operationsSchema,{...data,lastWorkerAt:"private-invalid-value"}),error=>error instanceof Error && !error.message.includes("private-invalid-value"));
});
