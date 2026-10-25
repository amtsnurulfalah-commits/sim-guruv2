import test from "node:test";
import assert from "node:assert/strict";
import { summarySchema, dashboardRows, activityLabel, rupiah, readDashboardSummary, pendingJournal, activityHref } from "../../src/lib/dashboard/summary";
const empty = {date:"2026-10-21",planned:[],tasks:[],pendingEventJournals:0,attendance:null,honor:{total:"0",totalJtm:"0",rateMissing:true},pendingHolidays:0,admin:null};
test("dashboard accepts empty and planned-only responses without inventing attendance or totals",()=>{
  assert.ok(summarySchema.safeParse(empty).success);
  const parsed=summarySchema.parse({...empty,planned:[{id:"schedule",kind:"KBM",time_start:"07:20:00",time_end:"08:00:00"}]});
  assert.equal(parsed.tasks.length,0);assert.equal(parsed.planned.length,1);assert.equal(parsed.attendance,null);
});
test("dashboard rejects incomplete, malformed and invalid financial responses",()=>{
  for(const value of [null,{}, {...empty,tasks:null},{...empty,date:"invalid"},{...empty,honor:{total:"NaN",totalJtm:"0",rateMissing:false}},{...empty,pendingHolidays:-1}])assert.equal(summarySchema.safeParse(value).success,false);
});
test("dashboard formatting preserves large integer money and readable activity labels",()=>{
 assert.equal(rupiah("9007199254740993123.0000"),"Rp 9.007.199.254.740.993.123");assert.equal(rupiah("-1250.0000"),"Rp -1.250");
 assert.equal(activityLabel("EXAM_SUPERVISOR"),"Pengawas ujian");assert.equal(activityLabel("__proto__"),"Kegiatan lainnya");
});
test("dashboard combines planned and effective rows in time order without key collisions",()=>{
 const value=summarySchema.parse({...empty,
   planned:[{id:"same",kind:"KBM",time_start:"09:00:00",time_end:"10:00:00"}],
   tasks:[{id:"same",kind:"PIKET",start:"07:00:00",end:"08:00:00",confirmed:true,journalComplete:false}]
 });
 const rows=dashboardRows(value);assert.deepEqual(rows.map(row=>row.key),["task-same","planned-same"]);
 assert.doesNotMatch(rows[0]!.status,/Jurnal/);assert.deepEqual(dashboardRows(null),[]);
});

test("dashboard rejects mismatched account/date/role and invalid task data", () => {
 const user={id:"11111111-1111-4111-8111-111111111111",role:"guru" as const};
 const valid={date:empty.date,user,summary:empty};
 assert.deepEqual(readDashboardSummary(valid,empty.date,user),empty);
 for(const raw of [{...valid,date:"2026-10-22"},{...valid,user:{...user,id:"22222222-2222-4222-8222-222222222222"}},{...valid,user:{...user,role:"admin"}},{...valid,summary:{...empty,admin:{activeUsers:1,failedMessages:0,failedJobs:0}}}]) assert.throws(()=>readDashboardSummary(raw,empty.date,user));
 const row={id:"one",kind:"KBM",start:"07:00",end:"08:00",confirmed:true,journalComplete:false};
 assert.equal(summarySchema.safeParse({...empty,tasks:[row,row]}).success,false);
 assert.equal(summarySchema.safeParse({...empty,tasks:[{...row,start:"99:99"}]}).success,false);
 assert.equal(summarySchema.safeParse({...empty,honor:{...empty.honor,totalJtm:"NaN"}}).success,false);
 assert.equal(pendingJournal(row),true);assert.equal(pendingJournal({...row,kind:"PIKET"}),false);
 assert.equal(activityHref("KBM",empty.date),"/jurnal?date=2026-10-21");
});
