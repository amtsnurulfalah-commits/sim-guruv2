"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { masterRequest } from "../masters/api";
import { DataForm, panel } from "../programs/forms";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { TableRegion } from "@/components/ui/table-region";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { ApiRequestError } from "@/lib/feedback/api-error";
import {
  choicesSchema,
  preparationRequest,
  readPreparationPreview,
  readPreparationStatus,
  readPreparationReceipt,
  issueLabels,
  type PreparationPreview,
  type PreparationReceipt,
  type PreparationChoices,
} from "@/lib/semester-preparation/contracts";
const api = "/api/semester-preparation/";
const message = (e: unknown) =>
  e instanceof z.ZodError
    ? "Respons persiapan semester tidak sesuai. Muat ulang atau hubungi admin."
    : e instanceof Error
      ? e.message
      : "Permintaan belum dapat diproses.";
function revealHeading(ref:{current:HTMLHeadingElement|null}) {
  requestAnimationFrame(()=>{ref.current?.focus({preventScroll:true});ref.current?.scrollIntoView({block:"start"});});
}
export function SemesterPreparationWorkspace() {
  const [choices,setChoices]=useState<PreparationChoices>({periods:[],history:[]});
  const [loading,setLoading]=useState(true),[choicesReady,setChoicesReady]=useState(false),[choiceError,setChoiceError]=useState("");
  const [error,setError]=useState(""),[notice,setNotice]=useState(""),[refresh,setRefresh]=useState(0);
  const [preview,setPreview]=useState<PreparationPreview|null>(null),[receipt,setReceipt]=useState<PreparationReceipt|null>(null);
  const [operation,setOperation]=useState<"preview"|"commit"|"check"|null>(null);
  const [uncertain,setUncertain]=useState(false),[stale,setStale]=useState(false),[confirm,setConfirm]=useState(false),[accepted,setAccepted]=useState(false),[page,setPage]=useState(1);
  const [now,setNow]=useState(()=>Date.now());
  const lock=useRef(false),mounted=useRef(false),write=useRef<AbortController|null>(null);
  const previewHeading=useRef<HTMLHeadingElement>(null),receiptHeading=useRef<HTMLHeadingElement>(null),applyButton=useRef<HTMLButtonElement>(null);
  const busy=operation!==null;
  const expired=!!preview && !receipt && Date.parse(preview.expiresAt)<=now;
  const applicable=!!preview && !receipt && !preview.result && !preview.plan.issues.length && !uncertain && !stale && !expired && choicesReady && !loading;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;write.current?.abort();};},[]);
  useEffect(()=>{
    const c=new AbortController();
    queueMicrotask(()=>{if(!c.signal.aborted){setLoading(true);setChoicesReady(false);setChoiceError("");}});
    masterRequest<unknown>(api+"read","GET",undefined,c.signal).then(raw=>{
      const value=choicesSchema.parse(raw);
      if(!c.signal.aborted){setChoices(value);setChoicesReady(true);}
    }).catch(e=>{
      if(!c.signal.aborted){setChoicesReady(false);setChoiceError(message(e));
        if(e instanceof ApiRequestError && [401,403].includes(e.status)){setPreview(null);setReceipt(null);setConfirm(false);}
      }
    }).finally(()=>{if(!c.signal.aborted)setLoading(false);});
    return()=>c.abort();
  },[refresh]);
  useEffect(()=>{
    if(!preview||receipt)return;
    const update=()=>{if(mounted.current&&document.visibilityState!=="hidden")setNow(Date.now());};
    queueMicrotask(update);
    const timer=window.setTimeout(update,Math.min(2147483647,Math.max(0,Date.parse(preview.expiresAt)-Date.now()+1)));
    window.addEventListener("focus",update);window.addEventListener("online",update);document.addEventListener("visibilitychange",update);
    return()=>{window.clearTimeout(timer);window.removeEventListener("focus",update);window.removeEventListener("online",update);document.removeEventListener("visibilitychange",update);};
  },[preview,receipt]);
  function begin(next: "preview"|"commit"|"check") {
    if(lock.current)return null;
    lock.current=true;setOperation(next);setError("");setNotice("");const c=new AbortController();write.current=c;return c;
  }
  function finish(c:AbortController) {
    if(write.current===c){lock.current=false;write.current=null;if(mounted.current)setOperation(null);}
  }
  function reloadChoices() {
    if(lock.current)return;
    setChoicesReady(false);setLoading(true);setChoiceError("");setRefresh(value=>value+1);
  }
  const plan = preview?.plan;
  const entries = plan
    ? [
        ...plan.classes.map((c) => ({
          id: c.id,
          source: c.sourceId,
          label: "Kelas " + c.name,
          detail: `Tingkat ${c.grade}${c.parallel} · Jumlah siswa baru: 0`,
        })),
        ...plan.schedules.map((s) => ({
          id: s.id,
          source: s.sourceId,
          label: `KBM · ${s.teacher ?? "Guru tidak aktif"} · ${s.className ?? "Kelas tidak tersedia"}`,
          detail: `${s.subject ?? "Mata pelajaran tidak tersedia"} · ${["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][s.dayIndex]} ${s.timeStart}–${s.timeEnd} · ${s.scheduledJtm} JTM · ID kelas baru: ${s.classId ?? "Tidak tersedia"}`,
        })),
      ]
    : [];
  const periodName = (id: string | null | undefined) =>
    choices.periods.find((p) => p.id === id)?.name ?? id ?? "Tidak tersedia";

  async function makePreview(data:Record<string,unknown>) {
    const request=preparationRequest.parse(data);
    if(!choicesReady||uncertain)throw Error("Muat ulang pilihan atau periksa hasil pratinjau sebelumnya terlebih dahulu.");
    const c=begin("preview");if(!c)throw Error("Tunggu sampai permintaan sebelumnya selesai.");
    if(!receipt){setPreview(null);setConfirm(false);setAccepted(false);}
    try {
      const value=readPreparationPreview(request,await masterRequest<unknown>(api+"preview","POST",request,c.signal));
      const source=choices.periods.find(period=>period.id.toLowerCase()===request.sourceId.toLowerCase());
      const target=choices.periods.find(period=>period.id.toLowerCase()===request.targetId.toLowerCase());
      if(value.plan.sourceDate!==source?.end||value.plan.validFrom!==target?.start||value.plan.validTo!==target?.end)
        throw Error("Rentang semester berubah. Muat ulang pilihan sebelum membuat pratinjau baru.");
      if(!mounted.current)return;
      setPreview(value);setReceipt(null);setPage(1);setAccepted(false);setConfirm(false);setUncertain(false);setStale(false);setNow(Date.now());
      revealHeading(previewHeading);
    }catch(e){if(mounted.current&&!c.signal.aborted)setError(message(e));throw new Error(message(e),{cause:e});}
    finally{finish(c);}
  }
  async function commit() {
    if(!confirm||!accepted||!applicable||!preview)return;
    if(Date.parse(preview.expiresAt)<=Date.now()){setNow(Date.now());setAccepted(false);return;}
    const reviewed=preview,c=begin("commit");if(!c)return;
    try {
      const result=readPreparationReceipt(reviewed,await masterRequest<unknown>(api+"commit","POST",{previewId:reviewed.previewId},c.signal));
      if(!mounted.current)return;
      setReceipt(result);setPreview({...reviewed,result});setConfirm(false);setAccepted(false);setChoicesReady(false);setLoading(true);setRefresh(v=>v+1);
      revealHeading(receiptHeading);
    }catch(e){
      if(!mounted.current)return;
      setError(message(e));
      if(e instanceof ApiRequestError && e.status===409){setStale(true);setConfirm(false);setAccepted(false);revealHeading(previewHeading);}
      else if(!(e instanceof ApiRequestError)||e.status>=500||e.status===0)setUncertain(true);
    }finally{finish(c);}
  }
  async function check() {
    if(!preview)return;
    const reviewed=preview,c=begin("check");if(!c)return;
    try {
      const value=readPreparationStatus(reviewed,await masterRequest<unknown>(api+"read?previewId="+reviewed.previewId,"GET",undefined,c.signal));
      if(!mounted.current)return;
      // Validate the entire status and receipt before changing any trusted state.
      const result=value.result?readPreparationReceipt(reviewed,value.result):null;
      setPreview(value);setUncertain(false);setAccepted(false);setNow(Date.now());
      if(result){setReceipt(result);setConfirm(false);setChoicesReady(false);setLoading(true);setRefresh(v=>v+1);revealHeading(receiptHeading);}
      else setNotice(stale||Date.parse(value.expiresAt)<=Date.now()?"Belum ada hasil penerapan. Pratinjau tidak dapat dipakai lagi; buat pratinjau baru setelah memeriksa pilihan.":"Belum ada hasil penerapan untuk ID ini. Periksa dan setujui kembali jika ingin menerapkan pratinjau yang sama; server mencegah duplikasi.");
    }catch(e){
      if(!mounted.current)return;
      setError(message(e));setAccepted(false);
      if(e instanceof ApiRequestError && e.status===404){setStale(true);setUncertain(false);setConfirm(false);revealHeading(previewHeading);}
      else if(uncertain||!(e instanceof ApiRequestError))setUncertain(true);
    }finally{finish(c);}
  }
  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <header className="space-y-2 rounded-2xl border bg-accent/40 p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">
          Konfigurasi semester berikutnya
        </p>
        <h1 className="text-2xl font-bold">Persiapan semester baru</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Tinjau salinan konfigurasi sebelum diterapkan. Semester tujuan tidak
          diaktifkan otomatis.
        </p>
      </header>
      <ErrorFeedback message={error} />
      {notice&&<p role="status" className="rounded-xl border p-4 text-sm leading-6">{notice}</p>}
      {uncertain&&<p className="rounded-xl border p-4 text-sm leading-6">Status penerapan belum dapat dipastikan. Periksa hasil pratinjau yang sama sebelum membuat atau menerapkan rencana lain.</p>}
      <section className={panel}>
        <h2 className="text-lg font-semibold">Batas penyalinan</h2>
        <p className="text-sm leading-6">Hanya kelas dan jadwal KBM yang dipilih. Jumlah siswa baru menjadi 0; semester tujuan tetap belum aktif.</p>
        <details className="rounded-xl border p-3 text-sm leading-6">
          <summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-ring">Baca aturan dan data yang tidak disalin</summary>
          <div className="mt-3 space-y-3">        <p className="text-sm leading-6">
          Hanya kelas dan jadwal KBM yang dipilih. Jadwal memakai konfigurasi
          aktif pada hari terakhir semester sumber dan rentang penuh semester
          tujuan. Jumlah siswa kelas baru direset ke 0; lengkapi di Data Master
          sebelum digunakan. Guru, mata pelajaran, menit per JP dan kebijakan
          kelas harus tetap sesuai.
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          Kehadiran, jurnal, konfirmasi, BAP, ledger, slip, hak libur dan
          koreksi tidak disalin. Piket, upacara, ujian, acara, kalender, tarif
          serta tunjangan disiapkan melalui modul masing-masing. Target yang
          sudah berisi kelas, jadwal, tugas, ujian atau kegiatan ditolak.
        </p>
          </div>
        </details>
      </section>
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Pilih konfigurasi</h2>
          <Button
            variant="outline"
            disabled={loading || busy}
            onClick={reloadChoices}
          >
            Muat ulang pilihan
          </Button>
        </div>
        <ErrorFeedback message={choiceError}/>
        {loading && <p role="status">Memuat semester…</p>}
        {!loading && choicesReady && choices.periods.length < 2 && (
          <p role="status">
            Siapkan minimal dua semester di Data Master. Tujuan harus semester
            berikutnya yang belum aktif dan mulai setelah hari ini WIB.
          </p>
        )}
        <DataForm
          label="Buat pratinjau"
          submitLabel="Periksa rencana"
          successMessage="Pratinjau siap ditinjau. Periksa temuan sebelum menerapkan."
          busy={loading || busy || uncertain || !choicesReady || choices.periods.length<2}
          locked={!choicesReady || choices.periods.length<2}
          fields={[
            {
              key: "sourceId",
              label: "Semester sumber",
              type: "select",
              options: choices.periods.map((p) => ({
                id: p.id,
                name: `${p.name} (${p.start}–${p.end})`,
              })),
            },
            {
              key: "targetId",
              label: "Semester tujuan",
              type: "select",
              options: choices.periods
                .filter((p) => !p.active)
                .map((p) => ({
                  id: p.id,
                  name: `${p.name} (${p.start}–${p.end})`,
                })),
            },
            {
              key: "configuration",
              label: "Konfigurasi yang disalin",
              type: "select",
              options: [
                { id: "classes", name: "Kelas saja" },
                { id: "classes_and_schedules", name: "Kelas dan jadwal KBM" },
              ],
            },
            {
              key: "reason",
              label: "Alasan persiapan (5–500 karakter)",
              type: "textarea",
            },
          ]}
          onSave={makePreview}
        />
      </section>
      {preview && plan && (
        <section className={panel}>
          <h2 ref={previewHeading} tabIndex={-1} className="scroll-mt-24 rounded text-lg font-semibold focus-visible:outline-2 focus-visible:outline-ring">Pratinjau konfigurasi</h2>
          <p className="text-sm">
            {periodName(plan.sourceId)} → {periodName(plan.targetId)}
          </p>
          <p className="text-sm">
            Konfigurasi sumber per {plan.sourceDate ?? "—"} · Berlaku baru{" "}
            {plan.validFrom ?? "—"}–{plan.validTo ?? "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            ID pratinjau: {preview.previewId} · Kedaluwarsa{" "}
            {new Date(preview.expiresAt).toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
            })}{" "}
            WIB
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="rounded-xl border p-4">
              <strong>{plan.classes.length}</strong> kelas baru
            </p>
            <p className="rounded-xl border p-4">
              <strong>{plan.schedules.length}</strong> jadwal KBM baru
            </p>
          </div>
          {plan.issues.length > 0 ? (
            <div role="alert" className="form-feedback-error">
              <p className="font-semibold">Rencana belum dapat diterapkan</p>
              <ul className="list-inside list-disc space-y-2 text-sm">
                {plan.issues.map((i) => (
                  <li key={i}>
                    {Object.hasOwn(issueLabels,i)?issueLabels[i]:"Periksa sumber dan tujuan."}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm">
              Pemeriksaan awal lulus. Server akan memeriksa ulang perubahan
              sumber dan seluruh constraint saat penerapan.
            </p>
          )}
          {(expired||stale)&&!receipt&&<p role="alert" className="form-feedback-error">{expired?"Pratinjau kedaluwarsa.":"Pratinjau berubah atau tidak tersedia."} Periksa hasil jika sebelumnya menerapkan, lalu buat pratinjau baru untuk melanjutkan.</p>}
          {!entries.length&&<p role="status" className="text-sm">Tidak ada konfigurasi yang dapat disalin dari pilihan ini. Periksa temuan dan semester sumber.</p>}
          <TableRegion label="Pemetaan konfigurasi semester">
            <table className="w-full min-w-[44rem] table-fixed text-left text-sm">
              <thead>
                <tr>
                  {["Konfigurasi", "ID sumber", "ID tujuan baru"].map((t) => (
                    <th key={t} className="p-3">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.slice((page - 1) * 25, page * 25).map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="min-w-48 p-3">
                      <strong>{r.label}</strong>
                      <p className="mt-1 text-muted-foreground">{r.detail}</p>
                    </td>
                    <td className="p-3">{r.source}</td>
                    <td className="p-3">{r.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRegion>
          <Pagination
            page={page}
            pageSize={25}
            total={entries.length}
            label="Halaman pemetaan konfigurasi"
            onPageChange={next=>{setPage(next);previewHeading.current?.focus({preventScroll:true});previewHeading.current?.scrollIntoView({block:"start"});}}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              ref={applyButton}
              disabled={busy || !applicable}
              onClick={() => {
                if(preview&&Date.parse(preview.expiresAt)<=Date.now()){setNow(Date.now());return;}
                setAccepted(false);
                setConfirm(true);
              }}
            >
              Terapkan konfigurasi
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void check()}
            >
              Periksa hasil pratinjau
            </Button>
          </div>
        </section>
      )}
      {receipt && (
        <section className={panel} role="status">
          <h2 ref={receiptHeading} tabIndex={-1} className="scroll-mt-24 rounded font-semibold focus-visible:outline-2 focus-visible:outline-ring">Konfigurasi berhasil diterapkan</h2>
          <p>
            {receipt.classes} kelas dan {receipt.schedules} jadwal KBM dibuat.
            ID hasil: {receipt.previewId}.
          </p>
          <p className="text-sm">
            Semester tujuan tetap belum aktif. Lengkapi jumlah siswa, periksa
            jadwal serta konfigurasi lain sebelum mengaktifkannya di Data
            Master.
          </p>
        </section>
      )}
      <section className={panel}>
        <h2 className="text-lg font-semibold">Riwayat penerapan terbaru</h2>
        {!choicesReady ? (
          <p className="text-sm text-muted-foreground">Riwayat belum dimuat.</p>
        ) : !choices.history.length ? (
          <p className="text-sm text-muted-foreground">
            Belum ada penerapan konfigurasi semester.
          </p>
        ) : (
          <ul className="space-y-3">
            {choices.history.map((h) => (
              <li key={h.id} className="rounded-xl border p-3 text-sm">
                <strong>{h.actor}</strong> ·{" "}
                {new Date(h.at).toLocaleString("id-ID", {
                  timeZone: "Asia/Jakarta",
                })}{" "}
                WIB
                <p>
                  {h.result.classes} kelas · {h.result.schedules} jadwal ·
                  Tujuan: {periodName(h.result.targetId)}
                </p>
                <p>{h.reason}</p>
                <p className="text-muted-foreground">Bukti penerapan: {h.id}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <FormDialog
        title="Terapkan persiapan semester?"
        trigger=""
        description="Penerapan membuat konfigurasi baru dalam satu transaksi. Periksa sumber, tujuan, jumlah, serta rentang sebelum menyetujui."
        open={confirm&&!!preview}
        onOpenChange={open=>{if(!busy){setConfirm(open);if(!open){setAccepted(false);requestAnimationFrame(()=>applyButton.current?.focus());}}}}
        busy={busy}
        error={error}
      >
        <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
        {notice&&<p role="status" className="rounded-xl border p-3 text-sm leading-6">{notice}</p>}
        <p>
          {periodName(plan?.sourceId)} → {periodName(plan?.targetId)}
        </p>
        <p>
          {plan?.classes.length} kelas · {plan?.schedules.length} jadwal KBM ·{" "}
          {plan?.validFrom}–{plan?.validTo}
        </p>
        {(expired||stale)&&<p role="alert" className="text-sm text-destructive">Pratinjau tidak dapat diterapkan. Tutup dan buat pratinjau baru; periksa hasil terlebih dahulu jika sebelumnya menerapkan.</p>}
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0"
            checked={accepted}
            disabled={busy || !applicable}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          Saya telah memeriksa pratinjau dan memahami bahwa jumlah siswa perlu
          dilengkapi serta semester tidak diaktifkan otomatis.
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={busy || !applicable || !accepted}
            onClick={() => void commit()}
          >
            {busy ? "Memproses…" : "Ya, terapkan konfigurasi"}
          </Button>
          {uncertain && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void check()}
            >
              Periksa hasil pratinjau
            </Button>
          )}
        </div>
        </div>
      </FormDialog>
    </div>
  );
}
