import test from 'node:test';
import assert from 'node:assert/strict';
import {renderCalendar} from '../../src/server/personal/ics';
import type {PersonalCalendar} from '../../src/lib/personal/contracts';
test('ICS stable private UID, WIB UTC rollover, all-day exclusive end and UTF8 folding prevent content injection',()=>{
 const item={uid:'KBM:synthetic:2026-12-31',date:'2026-12-31',start:'00:15',finish:'01:15',kind:'KBM' as const,title:'IPA,;\\\nBEGIN:VEVENT '+ '漢😀'.repeat(60),location:'VII',state:'planned' as const,all_day:false};
 const data:PersonalCalendar={from:item.date,to:item.date,generatedAt:'2026-12-30T00:00:00Z',items:[item]};
 const output=renderCalendar(data,'A');assert.ok(output.includes('DTSTART:20261230T171500Z'));assert.equal(output.split('\r\n').filter(l=>l==='BEGIN:VEVENT').length,1);assert.ok(output.includes('CLASS:PRIVATE'));assert.ok(output.includes('\\nBEGIN:VEVENT'));
 for(const line of output.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 const uid=(s:string)=>s.match(/UID:([^\r]+)/)![1];assert.equal(uid(output),uid(renderCalendar({...data,generatedAt:'2026-12-31T00:00:00Z'},'A')));assert.notEqual(uid(output),uid(renderCalendar(data,'B')));
 const allDay=renderCalendar({...data,items:[{...item,all_day:true}]},'A');assert.ok(allDay.includes('DTSTART;VALUE=DATE:20261231'));assert.ok(allDay.includes('DTEND;VALUE=DATE:20270101'));
});
