import { z } from "zod";
import { wibDate } from "../calendar/schemas";
export const rangeSchema = z.object({ from: z.iso.date(), to: z.iso.date() }).strict().refine(v => v.from >= '2000-01-01' && v.to < '2200-01-01' && Date.parse(v.to)-Date.parse(v.from)>=0 && Date.parse(v.to)-Date.parse(v.from)<=30*86400000, 'Pilih rentang maksimal 31 hari.');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const calendarItem = z.object({ uid: z.string().min(1).max(150), date: z.iso.date(), start: time, finish: time, kind: z.enum(['KBM','PIKET','UPACARA','EXAM_SUPERVISOR','EXAM_COMMITTEE','EVENT']), title: z.string().max(1000), location: z.string().max(1000), state: z.enum(['effective','allocated','planned','available']), all_day: z.boolean() }).refine(v => v.finish > v.start);
export const calendarSchema = z.object({ from: z.iso.date(), to: z.iso.date(), generatedAt: z.iso.datetime({offset:true}), items: z.array(calendarItem).max(2000) }).refine(v => new Set(v.items.map(i=>i.uid)).size===v.items.length && v.items.every(i=>i.date>=v.from&&i.date<=v.to));
export type PersonalCalendar = z.infer<typeof calendarSchema>;
export const historySchema = z.object({ items: z.array(z.object({id:z.uuid(),kind:z.string(),reference:z.uuid(),actor:z.string().nullable(),reason:z.string().nullable(),createdAt:z.iso.datetime({offset:true}),hasBefore:z.boolean(),hasAfter:z.boolean(),changedFields:z.array(z.string()).max(10).optional().default([])})).max(100), truncated:z.boolean() });
export const kindLabel: Record<string,string> = {KBM:'KBM',PIKET:'Piket',UPACARA:'Upacara',EXAM_SUPERVISOR:'Pengawas ujian',EXAM_COMMITTEE:'Panitia ujian',EVENT:'Acara'};
export const historyLabel: Record<string,string> = {schedule:'Perubahan jadwal mengajar',confirmation:'Status konfirmasi diperbarui','duty-substitute':'Petugas pengganti ditetapkan','duty-cancel-substitute':'Pengganti dibatalkan','duty-confirm':'Kegiatan dikonfirmasi','duty-revoke':'Konfirmasi dicabut','duty-adjust':'JTM disesuaikan','duty-relocate':'JTM dialokasikan','duty-replace':'Petugas pengganti diperbarui','duty-allocate':'JTM dialokasikan','duty-remove-allocation':'Alokasi JTM dibatalkan','duty-reset':'Perubahan penugasan direset',journal:'Perubahan jurnal pembelajaran','correction-request':'Koreksi honorarium diajukan','honor-correction':'Koreksi honorarium diterapkan'};

export const calendarStateLabel={effective:'Penugasan efektif',allocated:'Alokasi JTM — periksa porsi di sumber',planned:'Rencana dari jadwal',available:'Acara tersedia'};

export type PersonalHistory = z.infer<typeof historySchema>;
/** Match SQL's inclusive WIB dates; reject duplicate React/audit identities. */
export function historyForRangeSchema(range: {from:string;to:string}) {
 return historySchema.superRefine((value,ctx)=>{
  const ids=new Set<string>();
  for(const item of value.items){
   const date=wibDate(new Date(item.createdAt));
   if(ids.has(item.id)||date<range.from||date>range.to)ctx.addIssue({code:'custom',message:'Riwayat tidak sesuai rentang atau memuat referensi duplikat.'});
   ids.add(item.id);
  }
 }).transform(value=>({...value,items:[...value.items].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))}));
}
export function personalDefaultRange(date:string,history:boolean){
 const delta=new Date(Date.parse(date)+(history?-6:6)*86400000).toISOString().slice(0,10);
 return history?{from:delta<'2000-01-01'?'2000-01-01':delta,to:date}:{from:date,to:delta>'2199-12-31'?'2199-12-31':delta};
}
