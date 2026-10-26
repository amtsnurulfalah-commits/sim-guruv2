'use client';
import {useId,useState} from 'react';
import {Button} from '@/components/ui/button';
import {EmptyState} from '@/components/feedback/feature-state';
import {historyLabel,type PersonalHistory} from '@/lib/personal/contracts';
const timeFormat=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'});
const label=(kind:string)=>Object.hasOwn(historyLabel,kind)?historyLabel[kind]:'Perubahan tercatat';
/** Search/paging only cover the bounded, authorized snapshot, never the entire audit store. */
export function HistoryList({value,admin,updatedAt,loading}:{value:PersonalHistory;admin:boolean;updatedAt:string|null;loading:boolean}){
 const fieldId=useId();
 const [query,setQuery]=useState(''),[kind,setKind]=useState(''),[page,setPage]=useState(1);
 const options=[...new Set([...value.items.map(item=>item.kind),...(kind?[kind]:[])])];
 const selectedKind=kind;
 const needle=query.trim().toLocaleLowerCase('id-ID');
 const filtered=value.items.filter(item=>(!selectedKind||item.kind===selectedKind)&&(!needle||[label(item.kind),item.actor,item.reason,item.id,item.reference,...item.changedFields].filter(Boolean).join(' ').toLocaleLowerCase('id-ID').includes(needle)));
 const pages=Math.max(1,Math.ceil(filtered.length/10)),current=Math.min(page,pages),start=(current-1)*10;
 return <div className="min-w-0 space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Catatan perubahan</h2><p className="text-sm text-muted-foreground" role="status" aria-live="polite">{loading?'Memperbarui catatan…':`${value.items.length} catatan dimuat`}{updatedAt&&!loading?` · diperbarui ${timeFormat.format(new Date(updatedAt))} WIB`:''}</p></div>
  {value.truncated&&<p role="note" className="ui-feedback-neutral text-sm leading-6">Sumber memuat lebih dari 100 catatan. Hanya 100 catatan terbaru dimuat. Pencarian dan halaman di bawah hanya menelusuri catatan ini; persempit rentang tanggal untuk memeriksa catatan lainnya.</p>}
  {!!value.items.length&&<div className="grid min-w-0 gap-3 rounded-xl bg-muted/30 p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
   <label className="min-w-0 text-sm font-medium">Cari dalam catatan dimuat<input className="ui-control mt-2" type="search" value={query} maxLength={200} placeholder="Tindakan, pelaku, alasan atau referensi" onChange={event=>{setQuery(event.target.value);setPage(1);}}/></label>
   <div className="min-w-0 text-sm font-medium"><label htmlFor={fieldId}>Jenis perubahan</label><select id={fieldId} className="ui-control mt-2" value={selectedKind} onChange={event=>{setKind(event.target.value);setPage(1);}}><option value="">Semua jenis</option>{options.map(option=><option key={option} value={option}>{label(option)}</option>)}</select></div>
   <Button className="self-end" variant="outline" disabled={!query&&!selectedKind} onClick={()=>{setQuery('');setKind('');setPage(1);}}>Reset pencarian</Button>
  </div>}
  {!value.items.length?<EmptyState title="Belum ada catatan pada rentang ini" description="Pilih tanggal perubahan dilakukan, bukan tanggal kegiatan. Hanya kategori audit yang didukung dan diizinkan untuk akun Anda yang ditampilkan."/>:!filtered.length?<EmptyState title="Tidak ada catatan yang cocok" description="Ubah kata kunci atau reset pencarian. Filter ini hanya memeriksa catatan yang sudah dimuat."/>:<>
   <p className="text-sm text-muted-foreground">Menampilkan {start+1}–{Math.min(start+10,filtered.length)} dari {filtered.length} hasil dalam catatan dimuat.</p>
   <ol start={start+1} className="min-w-0 space-y-3" aria-label="Daftar riwayat perubahan">{filtered.slice(start,start+10).map(item=><li key={item.id} className="min-w-0 space-y-3 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 font-semibold">{label(item.kind)}</h3><time className="text-sm text-muted-foreground" dateTime={item.createdAt}>{timeFormat.format(new Date(item.createdAt))} WIB</time></div>
    <p className="text-sm"><span className="font-medium">Pelaku: </span>{item.actor?.trim()||'Pengguna tidak tersedia'}</p>
    <p className="whitespace-pre-wrap text-sm leading-6"><span className="font-medium">Alasan: </span>{item.reason?.trim()||(admin?'Alasan tidak tersimpan pada catatan ini.':'Alasan tidak tersedia atau dibatasi sesuai hak akses akun ini.')}</p>
    <p className="text-sm text-muted-foreground">{item.changedFields.length?'Bagian tercatat: '+item.changedFields.join(', '):'Ringkasan bagian yang berubah belum tersedia untuk catatan ini.'}</p>
    {(!item.hasBefore||!item.hasAfter)&&<p className="text-xs leading-5 text-muted-foreground">Sebagian rincian sebelum/sesudah tidak tersimpan pada catatan ini.</p>}
    <details className="min-w-0 text-sm"><summary className="min-h-11 cursor-pointer rounded-md py-3 font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring">Referensi audit</summary><dl className="grid min-w-0 gap-2 rounded-lg bg-muted/30 p-3 text-xs"><div><dt className="font-medium">ID audit</dt><dd className="mt-1 break-all">{item.id}</dd></div><div><dt className="font-medium">ID objek terkait</dt><dd className="mt-1 break-all">{item.reference}</dd></div></dl></details>
   </li>)}</ol>
   {pages>1&&<nav aria-label="Halaman riwayat perubahan" className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" disabled={current===1} onClick={()=>setPage(current-1)}>Sebelumnya</Button><p role="status" className="text-sm">Halaman {current} dari {pages}</p><Button variant="outline" disabled={current===pages} onClick={()=>setPage(current+1)}>Berikutnya</Button></nav>}
  </>}
 </div>;
}
