import test from "node:test";
import assert from "node:assert/strict";
import { dayContextSchema, calendarPreviewSchema, calendarHistorySchema, calendarCommitSchema } from "../../src/lib/calendar/contracts";
const id = "33333333-3333-4333-8333-333333333333";
const day = {date:"2090-01-01",dayIndex:0,isHoliday:false,calendarEntry:null,kbmEnabled:false,examEnabled:false,activeExamPeriods:[],activeExamPeriodIds:[],activeAcademicPeriod:null,academicPeriodId:null,contextVersion:"test",override:{id:null,version:"1",academicPeriodId:id,kbmEnabled:true,examEnabled:false},calendarVersion:"0",overrideVersion:"0",reasons:[],policyVersion:"calendar-v1",assignmentIntegration:"exams_ready"};
test("Calendar dry-run permits an unpersisted override id, but rejects malformed context", () => {
 assert.equal(dayContextSchema.safeParse(day).success,true);
 assert.equal(dayContextSchema.safeParse({...day,reasons:null}).success,false);
 assert.equal(dayContextSchema.safeParse({...day,kbmEnabled:"false"}).success,false);
});
test("Calendar preview count, unique dates and context dates must agree", () => {
 const preview={previewId:id,expiresAt:"2090-01-01T01:00:00+00:00",kind:"context",action:"override",count:1,policyVersion:"calendar-v1",assignmentIntegration:"exams_ready",days:[{date:day.date,before:day,after:day}]};
 assert.equal(calendarPreviewSchema.safeParse(preview).success,true);
 assert.equal(calendarPreviewSchema.safeParse({...preview,count:2}).success,false);
 assert.equal(calendarPreviewSchema.safeParse({...preview,count:2,days:[...preview.days,...preview.days]}).success,false);
 assert.equal(calendarPreviewSchema.safeParse({...preview,days:[{date:"2090-01-02",before:day,after:day}]}).success,false);
});
test("Calendar history renders null audit snapshots safely; commit requires positive acknowledgement", () => {
 assert.equal(calendarHistorySchema.safeParse([{actor_name:null,reason:"Audit",created_at:"2090-01-01T00:00:00Z",old_data:null,new_data:null}]).success,true);
 assert.equal(calendarCommitSchema.safeParse({committed:false,count:1,previewId:id,policyVersion:"calendar-v1"}).success,false);
 assert.equal(calendarCommitSchema.safeParse({committed:true,count:1,previewId:id,policyVersion:"calendar-v1"}).success,true);
});
