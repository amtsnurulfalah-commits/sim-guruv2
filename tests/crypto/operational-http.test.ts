import test from "node:test";
import assert from "node:assert/strict";
import { OperationsService } from "../../src/server/operations/service";
import { handleModuleRequest, authResponse } from "../../src/server/auth/http";
import { commands } from "../../src/lib/operations/schemas";
import type { SqlDatabase } from "../../scripts/lib/sql-database";
test("operational state rejections become actionable 409 responses without exposing database errors", async () => {
 for (const message of ["RETRY_NOT_ALLOWED","RECONCILE_NOT_ALLOWED","private SQL detail"]) {
  const service=new OperationsService({transaction:async()=>{throw Object.assign(new Error(message),{code:"42501"});}} as unknown as SqlDatabase);
  const response=await handleModuleRequest("operations",async()=>authResponse(await service.command("synthetic-token","retry",{id:"48bfc3a0-adb3-45d0-a97f-eb27186062b0",reason:"Pengujian kondisi"}),"synthetic"));
  const body=await response.json();
  assert.equal(response.status,message==="private SQL detail"?503:409);
  assert.equal(body.error.code,message==="private SQL detail"?"UNAVAILABLE":message);
  if(response.status===409) assert.match(body.error.message,/Muat ulang/);
  assert.doesNotMatch(JSON.stringify(body),/private SQL detail/);
 }
});
test("operational schedule validation returns a field-specific repair instruction", async()=>{
 const response=await handleModuleRequest("operations",async()=>authResponse(commands.settings.parse({version:"1",reason:"Pengujian aturan",config:{mailEnabled:false,jobsEnabled:false,maintenance:false,maintenanceStart:"2026-10-23T12:00:00+07:00",maintenanceEnd:null}}),"synthetic"));
 const body=await response.json();
 assert.equal(response.status,422);assert.match(body.error.fieldErrors["config.maintenanceEnd"][0],/Isi waktu selesai/);
});
