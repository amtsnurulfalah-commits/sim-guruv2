import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
test("PWA worker passes online navigation, leaves API/mutations untouched and never caches private data", async () => {
 let handler: (event: {request:{method:string;mode:string;url:string};respondWith:(response:Promise<Response>)=>void})=>void;
 let fail=false, fetches=0;
 runInNewContext(await readFile("public/sw.js","utf8"),{self:{location:{origin:"https://example.test"},addEventListener:(name:string,fn:typeof handler)=>{assert.equal(name,"fetch");handler=fn;}},URL,Response,fetch:async()=>{fetches++;if(fail)throw Error("offline");return new Response("live",{status:200});}});
 for(const request of [{method:"POST",mode:"navigate",url:"https://example.test/api/write"},{method:"GET",mode:"cors",url:"https://example.test/api/private"},{method:"GET",mode:"navigate",url:"https://other.test/"}])handler!({request,respondWith:()=>assert.fail("must not intercept")});
 assert.equal(fetches,0);
 let response:Promise<Response>|undefined;
 const request={method:"GET",mode:"navigate",url:"https://example.test/jurnal"};handler!({request,respondWith:r=>{response=r;}});assert.equal(await (await response!).text(),"live");
 fail=true;handler!({request,respondWith:r=>{response=r;}});const offline=await response!;assert.equal(offline.status,503);assert.equal(offline.headers.get("cache-control"),"no-store");assert.match(await offline.text(),/SiM-Guru belum dapat dijangkau/);
});
