import test from "node:test";
import assert from "node:assert/strict";
import { ReportsService } from "../../src/server/reports/service";
import type { SqlDatabase, SqlExecutor } from "../../scripts/lib/sql-database";
const id=(n:number)=>`11111111-1111-4111-8111-${String(n).padStart(12,"0")}`;
const row=(n:number)=>({id:id(n),name:"Synthetic",jtm:"1",teaching:"1",allowances:"0",transport:"0",corrections:"0",total:"1",cutoff:"2026-10-24"});
function fixture(total:number,alter?:(value:Record<string,unknown>,page:number)=>void) {
 let calls=0, isolation=false;
 const db:SqlDatabase={
  async exec(sql){isolation=sql.includes("REPEATABLE READ");},
  async query<T extends Record<string,unknown>>(){
   const page=++calls;
   const value:Record<string,unknown>={kind:"finance",period:"2026-10",teacher:null,mode:"realized",cutoff:"2026-10-24",updatedAt:"2026-10-24T10:00:00Z",summary:{beneficiaries:total,jtm:String(total),total:String(total)},issues:[],items:Array.from({length:Math.min(1000,Math.max(0,total-(page-1)*1000))},(_,n)=>row((page-1)*1000+n+1)),total,page,pageSize:1000,teachers:[]};
   alter?.(value,page);
   return {rows:[{value}] as unknown as T[]};
  },
  async transaction<T>(work:(tx:SqlExecutor)=>Promise<T>){return work(db);},async close(){},
 };
 return {service:new ReportsService(db),calls:()=>calls,isolation:()=>isolation};
}
const query={kind:"finance",period:"2026-10",mode:"realized"};
test("report export uses one repeatable snapshot, all pages and exact 10000 limit",async()=>{
 const f=fixture(10000);const result=await f.service.export("synthetic-token",query);
 assert.equal(result.items.length,10000);assert.equal(f.calls(),10);assert.equal(f.isolation(),true);
 const tooLarge=fixture(10001);await assert.rejects(()=>tooLarge.service.export("synthetic-token",query),/EXPORT_TOO_LARGE/);assert.equal(tooLarge.calls(),1);
});
test("report export fails closed on repeated, incomplete, wrong-scope or inconsistent pages",async()=>{
 for(const alter of [
  (v:Record<string,unknown>,p:number)=>{if(p===2)v.items=[row(1)];},
  (v:Record<string,unknown>,p:number)=>{if(p===2)v.items=[];},
  (v:Record<string,unknown>,p:number)=>{if(p===2)v.period="2026-09";},
  (v:Record<string,unknown>,p:number)=>{if(p===2)v.mode="projection";},
  (v:Record<string,unknown>,p:number)=>{if(p===2)v.summary={beneficiaries:1001,jtm:"1001",total:"999"};},
 ]){const f=fixture(1001,alter);await assert.rejects(()=>f.service.export("synthetic-token",query));assert.equal(f.calls(),2);}
});
