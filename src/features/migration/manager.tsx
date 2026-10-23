"use client";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { EmptyState } from "@/components/feedback/feature-state";
import { masterRequest } from "@/features/masters/api";
import { validateAccount } from "@/lib/accounts/client-validation";
import { ApiRequestError } from "@/lib/feedback/api-error";
import { statusLabel } from "@/lib/ui-status";
import { exportSchema, gates } from "@/lib/migration/contracts";
import { migrationBoardSchema, migrationReportSchema, migrationStagedSchema, migrationSavedSchema, readMigrationResponse, gateLabels, type MigrationBatch, type MigrationReport, } from "@/lib/migration/ui-contracts";
import { MigrationEditor, type MigrationAction } from "./migration-editor";
const api = "/api/migration/";
const limit = 2 * 1024 * 1024;
const uncertain = (e: unknown) => e instanceof ApiRequestError && (["NETWORK_ERROR", "TIMEOUT", "INVALID_RESPONSE"].includes(e.code) || e.status >= 500);
type Selection = {
    batchId: string;
    version: string;
    report: MigrationReport;
};
function BatchDetails({ batch, report, disabled, onEdit }: {
    batch: MigrationBatch;
    report: MigrationReport;
    disabled: boolean;
    onEdit: (action: MigrationAction) => void;
}) {
    const [q, setQ] = useState(""), [severity, setSeverity] = useState(""), [page, setPage] = useState(1);
    const filtered = report.issues.filter(issue => (!severity || issue.severity === severity) && `${issue.source_table} ${issue.row_number ?? ""} ${issue.field ?? ""} ${issue.code}`.toLowerCase().includes(q.trim().toLowerCase()));
    const last = Math.max(1, Math.ceil(filtered.length / 20)), current = Math.min(page, last);
    return <div className="min-w-0 space-y-5 border-t pt-4">
    <p className="text-sm">{report.mappedRows} pemetaan hasil impor tercatat.</p>
    <details className="min-w-0 rounded-xl border p-3"><summary className="min-h-11 cursor-pointer font-semibold">Jumlah baris per sheet</summary><dl className="grid gap-3 pt-3 sm:grid-cols-2">{Object.entries(report.counts).map(([sheet, count]) => <div key={sheet} className="min-w-0"><dt className="text-sm text-muted-foreground">{sheet}</dt><dd>{count} baris</dd></div>)}</dl>{!Object.keys(report.counts).length && <p className="text-sm">Tidak ada baris staging yang tercatat.</p>}</details>
    <h3 className="text-lg font-bold">Temuan pemeriksaan</h3>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2"><label className="min-w-0 text-sm">Cari sheet, baris, kolom, atau kode<input className="ui-control mt-2" value={q} maxLength={150} onChange={e => { setQ(e.target.value); setPage(1); }}/></label><div className="min-w-0 text-sm"><label htmlFor={batch.id + "severity"}>Jenis temuan</label><select className="ui-control mt-2" id={batch.id + "severity"} value={severity} onChange={e => { setSeverity(e.target.value); setPage(1); }}><option value="">Semua jenis</option><option value="error">Kesalahan data</option><option value="review">Perlu tinjauan</option></select></div></div>
    <p className="text-sm">{filtered.length} temuan · halaman {current} dari {last}</p>
    {!filtered.length && <EmptyState title={report.issues.length ? "Tidak ada temuan sesuai filter." : "Tidak ada temuan pemeriksaan."} description={report.issues.length ? "Ubah jenis temuan atau hapus pencarian." : "Tetap lengkapi bukti kesiapan dan prosedur operator sebelum pemindahan layanan."}/>}
    {filtered.slice((current - 1) * 20, current * 20).map(issue => <article key={issue.sequence} className="min-w-0 space-y-3 rounded-xl border bg-muted/20 p-4"><h4 className="font-semibold">{issue.code}</h4><p className="text-sm">{issue.source_table} · baris {issue.row_number ?? "—"} · {issue.field ?? "—"} · {issue.severity === "error" ? "Kesalahan data" : "Perlu tinjauan"} · {issue.resolution ? "Ditinjau" : "Belum selesai"}</p>{issue.resolution && <p className="whitespace-pre-wrap text-sm leading-6">Hasil tinjauan: {issue.resolution}</p>}{issue.severity === "review" && !issue.resolution ? <Button variant="outline" disabled={disabled} onClick={() => onEdit({ kind: "resolve", batch, issue })}>Tinjau data migrasi</Button> : issue.severity === "error" && <p className="text-sm text-muted-foreground">Perbaiki data pada sumber, lalu unggah ekspor yang diperbaiki. Kesalahan ini tidak dapat diabaikan melalui tinjauan.</p>}</article>)}
    <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" disabled={current <= 1} onClick={() => setPage(current - 1)}>Temuan sebelumnya</Button><Button variant="outline" disabled={current >= last} onClick={() => setPage(current + 1)}>Temuan berikutnya</Button></div>
    <h3 className="text-lg font-bold">Bukti kesiapan</h3>
    <p className="text-sm">{batch.gates.filter(gate => gate.passed).length} dari {gates.length} pemeriksaan disetujui dengan bukti.</p>
    <dl className="grid min-w-0 gap-3 sm:grid-cols-2">{gates.map(gate => {
            const evidence = batch.gates.find(value => value.gate === gate);
            return <div key={gate} className="min-w-0 space-y-2 rounded-xl border p-3"><dt className="font-semibold">{gateLabels[gate]}</dt><dd className="text-sm">{evidence?.passed ? "Disetujui dengan bukti" : "Belum disetujui"}{evidence?.evidence && <span className="mt-2 block whitespace-pre-wrap leading-6">Bukti: {evidence.evidence}</span>}</dd></div>;
        })}</dl>
    <Button variant="outline" disabled={disabled} onClick={() => onEdit({ kind: "gate", batch })}>Tinjau bukti migrasi</Button>
    <p className="text-sm leading-6 text-muted-foreground">Persetujuan bukti tidak mengimpor data atau memindahkan layanan secara otomatis. Ikuti prosedur operator untuk rencana impor, rekonsiliasi, backup, dan pemindahan layanan.</p>
  </div>;
}
export function MigrationManager() {
    const [batches, setBatches] = useState<MigrationBatch[] | null>(null), [selection, setSelection] = useState<Selection | null>(null);
    const [reading, setReading] = useState(true), [readReady, setReadReady] = useState(false), [writing, setWriting] = useState(false), [blocked, setBlocked] = useState(false);
    const [error, setError] = useState(""), [notice, setNotice] = useState(""), [action, setAction] = useState<MigrationAction | null>(null);
    const [q, setQ] = useState(""), [state, setState] = useState(""), [page, setPage] = useState(1);
    const mounted = useRef(false), pending = useRef(false), read = useRef<AbortController | null>(null), upload = useRef<AbortController | null>(null), lastBatch = useRef<string | null>(null);
    function select(value: Selection | null) { if (value) lastBatch.current = value.batchId; setSelection(value); }
    const refresh = useCallback(async (target?: {
        id: string;
        minimumVersion?: string;
    }) => {
        read.current?.abort();
        const controller = new AbortController();
        read.current = controller;
        setReading(true);
        setReadReady(false);
        setError("");
        try {
            const value = readMigrationResponse(migrationBoardSchema, await masterRequest<unknown>(api + "board", "GET", undefined, controller.signal));
            if (!mounted.current || read.current !== controller)
                return;
            setBatches(value.batches);
            const id = target?.id ?? lastBatch.current, batch = value.batches.find(row => row.id === id);
            if (target?.minimumVersion && (!batch || BigInt(batch.version) < BigInt(target.minimumVersion)))
                throw new ApiRequestError("INVALID_RESPONSE", "Versi terbaru batch belum tersedia. Muat ulang dan periksa hasil perubahan sebelum melanjutkan.");
            if (batch) {
                const report = readMigrationResponse(migrationReportSchema, await masterRequest<unknown>(api + "board?id=" + encodeURIComponent(batch.id), "GET", undefined, controller.signal));
                if (!mounted.current || read.current !== controller)
                    return;
                const next = { batchId: batch.id, version: batch.version, report };
                lastBatch.current = next.batchId;
                setSelection(next);
            }
            else {
                lastBatch.current = null;
                setSelection(null);
            }
            setBlocked(false);
            setReadReady(true);
        }
        catch (e) {
            if (mounted.current && read.current === controller) {
                setSelection(null);
                setError(e instanceof Error ? e.message : "Daftar batch belum dapat dimuat. Coba kembali.");
            }
        }
        finally {
            if (mounted.current && read.current === controller)
                setReading(false);
        }
    }, []);
    useEffect(() => {
        mounted.current = true;
        let active = true;
        queueMicrotask(() => { if (active)
            void refresh(); });
        return () => { active = false; mounted.current = false; read.current?.abort(); read.current = null; upload.current?.abort(); };
    }, [refresh]);
    async function viewBatch(batch: MigrationBatch) {
        if (pending.current)
            return;
        read.current?.abort();
        const controller = new AbortController();
        read.current = controller;
        setReading(true);
        setReadReady(false);
        setError("");
        try {
            const report = readMigrationResponse(migrationReportSchema, await masterRequest<unknown>(api + "board?id=" + encodeURIComponent(batch.id), "GET", undefined, controller.signal));
            if (mounted.current && read.current === controller) {
                select({ batchId: batch.id, version: batch.version, report });
                setReadReady(true);
            }
        }
        catch (e) {
            if (mounted.current && read.current === controller)
                setError(e instanceof Error ? e.message : "Laporan belum dapat dimuat. Coba kembali.");
        }
        finally {
            if (mounted.current && read.current === controller)
                setReading(false);
        }
    }
    async function stage(event: ChangeEvent<HTMLInputElement>) {
        const input = event.currentTarget, file = input.files?.[0];
        if (!file)
            return;
        if (pending.current || reading || !batches || blocked || !readReady) {
            input.value = "";
            return;
        }
        pending.current = true;
        setWriting(true);
        setError("");
        setNotice("");
        const controller = new AbortController();
        upload.current = controller;
        let sent = false;
        try {
            if (file.size > limit)
                throw new Error("Ukuran ekspor melebihi 2 MiB. Pecah ekspor sesuai prosedur operator.");
            let text: string;
            try {
                text = await file.text();
            }
            catch {
                throw new Error("Berkas belum dapat dibaca. Pilih ulang berkas JSON ekspor yang dapat diakses.");
            }
            if (!mounted.current || controller.signal.aborted)
                return;
            let parsed: unknown;
            try {
                parsed = JSON.parse(text);
            }
            catch {
                throw new Error("Berkas bukan JSON yang valid. Perbaiki format JSON pada sumber, lalu pilih ulang berkas.");
            }
            const data = validateAccount(exportSchema, parsed);
            if (new TextEncoder().encode(JSON.stringify(data)).byteLength > limit)
                throw new Error("Data JSON yang akan dikirim melebihi 2 MiB. Pecah ekspor sesuai prosedur operator.");
            sent = true;
            const result = readMigrationResponse(migrationStagedSchema, await masterRequest<unknown>(api + "stage", "POST", data, controller.signal));
            if (!mounted.current || controller.signal.aborted)
                return;
            setNotice(result.replayed ? `Ekspor ini sudah tercatat; tidak dibuat batch ganda. Referensi: ${result.id}.` : `Berkas berhasil diperiksa di area privat. Referensi batch: ${result.id}.`);
            setBlocked(true);
            lastBatch.current = result.id;
            select(null);
            setQ("");
            setState("");
            setPage(1);
            void refresh({ id: result.id });
        }
        catch (e) {
            if (mounted.current && !controller.signal.aborted) {
                if (sent && uncertain(e))
                    setBlocked(true);
                setError(e instanceof Error ? e.message : "Berkas belum dapat diperiksa.");
            }
        }
        finally {
            input.value = "";
            pending.current = false;
            upload.current = null;
            if (mounted.current)
                setWriting(false);
        }
    }
    async function save(input: unknown, signal: AbortSignal) {
        if (pending.current || reading || blocked || !readReady || !action)
            return;
        pending.current = true;
        setWriting(true);
        setNotice("");
        const current = action;
        try {
            const result = readMigrationResponse(migrationSavedSchema, await masterRequest<unknown>(api + current.kind, "POST", input, signal));
            if (BigInt(result.version) <= BigInt(current.batch.version))
                throw new ApiRequestError("INVALID_RESPONSE", "Versi hasil penyimpanan tidak sesuai. Muat ulang batch sebelum menyimpan lagi.");
            if (!mounted.current || signal.aborted)
                return;
            setAction(null);
            setBlocked(true);
            lastBatch.current = current.batch.id;
            select(null);
            setNotice(current.kind === "gate" ? "Keputusan bukti berhasil disimpan. Persetujuan tidak menjalankan pemindahan layanan." : "Hasil peninjauan berhasil disimpan. Persetujuan bukti batch perlu diperiksa kembali.");
            void refresh({ id: current.batch.id, minimumVersion: result.version });
        }
        catch (e) {
            if (mounted.current && !signal.aborted && (uncertain(e) || (e instanceof ApiRequestError && (e.status === 409 || e.code === "CONFLICT"))))
                setBlocked(true);
            throw e;
        }
        finally {
            pending.current = false;
            if (mounted.current)
                setWriting(false);
        }
    }
    const busy = reading || writing, disabled = busy || blocked || !readReady;
    const filtered = (batches ?? []).filter(batch => (!state || batch.state === state) && `${batch.source} ${batch.id} ${batch.source_checksum}`.toLowerCase().includes(q.trim().toLowerCase()));
    const last = Math.max(1, Math.ceil(filtered.length / 5)), current = Math.min(page, last);
    return <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
    <header><p className="text-xs font-semibold uppercase tracking-widest text-primary">Administrasi madrasah</p><h1 className="text-3xl font-bold">Migrasi data</h1><p className="max-w-3xl text-sm leading-7 text-muted-foreground">Periksa ekspor lama, selesaikan temuan, dan tinjau bukti kesiapan. Unggahan tidak otomatis memindahkan transaksi, mengirim email, atau mengganti layanan.</p></header>
    <Button variant="outline" disabled={busy || action !== null} onClick={() => void refresh()}>Muat ulang migrasi</Button>
    {notice && <p role="status">{notice}</p>}
    {busy && <p role="status" aria-busy="true">{writing ? "Memproses permintaan migrasi…" : "Memuat daftar atau laporan batch…"}</p>}
    <ErrorFeedback message={error} autoFocus/>
    {error && <p className="text-sm">{notice ? "Permintaan telah berhasil, tetapi data terbaru belum dapat dimuat. " : ""}{!readReady || blocked ? "Periksa pesan di atas. Muat ulang migrasi sebelum mengirim perubahan kembali." : "Perbaiki berkas sesuai pesan di atas, lalu pilih ulang berkas JSON."}</p>}
    {blocked && !action && !busy && !error && <p role="status">Periksa data terbaru melalui Muat ulang migrasi sebelum melanjutkan.</p>}
    <section className="ui-panel space-y-4"><h2 className="text-xl font-bold">Periksa berkas data lama</h2><label className="block min-w-0 space-y-2 text-sm">File JSON ekspor (maksimum 2 MiB)<input className="ui-control max-w-full file:mr-3 file:max-w-full file:whitespace-normal" type="file" accept="application/json,.json" disabled={disabled || !batches} onChange={event => void stage(event)}/></label><p className="text-sm leading-6 text-muted-foreground">Berkas langsung diperiksa setelah dipilih. Data login lama tidak dibawa. Gunakan kontrak ekspor dan prosedur operator untuk menyiapkan rencana impor. Jangan mengunggah berkas bukti ke tempat publik.</p></section>
    {batches && <section className="min-w-0 space-y-5" aria-label="Daftar batch migrasi"><h2 className="text-xl font-bold">Batch migrasi (50 terbaru)</h2><div className="grid min-w-0 gap-3 sm:grid-cols-2"><label className="min-w-0 text-sm">Cari sumber atau referensi batch<input className="ui-control mt-2" value={q} maxLength={150} onChange={e => { setQ(e.target.value); setPage(1); }}/></label><div className="min-w-0 text-sm"><label htmlFor="migration-state">Status batch</label><select id="migration-state" className="ui-control mt-2" value={state} onChange={e => { setState(e.target.value); setPage(1); }}><option value="">Semua status</option>{["blocked", "validated", "imported", "reconciled"].map(value => <option value={value} key={value}>{statusLabel(value)}</option>)}</select></div></div><p className="text-sm">{filtered.length} batch · halaman {current} dari {last}. Pencarian berlaku pada 50 batch terbaru.</p>
      {!filtered.length && <EmptyState title={batches.length ? "Tidak ada batch sesuai filter." : "Belum ada ekspor yang diperiksa."} description={batches.length ? "Ubah status atau hapus pencarian untuk melihat batch lainnya." : "Pilih berkas JSON ekspor untuk memulai pemeriksaan di area privat."}/>}
      {filtered.slice((current - 1) * 5, current * 5).map(batch => <section className="ui-panel min-w-0 space-y-4" key={batch.id}><h2 className="text-xl font-bold">{batch.source}</h2><p className="text-sm font-semibold text-primary">{statusLabel(batch.state)} · versi {batch.version}</p><p className="text-sm">{batch.summary.rows} baris · {batch.summary.errors} kesalahan · {batch.summary.review} temuan peninjauan awal · {batch.summary.redactedFields} kolom/nilai rahasia dikeluarkan</p><p className="text-xs text-muted-foreground">Referensi: {batch.id}<span className="mt-1 block">Checksum: {batch.source_checksum}</span></p><Button variant="outline" disabled={busy} onClick={() => void viewBatch(batch)}>Periksa temuan dan bukti</Button>{selection?.batchId === batch.id && selection.version === batch.version && <BatchDetails key={batch.id + batch.version} batch={batch} report={selection.report} disabled={disabled} onEdit={setAction}/>}</section>)}
      <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" disabled={current <= 1} onClick={() => setPage(current - 1)}>Batch sebelumnya</Button><Button variant="outline" disabled={current >= last} onClick={() => setPage(current + 1)}>Batch berikutnya</Button></div>
    </section>}
    {action && <MigrationEditor action={action} blocked={blocked} onSave={save} onClose={() => setAction(null)} onRecover={() => { setAction(null); void refresh({ id: action.batch.id }); }}/>}
  </div>;
}
