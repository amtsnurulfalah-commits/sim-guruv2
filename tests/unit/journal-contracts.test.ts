import test from "node:test";
import assert from "node:assert/strict";
import { journalSchema, journalListSchema, eligibleJournalsSchema, journalEligibilityText, readJournalResponse } from "../../src/lib/activities/journal-contracts";
import { commandSchemas } from "../../src/lib/activities/schemas";
const journal={id:"11111111-1111-4111-8111-111111111111",occurrenceId:"22222222-2222-4222-8222-222222222222",userId:"33333333-3333-4333-8333-333333333333",teacherName:"Guru",date:"2026-10-23",className:"VII",subjectName:"IPA",material:"Materi",present:28,absent:2,notes:"",inputType:"SAME_DAY",weight:"1.0",creditedJtm:"3.0000",version:"9007199254740993",submittedAt:"2026-10-23T00:00:00Z",recapAvailable:true};
test("journal DTO preserves exact JTM/version strings and rejects malformed metadata",()=>{
 assert.equal(journalSchema.parse(journal).creditedJtm,"3.0000");
 for(const change of [{version:1},{creditedJtm:3},{weight:"0.7"},{inputType:"H_DAY"},{submittedAt:"bad"},{present:-1},{date:"2026-02-30"}])assert.equal(journalSchema.safeParse({...journal,...change}).success,false);
 assert.throws(()=>readJournalResponse(journalSchema,{private:"not-to-echo"}),error=>error instanceof Error&&!error.message.includes("not-to-echo"));
});
test("journal list prevents duplicate row identities and inconsistent pagination",()=>{
 const value={items:[journal],total:1,page:1,pageSize:25};assert.equal(journalListSchema.safeParse(value).success,true);
 for(const change of [{total:0},{items:null},{items:[journal,journal]},{pageSize:0}])assert.equal(journalListSchema.safeParse({...value,...change}).success,false);
});
test("eligible contract accepts non-KBM metadata for safe filtering, without prototype label lookups",()=>{
 const row={id:journal.id,userId:journal.userId,date:journal.date,kind:"PIKET",className:null,subjectName:null,expectedStudents:0,timeStart:"07:00",timeEnd:"14:00",journalId:null,eligibilityError:"NOT_FOUND"};
 assert.equal(eligibleJournalsSchema.safeParse({items:[row]}).success,true);
 assert.equal(eligibleJournalsSchema.safeParse({items:[row,row]}).success,false);
 assert.equal(journalEligibilityText("constructor"),"Kegiatan belum memenuhi syarat input.");
});
test("journal forms reject empty/noninteger counts and point reversed blocks to the end date",()=>{
 const input={occurrenceId:journal.occurrenceId,material:"Materi",present:28,absent:2,notes:"",reason:"Alasan uji"};
 for(const present of [NaN,undefined,1.5,-1])assert.equal(commandSchemas["journal-create"].safeParse({...input,present}).success,false);
 const block=commandSchemas.block.safeParse({subjectId:journal.id,dateStart:"2026-10-24",dateEnd:"2026-10-23",message:"Pesan blok",active:true,version:"0",reason:"Alasan uji"});
 assert.equal(block.success,false);if(!block.success)assert.deepEqual(block.error.issues[0]?.path,["dateEnd"]);
});
