"use client";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionIcon } from "@/components/ui/action-icon";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { masterRequest } from "@/features/masters/api";
import { choiceListSchema, readScheduleResponse } from "@/lib/schedules/contracts";
export type Choice = {id:string; label:string; raw:Record<string,unknown>};
const fieldNames:Record<string,string> = {"academic-periods":"academicPeriodId",users:"userId",subjects:"subjectId",classes:"classId","academic-years":"academicYearId"};
export function SchedulePicker({target,label,value,onChange,parentId="",optional=false,disabled=false,selectedLabel=""}:{
  target:string; label:string; value:string; onChange:(id:string,item?:Choice)=>void;
  parentId?:string; optional?:boolean; disabled?:boolean; selectedLabel?:string;
}) {
  const inputId=useId(),selectId=useId();
  const [q,setQ]=useState(""),[page,setPage]=useState(1),[items,setItems]=useState<Choice[]>([]),[total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
  const [selection,setSelection]=useState<{id:string;label:string}|null>(null);
  const unavailable=target==="classes" && !optional && !parentId;
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    const timer=setTimeout(()=>{
      if(unavailable){setItems([]);setLoading(false);return;}
      setLoading(true);setError("");
      const url=target==="users"?"/api/users":"/api/settings/"+target;
      void masterRequest<unknown>(url+"?"+new URLSearchParams({q,page:String(page),pageSize:"20",...(target==="users"?{status:"active"}:{parentId})}),"GET",undefined,controller.signal)
        .then(raw=>{
          const result=readScheduleResponse(choiceListSchema,raw);
          if(!active)return;
          setItems(result.items.map(row=>({id:row.id,label:String(row.fullName??row.name??row.label??row.parentLabel??"Data")+(row.semester?" · Semester "+String(row.semester):""),raw:row})));
          setTotal(result.total);
        }).catch(e=>{if(active){setItems([]);setTotal(0);setError(e instanceof Error?e.message:"Pilihan belum dapat dimuat.");}})
        .finally(()=>{if(active)setLoading(false);});
    },150);
    return()=>{active=false;clearTimeout(timer);controller.abort();};
  },[target,q,page,parentId,unavailable,revision]);
  const currentLabel=items.find(item=>item.id===value)?.label??((selection?.id===value?selection.label:selectedLabel)||"Pilihan tersimpan");
  return <div className="min-w-0 space-y-2 rounded-xl border p-3" aria-busy={loading && !unavailable}>
    <div className="ui-floating-field"><label htmlFor={inputId} className="block text-sm ui-floating-label">Cari {label.toLowerCase()}</label>
    <input placeholder=" " id={inputId} disabled={disabled||unavailable} value={q} maxLength={100} onChange={e=>{setQ(e.target.value);setPage(1);setLoading(true);}} className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3" /></div>
    <label id={selectId+"-label"} htmlFor={selectId} className="block text-sm font-medium">{label}</label>
    <select id={selectId} name={fieldNames[target]} aria-labelledby={selectId+"-label"} disabled={disabled||unavailable||loading||Boolean(error)} value={value} required={!optional} onChange={e=>{
      const item=items.find(v=>v.id===e.target.value);setSelection(item?{id:item.id,label:item.label}:null);onChange(e.target.value,item);
    }} className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3">
      <option value="">{unavailable?"Pilih semester terlebih dahulu":optional?"Semua / tidak dipilih":"Pilih data"}</option>
      {value&&!items.some(item=>item.id===value)&&<option value={value}>{currentLabel}</option>}
      {items.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
    {loading&&!unavailable&&<p role="status" className="text-xs text-muted-foreground">Memuat pilihan…</p>}
    {!loading&&!error&&!unavailable&&!items.length&&<p role="status" className="text-xs text-muted-foreground">Tidak ada pilihan sesuai pencarian.</p>}
    {error&&<><ErrorFeedback message={error}/><Button type="button" variant="outline" size="sm" disabled={disabled||loading} onClick={()=>{setLoading(true);setRevision(v=>v+1);}}>Coba muat pilihan</Button></>}
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={disabled||loading||unavailable||page===1} onClick={()=>{setPage(p=>p-1);setLoading(true);}}><ActionIcon action="previous"/>Sebelumnya</Button>
      <Button type="button" size="sm" variant="outline" disabled={disabled||loading||unavailable||page*20>=total} onClick={()=>{setPage(p=>p+1);setLoading(true);}}><ActionIcon action="next"/>Berikutnya</Button>
      {!unavailable&&<span className="text-xs text-muted-foreground">Halaman {page}</span>}
    </div>
  </div>;
}
