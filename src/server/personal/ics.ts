import 'server-only';
import { createHash } from 'node:crypto';
import { calendarStateLabel, calendarSchema, kindLabel, type PersonalCalendar } from '../../lib/personal/contracts';
const text = (v:string) => v.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/\r/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function fold(line:string) { const parts:string[]=[];let current='',bytes=0;for(const c of line){const n=Buffer.byteLength(c);if(bytes+n>75){parts.push(current);current=' ';bytes=1;}current+=c;bytes+=n;}parts.push(current);return parts.join('\r\n'); }
const utc = (date:string,time:string) => new Date(`${date}T${time}:00+07:00`).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export function renderCalendar(raw:PersonalCalendar,accountId:string) {
 const data=calendarSchema.parse(raw),stamp=new Date(data.generatedAt).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SiM-Guru//Kalender pribadi//ID','CALSCALE:GREGORIAN'];
 for(const i of data.items){const uid=createHash('sha256').update(accountId+':'+i.uid).digest('hex');lines.push('BEGIN:VEVENT','UID:'+uid+'@sim-guru','DTSTAMP:'+stamp,'CLASS:PRIVATE');
 if(i.all_day){const end=new Date(Date.parse(i.date)+86400000).toISOString().slice(0,10).replaceAll('-','');lines.push('DTSTART;VALUE=DATE:'+i.date.replaceAll('-',''),'DTEND;VALUE=DATE:'+end);}else lines.push('DTSTART:'+utc(i.date,i.start),'DTEND:'+utc(i.date,i.finish));
 lines.push('SUMMARY:'+text((kindLabel[i.kind]??i.kind)+' · '+i.title),'LOCATION:'+text(i.location),'DESCRIPTION:'+text('Salinan kalender, bukan sinkronisasi otomatis. Status sumber: '+calendarStateLabel[i.state]+'. Acara tersedia tidak berarti kehadiran telah dikonfirmasi.'),'END:VEVENT');}
 lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
