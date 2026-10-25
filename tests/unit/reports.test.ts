import test from "node:test";
import assert from "node:assert/strict";
import {
  accessCommand,
  reportQuery,
  reportResponseSchema,
  readReportResponse, readersSchema, accessSavedSchema,
} from "../../src/lib/reports/contracts";
test("reports accept bounded filters and require explicit independent scopes", () => {
  assert.equal(
    reportQuery.parse({ kind: "academic", period: "2026-10" }).pageSize,
    25,
  );
  for (const v of [
    { kind: "academic", period: "2026-13" },
    { kind: "finance", period: "2026-10", teacher: "admin" },
    { kind: "academic", period: "2026-10", page: 0 },
    { kind: "academic", period: "2026-10", scope: "all" },
  ])
    assert.equal(reportQuery.safeParse(v).success, false);
  assert.equal(
    accessCommand.safeParse({
      userId: "11111111-1111-4111-8111-111111111111",
      version: "0",
      reason: "Valid reason",
      academic: true,
    }).success,
    false,
  );
});
test("report decoder rejects duplicate rows and unsafe numeric money types", () => {
  const row = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Synthetic",
    total: "9007199254740993", jtm:"1", teaching:"9007199254740993",allowances:"0",transport:"0",corrections:"0",cutoff:"2026-10-24",
  };
  const report = {
    kind: "finance",
    period: "2026-10",
    teacher: null,
    mode: "realized",
    cutoff: "2026-10-24",
    updatedAt: "2026-10-24T10:00:00Z",
    summary: { total: row.total, beneficiaries:1, jtm:"1" },
    issues: [],
    items: [row],
    total: 1,
    page: 1,
    pageSize: 25,
    teachers: [],
  };
  assert.equal(reportResponseSchema.parse(report).items[0]!.total, row.total);
  assert.equal(
    reportResponseSchema.safeParse({ ...report, items: [row, row], total: 2 })
      .success,
    false,
  );
  assert.equal(
    reportResponseSchema.safeParse({
      ...report,
      items: [{ ...row, total: 9007199254740992 }],
    }).success,
    false,
  );
});

test("reports reject missing kind-specific summaries, wrong modes and mismatched filter envelopes",()=>{
 const academic={kind:"academic",period:"2026-10",teacher:null,mode:"recorded",cutoff:"2026-10-24",updatedAt:"2026-10-24T10:00:00Z",summary:{kbm:0,confirmed:0,journals:0,exams:0,baps:0,attendance:0,present:0,complete:0},issues:[],items:[],total:0,page:1,pageSize:25,teachers:[]};
 const query="kind=academic&period=2026-10&page=1&pageSize=25";
 assert.deepEqual(readReportResponse(academic,query),academic);
 for(const invalid of [{...academic,summary:{}},{...academic,updatedAt:"bad"},{...academic,mode:"projection"},{...academic,period:"2026-09"},{...academic,pageSize:100},{...academic,teachers:[{id:"11111111-1111-4111-8111-111111111111",name:"A"},{id:"11111111-1111-4111-8111-111111111111",name:"B"}]}])assert.throws(()=>readReportResponse(invalid,query));
 const finance={...academic,kind:"finance",mode:"realized",summary:{beneficiaries:0,jtm:"0",total:"0"}};
 assert.throws(()=>readReportResponse(finance,"kind=finance&period=2026-10&mode=projection"));
 assert.equal(readReportResponse({...finance,mode:"final"},"kind=finance&period=2026-10&mode=projection").mode,"final");
 const teacher="abcdefab-abcd-4abc-8abc-abcdefabcdef";
 assert.equal(readReportResponse({...finance,teacher},"kind=finance&period=2026-10&teacher="+teacher.toUpperCase()).teacher,teacher);
});
test("report access responses require typed unique readers and an explicit save acknowledgment",()=>{
 const reader={id:"11111111-1111-4111-8111-111111111111",name:"Guru",academic:true,finance:false,version:"1"};
 assert.equal(readersSchema.safeParse({items:[reader]}).success,true);
 for(const raw of [null,{items:null},{items:[reader,reader]},{items:[{...reader,academic:"true"}]},{items:[{...reader,version:"bad"}]}])assert.equal(readersSchema.safeParse(raw).success,false);
 assert.equal(accessSavedSchema.safeParse(null).success,false);assert.equal(accessSavedSchema.safeParse({}).success,false);assert.equal(accessSavedSchema.safeParse({ok:true}).success,true);
});
