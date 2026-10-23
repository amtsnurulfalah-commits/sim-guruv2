import test from "node:test";
import assert from "node:assert/strict";
import { migrationBoardSchema, migrationReportSchema, migrationSavedSchema, readMigrationResponse } from "../../src/lib/migration/ui-contracts";
import { resolveSchema } from "../../src/lib/migration/contracts";
const batch={id:"11111111-1111-4111-8111-111111111111",source:"Synthetic",source_checksum:"a".repeat(64),state:"blocked",version:"9007199254740993",created_at:"2026-10-23T00:00:00Z",gates:[],summary:{rows:1,errors:0,review:1,redactedFields:0}};
test("migration board rejects malformed identity, dates, states, counts and duplicate batches",()=>{
 assert.equal(migrationBoardSchema.safeParse({batches:[batch]}).success,true);
 for(const change of [{id:"bad"},{state:"staged"},{created_at:"bad"},{summary:null},{gates:null},{summary:{...batch.summary,rows:-1}}])
  assert.equal(migrationBoardSchema.safeParse({batches:[{...batch,...change}]}).success,false);
 assert.equal(migrationBoardSchema.safeParse({batches:[batch,batch]}).success,false);
 assert.throws(()=>readMigrationResponse(migrationBoardSchema,{private:"do-not-echo"}),error=>error instanceof Error&&!error.message.includes("do-not-echo"));
});
test("migration reports normalize SQL null counts and reject invalid or duplicate issue identities",()=>{
 assert.deepEqual(migrationReportSchema.parse({issues:[],counts:null,mappedRows:0}).counts,{});
 const issue={sequence:1,code:"REVIEW",source_table:"Fixture",row_number:2,field:null,severity:"review",resolution:null};
 assert.equal(migrationReportSchema.safeParse({issues:[issue],counts:{Fixture:1},mappedRows:0}).success,true);
 for(const issues of [[{...issue,severity:"constructor"}],[issue,issue],[{...issue,sequence:0}]])
  assert.equal(migrationReportSchema.safeParse({issues,counts:{},mappedRows:0}).success,false);
 assert.equal(migrationSavedSchema.safeParse({version:1}).success,false);
});
test("review evidence uses the same 10–1000 character contract as server validation",()=>{
 const input={batchId:batch.id,version:"1",sequence:1,evidence:"a".repeat(1000),reason:"Alasan pengujian"};
 assert.equal(resolveSchema.safeParse(input).success,true);
 for(const evidence of ["short","a".repeat(1001)])assert.equal(resolveSchema.safeParse({...input,evidence}).success,false);
});
