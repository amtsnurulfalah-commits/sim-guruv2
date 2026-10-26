'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {PageHeader} from '@/components/ui/page-header';
import {ErrorFeedback} from '@/components/feedback/error-feedback';
import {EmptyState,FeatureState} from '@/components/feedback/feature-state';
import {useReadResource} from '@/lib/feedback/use-read-resource';
import {downloadFile} from '@/lib/feedback/api-error';
import {calendarStateLabel,calendarSchema,historyForRangeSchema,personalDefaultRange,kindLabel,rangeSchema} from '@/lib/personal/contracts';
import {HistoryList} from './history-list';
import {honorSourceLink} from '@/lib/finance/provenance';
export function PersonalWorkspace({date,history=false,admin=false}:{date:string;history?:boolean;admin?:boolean}){
 const [from,setFrom]=useState(()=>personalDefaultRange(date,history).from),[to,setTo]=useState(()=>personalDefaultRange(date,history).to);
 const [applied,setApplied]=useState({from,to}),[error,setError]=useState('');
 return <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]"><PageHeader context="Kegiatan madrasah · WIB" title={history?'Riwayat perubahan':'Kalender pribadi'} description={history?(admin?'Catatan jadwal mengajar, penugasan, jurnal dan koreksi honorarium dari kategori audit yang didukung. Halaman ini hanya untuk peninjauan.':'Riwayat tindakan Anda serta perubahan jadwal dan penugasan milik Anda. Keterangan internal pihak lain disembunyikan.'):'KBM, piket, upacara, ujian dan acara dari sumber kegiatan. Jadwal masih dapat berubah; periksa sumber sebelum bertugas.'}/>
 <form className="grid min-w-0 gap-3 rounded-xl border p-4 sm:grid-cols-3" onSubmit={e=>{e.preventDefault();const result=rangeSchema.safeParse({from,to});if(!result.success){setError('Pilih rentang tanggal valid, maksimal 31 hari (tahun 2000–2199).');return;}setError('');setApplied(result.data);}}><label className="min-w-0 text-sm">Dari tanggal<input className="ui-control mt-2" type="date" min="2000-01-01" max="2199-12-31" required value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="min-w-0 text-sm">Sampai tanggal<input className="ui-control mt-2" type="date" min="2000-01-01" max="2199-12-31" required value={to} onChange={e=>setTo(e.target.value)}/></label><Button type="submit" className="self-end">Tampilkan rentang</Button></form>
 <ErrorFeedback message={error} autoFocus/>
 <PersonalResults admin={admin} key={JSON.stringify([applied,history])} from={applied.from} to={applied.to} history={history}/>
 </div>;
}
function PersonalResults({from,to,history,admin}:{from:string;to:string;history:boolean;admin:boolean}){
 const query=new URLSearchParams({from,to}).toString(),path='/api/personal/'+(history?'history':'calendar')+'?'+query;
 const parse=useCallback((raw:unknown)=>{if(history){const parsed=historyForRangeSchema({from,to}).safeParse(raw);if(!parsed.success)throw Error('Riwayat belum sesuai. Muat ulang sumber atau hubungi administrator jika kendala berulang.');return parsed.data;}const parsed=calendarSchema.safeParse(raw);if(!parsed.success||parsed.data.from!==from||parsed.data.to!==to)throw Error('Kalender belum sesuai rentang yang diminta. Muat ulang sumber sebelum mengunduh.');return parsed.data;},[from,to,history]);
 const data=useReadResource(path,parse),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=useRef<AbortController|null>(null),pending=useRef(false),mounted=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current?.abort();};},[]);
 async function exportCalendar(){if(pending.current||data.loading||!data.value||data.error)return;pending.current=true;setBusy(true);setError('');const c=new AbortController();request.current=c;try{await downloadFile('/api/personal/export?'+query,'kalender-pribadi.ics',{signal:AbortSignal.any([c.signal,AbortSignal.timeout(30000)])});}catch(e){if(mounted.current&&!c.signal.aborted)setError(e instanceof Error?e.message:'Unduhan belum berhasil.');}finally{pending.current=false;if(mounted.current)setBusy(false);}}
 if(!data.value)return <FeatureState headingLevel={2} error={data.error} label="Memuat sumber…" retry={data.refresh}/>;
 return <section className="min-w-0 space-y-4" aria-busy={data.loading||busy}><div className="flex flex-wrap gap-3"><Button variant="outline" disabled={data.loading} onClick={data.refresh}>Muat ulang sumber</Button>{!history&&<Button variant="outline" disabled={busy||data.loading||!!data.error} onClick={()=>void exportCalendar()}>Unduh kalender (.ics)</Button>}</div>
 <p className="text-sm leading-6 text-muted-foreground">Rentang {from}–{to} · WIB. {history?'Tanggal mengacu pada waktu perubahan dicatat, bukan tanggal kegiatan. Urutan terbaru lebih dahulu. Rincian sebelum/sesudah yang tidak tersimpan tidak direkonstruksi.':'Berkas memuat jadwal pribadi. Unduhan adalah salinan saat diunduh, tidak tersinkron otomatis. Setelah perubahan atau pembatalan, hapus impor lama lalu impor ulang untuk mencegah duplikasi di aplikasi kalender. Acara tersedia bukan konfirmasi kehadiran.'}</p>
 <ErrorFeedback message={error||data.error}/>
 {'truncated' in data.value ? <HistoryList value={data.value} admin={admin} updatedAt={data.updatedAt} loading={data.loading}/> : <>
 {!data.value.items.length&&<EmptyState title="Belum ada catatan pada rentang ini"/>}
 <ul className="grid min-w-0 gap-3 sm:grid-cols-2">{data.value.items.map(item=><li key={item.uid} className="min-w-0 space-y-2 rounded-xl border p-4"><p className="text-sm text-muted-foreground">{item.date} · {item.all_day?'Sepanjang hari / jam khusus belum ditentukan':`${item.start}–${item.finish} WIB`}</p><h2 className="font-semibold">{kindLabel[item.kind]} · {item.title}</h2><p className="text-sm">{calendarStateLabel[item.state]}{item.location?' · '+item.location:''}</p>{honorSourceLink({component:item.kind,date:item.date})&&<Link className="inline-flex min-h-11 items-center text-sm text-primary underline" prefetch={false} href={honorSourceLink({component:item.kind,date:item.date})!}>Buka sumber kegiatan</Link>}</li>)}</ul>
 </>}
 </section>;
}
