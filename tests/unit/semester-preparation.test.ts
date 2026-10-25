import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  preparationRequest,
  previewSchema, choicesSchema, readPreparationPreview, readPreparationStatus,
  commitRequest,
  readPreparationReceipt,
  type PreparationPreview,
} from "../../src/lib/semester-preparation/contracts";
test("semester allowlist rejects extra data and same source/target", () => {
  const sourceId = randomUUID(),
    targetId = randomUUID(),
    q = {
      sourceId,
      targetId,
      configuration: "classes",
      reason: "Persiapan semester",
    };
  assert.equal(preparationRequest.safeParse(q).success, true);
  for (const x of [
    { ...q, targetId: sourceId },
    { ...q, configuration: "all" },
    { ...q, copyTransactions: true },
    { ...q, reason: "x" },
  ])
    assert.equal(preparationRequest.safeParse(x).success, false);
  assert.equal(
    commitRequest.safeParse({ previewId: randomUUID(), classes: [] }).success,
    false,
  );
});
test("receipt must match reviewed mapping and exact counts before success is shown", () => {
  const klass = {
      id: randomUUID(),
      sourceId: randomUUID(),
      name: "Kelas",
      level: "SMP",
      grade: 7,
      parallel: "",
      expectedStudents: 0 as const,
    },
    sourceId = randomUUID(),
    targetId = randomUUID(),
    previewId = randomUUID();
  const preview: PreparationPreview = {
    previewId,
    expiresAt: "2095-01-01T00:00:00Z",
    result: null,
    plan: {
      sourceId,
      targetId,
      sourceDate: "2090-06-30",
      validFrom: "2090-07-01",
      validTo: "2090-12-31",
      configuration: "classes",
      classes: [klass],
      schedules: [],
      issues: [],
    },
  };
  const r = {
    previewId,
    sourceId,
    targetId,
    classes: 1,
    schedules: 0,
    committedAt: "2090-01-01T00:00:00Z",
    classMapping: [klass],
    scheduleMapping: [],
  };
  assert.equal(readPreparationReceipt(preview, r).previewId, previewId);
  for (const x of [
    { ...r, previewId: randomUUID() },
    { ...r, classes: 0, classMapping: [] },
    { ...r, classMapping: [{ ...klass, id: randomUUID() }] },
    { ...r, classes: 2 },
  ])
    assert.throws(() => readPreparationReceipt(preview, x));
});

function reviewed() {
 const klass={id:randomUUID(),sourceId:randomUUID(),name:"VII",level:"SMP",grade:7,parallel:"",expectedStudents:0 as const};
 const schedule={id:randomUUID(),sourceId:randomUUID(),classId:klass.id,className:klass.name,teacher:"Guru",subject:"IPA",userId:randomUUID(),subjectId:randomUUID(),dayIndex:1,timeStart:"07:00:00",timeEnd:"07:40:00",scheduledJtm:"1",restMinutes:0,validFrom:"2090-07-01",validTo:"2090-12-31"};
 const preview:PreparationPreview={previewId:randomUUID(),expiresAt:"2090-01-01T00:10:00Z",result:null,plan:{sourceId:randomUUID(),targetId:randomUUID(),sourceDate:"2090-06-30",validFrom:schedule.validFrom,validTo:schedule.validTo,configuration:"classes_and_schedules",classes:[klass],schedules:[schedule],issues:[]}};
 const receipt={previewId:preview.previewId,sourceId:preview.plan.sourceId!,targetId:preview.plan.targetId!,classes:1,schedules:1,committedAt:"2090-01-01T00:01:00Z",classMapping:[klass],scheduleMapping:[schedule]};
 return {preview,receipt,klass,schedule};
}
test("preview contracts validate IDs, graph, timestamps and bounded clear plans without hiding blocked diagnostics",()=>{
 const {preview:p,klass,schedule}=reviewed();assert.equal(previewSchema.safeParse(p).success,true);
 for(const value of [{...p,expiresAt:"bad"},{...p,plan:{...p.plan,classes:[klass,klass]}},{...p,plan:{...p.plan,schedules:[{...schedule,classId:randomUUID()}]}},{...p,plan:{...p.plan,schedules:[{...schedule,timeStart:"99:99"}]}},{...p,plan:{...p.plan,schedules:[{...schedule,scheduledJtm:"NaN"}]}},{...p,plan:{...p.plan,configuration:"classes"}}])assert.equal(previewSchema.safeParse(value).success,false);
 assert.equal(previewSchema.safeParse({...p,plan:{...p.plan,classes:[],schedules:[{...schedule,classId:null,className:null}],issues:["NO_CLASSES","CLASS_MISSING"]}}).success,true);
 const large=Array.from({length:501},()=>({...klass,id:randomUUID(),sourceId:randomUUID()}));
 assert.equal(previewSchema.safeParse({...p,plan:{...p.plan,classes:large,schedules:[],configuration:"classes",issues:["PLAN_TOO_LARGE"]}}).success,true);
 assert.equal(previewSchema.safeParse({...p,plan:{...p.plan,classes:large,schedules:[],configuration:"classes",issues:[]}}).success,false);
});
test("preview request and status match the exact reviewed configuration before state can be replaced",()=>{
 const {preview:p,receipt}=reviewed();const request={sourceId:p.plan.sourceId!,targetId:p.plan.targetId!,configuration:p.plan.configuration,reason:"Persiapan uji"};
 assert.deepEqual(readPreparationPreview(request,p),p);
 assert.throws(()=>readPreparationPreview({...request,configuration:"classes"},p));
 assert.deepEqual(readPreparationStatus(p,{...p,result:receipt}).result,receipt);
 assert.throws(()=>readPreparationStatus({...p,result:receipt},p));
 for(const value of [{...p,previewId:randomUUID()},{...p,expiresAt:"2090-01-01T00:11:00Z"},{...p,plan:{...p.plan,classes:[{...p.plan.classes[0]!,name:"Berubah"}]}},{...p,result:{...receipt,classMapping:[{...receipt.classMapping[0]!,name:"Berubah"}]}}])assert.throws(()=>readPreparationStatus(p,value));
});
test("receipt compares metadata as well as IDs, and allows equivalent UUID casing",()=>{
 const {preview:p,receipt:r}=reviewed();
 for(const value of [{...r,classMapping:[{...r.classMapping[0]!,grade:8}]},{...r,scheduleMapping:[{...r.scheduleMapping[0]!,scheduledJtm:"2"}]},{...r,scheduleMapping:[{...r.scheduleMapping[0]!,validTo:"2090-12-30"}]}])assert.throws(()=>readPreparationReceipt(p,value));
 assert.equal(readPreparationReceipt(p,{...r,previewId:r.previewId.toUpperCase(),classMapping:r.classMapping.map(row=>({...row,id:row.id.toUpperCase(),sourceId:row.sourceId.toUpperCase()}))}).classes,1);
 assert.equal(preparationRequest.safeParse({sourceId:r.sourceId,targetId:r.sourceId.toUpperCase(),configuration:"classes",reason:"Tidak sama"}).success,false);
});
test("choices reject duplicate identities, invalid ranges and unrelated history receipts",()=>{
 const {preview:p,receipt:r}=reviewed();const period={id:p.plan.sourceId!,name:"Semester",start:"2090-01-01",end:"2090-06-30",active:true};
 const history={id:r.previewId,at:r.committedAt,actor:"Admin",reason:"Persiapan",result:{previewId:r.previewId,sourceId:r.sourceId,targetId:r.targetId,classes:r.classes,schedules:r.schedules,committedAt:r.committedAt}};
 assert.equal(choicesSchema.safeParse({periods:[period],history:[history]}).success,true);
 for(const raw of [{periods:[period,period],history:[]},{periods:[{...period,start:"2091-01-01"}],history:[]},{periods:[period],history:[{...history,id:randomUUID()}]},{periods:[period],history:[{...history,at:"bad"}]}])assert.equal(choicesSchema.safeParse(raw).success,false);
});
