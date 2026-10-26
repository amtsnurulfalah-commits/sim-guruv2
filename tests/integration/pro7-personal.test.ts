import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openNativeDatabase} from '../../scripts/lib/native-database';
import {openPgliteDatabase} from '../helpers/pglite-database';
import {applyMigrations,readMigrations} from '../../scripts/lib/migrations';
import {tokenHash} from '../../src/server/auth/service';
import {PersonalService} from '../../src/server/personal/service';
import {calendarSchema,historySchema} from '../../src/lib/personal/contracts';
import type {SqlExecutor} from '../../scripts/lib/sql-database';

test('PRO-7 canonical personal calendar and redacted audit',async t=>{
 const native=process.env.PRO7_DATABASE_URL;
 if(native){const url=new URL(native);if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!url.pathname.endsWith('_test')||url.search||url.hash)throw Error('DISPOSABLE_LOCAL_TEST_DATABASE_REQUIRED');}
 const db=native?openNativeDatabase(native):await openPgliteDatabase();t.after(()=>db.close());await applyMigrations(db,await readMigrations('supabase/migrations'));
 const hash='$argon2id$v=19$m=19456,t=2,p=1$abcdefghijklmnopqrstuv$'+'A'.repeat(43);
 async function actor(role:'admin'|'guru',char:string){const id=randomUUID(),token=char.repeat(43);await db.query("insert into app.app_users(id,username,full_name,role,status,must_change_password,contact_email,email_verified_at,km_distance) values($1::uuid,'pro7.'||$4,$2,$3,'active',false,'synthetic.'||$4||'@example.test',clock_timestamp(),1)",[id,'Synthetic '+char,role,char]);await db.query('insert into auth_private.user_credentials(user_id,password_hash) values($1,$2)',[id,hash]);await db.query("insert into auth_private.security_questions(user_id,question,answer_hash) values($1,'Synthetic question',$2)",[id,hash]);await db.query("select auth_private.issue_session($1,$2,1,1,$3,'business')",[id,hash,tokenHash(token)]);return{id,token};}
 const admin=await actor('admin','A'),a=await actor('guru','B'),b=await actor('guru','C');
 await db.exec("CREATE OR REPLACE FUNCTION app.activity_today() RETURNS date LANGUAGE sql STABLE AS $$SELECT '2090-01-05'::date$$");
 const year=randomUUID(),period=randomUUID(),cls=randomUUID(),sub=randomUUID(),schedule=randomUUID();
 await db.transaction(async tx=>{
 await tx.query('select app.master_guard($1,true)',[tokenHash(admin.token)]);await tx.query("select set_config('app.master_reason','Synthetic fixture setup',true)");
 await tx.query("insert into app.school_profiles(name,npsn,level,use_parallel,parallel_max,minutes_per_jtm) values('Synthetic','12345678','SMP',false,1,45)");
 await tx.query("insert into app.academic_years(id,label,date_start,date_end) values($1,'2089/2090','2089-07-01','2090-06-30')",[year]);
 await tx.query("insert into app.academic_periods(id,academic_year_id,semester,date_start,date_end,is_active) values($1,$2,2,'2090-01-01','2090-06-30',true)",[period,year]);
 await tx.query("insert into app.classes(id,academic_period_id,name,level,grade,parallel,expected_students) values($1,$2,'VII','SMP',7,'',20)",[cls,period]);await tx.query("insert into app.subjects(id,name) values($1,'IPA')",[sub]);
 await tx.query("insert into app.teaching_schedules(id,academic_period_id,user_id,subject_id,class_id,day_index,time_start,time_end,scheduled_jtm,rest_minutes,minutes_per_jtm,valid_from,valid_to,snapshot) values($1,$2,$3,$4,$5,extract(dow from date '2090-01-05'), '07:00','08:30',2,0,45,'2090-01-01','2090-01-31','{\"className\":\"VII\",\"subjectName\":\"IPA\",\"teacherName\":\"Synthetic\"}')",[schedule,period,a.id,sub,cls]);
 });
 const service=new PersonalService({...db,transaction:work=>db.transaction(async(tx:SqlExecutor)=>{await tx.exec('SET LOCAL ROLE sim_guru_business');return work(tx);})});
 const range={from:'2090-01-05',to:'2090-01-05'};
 const read=async(token=a.token)=>calendarSchema.parse(await service.read(token,'calendar',range));
 let uid='';
 await t.test('plans are canonical, actor-only even for admin, bounded and do not create occurrences',async()=>{
  const value=await read();assert.equal(value.items.length,1);assert.equal(value.items[0]!.title,'IPA');uid=value.items[0]!.uid;
  assert.equal((await read(b.token)).items.length,0);assert.equal((await read(admin.token)).items.length,0);assert.equal((await db.query<{n:number}>('select count(*)::int n from app.activity_occurrences')).rows[0]!.n,0);
  await assert.rejects(()=>service.read(a.token,'calendar',{...range,userId:b.id}));await assert.rejects(()=>service.read(a.token,'calendar',{from:'2090-01-01',to:'2090-02-01'}));
 });
 let occurrence='';
 await t.test('materialization retains UID; effective replacement moves event without duplication; removal does not revive plan',async()=>{
  await db.query("select app.ensure_occurrences('2090-01-05')");occurrence=(await db.query<{id:string}>('select id from app.activity_occurrences where schedule_id=$1',[schedule])).rows[0]!.id;
  assert.equal((await read()).items[0]!.uid,uid);assert.equal((await read()).items.length,1);
  await db.query('update app.activity_assignments set effective_user_id=$1,effective_name=$2,version=version+1 where occurrence_id=$3',[b.id,'Synthetic replacement',occurrence]);
  assert.equal((await read()).items.length,0);assert.equal((await read(b.token)).items[0]!.uid,uid);
  await db.query('update app.activity_occurrences set removed_at=clock_timestamp() where id=$1',[occurrence]);assert.equal((await read(b.token)).items.length,0);assert.equal((await read()).items.length,0);
 });
 await t.test('audit uses existing proof, redacts other actors reasons and contains no raw before/after',async()=>{
  const ref=randomUUID();await db.query("insert into ops.master_revisions(kind,entity_id,actor_id,reason,old_data,new_data) values('schedules',$1,$2,'INTERNAL_NOTE','{}','{}')",[schedule,admin.id]);
  await db.query("insert into ops.activity_revisions(id,entity_kind,entity_id,actor_id,reason,old_data,new_data) values($1,'confirmation',$2,$3,'Own synthetic reason',null,'{}')",[ref,occurrence,a.id]);
  await db.query("insert into ops.activity_revisions(entity_kind,entity_id,actor_id,reason,old_data,new_data) values('duty-substitute',$1,$2,'INTERNAL_SUBSTITUTION','{}','{}')",[occurrence,admin.id]);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());const q={from:today,to:today};
  const own=historySchema.parse(await service.read(a.token,'history',q));assert.equal(own.items.length,4);assert.equal(own.items.find(i=>i.kind==='schedule')!.reason,null);assert.ok(!JSON.stringify(own).includes('INTERNAL_NOTE'));assert.ok(!JSON.stringify(own).includes('new_data'));
  const replacement=historySchema.parse(await service.read(b.token,'history',q));assert.equal(replacement.items.length,2);assert.ok(replacement.items.every(i=>i.reason===null));assert.ok(!JSON.stringify(own).includes('INTERNAL_SUBSTITUTION'));assert.ok(JSON.stringify(await service.read(admin.token,'history',q)).includes('INTERNAL_NOTE'));
 });
 await t.test('duties, exams, optional events and cancelled sources stay separate and owner-scoped',async()=>{
  const duty=randomUUID(),ep=randomUUID(),es=randomUUID(),room=randomUUID(),supervisor=randomUUID(),committee=randomUUID(),event=randomUUID();
  await db.transaction(async tx=>{
   await tx.query('select app.master_guard($1,true)',[tokenHash(admin.token)]);await tx.query("select set_config('app.master_reason','Synthetic additional setup',true)");
   await tx.query("insert into app.duty_schedules(id,kind,user_id,academic_period_id,day_index,valid_from,valid_to,time_start,time_end) values($1,'PIKET',$2,$3,extract(dow from date '2090-01-05'),'2090-01-01','2090-01-31','09:00','10:00')",[duty,a.id,period]);
   await tx.query("insert into app.exam_periods(id,academic_period_id,name,date_start,date_end,default_committee_jtm) values($1,$2,'Synthetic Exam','2090-01-01','2090-01-31',3)",[ep,period]);
   await tx.query("insert into app.exam_sessions(id,period_id,date,name,time_start,time_end,scheduled_jtm) values($1,$2,'2090-01-05','Synthetic Session','11:00','12:00',1)",[es,ep]);
   await tx.query("insert into app.exam_rooms(id,session_id,name,subject_id,total_students) values($1,$2,'Room 1',$3,20)",[room,es,sub]);
   await tx.query("insert into app.exam_supervisor_assignments(id,exam_room_id,user_id) values($1,$2,$3)",[supervisor,room,b.id]);
   await tx.query("insert into app.exam_committee_assignments(id,period_id,date,user_id,scheduled_jtm) values($1,$2,'2090-01-05',$3,3)",[committee,ep,a.id]);
   await tx.query("insert into app.event_definitions(id,name,type,days,dates,time_start,time_end,jtm,description,date_start,date_end) values($1,'Synthetic event','insidental','{}',ARRAY[date '2090-01-05'],'13:00','14:00',1,'Synthetic','2090-01-01','2090-01-31')",[event]);
  });
  const own=await read();assert.ok(own.items.some(i=>i.kind==='PIKET'));assert.ok(own.items.some(i=>i.kind==='EXAM_COMMITTEE'&&i.all_day));assert.ok(own.items.some(i=>i.kind==='EVENT'&&i.state==='available'));assert.ok(!own.items.some(i=>i.kind==='EXAM_SUPERVISOR'));
  assert.ok((await read(b.token)).items.some(i=>i.kind==='EXAM_SUPERVISOR'));
  await db.query('update app.exam_supervisor_assignments set active=false where id=$1',[supervisor]);assert.ok(!(await read(b.token)).items.some(i=>i.kind==='EXAM_SUPERVISOR'));
 });
 await t.test('revocation and SQL execution privileges fail closed',async()=>{
  await db.query('update auth_private.app_sessions set revoked_at=clock_timestamp() where user_id=$1',[a.id]);await assert.rejects(()=>read());
  await assert.rejects(()=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE sim_guru_worker');return tx.query('select app.personal_calendar($1,$2,$3)',[tokenHash(b.token),range.from,range.to]);}));
 });
});
