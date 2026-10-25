"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { accessCommand, accessSavedSchema, readersSchema, type Reader } from "@/lib/reports/contracts";
import { ApiRequestError } from "@/lib/feedback/api-error";
import { useReadResource } from "@/lib/feedback/use-read-resource";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/dialog";
import { masterRequest } from "../masters/api";

const readReaders=(raw:unknown)=>{const parsed=readersSchema.safeParse(raw);if(!parsed.success)throw Error("Daftar izin belum sesuai. Muat ulang izin sebelum melanjutkan.");return parsed.data;};
export function ReportAccess({ onChange }: { onChange: () => void }) {
  const feedback=useRef<HTMLParagraphElement>(null);
  const [revision,setRevision]=useState(0), [notice,setNotice]=useState("");
  return <section className="ui-panel min-w-0 space-y-4" aria-label="Izin pembaca laporan">
    <h2 className="text-lg font-semibold">Izin pembaca laporan</h2>
    <p className="text-sm leading-6">Admin memiliki akses penuh. Izin akademik dan honorarium diberikan terpisah. Pencabutan berlaku pada pembacaan dan ekspor berikutnya; alasan perubahan dicatat pada audit.</p>
    {notice && <p ref={feedback} role="status" tabIndex={-1} className="text-sm">{notice}</p>}
    <AccessEditor key={revision} onReload={()=>setRevision(v=>v+1)} onSaved={()=>{
      setNotice("Izin laporan berhasil disimpan. Daftar izin dimuat ulang.");
      setRevision(v=>v+1); onChange();requestAnimationFrame(()=>feedback.current?.focus());
    }}/>
  </section>;
}
function AccessEditor({onReload,onSaved}: {onReload:()=>void; onSaved:()=>void}) {
  const {value,error,loading}=useReadResource("/api/reports/read?kind=access",readReaders);
  const [open,setOpen]=useState(false), [selected,setSelected]=useState<Reader|null>(null);
  const [academic,setAcademic]=useState(false), [finance,setFinance]=useState(false), [reason,setReason]=useState("");
  const [saving,setSaving]=useState(false), [locked,setLocked]=useState(false), [actionError,setActionError]=useState("");
  const trigger=useRef<HTMLButtonElement>(null),reload=useRef<HTMLButtonElement>(null);
  const pending=useRef(false), mounted=useRef(false), write=useRef<AbortController|null>(null);
  useEffect(()=>{
    mounted.current=true;
    return ()=>{mounted.current=false;write.current?.abort();};
  },[]);
  function choose(id:string) {
    const reader=value?.items.find(item=>item.id===id)??null;
    setSelected(reader);setReason(""); setAcademic(reader?.academic??false); setFinance(reader?.finance??false); setActionError("");
  }
  async function save(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(pending.current||loading||error||locked||!selected)return;
    let input;
    try {input=accessCommand.parse({userId:selected.id,version:selected.version,academic,finance,reason});}
    catch{setActionError("Alasan perubahan harus berisi 5–500 karakter setelah spasi di awal dan akhir dihapus.");return;}
    pending.current=true;setSaving(true);setActionError("");
    const c=new AbortController();write.current=c;
    try {
      accessSavedSchema.parse(await masterRequest<unknown>("/api/reports/access","POST",input,c.signal));
      if(mounted.current)onSaved();
    }catch(e){
      if(!mounted.current)return;
      const uncertain=!(e instanceof ApiRequestError)||e.status===0||e.status>=500||e.status===409;
      setLocked(uncertain);
      setActionError(e instanceof z.ZodError?"Status penyimpanan izin belum dapat dipastikan. Muat ulang dan periksa izin sebelum mengirim kembali.":e instanceof Error?e.message:"Izin belum dapat disimpan.");
    }finally{pending.current=false;write.current=null;if(mounted.current)setSaving(false);}
  }
  return <>
    <ErrorFeedback message={error}/>
    {loading && <p role="status" className="text-sm">Memuat daftar izin…</p>}
    <div className="flex flex-wrap gap-2">
      <Button ref={reload} type="button" variant="outline" disabled={saving} onClick={()=>{if(!pending.current)onReload();}}>Muat ulang izin</Button>
      <Button ref={trigger} type="button" disabled={loading||Boolean(error)||!value?.items.length||saving||locked} onClick={()=>{
        setSelected(null);setAcademic(false);setFinance(false);setReason("");setActionError("");setLocked(false);setOpen(true);
      }}>Atur izin laporan</Button>
    </div>
    {value && !error && <>
      <ul className="space-y-2 text-sm">
        {value.items.filter(reader=>reader.academic||reader.finance).map(reader=><li key={reader.id} className="rounded-xl border p-3">
          <strong>{reader.name}</strong> · {[reader.academic?"Akademik":"",reader.finance?"Honorarium":""].filter(Boolean).join(", ")}
        </li>)}
      </ul>
      {!value.items.some(reader=>reader.academic||reader.finance)&&<p className="text-sm text-muted-foreground">Belum ada guru yang diberi izin.</p>}
      {!value.items.length&&<p className="text-sm text-muted-foreground">Belum ada pengguna guru aktif yang dapat diberi izin.</p>}
    </>}
    <FormDialog title="Atur izin laporan" trigger="" description="Pilih pengguna untuk melihat izin tersimpan, lalu ubah hanya lingkup yang diperlukan." open={open} busy={saving} onOpenChange={next=>{setOpen(next);if(!next)requestAnimationFrame(()=>(locked?reload.current:trigger.current)?.focus());}}>
      <form onInvalid={event=>{event.preventDefault();setActionError("Lengkapi alasan perubahan dengan 5–500 karakter sebelum menyimpan.");}} onSubmit={event=>void save(event)} className="min-w-0 space-y-4" aria-busy={saving}>
        <ErrorFeedback message={actionError||error} autoFocus/>
        {locked&&<p className="text-sm leading-6">Tutup formulir lalu muat ulang izin dan periksa hasil terbaru. Pengiriman ulang dikunci untuk mencegah perubahan ganda atau menimpa versi baru.</p>}
        <fieldset disabled={saving||locked||loading||Boolean(error)} className="min-w-0 space-y-4">
          <label className="block space-y-2 text-sm"><span>Pengguna</span><select required className="ui-control" value={selected?.id??""} onChange={event=>choose(event.target.value)}>
            <option value="">Pilih pengguna</option>{value?.items.map(reader=><option key={reader.id} value={reader.id}>{reader.name}</option>)}
          </select></label>
          <label className="block space-y-2 text-sm"><span>Laporan akademik</span><select className="ui-control" disabled={!selected} value={String(academic)} onChange={event=>setAcademic(event.target.value==="true")}>
            <option value="false">Cabut / tidak diizinkan</option><option value="true">Izinkan</option>
          </select></label>
          <label className="block space-y-2 text-sm"><span>Laporan honorarium</span><select className="ui-control" disabled={!selected} value={String(finance)} onChange={event=>setFinance(event.target.value==="true")}>
            <option value="false">Cabut / tidak diizinkan</option><option value="true">Izinkan</option>
          </select></label>
          <label className="block space-y-2 text-sm"><span>Alasan (5–500 karakter)</span><textarea required minLength={5} maxLength={500} className="ui-control" value={reason} onChange={event=>setReason(event.target.value)}/></label>
          <Button type="submit" disabled={!selected}>{saving?"Menyimpan izin…":"Atur izin laporan"}</Button>
        </fieldset>
      </form>
    </FormDialog>
  </>;
}
