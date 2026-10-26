import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {writeFile} from "node:fs/promises";
import {performance} from "node:perf_hooks";
import postgres from "postgres";
import {openNativeDatabase} from "./lib/native-database";
import {applyMigrations,readMigrations} from "./lib/migrations";
import {seedPro2Fixture} from "./lib/pro2-fixture";
import {databaseFromClient} from "../src/server/auth/runtime";
import {ActivityService} from "../src/server/activities/service";

type History = {items: {id:string;userId:string;date:string}[];total:number;page:number;pageSize:number};
async function main() {
 const source=process.env.PRO2_DATABASE_URL;
 if(!source)throw Error("PRO2_DATABASE_URL_REQUIRED");
 const url=new URL(source);
 if(!["127.0.0.1","localhost"].includes(url.hostname)||!/^\/pro2_test$/.test(url.pathname))throw Error("DISPOSABLE_LOOPBACK_PRO2_DATABASE_REQUIRED");
 const db=openNativeDatabase(source),client=postgres(source,{max:4,prepare:false,onnotice:()=>{}}),wrapped=databaseFromClient(client);
 try{
  assert.equal((await db.query<{n:number}>("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname not in('pg_catalog','information_schema')")).rows[0]!.n,0);
  const migrations=await readMigrations("supabase/migrations"),pending=migrations.filter(m=>m.name.includes("pro2_activity_read_performance"));assert.equal(pending.length,1);
  await applyMigrations(db,migrations.filter(m=>!pending.includes(m)));
  const {actor,token}=await seedPro2Fixture(db);
  const service=new ActivityService({...wrapped,transaction:work=>wrapped.transaction(async tx=>{await tx.exec("SET LOCAL ROLE sim_guru_business");return work(tx);})});
  const scenarios=[{name:"global-first",page:1},{name:"global-deep",page:400},{name:"filtered",page:1,userId:actor}];
  const fingerprints=new Map<string,string>();
  async function measure(phase:string){
   const rows=[];
   for(const scenario of scenarios){
    const {name,...paging}=scenario,filter={from:"2025-01-01",to:"2025-03-01",pageSize:25,...paging};
    const durations:number[]=[],errors:string[]=[];let bytes=0;
    const cpu=process.cpuUsage(),memory=process.memoryUsage().rss,start=performance.now();
    // Warm-up is excluded from measured samples, but errors are still recorded.
    try{await service.read(token,"attendance",filter);}catch{/* timed calls below record the result */}
    for(let batch=0;batch<5;batch++)await Promise.all(Array.from({length:4},async()=>{
     const t=performance.now();
     try{
      const value=await service.read(token,"attendance",filter) as History;
      assert.equal(value.total,name==="filtered"?60:12060);assert.equal(value.page,paging.page);assert.equal(value.items.length,25);
      if(name==="filtered")assert.ok(value.items.every(i=>i.userId===actor));
      const encoded=JSON.stringify(value),fingerprint=createHash("sha256").update(encoded).digest("hex");
      if(fingerprints.has(name))assert.equal(fingerprint,fingerprints.get(name),"HISTORY_RESULT_CHANGED");else fingerprints.set(name,fingerprint);
      bytes+=Buffer.byteLength(encoded);durations.push(performance.now()-t);
     }catch(e){if(e instanceof assert.AssertionError)throw e;errors.push(typeof e==="object"&&e!==null&&"code" in e?String(e.code):"READ_FAILED");}
    }));
    durations.sort((a,b)=>a-b);const used=process.cpuUsage(cpu);
    rows.push({phase,scenario:name,requests:20,concurrency:4,success:durations.length,errors:errors.length,errorCodes:[...new Set(errors)],p50Ms:durations.length?Math.round(durations[Math.ceil(durations.length*.5)-1]!):null,p95Ms:durations.length?Math.round(durations[Math.ceil(durations.length*.95)-1]!):null,wallMs:Math.round(performance.now()-start),meanResponseBytes:durations.length?Math.round(bytes/durations.length):null,clientCpuMs:Math.round((used.user+used.system)/1000),clientRssDeltaBytes:process.memoryUsage().rss-memory});
   }
   return rows;
  }
  async function plan(cached:boolean){return db.transaction(async tx=>{
   await tx.exec("SET LOCAL ROLE sim_guru_owner");
   await tx.query("select auth_private.lifecycle_self($1)",[createHash("sha256").update(token).digest("hex")]);
   const result=await tx.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT count(*) FROM app.daily_attendance x WHERE x.date BETWEEN date '2025-01-01' AND date '2025-03-01' AND("+(cached?"true":"app.actor_is_admin()")+" OR x.user_id=$1::uuid OR app.is_piket($1::uuid,x.date) OR app.committee_target($1::uuid,x.user_id,x.date))",[actor]);
   return result.rows[0]!["QUERY PLAN"];
  });}
  const beforePlan=await plan(false),before=await measure("before");
  await applyMigrations(db,migrations);assert.deepEqual(await applyMigrations(db,migrations),[]);
  const afterPlan=await plan(true),after=await measure("after");
  const result={kind:"pro2-native-business-adapter-before-after",postgres:(await db.query<{version:string}>("select current_setting('server_version') version")).rows[0]!.version,fixture:{users:201,attendanceRows:12060},samplePolicy:"20 timed requests per scenario/phase, one excluded warm-up; nearest-rank percentiles of successes; errors reported separately",budgets:{afterErrors:0,afterP95Ms:5000},before,after,diagnosticCountPlans:{before:beforePlan,after:afterPlan,note:"Representative count predicate under owner/verified synthetic context. Timed RPC runs through business role, unchanged 10s statement/3s lock limits."},limits:"Loopback disposable PostgreSQL, actual service/adapter but no HTTP/TLS/WAN/SSR. Client CPU/RSS are not database CPU or a production capacity guarantee."};
  console.log("PRO2_PROFILE_RESULT "+JSON.stringify(result));
  if(process.env.PRO2_REPORT_FILE)await writeFile(process.env.PRO2_REPORT_FILE,JSON.stringify(result,null,2)+"\n");
  for(const row of after){assert.equal(row.errors,0);assert.ok(row.p95Ms!==null&&row.p95Ms<5000,"PRO2_AFTER_BUDGET_EXCEEDED");}
  assert.equal((await db.query<{n:number}>("select count(*)::int n from app.daily_attendance")).rows[0]!.n,12060);
 }finally{await client.end();await db.close();}
}
void main().catch((error: unknown)=>{console.error("PRO2_PROFILE_FAILED",error instanceof Error ? error.message : "UNKNOWN");process.exitCode=1;});
