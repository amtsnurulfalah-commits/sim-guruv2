"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ActionIcon } from "@/components/ui/action-icon";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { EmptyState } from "@/components/feedback/feature-state";
import { masterRequest } from "@/features/masters/api";
import { ApiRequestError, downloadFile } from "@/lib/feedback/api-error";
import { wibDate } from "@/lib/calendar/schemas";
import { dayFilter, historyFilter } from "@/lib/activities/schemas";
import { journalSchema, journalListSchema, journalOptionsSchema, eligibleJournalsSchema, journalBlocksSchema, journalDeletedSchema, journalPolicySavedSchema, readJournalResponse, journalEligibilityText, type JournalOptions, type JournalEligible, type JournalBlock, } from "@/lib/activities/journal-contracts";
import { JournalEditor, type JournalAction } from "./journal-editor";
type History = ReturnType<typeof journalListSchema.parse>;
type Context = {
    options: JournalOptions;
    eligible: JournalEligible[];
    blocks: JournalBlock[];
};
const api = "/api/activities/";
const uncertain = (e: unknown) => e instanceof ApiRequestError && (["NETWORK_ERROR", "TIMEOUT", "INVALID_RESPONSE"].includes(e.code) || e.status >= 500 || e.status === 409 || e.status === 404);
export function JournalWorkspace({ admin, userId }: {
    admin: boolean;
    userId: string;
}) {
    const [tab, setTab] = useState("input"), [date, setDate] = useState(wibDate());
    const [from, setFrom] = useState(wibDate().slice(0, 7) + "-01"), [to, setTo] = useState(wibDate()), [teacher, setTeacher] = useState(""), [q, setQ] = useState(""), [page, setPage] = useState(1);
    const [context, setContext] = useState<Context | null>(null), [history, setHistory] = useState<History | null>(null);
    const [contextLoading, setContextLoading] = useState(true), [historyLoading, setHistoryLoading] = useState(true);
    const [contextError, setContextError] = useState(""), [historyError, setHistoryError] = useState(""), [actionError, setActionError] = useState("");
    const [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [notice, setNotice] = useState(""), [action, setAction] = useState<JournalAction | null>(null);
    const [blockQ, setBlockQ] = useState(""), [blockPage, setBlockPage] = useState(1);
    const mounted = useRef(false), pending = useRef(false), contextRead = useRef<AbortController | null>(null), historyRead = useRef<AbortController | null>(null), downloadRequest = useRef<AbortController | null>(null), recoveryScope = useRef<"context" | "all">("all");
    const loadContext = useCallback(async () => {
        contextRead.current?.abort();
        const controller = new AbortController();
        contextRead.current = controller;
        setContextLoading(true);
        setContextError("");
        setContext(null);
        try {
            if (!dayFilter.safeParse({ date }).success)
                throw new ApiRequestError("VALIDATION_ERROR", "Pilih tanggal kegiatan / input yang valid sebelum memuat kegiatan.");
            const [options, eligible, blocks] = await Promise.all([
                masterRequest<unknown>(api + "options", "GET", undefined, controller.signal).then(v => readJournalResponse(journalOptionsSchema, v)),
                masterRequest<unknown>(api + "eligible?" + new URLSearchParams({ date }), "GET", undefined, controller.signal).then(v => readJournalResponse(eligibleJournalsSchema, v)),
                admin ? masterRequest<unknown>(api + "blocks", "GET", undefined, controller.signal).then(v => readJournalResponse(journalBlocksSchema, v)) : Promise.resolve({ items: [] }),
            ]);
            if (!mounted.current || contextRead.current !== controller || controller.signal.aborted)
                return false;
            if (eligible.items.some(row => row.date !== date || row.userId !== userId))
                throw new ApiRequestError("INVALID_RESPONSE", "Kegiatan yang diterima tidak sesuai tanggal atau akun. Muat ulang jurnal.");
            setContext({ options, eligible: eligible.items.filter(row => row.kind === "KBM"), blocks: blocks.items });
            return true;
        }
        catch (e) {
            if (mounted.current && contextRead.current === controller && !controller.signal.aborted)
                setContextError(e instanceof Error ? e.message : "Kegiatan dan kebijakan jurnal belum dapat dimuat.");
            return false;
        }
        finally {
            if (mounted.current && contextRead.current === controller && !controller.signal.aborted)
                setContextLoading(false);
        }
    }, [admin, date, userId]);
    const loadHistory = useCallback(async () => {
        historyRead.current?.abort();
        const controller = new AbortController();
        historyRead.current = controller;
        setHistoryLoading(true);
        setHistoryError("");
        setHistory(null);
        try {
            const filter = { from, to, page, pageSize: 25, ...(admin && teacher ? { userId: teacher } : {}), ...(q.trim() ? { q: q.trim() } : {}) };
            if (!historyFilter.safeParse(filter).success)
                throw new ApiRequestError("VALIDATION_ERROR", "Periksa Riwayat mulai dan Riwayat sampai. Tanggal akhir harus setelah atau sama dengan tanggal mulai, dengan rentang maksimal 366 tanggal. Pencarian maksimal 200 karakter.");
            let value = readJournalResponse(journalListSchema, await masterRequest<unknown>(api + "journals?" + new URLSearchParams(Object.entries(filter).map(([key, v]) => [key, String(v)])), "GET", undefined, controller.signal));
            if (!mounted.current || historyRead.current !== controller || controller.signal.aborted)
                return false;
            if (value.page !== page || value.pageSize !== 25 || value.items.some(row => row.date < from || row.date > to || (!admin && row.userId !== userId) || (admin && teacher && row.userId !== teacher)))
                throw new ApiRequestError("INVALID_RESPONSE", "Riwayat jurnal tidak sesuai filter atau akun. Muat ulang dan periksa data.");
            const last = Math.max(1, Math.ceil(value.total / 25));
            if (page > last) {
                value = readJournalResponse(journalListSchema, await masterRequest<unknown>(api + "journals?" + new URLSearchParams(Object.entries({ ...filter, page: last }).map(([key, v]) => [key, String(v)])), "GET", undefined, controller.signal));
                if (!mounted.current || historyRead.current !== controller || controller.signal.aborted)
                    return false;
                if (value.page !== last || value.pageSize !== 25 || value.items.some(row => row.date < from || row.date > to || (!admin && row.userId !== userId) || (admin && teacher && row.userId !== teacher)))
                    throw new ApiRequestError("INVALID_RESPONSE", "Riwayat jurnal tidak sesuai filter atau akun. Muat ulang dan periksa data.");
                setPage(last);
            }
            setHistory(value);
            return true;
        }
        catch (e) {
            if (mounted.current && historyRead.current === controller && !controller.signal.aborted)
                setHistoryError(e instanceof Error ? e.message : "Riwayat jurnal belum dapat dimuat.");
            return false;
        }
        finally {
            if (mounted.current && historyRead.current === controller && !controller.signal.aborted)
                setHistoryLoading(false);
        }
    }, [admin, from, to, page, teacher, q, userId]);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; contextRead.current?.abort(); historyRead.current?.abort(); downloadRequest.current?.abort(); contextRead.current = null; historyRead.current = null; };
    }, []);
    useEffect(() => { let active = true; queueMicrotask(() => { if (active)
        void loadContext(); }); return () => { active = false; contextRead.current?.abort(); }; }, [loadContext]);
    useEffect(() => { const timer = setTimeout(() => void loadHistory(), 200); return () => { clearTimeout(timer); historyRead.current?.abort(); }; }, [loadHistory]);
    async function refresh() {
        setActionError("");
        const [contextOk, historyOk] = await Promise.all([loadContext(), loadHistory()]);
        if (mounted.current && contextOk && (recoveryScope.current === "context" || historyOk))
            setBlocked(false);
    }
    function changeHistory(update: () => void) { setHistory(null); setHistoryLoading(true); update(); setPage(1); }
    async function save(input: unknown, signal: AbortSignal) {
        if (!action || pending.current || blocked)
            return;
        pending.current = true;
        setBusy(true);
        setNotice("");
        setActionError("");
        const current = action;
        recoveryScope.current = ["edit", "delete"].includes(current.kind) ? "all" : "context";
        const endpoint = current.kind === "create" ? "journal-create" : current.kind === "edit" ? "journal-edit" : current.kind === "delete" ? "journal-delete" : current.kind === "h1" ? "h1" : "block";
        try {
            const raw = await masterRequest<unknown>(api + endpoint, "POST", input, signal);
            if (current.kind === "create" || current.kind === "edit") {
                const result = readJournalResponse(journalSchema, raw);
                const identity = input as {
                    occurrenceId?: string;
                };
                if ((current.kind === "create" && (result.occurrenceId !== identity.occurrenceId || result.userId !== userId)) || (current.kind === "edit" && (result.id !== current.journal.id || result.occurrenceId !== current.journal.occurrenceId || BigInt(result.version) <= BigInt(current.journal.version))))
                    throw new ApiRequestError("INVALID_RESPONSE", "Identitas atau versi hasil penyimpanan jurnal tidak sesuai. Muat ulang sebelum menyimpan kembali.");
            }
            else if (current.kind === "delete") {
                if (readJournalResponse(journalDeletedSchema, raw).id !== current.journal.id)
                    throw new ApiRequestError("INVALID_RESPONSE", "Identitas hasil penghapusan tidak sesuai. Periksa riwayat jurnal.");
            }
            else
                readJournalResponse(journalPolicySavedSchema, raw);
            if (!mounted.current || signal.aborted)
                return;
            setAction(null);
            setBlocked(true);
            setNotice(current.kind === "delete" ? "Jurnal berhasil dihapus dan kredit JTM dibalik. Riwayat tetap tersimpan." : current.kind === "create" || current.kind === "edit" ? "Jurnal berhasil disimpan. Bobot dan kredit JTM mengikuti hasil server." : "Kebijakan jurnal berhasil disimpan.");
            void refresh();
        }
        catch (e) {
            if (mounted.current && !signal.aborted && uncertain(e))
                setBlocked(true);
            throw e;
        }
        finally {
            pending.current = false;
            if (mounted.current)
                setBusy(false);
        }
    }
    async function download(format: "csv" | "pdf") {
        if (pending.current || !history || historyLoading || blocked)
            return;
        pending.current = true;
        setBusy(true);
        setActionError("");
        const controller = new AbortController();
        downloadRequest.current = controller;
        try {
            const params = new URLSearchParams({ kind: "journals", format, from, to, ...(admin && teacher ? { userId: teacher } : {}), ...(q.trim() ? { q: q.trim() } : {}) });
            await downloadFile(api + "export?" + params, "journals." + format, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(40000)]) });
        }
        catch (e) {
            if (mounted.current && !controller.signal.aborted)
                setActionError(e instanceof Error ? e.message : "Unduhan jurnal belum berhasil. Coba kembali.");
        }
        finally {
            pending.current = false;
            downloadRequest.current = null;
            if (mounted.current)
                setBusy(false);
        }
    }
    const contextDisabled = busy || blocked || contextLoading || !context;
    const historyDisabled = busy || blocked || historyLoading || !history;
    const available = context?.eligible.filter(row => !row.journalId && !row.eligibilityError) ?? [];
    const blocks = (context?.blocks ?? []).filter(row => `${context?.options.subjects.find(s => s.id === row.subject_id)?.name ?? row.subject_id} ${row.message}`.toLowerCase().includes(blockQ.trim().toLowerCase()));
    const blockLast = Math.max(1, Math.ceil(blocks.length / 10)), shownBlockPage = Math.min(blockPage, blockLast);
    const historyLast = Math.max(1, Math.ceil((history?.total ?? 0) / 25));
    return <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
    <header><p className="text-xs font-semibold uppercase tracking-widest text-primary">Pembelajaran madrasah</p><h1 className="text-3xl font-bold">Jurnal pembelajaran</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">Tanggal operasional memakai WIB. Konfirmasi kegiatan dan jam hadir harian merupakan bukti yang berbeda. Pilih kegiatan, catat pembelajaran, lalu periksa riwayat dan kredit JTM.</p></header>
    <Button variant="outline" disabled={busy || contextLoading || historyLoading || action !== null} onClick={() => void refresh()}>Muat ulang</Button>
    {notice && <p role="status">{notice}</p>}
    <ErrorFeedback message={actionError} autoFocus/>
    {blocked && !action && <p role="status">Periksa hasil terbaru melalui Muat ulang sebelum melanjutkan perubahan. Jika pemuatan gagal, perubahan yang sudah berhasil tetap tersimpan.</p>}
    <details className="group/journal-filter min-w-0 rounded-2xl border bg-card shadow-xs"><summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-5 [&::-webkit-details-marker]:hidden"><ActionIcon action="filter"/><span className="min-w-0 flex-1">Tanggal dan filter jurnal</span><ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open/journal-filter:rotate-180 motion-reduce:transition-none"/></summary><fieldset disabled={busy} className="grid min-w-0 gap-4 border-t p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
      <label className="min-w-0 text-sm">Tanggal kegiatan / input<input type="date" className="ui-control mt-2" value={date} onChange={e => { setContext(null); setContextLoading(true); setDate(e.target.value); }}/></label>
      <label className="min-w-0 text-sm">Riwayat mulai<input type="date" className="ui-control mt-2" value={from} onChange={e => changeHistory(() => setFrom(e.target.value))}/></label>
      <label className="min-w-0 text-sm">Riwayat sampai<input type="date" className="ui-control mt-2" value={to} onChange={e => changeHistory(() => setTo(e.target.value))}/></label>
      {admin && <div className="min-w-0 text-sm"><label htmlFor="journal-teacher">Filter guru (kosong: semua)</label><select id="journal-teacher" className="ui-control mt-2" value={teacher} onChange={e => changeHistory(() => setTeacher(e.target.value))}><option value="">Semua guru</option>{context?.options.teachers.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>}
      <label className="min-w-0 text-sm">Cari materi/catatan<input className="ui-control mt-2" maxLength={200} value={q} onChange={e => changeHistory(() => setQ(e.target.value))}/></label>
    </fieldset></details>
    <Tabs label="Jurnal pembelajaran" defaultValue="input" value={tab} onValueChange={setTab} items={[
            { value: "input", label: "Input Jurnal Pembelajaran", icon: <ActionIcon action="add"/>, content: <section className="ui-panel min-w-0 space-y-4"><h2 className="text-xl font-bold">Input jurnal pembelajaran</h2><p className="text-sm">Tanggal kegiatan: {date || "belum dipilih"}. Input baru mengikuti penugasan akun Anda; admin dapat mengubah jurnal guru melalui Riwayat.</p>
        {contextLoading && <p role="status" aria-busy="true">Memuat kegiatan dan kebijakan jurnal…</p>}<ErrorFeedback message={contextError}/>
        {context && <><p className="text-sm text-muted-foreground">H-1 {context.options.h1Enabled ? "aktif dengan bobot 80%" : "belum aktif"}. Rekap siswa yang tersedia wajib cocok dengan jurnal.</p>{!available.length && <EmptyState title="Tidak ada kegiatan yang siap diisi." description="Periksa tanggal, penugasan, konfirmasi, jurnal yang sudah tersimpan, dan kendala di bawah. Riwayat tetap dapat diperiksa pada tab berikutnya."/>}<Button variant="outline" disabled={contextDisabled || !available.length} onClick={() => setAction({ kind: "create", date, eligible: available, h1: context.options.h1Enabled })}>Jurnal pembelajaran</Button>
          {context.eligible.map(row => <article key={row.id} className="min-w-0 space-y-2 rounded-xl border p-4"><h3 className="font-semibold">{row.subjectName ?? "Mata pelajaran"} · {row.className ?? "Kelas"}</h3><p className="text-sm">{row.timeStart}–{row.timeEnd} · {row.expectedStudents} siswa sesuai standar</p><p className="text-sm text-muted-foreground">{row.journalId ? "Jurnal sudah tersimpan. Periksa Riwayat dan Detail Jurnal." : row.eligibilityError ? journalEligibilityText(row.eligibilityError) : "Siap diisi setelah Anda memeriksa jumlah siswa."}</p></article>)}</>}
      </section> },
            { value: "history", label: "Riwayat dan Detail Jurnal", icon: <ActionIcon action="history"/>, content: <><section className="ui-panel min-w-0 space-y-4"><h2 className="text-xl font-bold">Riwayat dan detail jurnal</h2><p className="text-sm text-muted-foreground">Unduhan mencakup seluruh hasil sesuai filter, bukan hanya halaman yang sedang terlihat.</p><div className="flex flex-wrap gap-3"><Button variant="outline" disabled={historyDisabled} onClick={() => void download("csv")}>Unduh CSV</Button><Button variant="outline" disabled={historyDisabled} onClick={() => void download("pdf")}>Unduh PDF</Button></div>
        {historyLoading && <p role="status" aria-busy="true">Memuat riwayat jurnal…</p>}<ErrorFeedback message={historyError}/>
        {history && <>{!history.items.length && <EmptyState title="Belum ada jurnal pada rentang ini." description="Periksa rentang tanggal, filter guru, atau pencarian materi/catatan."/>}{history.items.map(journal => <article key={journal.id} className="min-w-0 space-y-3 rounded-xl border p-4"><h3 className="font-semibold">{journal.date} · {journal.teacherName} · {journal.subjectName} · {journal.className}</h3><p className="whitespace-pre-wrap leading-7">{journal.material}</p><p className="text-sm">Hadir {journal.present}; absen {journal.absent} · {journal.creditedJtm} JTM · {journal.inputType === "H_MINUS_1" ? "H-1 (80%)" : "Hari H (100%)"} · versi {journal.version}</p>{journal.notes && <p className="whitespace-pre-wrap text-sm leading-6">{journal.notes}</p>}<p className="text-sm text-muted-foreground">{journal.recapAvailable ? "Rekap siswa tersedia" : "Belum ada rekap siswa; jumlah diperiksa terhadap standar kelas."}</p>{(admin || journal.userId === userId) && <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={historyDisabled} onClick={() => { setTab("input"); setAction({ kind: "edit", journal }); }}>Ubah jurnal</Button><Button variant="outline" disabled={historyDisabled} onClick={() => setAction({ kind: "delete", journal })}>Hapus jurnal dan batalkan JTM</Button></div>}</article>)}</>}
      </section><div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><Button variant="outline" disabled={historyDisabled || page <= 1} onClick={() => { setHistory(null); setHistoryLoading(true); setPage(value => value - 1); }}>Sebelumnya</Button><span className="text-sm">Halaman {page} dari {historyLast} · {history?.total ?? 0} catatan</span><Button variant="outline" disabled={historyDisabled || page >= historyLast} onClick={() => { setHistory(null); setHistoryLoading(true); setPage(value => value + 1); }}>Berikutnya</Button></div></> },
            { value: "policy", label: "Kebijakan dan Pemblokiran Jurnal", icon: <ActionIcon action="section"/>, content: <section className="ui-panel min-w-0 space-y-4"><h2 className="text-xl font-bold">Kebijakan dan pemblokiran jurnal</h2>{contextLoading && <p role="status" aria-busy="true">Memuat kebijakan jurnal…</p>}<ErrorFeedback message={contextError}/>{context && <><p className="text-sm">Jurnal H-1 {context.options.h1Enabled ? "aktif dengan bobot 80%" : "belum aktif"}. Kegiatan harus memenuhi ketentuan konfirmasi dan batas waktu pengisian.</p>{admin ? <><div className="flex flex-wrap gap-3"><Button variant="outline" disabled={contextDisabled} onClick={() => setAction({ kind: "h1", enabled: !context.options.h1Enabled })}>{context.options.h1Enabled ? "Nonaktifkan" : "Aktifkan"} jurnal H-1</Button><Button variant="outline" disabled={contextDisabled || !context.options.subjects.length} onClick={() => setAction({ kind: "block-new", date: dayFilter.safeParse({ date }).success ? date : wibDate(), subjects: context.options.subjects })}>Blok pengisian jurnal</Button></div><label className="block min-w-0 text-sm">Cari blok mata pelajaran atau pesan<input className="ui-control mt-2" maxLength={150} value={blockQ} onChange={e => { setBlockQ(e.target.value); setBlockPage(1); }}/></label>{!blocks.length && <EmptyState title="Tidak ada blok sesuai pencarian." description="Blok baru akan tampil setelah berhasil disimpan. Hapus pencarian untuk melihat seluruh blok."/>}{blocks.slice((shownBlockPage - 1) * 10, shownBlockPage * 10).map(block => { const subject = context.options.subjects.find(row => row.id === block.subject_id)?.name ?? `Mata pelajaran ${block.subject_id}`; return <article key={block.id} className="min-w-0 space-y-3 rounded-xl border p-4"><h3 className="font-semibold">{subject}</h3><p className="text-sm">{block.date_start}–{block.date_end} · {block.active ? "Aktif" : "Nonaktif"} · versi {block.version}</p><p className="whitespace-pre-wrap text-sm leading-6">{block.message}</p><Button variant="outline" disabled={contextDisabled} onClick={() => setAction({ kind: "block-toggle", block, subject })}>{block.active ? "Nonaktifkan blok jurnal" : "Aktifkan blok jurnal"}</Button></article>; })}<div className="flex flex-wrap justify-between gap-3"><Button variant="outline" disabled={shownBlockPage <= 1} onClick={() => setBlockPage(shownBlockPage - 1)}>Blok sebelumnya</Button><p className="text-sm">{blocks.length} blok · halaman {shownBlockPage} dari {blockLast}</p><Button variant="outline" disabled={shownBlockPage >= blockLast} onClick={() => setBlockPage(shownBlockPage + 1)}>Blok berikutnya</Button></div></> : <p className="text-sm leading-6">Pengaturan kebijakan dan pemblokiran jurnal dikelola administrator. Kendala pengisian kegiatan ditampilkan pada tab Input Jurnal Pembelajaran.</p>}</>}
      </section> },
        ]}/>
    {action && <JournalEditor action={action} blocked={blocked} onSave={save} onClose={() => setAction(null)} onRecover={() => { setAction(null); void refresh(); }}/>}
  </div>;
}
