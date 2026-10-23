import test from "node:test";
import assert from "node:assert/strict";
import { MigrationService } from "../../src/server/migration/service";
import { handleModuleRequest, authResponse } from "../../src/server/auth/http";
import type { SqlDatabase } from "../../scripts/lib/sql-database";
test("migration business guards return actionable errors while unknown SQL failures remain private",async()=>{
 for(const code of ["REVIEW_NOT_ALLOWED","MIGRATION_BLOCKED","MIGRATION_NOT_IMPORTED","CUTOVER_GATES_INCOMPLETE","private SQL secret"]){
  const service=new MigrationService({transaction:async()=>{throw Object.assign(new Error(code),{code:"42501"});}} as unknown as SqlDatabase);
  const response=await handleModuleRequest("migration",async()=>authResponse(await service.read("synthetic-token","board"),"synthetic"));
  const body=await response.json();
  assert.equal(response.status,code==="private SQL secret"?503:code==="REVIEW_NOT_ALLOWED"?409:422);
  assert.equal(body.error.code,code==="private SQL secret"?"UNAVAILABLE":code);
  assert.doesNotMatch(JSON.stringify(body),/private SQL secret/);
 }
});
