import { performance } from "node:perf_hooks";
import { getPasswordService,ARGON2_POLICY } from "../src/server/auth/passwords";
async function main(){
const service=await getPasswordService();
const password="Synthetic9!benchmark#only";
const samples:number[]=[];let hash="";
for(let i=0;i<12;i++){const start=performance.now();hash=await service.hashNew(password,{username:"operator",fullName:"Admin Uji"});samples.push(performance.now()-start);}
const verify:number[]=[];
for(let i=0;i<12;i++){const start=performance.now();await service.verify(hash,password);verify.push(performance.now()-start);}
const summary=(values:number[])=>{const ordered=[...values].sort((a,b)=>a-b);return {samples:values.length,p50ms:Math.round(ordered[Math.ceil(ordered.length*.5)-1]!),p95ms:Math.round(ordered[Math.ceil(ordered.length*.95)-1]!)};};
const start=performance.now();await Promise.all(Array.from({length:4},()=>service.verify(hash,password)));
console.log(JSON.stringify({environment:"local container; not Vercel",node:process.version,policy:ARGON2_POLICY,hash:summary(samples),verify:summary(verify),fourConcurrentVerifyMs:Math.round(performance.now()-start),rssBytes:process.memoryUsage().rss},null,2));

}
main().catch(()=>{console.error("BENCHMARK_FAILED");process.exitCode=1;});
