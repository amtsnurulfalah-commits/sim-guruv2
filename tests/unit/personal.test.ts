import test from 'node:test';
import assert from 'node:assert/strict';
import manifest from '../../src/app/manifest';
import {calendarSchema,rangeSchema} from '../../src/lib/personal/contracts';
test('personal calendar range and DTO reject oversized, mismatched, duplicate and invalid-time data',()=>{
 assert.equal(rangeSchema.safeParse({from:'2026-01-01',to:'2026-02-01'}).success,false);
 assert.equal(rangeSchema.safeParse({from:'2026-01-01',to:'2026-01-31',userId:'other'}).success,false);
 const item={uid:'a',date:'2026-01-01',start:'07:00',finish:'08:00',kind:'KBM',title:'IPA',location:'VII',state:'planned',all_day:false};
 const value={from:'2026-01-01',to:'2026-01-02',generatedAt:'2026-01-01T00:00:00Z',items:[item]};
 assert.equal(calendarSchema.safeParse(value).success,true);
 assert.equal(calendarSchema.safeParse({...value,items:[item,item]}).success,false);
 assert.equal(calendarSchema.safeParse({...value,items:[{...item,date:'2026-01-03'}]}).success,false);
 assert.equal(calendarSchema.safeParse({...value,items:[{...item,start:'09:00'}]}).success,false);
});
test('install manifest launches a guarded page with existing identity and no credentials',()=>{
 const value=manifest();assert.equal(value.start_url,'/dashboard');assert.equal(value.display,'standalone');assert.deepEqual(value.icons?.map(x=>x.sizes),['192x192','512x512']);assert.ok(!JSON.stringify(value).includes('token'));
});

test('history defaults look backwards; WIB bounds, duplicate IDs and ordering are validated',async()=>{
 const {personalDefaultRange,historyForRangeSchema}=await import('../../src/lib/personal/contracts');
 assert.deepEqual(personalDefaultRange('2026-10-26',true),{from:'2026-10-20',to:'2026-10-26'});
 assert.deepEqual(personalDefaultRange('2026-10-26',false),{from:'2026-10-26',to:'2026-11-01'});
 assert.deepEqual(personalDefaultRange('2000-01-01',true),{from:'2000-01-01',to:'2000-01-01'});
 assert.deepEqual(personalDefaultRange('2199-12-31',false),{from:'2199-12-31',to:'2199-12-31'});
 const schema=historyForRangeSchema({from:'2026-10-26',to:'2026-10-26'});
 const item={id:'11111111-1111-4111-8111-111111111111',reference:'22222222-2222-4222-8222-222222222222',kind:'journal',actor:null,reason:null,createdAt:'2026-10-25T17:00:00Z',hasBefore:false,hasAfter:true};
 assert.equal(schema.safeParse({items:[item],truncated:false}).success,true);
 assert.equal(schema.safeParse({items:[{...item,createdAt:'2026-10-26T17:00:00Z'}],truncated:false}).success,false);
 assert.equal(schema.safeParse({items:[{...item,createdAt:'2026-10-25T16:59:59Z'}],truncated:false}).success,false);
 assert.equal(schema.safeParse({items:[item,item],truncated:false}).success,false);
 const later={...item,id:'33333333-3333-4333-8333-333333333333',createdAt:'2026-10-26T08:00:00Z'};
 assert.deepEqual(schema.parse({items:[item,later],truncated:false}).items.map(x=>x.id),[later.id,item.id]);
});
