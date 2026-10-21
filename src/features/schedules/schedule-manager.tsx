"use client";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { ActionIcon } from "@/components/ui/action-icon";
import { ChevronDown } from "lucide-react";

import { TableRegion } from "@/components/ui/table-region";
import {
  ManagedDialog,
  requestDialogClose,
} from "@/components/ui/managed-dialog";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { masterRequest } from "@/features/masters/api";
import {
  days,
  endTime, createSchedule, editSchedule, conflictSchedule, bulkSchedule, scheduleFilters,
  type ScheduleRow,
  type ScheduleList,
} from "@/lib/schedules/schemas";
import { wibDate } from "@/lib/calendar/schemas";
import type { MasterList } from "@/lib/masters/schemas";
import type { z } from "zod";
import { ApiRequestError, serverFieldErrors } from "@/lib/feedback/api-error";
import { applyFieldErrors } from "@/lib/feedback/form-fields";
import { validateAccount as validateInput } from "@/lib/accounts/client-validation";
import { EmptyState } from "@/components/feedback/feature-state";
import { readScheduleResponse, scheduleListSchema, recapSchema, dailySchema, collisionSchema, bulkPreviewSchema, historySchema, canChangeSchedule } from "@/lib/schedules/contracts";
import { SchedulePicker as Picker } from "./schedule-picker";
function Editor({
  row,
  onSaved,
  onBusy,
}: {
  row: ScheduleRow | null;
  onSaved: () => void;
  onBusy: (v: boolean) => void;
}) {
  const pending = useRef(false);
  const checkedDuration = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current=true; return () => { mounted.current=false; }; }, []);
  const [period, setPeriod] = useState(row?.academicPeriodId ?? ""),
    [user, setUser] = useState(row?.userId ?? ""),
    [subject, setSubject] = useState(row?.subjectId ?? ""),
    [klass, setKlass] = useState(row?.classId ?? ""),
    [from, setFrom] = useState(
      row && row.validFrom > wibDate() ? row.validFrom : wibDate(),
    ),
    [to, setTo] = useState(row?.validTo ?? ""),
    [start, setStart] = useState(row?.timeStart ?? "07:30"),
    [jtm, setJtm] = useState(row?.scheduledJtm ?? "1"),
    [rest, setRest] = useState(row?.restMinutes ?? 0),
    [minutes, setMinutes] = useState(row?.minutesPerJtm ?? 40),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [minutesError, setMinutesError] = useState(""),
    [collision, setCollision] = useState<{
      conflicts: {
        id: string;
        teacher: boolean;
        class: boolean;
        dayIndex: number;
        timeStart: string;
        timeEnd: string;
        validFrom: string;
        validTo: string;
      }[];
      timeEnd: string;
      minutesPerJtm: number;
    } | null>(null);
  useEffect(() => {
    let active = true;
    masterRequest<MasterList>("/api/settings/school")
      .then((v) => {
        const value=Number(v.items?.[0]?.minutesPerJtm);
        if(!Number.isInteger(value)||value<1||value>180) throw new Error("Pengaturan durasi sekolah belum dapat dibaca.");
        if(active && !checkedDuration.current)setMinutes(value);
      })
      .catch(e => {if(active && !checkedDuration.current)setMinutesError(e instanceof Error?e.message:"Pengaturan durasi sekolah belum dapat dimuat.");});
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current=true;
    const form = event.currentTarget,
      values = new FormData(form),
      intent =
        (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ??
        "save",
      data = {
        academicPeriodId: period,
        userId: user,
        subjectId: subject,
        classId: klass,
        dayIndex: Number(values.get("dayIndex")),
        timeStart: start,
        scheduledJtm: jtm,
        restMinutes: rest,
        validFrom: from,
        validTo: to,
      };
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      if (intent === "check") {
        setCollision(null);
        const payload=validateInput(conflictSchedule,{...(row?{id:row.id}:{}),data});
        const v=readScheduleResponse(collisionSchema,await masterRequest<unknown>("/api/schedules/conflicts","POST",payload));
        if(mounted.current){checkedDuration.current=true;setCollision(v);setMinutes(v.minutesPerJtm);setMinutesError("");}
      } else {
        await masterRequest(
          "/api/schedules" + (row ? "/" + row.id : ""),
          row ? "PATCH" : "POST",
          row ? validateInput(editSchedule,{data,reason:values.get("reason"),version:row.version}) : validateInput(createSchedule,{data,reason:values.get("reason")}),
        );
        if(mounted.current) onSaved();
      }
    } catch (e) {
      if(mounted.current){applyFieldErrors(form,serverFieldErrors(e));setError(e instanceof Error ? e.message : "Jadwal belum dapat disimpan.");}
    } finally {
      pending.current=false;
      if(mounted.current)setBusy(false);
      onBusy(false);
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} onChangeCapture={() => setCollision(null)} aria-busy={busy} className="min-w-0 space-y-4">
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <Picker
          target="academic-periods"
          label="Semester"
          value={period}
          disabled={Boolean(row)}
          selectedLabel={row?.periodLabel ?? ""}
          onChange={(id, item) => {
            setPeriod(id);
            setKlass("");
            if (item) {
              setFrom(
                String(item.raw.dateStart) > wibDate()
                  ? String(item.raw.dateStart)
                  : wibDate(),
              );
              setTo(String(item.raw.dateEnd));
            }
          }}
        />
        <Picker
          target="users"
          label="Guru / pengajar aktif"
          selectedLabel={row?.teacherName ?? ""}
          value={user}
          onChange={(id) => setUser(id)}
        />
        <Picker
          target="subjects"
          label="Mata pelajaran"
          selectedLabel={row?.subjectName ?? ""}
          value={subject}
          onChange={(id) => setSubject(id)}
        />
        <Picker
          target="classes"
          label="Kelas pada semester terpilih"
          key={period}
          selectedLabel={row?.className ?? ""}
          value={klass}
          parentId={period}
          onChange={(id) => setKlass(id)}
        />
        </div>
        <label className="block space-y-2 text-sm">
          <span>Hari</span>
          <select
            name="dayIndex"
            aria-label="Hari"
            defaultValue={row?.dayIndex ?? 1}
            className="min-h-11 w-full min-w-0 rounded border bg-background px-3"
          >
            {days.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm">
            <span>Jam mulai (WIB)</span>
            <input
              type="time"
              required
              name="timeStart"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setCollision(null);
              }}
              className="min-h-11 w-full min-w-0 rounded border bg-background px-3"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>JTM (titik desimal, maksimal 4 tempat)</span>
            <input
              required
              inputMode="decimal"
              name="scheduledJtm"
              value={jtm}
              maxLength={13}
              onChange={(e) => {
                setJtm(e.target.value);
                setCollision(null);
              }}
              className="min-h-11 w-full min-w-0 rounded border bg-background px-3"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Istirahat (menit)</span>
            <input
              type="number"
              min={0}
              max={600}
              step={1}
              required
              name="restMinutes"
              value={rest}
              onChange={(e) => {
                setRest(Number(e.target.value));
                setCollision(null);
              }}
              className="min-h-11 w-full min-w-0 rounded border bg-background px-3"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Mulai berlaku</span>
            <input
              type="date"
              min={wibDate()}
              required
              name="validFrom"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setCollision(null);
              }}
              className="min-h-11 w-full min-w-0 rounded border bg-background px-3"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Akhir berlaku (inklusif)</span>
            <input
              type="date"
              required
              name="validTo"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setCollision(null);
              }}
              className="min-h-11 w-full min-w-0 rounded border bg-background px-3"
            />
          </label>
        </div>
        <p className="text-sm leading-7">
          Pratinjau akhir:{" "}
          <strong>
            {endTime(start, jtm, minutes, rest) ??
              "Durasi belum valid / melewati tengah malam"}
          </strong>{" "}
          WIB · {minutes} menit per JTM. Durasi akhir mengikuti pengaturan sekolah saat jadwal disimpan.
        </p>
        {minutesError && <p role="status" className="rounded-lg border bg-muted p-3 text-sm leading-6">Perkiraan durasi memakai nilai sebelumnya. {minutesError} Gunakan pemeriksaan bentrok untuk membaca durasi terbaru; server tetap memeriksa saat simpan.</p>}
        {row && row.validFrom < wibDate() && (
          <p className="text-sm leading-7">
            Jadwal sudah berjalan. Tanggal mulai baru menjadi batas revisi:
            versi lama ditutup sehari sebelumnya dan versi pengganti dibuat
            tanpa menulis ulang riwayat.
          </p>
        )}
        <label className="block space-y-2 text-sm">
          <span>Alasan perubahan</span>
          <input
            name="reason"
            required
            minLength={5}
            maxLength={500}
            className="min-h-11 w-full min-w-0 rounded border bg-background px-3"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            name="intent"
            value="check"
            variant="outline"
            formNoValidate
          >
            <ActionIcon action="preview" />
            Periksa bentrok jadwal
          </Button>
          <Button type="submit" name="intent" value="save">
            <ActionIcon action="save" />
            {busy ? "Memproses…" : "Simpan jadwal"}
          </Button>
        </div>
      </fieldset>
      {collision && (
        <div role="status" className="space-y-2 rounded border p-4 text-sm">
          <p>
            {collision.conflicts.length
              ? collision.conflicts.length + " bentrok ditemukan."
              : "Tidak ada bentrok pada pemeriksaan ini."}{" "}
            Hasil pemeriksaan ini belum menyimpan jadwal. Kelayakan diperiksa
            ulang saat simpan.
          </p>
          {collision.conflicts.map((v) => (
            <p key={v.id}>
              {days[v.dayIndex]} {v.timeStart}–{v.timeEnd}, {v.validFrom}–
              {v.validTo}: {v.teacher ? "guru " : ""}
              {v.class ? "kelas" : ""}
            </p>
          ))}
        </div>
      )}
      {error && <ErrorFeedback message={error} />}
    </form>
  );
}
const initial = {
  academicYearId: "",
  q: "",
  academicPeriodId: "",
  userId: "",
  subjectId: "",
  classId: "",
  dayIndex: "",
  validFrom: "",
  validTo: "",
  state: "active",
};
type BulkPreview = {
  previewId: string;
  expiresAt: string;
  count: number;
  items: {
    id: string;
    teacherName: string;
    className: string;
    validFrom: string;
    validTo: string;
    stopFrom: string;
    operation: string;
  }[];
};
export function ScheduleManager({ admin }: { admin: boolean }) {
  const [filters, setFilters] = useState(initial),
    [page, setPage] = useState(1),
    [list, setList] = useState<ScheduleList | null>(null),
    [recap, setRecap] = useState<{
      rowCount: number;
      totalScheduledJtm: string;
    } | null>(null),
    [selected, setSelected] = useState<Record<string, ScheduleRow>>({}),
    [date, setDate] = useState(wibDate()),
    [daily, setDaily] = useState<{
      items: ScheduleRow[];
      scheduledCount: number;
      dayContext: z.infer<typeof dailySchema>["dayContext"];
    } | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<ScheduleRow | null>(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [targets, setTargets] = useState<ScheduleRow[] | null>(null),
    [preview, setPreview] = useState<BulkPreview | null>(null),
    [history, setHistory] = useState<
      | {
          actor_name: string | null;
          reason: string | null;
          created_at: string;
          new_data: unknown;
        }[]
      | null
    >(null);
  const operation=useRef(false), mounted=useRef(false);
  const historyController=useRef<AbortController|null>(null);
  const [listError,setListError]=useState(""),[recapError,setRecapError]=useState("");
  const [dailyError,setDailyError]=useState(""),[dailyLoading,setDailyLoading]=useState(true),[dailyRevision,setDailyRevision]=useState(0);
  const [historyId,setHistoryId]=useState<string|null>(null),[historyError,setHistoryError]=useState(""),[historyLoading,setHistoryLoading]=useState(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;historyController.current?.abort();};},[]);
  function editorBusy(value:boolean){operation.current=value;if(mounted.current)setBusy(value);}
  const [printRows, setPrintRows] = useState<ScheduleRow[] | null>(null);
  useEffect(() => {
    if (!printRows) return;
    const clear = () => setPrintRows(null);
    window.addEventListener("afterprint",clear,{once:true});
    const frame = requestAnimationFrame(() => window.print());
    return () => {cancelAnimationFrame(frame);window.removeEventListener("afterprint",clear);};
  }, [printRows]);
  async function printAll() {
    if (operation.current || loading || !list) return;
    operation.current=true;
    setBusy(true);
    setError("");
    setPrintRows(null);
    try {
      const rows: ScheduleRow[] = [];
      let total = -1;
      for (let page = 1; total < 0 || rows.length < total; page++) {
        if(page>100000)throw new Error("Hasil cetak terlalu banyak. Persempit filter lalu coba kembali.");
        const result = readScheduleResponse(scheduleListSchema,await masterRequest<unknown>(
          (admin ? "/api/schedules" : "/api/schedules/mine") +
            "?" +
            new URLSearchParams({
              ...filters,
              page: String(page),
              pageSize: "100",
            }),
        ));
        if(!mounted.current)return;
        if (
          (total >= 0 && total !== result.total) ||
          (!result.items.length && rows.length < result.total)
        )
          throw new Error(
            "Data berubah saat menyiapkan cetak. Muat ulang dan coba lagi.",
          );
        total = result.total;
        rows.push(...result.items);
      }
      if (new Set(rows.map((r) => r.id)).size !== total)
        throw new Error(
          "Data berubah saat menyiapkan cetak. Muat ulang dan coba lagi.",
        );
      if(!rows.length){setMessage("Tidak ada jadwal untuk dicetak pada filter ini.");return;}
      setPrintRows(rows);
    } catch (e) {
      if(mounted.current)setError(e instanceof Error ? e.message : "Cetak belum tersedia.");
    } finally {
      operation.current=false;
      if(mounted.current)setBusy(false);
    }
  }
  const editor = useRef<HTMLDialogElement>(null),
    stop = useRef<HTMLDialogElement>(null),
    historyDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    const c = new AbortController(),
      params = new URLSearchParams({
        ...filters,
        page: String(page),
        pageSize: "20",
      });
    async function load() {
      setLoading(true); setListError(""); setRecap(null); setRecapError("");
      try {
        const payload=validateInput(scheduleFilters,Object.fromEntries(params));
        const [rows, summary] = await Promise.allSettled([
          masterRequest<unknown>("/api/schedules"+(admin?"":"/mine")+"?"+new URLSearchParams({...filters,page:String(payload.page),pageSize:"20"}),"GET",undefined,c.signal),
          admin?masterRequest<unknown>("/api/schedules/recaps?"+params,"GET",undefined,c.signal):Promise.resolve(null),
        ]);
        if(!active)return;
        if(rows.status==="rejected")throw rows.reason;
        const result=readScheduleResponse(scheduleListSchema,rows.value);
        const lastPage=Math.max(1,Math.ceil(result.total/20));
        if(page>lastPage){setPage(lastPage);return;}
        setList(result);
        setSelected(previous=>Object.fromEntries(Object.entries(previous).filter(([id,row])=>{
          const current=result.items.find(item=>item.id===id);
          return !current || (current.version===row.version && canChangeSchedule(current,wibDate()));
        })));
        if(admin){
          try { if(summary.status==="rejected")throw summary.reason;setRecap(readScheduleResponse(recapSchema,summary.value)); }
          catch(e){setRecapError(e instanceof Error?e.message:"Rekap belum dapat dimuat.");}
        }
      } catch(e){if(active){setList(null);setListError(e instanceof Error?e.message:"Jadwal belum dapat dimuat.");}}
      finally{if(active)setLoading(false);}
    }
    void load();
    return () => {
      active = false;
      c.abort();
    };
  }, [filters, page, revision, admin]);
  useEffect(() => {
    let active=true;const c=new AbortController();
    async function load(){
      setDailyLoading(true);setDailyError("");setDaily(null);
      try{
        const value=readScheduleResponse(dailySchema,await masterRequest<unknown>("/api/schedules/today?date="+date,"GET",undefined,c.signal));
        if(active)setDaily(value);
      }catch(e){if(active)setDailyError(e instanceof Error?e.message:"Jadwal harian belum dapat dimuat.");}
      finally{if(active)setDailyLoading(false);}
    }
    void load();return()=>{active=false;c.abort();};
  },[date,revision,dailyRevision]);
  useEffect(() => {
    if (open) editor.current?.showModal();
  }, [open]);
  useEffect(() => {
    if (targets) stop.current?.showModal();
  }, [targets]);
  useEffect(() => {
    if (historyId && !historyDialog.current?.open) historyDialog.current?.showModal();
  }, [historyId]);
  function filter(key: string, value: string) {
    setFilters((v) => ({ ...v, [key]: value }));
    setPage(1);
    setSelected({});
    setPrintRows(null);
  }
  function saved() {
    editor.current?.close();
    setRevision((v) => v + 1);
    setSelected({});
    setPrintRows(null);
    setMessage("Jadwal tersimpan dan riwayat perubahan telah dicatat.");
  }
  async function stopPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targets || operation.current) return;
    operation.current=true;
    setBusy(true);
    setError("");
    const form=event.currentTarget;
    const v = new FormData(form);
    try {
      setPreview(
        readScheduleResponse(bulkPreviewSchema,await masterRequest<unknown>(
          "/api/schedules/bulk-delete/preview",
          "POST",
          validateInput(bulkSchedule,{
            items: targets.map((r) => ({ id: r.id, version: r.version })),
            stopFrom: v.get("stopFrom"),reason: v.get("reason"),
          }),
        )),
      );
    } catch (e) {
      if(mounted.current){applyFieldErrors(form,serverFieldErrors(e));setError(e instanceof Error ? e.message : "Pratinjau belum tersedia.");}
    } finally {
      operation.current=false;
      if(mounted.current)setBusy(false);
    }
  }
  async function commit() {
    if (!preview || operation.current) return;
    operation.current=true;
    setBusy(true);
    setError("");
    try {
      await masterRequest("/api/schedules/bulk-delete", "POST", {
        previewId: preview.previewId,
      });
      stop.current?.close();
      setSelected({});
      setRevision((v) => v + 1);
      setMessage(
        "Jadwal dihentikan sesuai batas tanggal. Riwayat tidak dihapus.",
      );
    } catch (e) {
      if(e instanceof ApiRequestError && ["CALENDAR_PREVIEW_INVALID","CALENDAR_PREVIEW_STALE","VERSION_CONFLICT"].includes(e.code)) setPreview(null);
      setError(e instanceof Error ? e.message : "Perubahan gagal.");
    } finally {
      operation.current=false;
      if(mounted.current)setBusy(false);
    }
  }
  async function showHistory(id: string) {
    historyController.current?.abort();
    const controller=new AbortController();historyController.current=controller;
    setHistoryId(id);setHistory(null);setHistoryError("");setHistoryLoading(true);
    try{
      const value=readScheduleResponse(historySchema,await masterRequest<unknown>("/api/schedules/"+id+"/history","GET",undefined,controller.signal));
      if(mounted.current&&!controller.signal.aborted)setHistory(value);
    }catch(e){if(mounted.current&&!controller.signal.aborted)setHistoryError(e instanceof Error?e.message:"Riwayat belum dapat dimuat.");}
    finally{if(mounted.current&&!controller.signal.aborted)setHistoryLoading(false);}
  }
  function rowLabel(r: ScheduleRow) {
    return r.teacherName + " · " + r.className + " · " + r.subjectName;
  }
  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      {printRows && (
        <>
          <style>{`@media screen { #schedule-print { display:none; } } @media print { body * { visibility:hidden; } #schedule-print, #schedule-print * { visibility:visible; } #schedule-print { position:absolute; left:0; top:0; width:100%; background:white; color:black; padding:12mm; } #schedule-print table { width:100%; border-collapse:collapse; font-size:10pt; } #schedule-print td, #schedule-print th { border:1px solid #999; padding:5px; } #schedule-print tr { break-inside:avoid; } }`}</style>
          <section id="schedule-print">
            <h1>Rekap jadwal KBM</h1>
            <p>
              Seluruh {printRows.length} baris sesuai filter saat laporan
              dibuat. Jadwal, bukan realisasi presensi atau honorarium.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Guru / periode</th>
                  <th>Kelas / mapel</th>
                  <th>Hari / jam WIB</th>
                  <th>Masa berlaku / JTM</th>
                </tr>
              </thead>
              <tbody>
                {printRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.teacherName}
                      <br />
                      {r.periodLabel}
                    </td>
                    <td>
                      {r.className}
                      <br />
                      {r.subjectName}
                    </td>
                    <td>
                      {days[r.dayIndex]}
                      <br />
                      {r.timeStart}–{r.timeEnd}
                    </td>
                    <td>
                      {r.validFrom}–{r.validTo}
                      <br />
                      {r.scheduledJtm} JTM · {r.state}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {admin ? "Administrasi" : "Ruang guru"}
        </p>
        <h1 className="mt-2 text-3xl font-bold">Jadwal KBM</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          Kelola jadwal mingguan, rentang berlaku, dan penugasan sesuai
          kalender. Jadwal bukan konfirmasi, jurnal, realisasi JTM atau hak
          honorarium.
        </p>
      </header>
      <details className="group rounded-2xl border bg-card">
        <summary className="min-h-12 cursor-pointer list-none rounded-2xl p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <h2 className="flex items-center justify-between gap-x-3 text-xl font-bold">
            Jadwal pribadi pada tanggal
            <ChevronDown
              aria-hidden="true"
              className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          </h2>
        </summary>
        <div className="space-y-4 border-t p-5">
          <label className="block max-w-xs space-y-2 text-sm">
            <span>Tanggal (WIB)</span>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) {setDate(e.target.value);setDaily(null);setDailyLoading(true);}
              }}
              className="min-h-11 w-full min-w-0 rounded border bg-background px-3"
            />
          </label>
          {dailyLoading ? <p role="status" aria-busy="true">Memuat jadwal harian…</p> : dailyError ? <div className="space-y-3"><ErrorFeedback message={dailyError}/><Button variant="outline" onClick={()=>{setDailyLoading(true);setDailyRevision(v=>v+1);}}>Coba muat jadwal harian</Button></div> : daily ? (
            <>
              <p className="text-sm">
                {daily.dayContext.isHoliday ? "Hari libur" : "Bukan hari libur"}{" "}
                · KBM {daily.dayContext.kbmEnabled ? "aktif" : "nonaktif"} ·{" "}
                {daily.scheduledCount} baris jadwal pribadi sesuai
                hari/semester.
              </p>
              {daily.items.length ? (
                daily.items.map((r) => (
                  <article key={r.id} className="rounded border p-4">
                    <strong>
                      {r.className} · {r.subjectName}
                    </strong>
                    <p className="mt-2 text-sm">
                      {r.timeStart}–{r.timeEnd} WIB · {r.scheduledJtm} JTM
                    </p>
                  </article>
                ))
              ) : (
                <p>
                  Tidak ada kegiatan KBM pribadi yang aktif pada konteks tanggal
                  ini.
                </p>
              )}
            </>
          ) : (
            <p role="status">
              Belum ada data jadwal harian.
            </p>
          )}
          <p className="text-sm leading-6 text-muted-foreground">
            Konfirmasi tersedia pada halaman Kegiatan KBM dan pengisian jurnal
            tersedia pada halaman Jurnal. Jadwal sendiri tidak otomatis
            memberikan kredit. Substitusi menyusul pada modul piket.
          </p>
        </div>
      </details>
      <section className="page-section space-y-5 rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">
            {admin ? "Pengelolaan jadwal mingguan" : "Jadwal mingguan saya"}
          </h2>
          <div className="flex w-full flex-wrap gap-3 sm:w-auto [&>button]:max-w-full">
            <Button
              variant="outline"
              disabled={busy || loading || !list}
              onClick={printAll}
            >
              <ActionIcon action="print" />
              Cetak seluruh hasil filter
            </Button>
            <Button variant="outline" disabled={busy || loading} onClick={() => setRevision((v) => v + 1)}>
              <ActionIcon action="refresh" />
              Muat ulang
            </Button>
            {admin && (
              <Button
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setError("");
                  setOpen(true);
                }}
              >
                <ActionIcon action="add" />
                Tambah jadwal
              </Button>
            )}
          </div>
        </div>
        <details className="group/filter rounded-xl border bg-background">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            <ActionIcon action="filter" />
            <span className="min-w-0 flex-1">Filter jadwal mingguan</span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform group-open/filter:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <fieldset disabled={busy} className="min-w-0 space-y-4 border-t p-4">
            <Button type="button" variant="outline" onClick={()=>{setFilters(initial);setPage(1);setSelected({});setPrintRows(null);}}>Reset filter</Button>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm">
                <span>Cari guru / kelas / mata pelajaran / periode</span>
                <input
                  value={filters.q}
                  maxLength={100}
                  onChange={(e) => filter("q", e.target.value)}
                  className="min-h-11 w-full min-w-0 rounded border bg-background px-3"
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span>Hari</span>
                <select
                  value={filters.dayIndex}
                  onChange={(e) => filter("dayIndex", e.target.value)}
                  className="min-h-11 w-full min-w-0 rounded border bg-background px-3"
                >
                  <option value="">Semua hari</option>
                  {days.map((v, i) => (
                    <option key={v} value={String(i)}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm">
                <span>Status jadwal</span>
                <select
                  value={filters.state}
                  onChange={(e) => filter("state", e.target.value)}
                  className="min-h-11 w-full min-w-0 rounded border bg-background px-3"
                >
                  <option value="active">Aktif</option>
                  <option value="closed">Ditutup pada batas tanggal</option>
                  <option value="archived">Diarsipkan</option>
                  <option value="">Semua termasuk riwayat</option>
                </select>
              </label>
              <label className="block space-y-2 text-sm">
                <span>Rentang mulai filter</span>
                <input
                  type="date"
                  value={filters.validFrom}
                  onChange={(e) => filter("validFrom", e.target.value)}
                  className="min-h-11 w-full min-w-0 rounded border bg-background px-3"
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span>Rentang akhir filter</span>
                <input
                  type="date"
                  value={filters.validTo}
                  onChange={(e) => filter("validTo", e.target.value)}
                  className="min-h-11 w-full min-w-0 rounded border bg-background px-3"
                />
              </label>
            </div>
            {admin && (
              <details className="min-w-0 space-y-4">
                <summary className="cursor-pointer text-sm">
                  Filter relasi guru, semester, mapel dan kelas
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Picker
                    target="academic-years"
                    label="Tahun ajaran"
                    optional
                    value={filters.academicYearId}
                    onChange={(id) => {
                      filter("academicYearId", id);
                      filter("academicPeriodId", "");
                      filter("classId", "");
                    }}
                  />
                  <Picker
                    target="academic-periods"
                    key={filters.academicYearId}
                    label="Semester"
                    parentId={filters.academicYearId}
                    optional
                    value={filters.academicPeriodId}
                    onChange={(id) => {
                      filter("academicPeriodId", id);
                      filter("classId", "");
                    }}
                  />
                  <Picker
                    target="users"
                    label="Guru"
                    optional
                    value={filters.userId}
                    onChange={(id) => filter("userId", id)}
                  />
                  <Picker
                    target="subjects"
                    label="Mata pelajaran"
                    optional
                    value={filters.subjectId}
                    onChange={(id) => filter("subjectId", id)}
                  />
                  <Picker
                    target="classes"
                    key={filters.academicPeriodId}
                    label="Kelas"
                    optional
                    parentId={filters.academicPeriodId}
                    value={filters.classId}
                    onChange={(id) => filter("classId", id)}
                  />
                </div>
              </details>
            )}
          </fieldset>
        </details>
        {recap && (
          <p className="text-sm">
            Rekap seluruh filter: {recap.rowCount} baris ·{" "}
            {recap.totalScheduledJtm} JTM pada baris terfilter. Ini bukan jumlah
            kehadiran, realisasi mingguan/bulanan atau honor.
          </p>
        )}
        {recapError && <div className="space-y-2"><p className="text-sm font-semibold">Rekap belum tersedia; daftar jadwal tetap dapat digunakan.</p><ErrorFeedback message={recapError}/></div>}
        {admin && Object.keys(selected).length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              {Object.keys(selected).length} dipilih, termasuk pilihan halaman
              lain.
            </p>
            <Button
              variant="outline"
              disabled={busy || loading || !list}
              onClick={() => {
                setError("");
                setTargets(Object.values(selected));
              }}
            >
              <ActionIcon action="preview" />
              Tinjau penghentian jadwal terpilih
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setSelected({})}>
              <ActionIcon action="close" />
              Kosongkan pilihan
            </Button>
          </div>
        )}
        {listError && <div className="space-y-3"><ErrorFeedback message={listError}/><Button variant="outline" disabled={loading||busy} onClick={()=>setRevision(v=>v+1)}>Coba muat daftar jadwal</Button></div>}
        {loading ? (
          <p role="status" aria-busy="true">Memuat jadwal…</p>
        ) : (
          list && (
            <>
              <p className="text-sm">
                {list.total} baris · halaman {page}
              </p>
              {list.items.length === 0 ? (
                <EmptyState title="Belum ada jadwal sesuai filter" description="Sesuaikan filter atau gunakan Reset filter untuk melihat jadwal lainnya." />
              ) : (
                <TableRegion label="Jadwal mengajar">
                  <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                    <colgroup>{admin && <col className="w-14" />}<col className="w-56"/><col className="w-40"/><col className="w-48"/>{admin && <col className="w-64"/>}</colgroup>
                    <thead>
                      <tr className="border-b">
                        {admin && <th className="p-3">Pilih</th>}
                        <th className="p-3">Guru / kelas / mapel</th>
                        <th className="p-3">Hari dan jam</th>
                        <th className="p-3">Masa berlaku / JTM</th>
                        {admin && <th className="p-3">Tindakan</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {list.items.map((r) => (
                        <tr key={r.id} className="border-b align-top">
                          {admin && (
                            <td className="p-3">
                              <input
                                type="checkbox"
                                aria-label={"Pilih " + rowLabel(r)}
                                checked={Boolean(selected[r.id])}
                                disabled={
                                  busy || !canChangeSchedule(r,wibDate()) ||
                                  (!selected[r.id] &&
                                    Object.keys(selected).length >= 100)
                                }
                                onChange={(e) =>
                                  setSelected((v) => {
                                    const next = { ...v };
                                    if (e.target.checked) next[r.id] = r;
                                    else delete next[r.id];
                                    return next;
                                  })
                                }
                              />
                            </td>
                          )}
                          <td className="p-3">
                            <strong>{r.teacherName}</strong>
                            <p>
                              {r.className} · {r.subjectName}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {r.periodLabel} ·{" "}
                              {r.state === "active"
                                ? "Aktif"
                                : r.state === "closed"
                                  ? "Ditutup"
                                  : "Diarsipkan"}
                            </p>
                          </td>
                          <td className="p-3">
                            {days[r.dayIndex]}
                            <p>
                              {r.timeStart}–{r.timeEnd} WIB
                            </p>
                            <p className="mt-1 text-xs">
                              Istirahat {r.restMinutes} menit
                            </p>
                          </td>
                          <td className="p-3">
                            {r.validFrom}–{r.validTo}
                            <p>
                              {r.scheduledJtm} JTM · {r.minutesPerJtm} menit/JTM
                            </p>
                          </td>
                          {admin && (
                            <td className="p-3">
                              <div className="flex flex-wrap gap-2">
                                {canChangeSchedule(r,wibDate()) && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={busy}
                                      onClick={() => {
                                        setEditing(r);
                                        setError("");
                                        setOpen(true);
                                      }}
                                    >
                                      <ActionIcon action="edit" />
                                      Ubah jadwal
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={busy}
                                      onClick={() => {
                                        setError("");
                                        setTargets([r]);
                                      }}
                                    >
                                      <ActionIcon action="stop" />
                                      Hentikan jadwal
                                    </Button>
                                  </>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => void showHistory(r.id)}
                                >
                                  <ActionIcon action="history" />
                                  Riwayat
                                </Button>
                                {r.replacesId && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() =>
                                      void showHistory(r.replacesId!)
                                    }
                                  >
                                    <ActionIcon action="previous" />
                                    Riwayat sebelumnya
                                  </Button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableRegion>
              )}
              <nav aria-label="Halaman daftar jadwal" className="flex flex-wrap justify-between gap-3">
                <Button
                  variant="outline"
                  disabled={busy || page === 1}
                  onClick={() => setPage((v) => v - 1)}
                >
                  <ActionIcon action="previous" />
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || page * 20 >= list.total}
                  onClick={() => setPage((v) => v + 1)}
                >
                  <ActionIcon action="next" />
                  Berikutnya
                </Button>
              </nav>
            </>
          )
        )}
      </section>
      {message && <p role="status" className="rounded-xl border bg-accent/40 p-4 text-sm leading-6">{message}</p>}
      {error && !open && !targets && <ErrorFeedback message={error} />}
      <ManagedDialog
        ref={editor}
        aria-labelledby="schedule-editor-title"
        className="m-auto max-h-[90svh] w-[min(48rem,calc(100%_-_2rem))] overflow-x-hidden overflow-y-auto rounded-2xl border bg-card p-4 sm:p-6 text-foreground [overflow-wrap:anywhere] backdrop:bg-black/45"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <h2 id="schedule-editor-title" className="text-xl font-bold">
            {editing ? "Ubah jadwal" : "Tambah jadwal"}
          </h2>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => requestDialogClose(editor.current)}
          >
            <ActionIcon action="close" />
            Tutup
          </Button>
        </div>
        {open && (
          <Editor
            key={editing?.id ?? "create"}
            row={editing}
            onSaved={saved}
            onBusy={editorBusy}
          />
        )}
      </ManagedDialog>
      <ManagedDialog
        ref={stop}
        aria-labelledby="schedule-stop-title"
        className="m-auto max-h-[90svh] w-[min(42rem,calc(100%_-_2rem))] overflow-x-hidden overflow-y-auto rounded-2xl border bg-card p-4 sm:p-6 text-foreground [overflow-wrap:anywhere] backdrop:bg-black/45"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        onClose={() => {
          setTargets(null);
          setPreview(null);
        }}
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <h2 id="schedule-stop-title" className="text-xl font-bold">
            Hentikan {targets?.length ?? 0} jadwal
          </h2>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => requestDialogClose(stop.current)}
          >
            <ActionIcon action="close" />
            Tutup
          </Button>
        </div>
        {preview ? (
          <div className="min-w-0 space-y-4">
            <p className="text-sm">
              Pratinjau berlaku sampai{" "}
              {new Date(preview.expiresAt).toLocaleTimeString("id-ID", {
                timeZone: "Asia/Jakarta",
              })}{" "}
              WIB. Semua perubahan disimpan bersama atau ditolak seluruhnya.
            </p>
            {preview.items.map((v) => (
              <article key={v.id} className="rounded border p-3 text-sm">
                <strong>
                  {v.teacherName} · {v.className}
                </strong>
                <p>
                  {v.validFrom}–{v.validTo}:{" "}
                  {v.operation === "archive"
                    ? "arsip jadwal yang belum dimulai"
                    : "tutup bagian berlaku mulai " + v.stopFrom}
                </p>
              </article>
            ))}
            <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy} onClick={()=>{setPreview(null);setError("");}}>Ubah tanggal atau alasan</Button>
            <Button disabled={busy} onClick={() => void commit()}>
              <ActionIcon action="confirm" />
              {busy ? "Memproses…" : "Konfirmasi penghentian jadwal"}
            </Button></div>
          </div>
        ) : (
          <form onSubmit={(e) => void stopPreview(e)} className="min-w-0 space-y-4">
            <p className="text-sm leading-6">
              Riwayat tidak dihapus. Jadwal yang belum dimulai dapat diarsipkan;
              jadwal berjalan ditutup sebelum tanggal batas. Perubahan yang
              sudah digunakan atau difinalisasi dilindungi. Jika perubahan
              ditolak, hubungi administrator untuk meninjau data terkait.
            </p>
            <fieldset disabled={busy} className="min-w-0 space-y-4">
              <label className="block text-sm">
                Hentikan mulai tanggal
                <input
                  type="date"
                  name="stopFrom"
                  required
                  min={wibDate()}
                  defaultValue={wibDate()}
                  className="mt-2 min-h-11 w-full min-w-0 rounded border bg-background px-3"
                />
              </label>
              <label className="block text-sm">
                Alasan
                <input
                  name="reason"
                  required
                  minLength={5}
                  maxLength={500}
                  className="mt-2 min-h-11 w-full min-w-0 rounded border bg-background px-3"
                />
              </label>
              <Button type="submit">
                <ActionIcon action="preview" />
                {busy ? "Memeriksa…" : "Lihat pratinjau dampak"}
              </Button>
            </fieldset>
          </form>
        )}
        {error && <ErrorFeedback message={error} />}
      </ManagedDialog>
      <ManagedDialog
        ref={historyDialog}
        aria-labelledby="schedule-history-title"
        className="m-auto max-h-[90svh] w-[min(42rem,calc(100%_-_2rem))] overflow-x-hidden overflow-y-auto rounded-2xl border bg-card p-4 sm:p-6 text-foreground [overflow-wrap:anywhere] backdrop:bg-black/45"
        onClose={() => {historyController.current?.abort();setHistoryId(null);setHistory(null);setHistoryError("");}}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h2 id="schedule-history-title" className="text-xl font-bold">
            Riwayat jadwal
          </h2>
          <Button
            variant="outline"
            onClick={() => requestDialogClose(historyDialog.current)}
          >
            <ActionIcon action="close" />
            Tutup
          </Button>
        </div>
        {historyLoading && <p role="status">Memuat riwayat jadwal…</p>}
        {historyError && <div className="space-y-3"><ErrorFeedback message={historyError}/><Button variant="outline" onClick={()=>{if(historyId)void showHistory(historyId);}}>Coba muat riwayat</Button></div>}
        {history?.length === 0 ? (
          <p>Belum ada riwayat.</p>
        ) : (
          history?.map((h, i) => {
            const v = h.new_data && typeof h.new_data === "object" ? h.new_data as Record<string, unknown> : {},
              snap = v.snapshot && typeof v.snapshot === "object" ? v.snapshot as Record<string, unknown> : undefined;
            return (
              <article
                key={i}
                className="mb-4 space-y-2 rounded border p-4 text-sm"
              >
                <p>
                  {new Date(h.created_at).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })}{" "}
                  · {h.actor_name || "Administrator"}
                </p>
                <p>{h.reason || "Tidak ada keterangan tambahan."}</p>
                <p>
                  {String(snap?.teacherName ?? "")} ·{" "}
                  {String(snap?.className ?? "")} ·{" "}
                  {String(snap?.subjectName ?? "")}
                </p>
                <p>
                  {String(v.valid_from ?? "—")}–{String(v.valid_to ?? "—")} ·{" "}
                  {String(v.time_start ?? "—")}–{String(v.time_end ?? "—")} ·{" "}
                  {String(v.scheduled_jtm ?? "—")} JTM
                </p>
              </article>
            );
          })
        )}
      </ManagedDialog>
    </div>
  );
}
