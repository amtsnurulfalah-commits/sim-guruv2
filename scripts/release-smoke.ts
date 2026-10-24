/** Read-only anonymous deployment probes. Never login, dispatch mail or change business data. */
import assert from "node:assert/strict";
const raw = process.env.SMOKE_BASE_URL;
if (!raw) throw Error("SMOKE_BASE_URL_REQUIRED");
const base = new URL(raw);
if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash) throw Error("HTTPS_ORIGIN_REQUIRED");
const paths = ["/api/dashboard","/api/activities/journals","/api/duties/board","/api/programs/read?domain=exams","/api/honorarium/read?kind=history","/api/users","/api/schedules/mine","/api/settings/school","/api/operations/tasks","/api/operations/inbox","/api/operations/support","/api/reports/read","/api/semester-preparation/read","/api/migration/board"];
async function probe(path: string, status: number) {
  const response = await fetch(new URL(path,base),{redirect:"error",signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,status,path);
  assert.equal(response.headers.get("x-content-type-options"),"nosniff",path);
  assert.equal(response.headers.get("x-frame-options"),"DENY",path);
  assert.match(response.headers.get("cache-control")??"",/no-store/,path);
  const body=await response.json();
  if(status===401){assert.equal(body.error?.code,"UNAUTHENTICATED",path);assert.ok(!JSON.stringify(body).includes("password_hash"));}
  else assert.equal(body.data?.status,"alive");
  return {path,status};
}
async function main() {
const results = [await probe("/api/health",200)];
for(let n=0;n<paths.length;n+=4) results.push(...await Promise.all(paths.slice(n,n+4).map(path=>probe(path,401))));
console.log(JSON.stringify({kind:"anonymous-release-smoke",ok:true,checks:results,limits:"Liveness and anonymous denial only; not authenticated business UAT or database readiness."},null,2));

}
main().catch(error => { console.error("SMOKE_FAILED", error instanceof Error ? error.message : "UNKNOWN"); process.exitCode=1; });
