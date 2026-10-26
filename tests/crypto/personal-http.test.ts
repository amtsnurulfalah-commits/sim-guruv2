import test from 'node:test';
import type {SqlDatabase} from '../../scripts/lib/sql-database';
import assert from 'node:assert/strict';
import {createPersonalHandler} from '../../src/server/personal/http';
import {cookieNames} from '../../src/server/auth/security';
import type {LocalAuthService} from '../../src/server/auth/service';
import type {PersonalService} from '../../src/server/personal/service';
import {rangeSchema} from '../../src/lib/personal/contracts';
const token='K'.repeat(43),config={appUrl:'http://localhost:3000',sessionSecret:'s'.repeat(64),production:false,vercel:false};
test('personal HTTP protects session/business/own scope and private calendar download',async()=>{
 let checks=0,reads=0;
 const handler=createPersonalHandler({config:()=>config,auth:async()=>({requireSession:async(t:string,business:boolean)=>{assert.equal(t,token);assert.equal(business,true);checks++;return{user_id:'owner'};}} as unknown as LocalAuthService),service:async()=>({read:async(_t:string,kind:string,input:unknown)=>{reads++;const q=rangeSchema.parse(input);return kind==='history'?{items:[],truncated:false}:{...q,generatedAt:'2026-10-26T00:00:00Z',items:[]};}} as unknown as PersonalService)});
 const request=(path:string,headers:Record<string,string>={},method='GET')=>new Request('http://localhost:3000/api/personal/'+path,{method,headers:{cookie:cookieNames(false).session+'='+token,...headers}});
 assert.equal((await handler('calendar',new Request('http://localhost:3000/api/personal/calendar?from=2026-10-26&to=2026-10-26'))).status,401);
 assert.equal((await handler('calendar',request('calendar',{},'POST'))).status,405);
 assert.equal((await handler('calendar',request('calendar?from=2026-10-26&to=2026-10-26',{'sec-fetch-site':'cross-site'}))).status,403);
 assert.equal(reads,0);
 const result=await handler('export',request('export?from=2026-10-26&to=2026-10-26'));assert.equal(result.status,200);assert.match(result.headers.get('content-type')!,/text\/calendar/);assert.match(result.headers.get('cache-control')!,/no-store/);assert.match(await result.text(),/BEGIN:VCALENDAR/);assert.equal(checks,1);
 assert.equal((await handler('calendar',request('calendar?from=2026-10-26&to=2026-10-26&userId=other'))).status,422);
});

test('personal service classifies missing/mismatched history DTO as upstream failure',async()=>{
 const {PersonalService}=await import('../../src/server/personal/service');
 let rows:Record<string,unknown>[]=[];
 const db:SqlDatabase={
  exec:async()=>{},close:async()=>{},query:async<T extends Record<string,unknown>>()=>({rows:rows as T[]}),transaction:async work=>work(db),
 };
 const service=new PersonalService(db),range={from:'2026-10-26',to:'2026-10-26'};
 await assert.rejects(()=>service.read(token,'history',range),{code:'INVALID_RESPONSE',status:502});
 rows=[{value:{items:[{id:'11111111-1111-4111-8111-111111111111',reference:'22222222-2222-4222-8222-222222222222',kind:'journal',actor:null,reason:null,createdAt:'2026-10-25T16:59:59Z',hasBefore:false,hasAfter:true}],truncated:false}}];
 await assert.rejects(()=>service.read(token,'history',range),{code:'INVALID_RESPONSE',status:502});
});
