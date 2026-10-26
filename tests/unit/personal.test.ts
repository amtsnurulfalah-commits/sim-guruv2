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
