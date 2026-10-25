import test from "node:test";
import assert from "node:assert/strict";
import { filterTasks, taskReason, taskKinds } from "../../src/lib/tasks/presentation";
import type { Task } from "../../src/lib/tasks/contracts";
const base: Task = {id:"one",source_id:"source",kind:"confirmation",title:"Konfirmasi guru IPA",reason:"STUDENT_ATTENDANCE_MISMATCH",date:"2026-10-25",deadline:null,href:"/ujian?date=2026-10-25",blocked:true};
test("task explanations make exam prerequisites actionable without exposing unknown codes", () => {
  assert.match(taskReason(base),/Rekap absensi siswa/);
  assert.match(taskReason({...base,reason:"ATTENDANCE_TIME_INVALID"}),/lima menit/);
  assert.doesNotMatch(taskReason({...base,reason:"PRIVATE_UNRECOGNIZED_CODE"}),/PRIVATE/);
  assert.equal(taskReason({...base,reason:"Keterangan sumber."}),"Keterangan sumber.");
  assert.equal(Object.keys(taskKinds).length,8);
});
test("combined task filters search visible wording, preserve server order and never mutate sources", () => {
  const rows=[base,{...base,id:"two",kind:"journal" as const,title:"Jurnal IPA",reason:"Sumber siap",blocked:false}];
  assert.deepEqual(filterTasks(rows,"blocked","all","  REKAP ABSENSI SISWA  "),[base]);
  assert.deepEqual(filterTasks(rows,"ready","journal","IPA"),[rows[1]]);
  assert.deepEqual(filterTasks(rows,"all","all","2026-10-25"),rows);
  assert.deepEqual(filterTasks(rows,"all","bap",""),[]);
  assert.deepEqual(rows.map(row=>row.id),["one","two"]);
});
