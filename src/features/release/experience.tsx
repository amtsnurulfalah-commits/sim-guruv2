'use client';
import Link from 'next/link';
import {useId,useState} from 'react';
import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/feedback/feature-state';
import {releaseNotes,type ReleaseNote} from '@/lib/release/notes';
import {useReleaseStatus} from './use-release-status';
import {useInstallPrompt} from './use-install-prompt';
export function InstallGuide(){
 const install=useInstallPrompt(),titleId=useId();
 return <section className="min-w-0 space-y-3 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby={titleId}><h2 id={titleId} className="text-lg font-semibold">Pasang SiM-Guru</h2>
 {install.standalone?<p className="text-sm">Aplikasi sedang dibuka dalam jendela mandiri.</p>:install.installed?<p className="text-sm">Aplikasi telah dipasang pada perangkat ini.</p>:<><p className="text-sm leading-6">Pada browser yang mendukung, gunakan menu Pasang aplikasi / Tambahkan ke layar utama. Pada Safari, gunakan menu Bagikan lalu Tambahkan ke Layar Utama. Nama menu dan dukungan dapat berbeda menurut perangkat.</p>{install.available&&<Button disabled={install.busy} onClick={()=>void install.install()}>{install.busy?'Membuka pemasangan…':'Pasang aplikasi'}</Button>}</>}
 {install.message&&<p role="status" className="ui-feedback-neutral text-sm leading-6">{install.message}</p>}
 <p className="text-sm leading-6 text-muted-foreground">Memerlukan internet untuk masuk, membaca sumber terbaru dan menyimpan transaksi. Tidak ada pengiriman otomatis ketika offline. Pembaruan diambil saat aplikasi dimuat ulang. Tunggu proses selesai; periksa sumber bila hasil simpan belum pasti, dan salin isian penting sebelum memuat ulang. Pemasangan tidak menyimpan sesi login permanen.</p></section>;
}
export function ReleaseNotice({scope}:{scope:string|null}){
 const {status}=useReleaseStatus(scope);
 return <Link prefetch={false} className="inline-flex min-h-11 items-center underline" href="/pembaruan">Catatan pembaruan{status==='unread'?' · Baru':''}</Link>;
}
const formatDate=(date:string)=>Number.isNaN(Date.parse(date+'T12:00:00Z'))?'Tanggal belum tersedia':new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'long'}).format(new Date(date+'T12:00:00Z'));
function NoteContents({note}:{note:ReleaseNote}){
 const groups=[{label:'Fitur baru',items:note.features},{label:'Perbaikan',items:note.fixes},{label:'Yang perlu dilakukan',items:note.actions}];
 return <div className="space-y-4">{groups.filter(group=>group.items.length).map(group=><div key={group.label}><h3 className="font-semibold">{group.label}</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6">{group.items.map((item,index)=><li key={index}>{item}</li>)}</ul></div>)}</div>;
}
export function ReleaseNotes({scope,notes=releaseNotes,includeInstall=true}:{scope:string|null;notes?:readonly ReleaseNote[];includeInstall?:boolean}){
 const titleId=useId(),olderId=useId();
 const latest=notes[0],{status,mark}=useReleaseStatus(scope,latest?.version??'');
 const [feedback,setFeedback]=useState<{scope:string|null;version:string;message:string}|null>(null);
 const message=status!=='read'&&feedback?.scope===scope&&feedback.version===latest?.version?feedback.message:'';
 return <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
 {latest?<><section className="min-w-0 space-y-4 rounded-2xl border border-primary/25 bg-card p-4 sm:p-6" aria-labelledby={titleId}>
  <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 space-y-2"><p className="text-xs font-semibold tracking-wide text-primary uppercase">Pembaruan terbaru</p><h2 id={titleId} className="text-xl font-bold">Versi {latest.version}</h2><time className="text-sm text-muted-foreground" dateTime={latest.date}>{formatDate(latest.date)}</time></div>{status==='read'&&<p role="status" className="ui-feedback-neutral text-sm">Versi ini sudah dibaca di tab ini.</p>}</div>
  <NoteContents note={latest}/>
  {scope&&<div className="space-y-2 border-t pt-4"><Button variant="outline" disabled={status==='read'||status==='unknown'} onClick={()=>{const saved=mark();setFeedback(saved?null:{scope,version:latest.version,message:'Penanda tidak dapat disimpan di tab ini. Catatan tetap dapat dibaca.'});}}>Tandai pembaruan sudah dibaca</Button><p className="text-xs leading-5 text-muted-foreground">Penanda berlaku untuk akun dan versi ini pada tab yang sama.</p></div>}
  {message&&<p role="status" className="ui-feedback-neutral text-sm">{message}</p>}
 </section>
 {notes.length>1&&<section className="min-w-0 space-y-3" aria-labelledby={olderId}><h2 id={olderId} className="text-lg font-semibold">Pembaruan sebelumnya</h2>{notes.slice(1).map(note=><details key={note.version} className="min-w-0 rounded-xl border bg-card"><summary className="min-h-12 cursor-pointer rounded-xl p-4 font-semibold focus-visible:outline-2 focus-visible:outline-ring">Versi {note.version} · {formatDate(note.date)}</summary><div className="min-w-0 border-t p-4 sm:p-5"><NoteContents note={note}/></div></details>)}</section>}</>:<EmptyState title="Belum ada catatan pembaruan" description="Catatan versi akan ditampilkan setelah pembaruan diterbitkan."/>}
 <Link prefetch={false} className="inline-flex min-h-11 items-center text-sm text-primary underline" href="/kesiapan">Buka panduan aplikasi</Link>
 {includeInstall&&<InstallGuide/>}
 </div>;
}
