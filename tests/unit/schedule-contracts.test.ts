import test from "node:test";
import assert from "node:assert/strict";
import { scheduleListSchema, historySchema, bulkPreviewSchema, canChangeSchedule, readScheduleResponse, choiceListSchema } from "../../src/lib/schedules/contracts";
import { ApiRequestError } from "../../src/lib/feedback/api-error";
const id="11111111-1111-4111-8111-111111111111";
const row={id,academicPeriodId:id,userId:id,subjectId:id,classId:id,dayIndex:1,timeStart:"07:30",timeEnd:"08:07:30.2400",scheduledJtm:"1.5001",restMinutes:0,minutesPerJtm:25,validFrom:"2090-01-01",validTo:"2090-06-30",state:"active",version:"1",teacherName:"Guru",className:"VII",subjectName:"IPA",periodLabel:"Semester 1",replacesId:null};
test("schedule DTO preserves fractional JTM/time and rejects malformed paging/rows",()=>{
 const value={items:[row],total:1,page:1,pageSize:20};
 assert.equal(readScheduleResponse(scheduleListSchema,value).items[0]?.scheduledJtm,"1.5001");
 for(const patch of [{items:null},{total:-1},{page:0},{items:[{...row,timeStart:"07:30:00"}]},{items:[{...row,dayIndex:7}]}])assert.throws(()=>readScheduleResponse(scheduleListSchema,{...value,...patch}),ApiRequestError);
});
test("schedule mutation controls exclude expired active records, closed and archived",()=>{
 assert.equal(canChangeSchedule(row,"2089-12-31"),true);
 assert.equal(canChangeSchedule({...row,validTo:"2026-01-01"},"2026-10-22"),false);
 assert.equal(canChangeSchedule({...row,state:"closed"},"2089-12-31"),false);
});
test("history accepts null snapshots instead of dereferencing them",()=>{
 assert.ok(historySchema.safeParse([{actor_name:null,reason:null,created_at:"2026-10-22T00:00:00+00:00",new_data:null}]).success);
 assert.equal(historySchema.safeParse([{new_data:"invalid"}]).success,false);
});
test("bulk preview must include validated operations and matching count",()=>{
 const preview={previewId:id,expiresAt:"2090-01-01T00:00:00Z",count:1,items:[{id,teacherName:"Guru",className:"VII",validFrom:"2090-01-01",validTo:"2090-06-30",stopFrom:"2090-01-01",operation:"archive"}]};
 assert.ok(bulkPreviewSchema.safeParse(preview).success);
 assert.equal(bulkPreviewSchema.safeParse({...preview,count:2}).success,false);
 assert.equal(bulkPreviewSchema.safeParse({...preview,items:[{...preview.items[0],operation:"delete"}]}).success,false);
});

test("invalid JTM text yields field validation, never a Decimal exception",async()=>{
 const {scheduleData}=await import("../../src/lib/schedules/schemas");
 const data=Object.fromEntries(Object.keys(scheduleData.shape).map(key=>[key,row[key as keyof typeof row]]));
 for(const scheduledJtm of ["invalid","--","1e2","Infinity","", "0", "-1", "0.00001"]){
  const result=scheduleData.safeParse({...data,scheduledJtm});assert.equal(result.success,false);
  if(!result.success)assert.ok(result.error.issues.some(issue=>issue.path.includes("scheduledJtm")));
 }
});

test("relation picker accepts the existing nullable master label contract",()=>{
 assert.ok(choiceListSchema.safeParse({items:[{id,name:"IPA",fullName:null,label:null,parentLabel:null,semester:null}],total:1}).success);
});

test("schedule form feedback explains numeric bounds and reversed date window",async()=>{
 const {scheduleData}=await import("../../src/lib/schedules/schemas");
 const {validateAccount}=await import("../../src/lib/accounts/client-validation");
 const data=Object.fromEntries(Object.keys(scheduleData.shape).map(key=>[key,row[key as keyof typeof row]]));
 assert.throws(()=>validateAccount(scheduleData,{...data,restMinutes:601}),error=>error instanceof ApiRequestError && error.fieldErrors.restMinutes?.[0]==="Gunakan nilai maksimal 600.");
 assert.throws(()=>validateAccount(scheduleData,{...data,validTo:"2089-01-01"}),error=>error instanceof ApiRequestError && !!error.fieldErrors.validTo?.[0]?.includes("maksimal 366 hari"));
});
