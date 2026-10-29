"use client";
import { HelpDisclosure } from "@/components/ui/help-disclosure";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { ActionIcon } from "@/components/ui/action-icon";

import { TableRegion } from "@/components/ui/table-region";
import { EmptyState } from "@/components/feedback/feature-state";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { masterRequest } from "@/features/masters/api";
import {
  wibDate,
  type CalendarList,
  type CalendarRow,
  type DayContext,
  type ChangePreview,
} from "@/lib/calendar/schemas";
import { calendarChangeSchema, contextChangeSchema } from "@/lib/calendar/schemas";
import { calendarListSchema, dayContextSchema, calendarPreviewSchema, calendarCommitSchema, calendarHistorySchema, calendarPeriodsSchema, readCalendarResponse, type CalendarHistory, type CalendarPeriods } from "@/lib/calendar/contracts";
import { validateAccount } from "@/lib/accounts/client-validation";
import { ApiRequestError, serverFieldErrors } from "@/lib/feedback/api-error";
import { applyFieldErrors } from "@/lib/feedback/form-fields";
const reasonLabels: Record<string, string> = {
  NO_ACADEMIC_PERIOD:
    "Tidak ada semester aktif/cakupan semester yang sesuai tanggal.",
  HOLIDAY: "Tanggal ditandai libur; KBM dan ujian reguler dinonaktifkan.",
  SUNDAY_DEFAULT_OFF: "Minggu tidak otomatis menjadi hari kegiatan.",
};
function ContextSummary({ value }: { value: DayContext }) {
  return (
    <div className="space-y-2 text-sm leading-6">
      <p>
        {value.isHoliday ? "Hari libur" : "Bukan hari libur"} · KBM{" "}
        {value.kbmEnabled ? "aktif" : "nonaktif"} · Ujian{" "}
        {value.examEnabled ? "aktif" : "nonaktif"}
      </p>
      <p>
        Semester:{" "}
        {value.activeAcademicPeriod
          ? value.activeAcademicPeriod.label +
            " · " +
            value.activeAcademicPeriod.semester
          : "Belum ada yang sesuai"}
      </p>
      {[...new Set(value.reasons)].map((v) => (
        <p key={v}>{Object.hasOwn(reasonLabels, v) ? reasonLabels[v] : "Konteks hari mengikuti kebijakan kalender yang berlaku."}</p>
      ))}
    </div>
  );
}
function Field({
  name,
  label,
  type = "text",
  value,
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0 space-y-2 text-sm ui-floating-field">
      <span className="ui-floating-label"><span>{label}</span></span>
      <input placeholder=" "
        name={name}
        type={type}
        required={required}
        defaultValue={value}
        minLength={name === "reason" ? 5 : undefined}
        maxLength={500}
        className="min-h-11 w-full min-w-0 max-w-full rounded-lg border bg-background px-3 py-2"
      />
    </label>
  );
}
export function CalendarManager() {
  const [selected, setSelected] = useState(wibDate());
  const [month, setMonth] = useState(wibDate().slice(0, 7));
  const [page, setPage] = useState(1), [q, setQ] = useState(""), [holiday, setHoliday] = useState("");
  const [list, setList] = useState<CalendarList | null>(null), [day, setDay] = useState<DayContext | null>(null);
  const [periods, setPeriods] = useState<CalendarPeriods | null>(null);
  const [periodQuery, setPeriodQuery] = useState(""), [periodPage, setPeriodPage] = useState(1);
  const [periodId, setPeriodId] = useState<string | null>(null), [periodLabel, setPeriodLabel] = useState("");
  const [periodError, setPeriodError] = useState(""), [periodLoading, setPeriodLoading] = useState(true), [periodRevision, setPeriodRevision] = useState(0);
  const [error, setError] = useState(""), [listError, setListError] = useState(""), [dayError, setDayError] = useState("");
  const [loading, setLoading] = useState(true), [dayLoading, setDayLoading] = useState(true);
  const [listRevision, setListRevision] = useState(0), [dayRevision, setDayRevision] = useState(0);
  const [message, setMessage] = useState(""), [revision, setRevision] = useState(0), [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ChangePreview | null>(null), [commitBlocked, setCommitBlocked] = useState(false);
  const [tab, setTab] = useState<"entry" | "range" | "context">("entry");
  const [history, setHistory] = useState<CalendarHistory | null>(null), [historyDate, setHistoryDate] = useState("");
  const [historyKind, setHistoryKind] = useState<"calendar" | "day-context">("calendar");
  const [historyLoading, setHistoryLoading] = useState(false), [historyError, setHistoryError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null), historyDialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(false), pending = useRef(false), mutation = useRef<AbortController | null>(null), historyRequest = useRef<AbortController | null>(null);
  const editor = useRef<HTMLElement>(null);
  const currentDay = day?.date === selected && !dayLoading ? day : null;
  const chosenPeriod = periodId ?? day?.override?.academicPeriodId ?? "";
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; mutation.current?.abort(); historyRequest.current?.abort(); };
  }, []);
  useEffect(() => {
    let active = true; const c = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setListError("");
      const [year, m] = month.split("-").map(Number);
      const end = new Date(0); end.setUTCFullYear(year!, m!, 0);
      void masterRequest<unknown>("/api/settings/calendar?" + new URLSearchParams({ dateStart: month + "-01", dateEnd: end.toISOString().slice(0, 10), q, holiday, page: String(page), pageSize: "20" }), "GET", undefined, c.signal)
        .then(raw => {
          const rows = readCalendarResponse(calendarListSchema, raw);
          if (!active) return;
          const last = Math.max(1, Math.ceil(rows.total / 20));
          if (page > last) { setPage(last); return; }
          setList(rows);
        }).catch(e => { if (active) { setList(null); setListError(e instanceof Error ? e.message : "Kalender belum dapat dimuat."); } })
        .finally(() => { if (active) setLoading(false); });
    }, 150);
    return () => { active = false; clearTimeout(timer); c.abort(); };
  }, [month, q, holiday, page, revision, listRevision]);
  useEffect(() => {
    let active = true; const c = new AbortController();
    async function load() {
      setDayLoading(true); setDayError("");
      try {
        const value = readCalendarResponse(dayContextSchema, await masterRequest<unknown>("/api/settings/day-context?date=" + selected, "GET", undefined, c.signal));
        if (value.date !== selected) throw new Error("Tanggal konteks tidak sesuai. Muat ulang konteks hari.");
        if (active) setDay(value);
      } catch (e) { if (active) { setDay(null); setDayError(e instanceof Error ? e.message : "Konteks hari belum dapat dimuat."); } }
      finally { if (active) setDayLoading(false); }
    }
    void load(); return () => { active = false; c.abort(); };
  }, [selected, revision, dayRevision]);
  useEffect(() => {
    let active = true; const c = new AbortController();
    const timer = setTimeout(() => {
      setPeriodLoading(true); setPeriodError("");
      void masterRequest<unknown>("/api/settings/academic-periods?" + new URLSearchParams({ q: periodQuery, page: String(periodPage), pageSize: "20" }), "GET", undefined, c.signal)
        .then(raw => { const value = readCalendarResponse(calendarPeriodsSchema, raw); if (active) {
          const last = Math.max(1, Math.ceil(value.total / 20));
          if (periodPage > last) setPeriodPage(last); else setPeriods(value);
        } }).catch(e => { if (active) { setPeriods(null); setPeriodError(e instanceof Error ? e.message : "Pilihan semester belum dapat dimuat."); } })
        .finally(() => { if (active) setPeriodLoading(false); });
    }, 150);
    return () => { active = false; clearTimeout(timer); c.abort(); };
  }, [periodQuery, periodPage, revision, periodRevision]);
  useEffect(() => { if (preview && !dialog.current?.open) dialog.current?.showModal(); }, [preview]);
  function changeDate(date: string) {
    if (!date || date === selected || pending.current) return;
    setSelected(date); setDayLoading(true); setPeriodId(null); setPeriodLabel(""); setError(""); setMessage("");
  }
  async function makePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !currentDay || preview) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    const form = event.currentTarget, values = new FormData(form), action = String(values.get("action"));
    const controller = new AbortController(); mutation.current = controller;
    const payload = action === "range" ? { action, dateStart: values.get("dateStart"), dateEnd: values.get("dateEnd"), description: values.get("description"), isHoliday: values.has("isHoliday"), reason: values.get("reason") }
      : action === "override" ? { action, date: selected, version: currentDay.overrideVersion, academicPeriodId: chosenPeriod, kbmEnabled: values.has("kbmEnabled"), examEnabled: values.has("examEnabled"), reason: values.get("reason") }
      : action === "clear" ? { action, date: selected, version: currentDay.overrideVersion, reason: values.get("reason") }
      : { action, date: selected, version: currentDay.calendarVersion, reason: values.get("reason"), ...(action === "upsert" ? { description: values.get("description"), isHoliday: values.has("isHoliday") } : {}) };
    const kind = action === "override" || action === "clear" ? "context" : "calendar";
    try {
      applyFieldErrors(form, {});
      const input = kind === "context" ? validateAccount(contextChangeSchema, payload) : validateAccount(calendarChangeSchema, payload);
      if (action !== "range" && selected < wibDate()) throw new ApiRequestError("CALENDAR_PAST", "Tanggal lampau hanya dapat dilihat; pilih tanggal hari ini atau berikutnya.");
      if (action === "range" && "dateStart" in input && input.dateStart < wibDate()) throw new ApiRequestError("VALIDATION_ERROR", "Rentang tidak boleh dimulai pada tanggal lampau.", 422, { dateStart: ["Pilih tanggal hari ini atau berikutnya."] });
      const p = readCalendarResponse(calendarPreviewSchema, await masterRequest<unknown>("/api/settings/" + (kind === "calendar" ? "calendar" : "day-context") + "/preview", "POST", input, controller.signal));
      if (p.kind !== kind || p.action !== action || (action !== "range" && (p.days.length !== 1 || p.days[0]?.date !== selected)) || (action === "range" && "dateStart" in input && (p.days[0]?.date !== input.dateStart || p.days.at(-1)?.date !== input.dateEnd))) throw new ApiRequestError("INVALID_RESPONSE", "Pratinjau tidak sesuai perubahan yang diajukan. Ajukan pratinjau kembali.");
      if (mounted.current && !controller.signal.aborted) { setCommitBlocked(false); setPreview(p); }
    } catch (e) { if (mounted.current && !controller.signal.aborted) { applyFieldErrors(form, serverFieldErrors(e)); setError(e instanceof Error ? e.message : "Pratinjau gagal."); } }
    finally { pending.current = false; mutation.current = null; if (mounted.current) setBusy(false); }
  }
  async function commit() {
    if (!preview || pending.current || commitBlocked) return;
    if (Date.parse(preview.expiresAt) <= Date.now()) { setError("Pratinjau sudah kedaluwarsa. Kembali ke formulir untuk memeriksa ulang."); setCommitBlocked(true); return; }
    pending.current = true; setBusy(true); setError("");
    const controller = new AbortController(); mutation.current = controller;
    try {
      const path = preview.kind === "context" ? "day-context/commit" : preview.action === "range" ? "calendar/range" : "calendar";
      const method = preview.kind === "context" || preview.action === "range" ? "POST" : preview.action === "delete" ? "DELETE" : preview.days[0]?.before.calendarVersion === "0" ? "POST" : "PATCH";
      const result = readCalendarResponse(calendarCommitSchema, await masterRequest<unknown>("/api/settings/" + path, method, { previewId: preview.previewId }, controller.signal));
      if (result.previewId !== preview.previewId || result.count !== preview.count) throw new ApiRequestError("INVALID_RESPONSE", "Status penyimpanan belum dapat dipastikan.");
      if (!mounted.current || controller.signal.aborted) return;
      dialog.current?.close(); setPreview(null); setPeriodId(null); setPeriodLabel(""); setDayLoading(true); setLoading(true); setRevision(v => v + 1);
      setMessage("Perubahan disimpan dan riwayat dicatat. Tidak ada jurnal, bonus atau kredit yang dibuat otomatis.");
    } catch (e) {
      if (!mounted.current || controller.signal.aborted) return;
      const uncertain = e instanceof ApiRequestError && (["NETWORK_ERROR", "TIMEOUT", "INVALID_RESPONSE"].includes(e.code) || e.status >= 500);
      const stale = e instanceof ApiRequestError && ["CALENDAR_PREVIEW_STALE", "CALENDAR_PREVIEW_INVALID", "VERSION_CONFLICT"].includes(e.code);
      if (uncertain || stale) setCommitBlocked(true);
      setError((e instanceof Error ? e.message : "Perubahan belum dapat disimpan.") + (uncertain ? "\nStatus penyimpanan belum pasti. Kembali, muat ulang tanggal dan periksa riwayat sebelum membuat perubahan baru." : stale ? "\nKembali ke formulir dan muat ulang konteks sebelum mengajukan pratinjau baru." : ""));
    } finally { pending.current = false; mutation.current = null; if (mounted.current) setBusy(false); }
  }
  function closeHistory() { historyRequest.current?.abort(); historyRequest.current = null; setHistory(null); setHistoryLoading(false); }
  async function showHistory(kind: "calendar" | "day-context", date = selected) {
    if (pending.current) return;
    historyRequest.current?.abort(); const controller = new AbortController(); historyRequest.current = controller;
    setHistoryKind(kind); setHistoryDate(date); setHistory(null); setHistoryError(""); setHistoryLoading(true);
    if (!historyDialog.current?.open) historyDialog.current?.showModal();
    try {
      const value = readCalendarResponse(calendarHistorySchema, await masterRequest<unknown>("/api/settings/calendar/history?" + new URLSearchParams({ kind, date }), "GET", undefined, controller.signal));
      if (mounted.current && !controller.signal.aborted) setHistory(value);
    } catch (e) { if (mounted.current && !controller.signal.aborted) setHistoryError(e instanceof Error ? e.message : "Riwayat tidak dapat dimuat."); }
    finally { if (mounted.current && !controller.signal.aborted) setHistoryLoading(false); }
  }
  function selectRow(row: CalendarRow) {
    changeDate(row.date); setTab("entry");
    requestAnimationFrame(() => { editor.current?.scrollIntoView({ block: "start", behavior: "auto" }); editor.current?.querySelector<HTMLInputElement>('input[type="date"]')?.focus(); });
  }
  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Administrasi madrasah
        </p>
        <h1 className="mt-2 text-3xl font-bold">Kalender Akademik</h1>
        <HelpDisclosure><p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          Bedakan catatan kalender biasa dan hari libur. Setiap perubahan
          diperiksa melalui pratinjau sebelum disimpan. Hari Minggu tidak
          otomatis memiliki kegiatan.
        </p></HelpDisclosure>
      </header>
      <section className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
        <h2 className="text-xl font-bold">Daftar kalender</h2>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>label]:min-w-0">
          <label className="text-sm ui-floating-field">
            <span className="ui-floating-label">Bulan
            </span><input placeholder=" "
              type="month"
              value={month}
              disabled={busy}
              onChange={(e) => {
                if (/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) {
                  setLoading(true); setMonth(e.target.value);
                  setPage(1);
                }
              }}
              className="mt-2 block min-h-11 w-full min-w-0 max-w-full rounded-lg border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm ui-floating-field">
            <span className="ui-floating-label">Cari keterangan
            </span><input placeholder=" "
              disabled={busy}
              value={q}
              maxLength={100}
              onChange={(e) => {
                setLoading(true); setQ(e.target.value);
                setPage(1);
              }}
              className="mt-2 block min-h-11 w-full min-w-0 max-w-full rounded-lg border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Jenis
            <select
              disabled={busy}
              value={holiday}
              onChange={(e) => {
                setLoading(true); setHoliday(e.target.value);
                setPage(1);
              }}
              className="mt-2 block min-h-11 w-full min-w-0 max-w-full rounded-lg border bg-background px-3 py-2"
            >
              <option value="">Semua</option>
              <option value="true">Hari libur</option>
              <option value="false">Catatan biasa</option>
            </select>
          </label>
          <Button variant="outline" disabled={busy || loading || dayLoading} onClick={() => { setLoading(true); setDayLoading(true); setRevision((v) => v + 1); }}>
            <ActionIcon action="refresh" />
            Muat ulang
          </Button>
        </div>
        {listError && <><ErrorFeedback message={listError} /><Button variant="outline" disabled={busy || loading} onClick={() => { setLoading(true); setListRevision(v => v + 1); }}>Coba muat kalender</Button></>}
        {loading ? (
          <p role="status">Memuat kalender…</p>
        ) : (
          list && (
            <>
              <p className="text-sm">
                {list.total} entri · halaman {page}
              </p>
              {list.items.length === 0 ? (
                <EmptyState title="Belum ada entri pada filter ini." />
              ) : (
                <TableRegion label="Kalender akademik">
                  <table className="w-full min-w-[640px] table-fixed text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th scope="col" className="w-32 p-3">Tanggal</th>
                        <th scope="col" className="p-3 align-top [overflow-wrap:anywhere]">Keterangan</th>
                        <th scope="col" className="w-28 p-3">Jenis</th>
                        <th scope="col" className="w-40 p-3">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.items.map((row) => (
                        <tr key={row.id} className="border-b">
                          <td className="p-3 align-top [overflow-wrap:anywhere]">{row.date}</td>
                          <td className="p-3 align-top [overflow-wrap:anywhere]">{row.description}</td>
                          <td className="p-3 align-top [overflow-wrap:anywhere]">
                            {row.isHoliday ? "Libur" : "Catatan biasa"}
                          </td>
                          <td className="p-3 align-top [overflow-wrap:anywhere]">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => selectRow(row)}
                            >
                              <ActionIcon action="open" />
                              Buka tanggal
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableRegion>
              )}
              <div className="flex flex-wrap justify-between gap-3">
                <Button
                  variant="outline"
                  disabled={busy || loading || page === 1}
                  onClick={() => { setLoading(true); setPage((v) => v - 1); }}
                >
                  <ActionIcon action="previous" />
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || loading || page * 20 >= list.total}
                  onClick={() => { setLoading(true); setPage((v) => v + 1); }}
                >
                  <ActionIcon action="next" />
                  Berikutnya
                </Button>
              </div>
            </>
          )
        )}
      </section>
      <section ref={editor} className="min-w-0 space-y-5 rounded-2xl border bg-card p-4 sm:p-6">
        <h2 className="text-xl font-bold">Periksa satu tanggal</h2>
        <label className="block max-w-xs space-y-2 text-sm ui-floating-field">
          <span className="ui-floating-label"><span>Tanggal kegiatan (WIB)</span></span>
          <input placeholder=" "
            type="date"
            value={selected}
            disabled={busy}
            onChange={(e) => changeDate(e.target.value)}
            className="min-h-11 w-full min-w-0 max-w-full rounded-lg border bg-background px-3 py-2"
          />
        </label>
        {dayLoading && <p role="status">Memuat konteks tanggal…</p>}
        {dayError && <><ErrorFeedback message={dayError} /><Button variant="outline" disabled={busy || dayLoading} onClick={() => { setDayLoading(true); setDayRevision(v => v + 1); }}>Coba muat konteks</Button></>}
        {currentDay && <ContextSummary value={currentDay} />}
        <p className="text-sm leading-7 text-muted-foreground">
          Status hari menentukan mode kegiatan yang tersedia. Perubahan kalender tidak otomatis membuat penugasan, jurnal, bonus atau hak honorarium. Kegiatan yang sudah digunakan atau difinalisasi tetap dilindungi saat penyimpanan.
        </p>
        <nav className="flex flex-wrap gap-2" aria-label="Tindakan kalender">
          {(["entry", "range", "context"] as const).map((v) => (
            <Button
              key={v}
              variant={tab === v ? "default" : "outline"}
              disabled={busy || dayLoading}
              aria-pressed={tab === v}
              onClick={() => { setTab(v); setError(""); }}
            >
              <ActionIcon action="add" />
              {v === "entry"
                ? "Catatan tanggal"
                : v === "range"
                  ? "Tambah rentang"
                  : "Atur konteks"}
            </Button>
          ))}
        </nav>
        {currentDay && (
          <form
            key={selected + tab + currentDay.contextVersion}
            onSubmit={(e) => void makePreview(e)}
            className="min-w-0 space-y-4"
          >
            <fieldset disabled={busy || dayLoading} className="min-w-0 space-y-4">
              {tab === "entry" ? (
                <>
                  <input type="hidden" name="action" value="upsert" />
                  <Field
                    name="description"
                    label="Keterangan kalender"
                    value={currentDay.calendarEntry?.description ?? ""}
                  />
                  <label className="flex gap-3 text-sm">
                    <input
                      type="checkbox"
                      name="isHoliday"
                      defaultChecked={currentDay.isHoliday}
                    />
                    Tandai sebagai hari libur (bukan sekadar catatan biasa)
                  </label>
                </>
              ) : tab === "range" ? (
                <>
                  <input type="hidden" name="action" value="range" />
                  <Field
                    name="dateStart"
                    label="Tanggal mulai"
                    type="date"
                    value={selected}
                  />
                  <Field
                    name="dateEnd"
                    label="Tanggal akhir (inklusif, maksimal 366 tanggal)"
                    type="date"
                    value={selected}
                  />
                  <Field
                    name="description"
                    label="Keterangan seluruh tanggal"
                  />
                  <label className="flex gap-3 text-sm">
                    <input type="checkbox" name="isHoliday" />
                    Seluruh tanggal adalah hari libur
                  </label>
                  <p className="text-sm">
                    Rentang hanya menambah tanggal yang belum pernah dicatat.
                    Jika ada satu benturan, seluruh rentang ditolak; ubah entri
                    lama melalui catatan tanggal.
                  </p>
                </>
              ) : (
                <>
                  <input type="hidden" name="action" value="override" />
                  <label className="block min-w-0 space-y-2 text-sm ui-floating-field">
                    <span className="ui-floating-label"><span>Cari semester untuk konteks khusus</span></span>
                    <input placeholder=" "
                      value={periodQuery}
                      maxLength={100}
                      onChange={(e) => {
                        setPeriodLoading(true); setPeriodQuery(e.target.value);
                        setPeriodPage(1);
                      }}
                      className="min-h-11 w-full min-w-0 max-w-full rounded-lg border bg-background px-3 py-2"
                    />
                  </label>
                  <label className="block min-w-0 space-y-2 text-sm">
                    <span>Semester yang mencakup tanggal</span>
                    <select
                      value={chosenPeriod}
                      name="academicPeriodId"
                      disabled={periodLoading || Boolean(periodError)}
                      onChange={(e) => { setPeriodId(e.target.value); setPeriodLabel(e.target.selectedOptions[0]?.text ?? ""); }}
                      required
                      className="min-h-11 w-full min-w-0 max-w-full rounded-lg border bg-background px-3 py-2"
                    >
                      <option value="">Pilih semester</option>
                      {chosenPeriod && !periods?.items.some(p => p.id === chosenPeriod) && <option value={chosenPeriod}>{periodLabel || (currentDay.activeAcademicPeriod?.id === chosenPeriod ? `${currentDay.activeAcademicPeriod.label} · Semester ${currentDay.activeAcademicPeriod.semester}` : "Semester tersimpan")}</option>}
                      {periods?.items.map((p) => (
                        <option key={p.id} value={p.id} disabled={selected < p.dateStart || selected > p.dateEnd}>
                          {String(p.parentLabel ?? "Tahun pelajaran")} ·
                          Semester {String(p.semester)} ({String(p.dateStart)}–
                          {String(p.dateEnd)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={periodLoading || busy || periodPage === 1}
                      onClick={() => { setPeriodLoading(true); setPeriodPage((v) => v - 1); }}
                    >
                      <ActionIcon action="previous" />
                      Pilihan sebelumnya
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={periodLoading || busy || !periods || periodPage * 20 >= periods.total}
                      onClick={() => { setPeriodLoading(true); setPeriodPage((v) => v + 1); }}
                    >
                      <ActionIcon action="next" />
                      Pilihan berikutnya
                    </Button>
                  </div>
                  {periodLoading && <p role="status">Memuat pilihan semester…</p>}
                  {!periodLoading && !periodError && !periods?.items.length && <p role="status">Tidak ada semester sesuai pencarian. Pilihan tersimpan tetap dipertahankan.</p>}
                  {periodError && <><ErrorFeedback message={periodError} /><Button type="button" variant="outline" onClick={() => { setPeriodLoading(true); setPeriodRevision(v => v + 1); }}>Coba muat semester</Button></>}
                  <p className="text-xs text-muted-foreground">Halaman {periodPage}. Semester di luar cakupan tanggal tidak dapat dipilih.</p>
                  <label className="flex gap-3 text-sm">
                    <input
                      name="kbmEnabled"
                      type="checkbox"
                      defaultChecked={
                        currentDay.override?.kbmEnabled ?? currentDay.kbmEnabled
                      }
                    />
                    Mode KBM diminta aktif
                  </label>
                  <label className="flex gap-3 text-sm">
                    <input
                      name="examEnabled"
                      type="checkbox"
                      defaultChecked={
                        currentDay.override?.examEnabled ?? currentDay.examEnabled
                      }
                    />
                    Mode ujian diminta aktif
                  </label>
                  <p className="text-sm">
                    Hari libur tetap menonaktifkan mode reguler. Semester wajib
                    mencakup tanggal; periode ujian aktif tidak dibuat melalui
                    formulir ini.
                  </p>
                </>
              )}
              <Field
                name="reason"
                label="Alasan perubahan (minimal 5 karakter)"
              />
              <Button type="submit">
                <ActionIcon action="preview" />
                {busy ? "Memeriksa…" : "Lihat pratinjau perubahan"}
              </Button>
            </fieldset>
          </form>
        )}
        {currentDay?.calendarEntry && tab === "entry" && (
          <form
            onSubmit={(e) => void makePreview(e)}
            className="space-y-4 rounded border p-4"
          >
            <fieldset disabled={busy || dayLoading} className="min-w-0 space-y-3">
              <input type="hidden" name="action" value="delete" />
              <Field name="reason" label="Alasan menghapus entri tanggal" />
              <Button className="mt-3" type="submit" variant="outline">
                <ActionIcon action="preview" />
                Pratinjau penghapusan catatan
              </Button>
            </fieldset>
          </form>
        )}
        {currentDay?.override && tab === "context" && (
          <form
            onSubmit={(e) => void makePreview(e)}
            className="space-y-4 rounded border p-4"
          >
            <fieldset disabled={busy || dayLoading} className="min-w-0 space-y-3">
              <input type="hidden" name="action" value="clear" />
              <Field
                name="reason"
                label="Alasan mengembalikan konteks standar"
              />
              <Button className="mt-3" type="submit" variant="outline">
                <ActionIcon action="preview" />
                Pratinjau hapus konteks khusus
              </Button>
            </fieldset>
          </form>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void showHistory("calendar")}
          >
            <ActionIcon action="history" />
            Riwayat catatan tanggal
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void showHistory("day-context")}
          >
            <ActionIcon action="history" />
            Riwayat konteks khusus
          </Button>
        </div>
      </section>
      {message && <p role="status" className="rounded-xl border bg-primary/5 p-4 text-sm leading-6">{message}</p>}
      {error && !preview && <ErrorFeedback message={error} autoFocus />}
      <dialog
        ref={dialog}
        aria-labelledby="calendar-preview-title"
        className="m-auto max-h-[90svh] w-[min(56rem,calc(100%_-_2rem))] overflow-y-auto rounded-2xl border bg-card p-4 text-foreground [overflow-wrap:anywhere] sm:p-6 backdrop:bg-black/45"
        onCancel={(e) => {
          if (pending.current) e.preventDefault();
        }}
        onClose={() => { setPreview(null); setError(""); if (commitBlocked) { setDayLoading(true); setRevision(v => v + 1); } }}
      >
        {preview && (
          <div className="min-w-0 space-y-5">
            <h2 id="calendar-preview-title" className="text-xl font-bold">
              Konfirmasi perubahan {preview.count} tanggal
            </h2>
            <p className="text-sm">
              Pratinjau berlaku sampai{" "}
              {new Date(preview.expiresAt).toLocaleTimeString("id-ID", {
                timeZone: "Asia/Jakarta",
              })}{" "}
              WIB. Perubahan lain pada kalender/semester membatalkan pratinjau
              ini. Data tidak diubah sebelum konfirmasi.
            </p>
            <div className="min-w-0 space-y-4">
              {preview.days.map((d) => (
                <article key={d.date} className="rounded border p-4">
                  <h3 className="mb-3 font-semibold">{d.date}</h3>
                  <div className="grid min-w-0 gap-4 md:grid-cols-2 [&>div]:min-w-0">
                    <div>
                      <p className="mb-2 font-semibold">Sebelum</p>
                      <ContextSummary value={d.before} />
                    </div>
                    <div>
                      <p className="mb-2 font-semibold">Sesudah</p>
                      <ContextSummary value={d.after} />
                      {d.after.calendarEntry && (
                        <p className="mt-2 text-sm">
                          {d.after.calendarEntry.description}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <p className="text-sm leading-6">
              Periksa perubahan konteks dan dampak pada kegiatan sebelum
              mengonfirmasi. Perubahan kalender tidak otomatis membuat jurnal
              atau bonus. Data yang sudah digunakan atau difinalisasi tetap
              dilindungi; perubahan yang tidak memenuhi aturan akan ditolak.
            </p>
            {error && <ErrorFeedback message={error} autoFocus />}
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => dialog.current?.close()}
              >
                <ActionIcon action="close" />
                {commitBlocked ? "Kembali dan muat ulang" : "Kembali ke formulir"}
              </Button>
              <Button disabled={busy || commitBlocked} onClick={() => void commit()}>
                <ActionIcon action="save" />
                {busy ? "Menyimpan…" : "Simpan perubahan kalender"}
              </Button>
            </div>
          </div>
        )}
      </dialog>
      <dialog
        ref={historyDialog}
        aria-labelledby="calendar-history-title"
        className="m-auto max-h-[90svh] w-[min(42rem,calc(100%_-_2rem))] overflow-y-auto rounded-2xl border bg-card p-4 text-foreground [overflow-wrap:anywhere] sm:p-6 backdrop:bg-black/45"
        onCancel={closeHistory}
        onClose={closeHistory}
      >
        <div className="mb-4 flex justify-between gap-3">
          <h2 id="calendar-history-title" className="text-xl font-bold">
            Riwayat {historyDate} · {historyKind === "calendar" ? "Catatan tanggal" : "Konteks khusus"}
          </h2>
          <Button
            variant="outline"
            onClick={() => { closeHistory(); historyDialog.current?.close(); }}
          >
            <ActionIcon action="close" />
            Tutup
          </Button>
        </div>
        {historyLoading && <p role="status">Memuat riwayat…</p>}
        {historyError && <><ErrorFeedback message={historyError} autoFocus /><Button variant="outline" onClick={() => void showHistory(historyKind, historyDate)}>Coba muat riwayat</Button></>}
        {history?.length === 0 ? (
          <EmptyState title="Belum ada riwayat." />
        ) : (
          history?.map((v, i) => (
            <article key={i} className="mb-4 space-y-2 rounded border p-4">
              <p className="text-sm">
                {new Date(v.created_at).toLocaleString("id-ID", {
                  timeZone: "Asia/Jakarta",
                })}{" "}
                · {v.actor_name ?? "Administrator"}
              </p>
              <p>{v.reason}</p>
              <p className="text-sm">
                {v.new_data?.deleted_at
                  ? "Dihapus (riwayat dipertahankan)"
                  : String(v.new_data?.description ?? "Konteks khusus")}{" "}
                · Versi {String(v.new_data?.version ?? "—")}
              </p>
            </article>
          ))
        )}
      </dialog>
    </div>
  );
}
