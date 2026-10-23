"use client";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/dialog";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { EmptyState } from "@/components/feedback/feature-state";
import { Field } from "@/features/auth/account-lifecycle";
import { masterRequest } from "@/features/masters/api";
import { validateAccount } from "@/lib/accounts/client-validation";
import { ApiRequestError, serverFieldErrors } from "@/lib/feedback/api-error";
import { applyFieldErrors } from "@/lib/feedback/form-fields";
import { statusLabel } from "@/lib/ui-status";
import { commands, type Operations } from "@/lib/operations/schemas";
import { operationsSchema, settingsSavedSchema, emailUpdatedSchema, jobRetriedSchema, readOperationsResponse, toWibInput, fromWibInput, formatOperationalTime, } from "@/lib/operations/operational-contracts";
export { AnnouncementManager } from "./announcement-manager";
const api = "/api/operations/";
type Action = {
    kind: "settings";
} | {
    kind: "retry" | "reconcile";
    id: string;
} | {
    kind: "job-retry";
    key: string;
};
const titles = { settings: "Atur operasional aplikasi", retry: "Tinjau pengiriman ulang", reconcile: "Tinjau status pengiriman", "job-retry": "Tinjau pengulangan pekerjaan" };
const submits = { settings: "Simpan pengaturan operasional", retry: "Jadwalkan pengiriman ulang", reconcile: "Simpan hasil pemeriksaan", "job-retry": "Jadwalkan ulang pekerjaan" };
const notices = { settings: "Pengaturan operasional berhasil disimpan.", retry: "Email berhasil dijadwalkan ulang. Pengiriman mengikuti pengaturan operasional.", reconcile: "Hasil pemeriksaan email berhasil disimpan.", "job-retry": "Percobaan ulang pekerjaan berhasil dijadwalkan. Pelaksanaan mengikuti jadwal dan pengaturan pekerjaan otomatis." };
function OperationsEditor({ action, data, blocked, onSave, onClose, onRecover }: {
    action: Action;
    data: Operations;
    blocked: boolean;
    onSave: (input: unknown, signal: AbortSignal) => Promise<void>;
    onClose: () => void;
    onRecover: () => void;
}) {
    const [saving, setSaving] = useState(false), [error, setError] = useState("");
    const pending = useRef(false), mounted = useRef(false), controller = useRef<AbortController | null>(null);
    const prefix = useId(), formId = prefix + "form";
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending.current || blocked)
            return;
        const form = event.currentTarget, values = new FormData(form), c = new AbortController();
        pending.current = true;
        controller.current = c;
        setSaving(true);
        setError("");
        try {
            applyFieldErrors(form, {});
            const reason = String(values.get("reason") ?? "");
            let input: unknown;
            if (action.kind === "settings") {
                input = validateAccount(commands.settings, {
                    version: data.config.version, reason,
                    config: {
                        mailEnabled: values.get("mailEnabled") === "true",
                        securityMailEnabled: values.get("securityMailEnabled") === "true",
                        jobsEnabled: values.get("jobsEnabled") === "true",
                        maintenance: values.get("maintenance") === "true",
                        maintenanceStart: fromWibInput(String(values.get("maintenanceStart") ?? "")),
                        maintenanceEnd: fromWibInput(String(values.get("maintenanceEnd") ?? "")),
                    },
                }, true);
            }
            else if (action.kind === "job-retry") {
                input = validateAccount(commands["job-retry"], { key: action.key, reason }, true);
            }
            else if (action.kind === "retry") {
                input = validateAccount(commands.retry, { id: action.id, reason }, true);
            }
            else {
                if (!["true", "false"].includes(String(values.get("sent"))))
                    throw new ApiRequestError("VALIDATION_ERROR", "Pilih hasil pemeriksaan penerimaan email.", 422, { sent: ["Pilih berdasarkan bukti penerimaan email."] });
                input = validateAccount(commands.reconcile, { id: action.id, reason, sent: values.get("sent") === "true" }, true);
            }
            await onSave(input, c.signal);
        }
        catch (e) {
            if (mounted.current && !c.signal.aborted) {
                applyFieldErrors(form, serverFieldErrors(e));
                setError(e instanceof Error ? e.message : "Permintaan belum dapat disimpan.");
            }
        }
        finally {
            pending.current = false;
            controller.current = null;
            if (mounted.current)
                setSaving(false);
        }
    }
    const config = data.config.value;
    const switches = [
        ["mailEnabled", "Email pengumuman dan kegiatan", config.mailEnabled],
        ["securityMailEnabled", "Email aktivasi dan pengamanan akun", config.securityMailEnabled],
        ["jobsEnabled", "Pekerjaan otomatis", config.jobsEnabled],
        ["maintenance", "Pemeliharaan segera", config.maintenance],
    ] as const;
    return <FormDialog title={titles[action.kind]} trigger="" open onOpenChange={open => { if (!open && !pending.current)
        onClose(); }} busy={saving} description="Periksa dampak perubahan dan isi alasan untuk riwayat audit. Semua waktu pada formulir memakai WIB." footer={<Button type="submit" form={formId} disabled={saving || blocked}>{saving ? "Menyimpan…" : submits[action.kind]}</Button>}>
    <form id={formId} method="post" onSubmit={event => void submit(event)} className="min-w-0 space-y-5 [overflow-wrap:anywhere]" aria-busy={saving}>
      <fieldset disabled={saving || blocked} className="min-w-0 space-y-5">
        {action.kind === "settings" ? <>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">{switches.map(([name, label, enabled]) => <div key={name} className="min-w-0 space-y-2 text-sm"><label htmlFor={prefix + name} className="block font-medium">{label}</label><select id={prefix + name} name={name} className="ui-control" defaultValue={String(enabled)} required><option value="true">Ya</option><option value="false">Tidak</option></select></div>)}</div>
          <p className="text-sm leading-6 text-muted-foreground">Pemeliharaan segera berlaku sampai dinonaktifkan. Jadwal di bawah tetap berlaku meskipun pemeliharaan segera dipilih Tidak. Untuk menghentikan seluruh pemeliharaan, pilih Tidak dan kosongkan kedua waktu jadwal.</p>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">{(["maintenanceStart", "maintenanceEnd"] as const).map((name, index) => <div key={name} className="min-w-0 space-y-2 text-sm"><label htmlFor={prefix + name} className="block font-medium">{index ? "Selesai" : "Mulai"} pemeliharaan (WIB)</label><input className="ui-control max-w-full" id={prefix + name} name={name} type="datetime-local" step="0.001" defaultValue={toWibInput(config[name])}/></div>)}</div>
          <p className="text-sm leading-6 text-muted-foreground">Isi kedua waktu untuk menjadwalkan pemeliharaan, atau kosongkan keduanya. Waktu selesai harus setelah waktu mulai. Admin dan pemulihan akun tetap tersedia.</p>
        </> : <>
          <p className="rounded-xl border bg-muted/30 p-3 text-sm">{action.kind === "job-retry" ? `Pekerjaan: ${action.key}` : `Referensi email: ${action.id}`}</p>
          {action.kind === "reconcile" ? <>
            <p className="text-sm leading-6">Periksa bukti penerimaan terlebih dahulu. Pilihan Ya menandai email terkirim; pilihan Tidak membatalkan antrean ini. Keduanya tidak mengirim ulang email.</p>
            <div className="min-w-0 space-y-2 text-sm"><label className="block font-medium" htmlFor={prefix + "sent"}>Email terbukti diterima</label><select id={prefix + "sent"} name="sent" className="ui-control" defaultValue="" required><option value="" disabled>Pilih hasil pemeriksaan…</option><option value="true">Ya, ada bukti penerimaan</option><option value="false">Tidak, batalkan antrean ini</option></select></div>
          </> : <p className="text-sm leading-6">Pastikan penyebab kegagalan sudah ditangani sebelum menjadwalkan ulang. Tindakan ini menyiapkan percobaan baru; keberhasilannya perlu diperiksa kembali.</p>}
        </>}
        <Field name="reason" label={action.kind === "reconcile" ? "Alasan / bukti pemeriksaan" : "Alasan perubahan (min. 5 karakter)"} minLength={5} maxLength={500} multiline/>
      </fieldset>
      <ErrorFeedback message={error} autoFocus/>
      {blocked && <div className="space-y-3"><p className="text-sm leading-6">Muat ulang dan periksa data terbaru sebelum mengirim perubahan lagi. Formulir ini akan ditutup dan isian belum tersimpan akan dikosongkan.</p><Button type="button" variant="outline" onClick={onRecover}>Muat ulang dan periksa data</Button></div>}
    </form>
  </FormDialog>;
}
function QueueControls({ name, state, setState, q, setQ, page, total, onPage }: {
    name: "email" | "pekerjaan";
    state: string;
    setState: (v: string) => void;
    q: string;
    setQ: (v: string) => void;
    page: number;
    total: number;
    onPage: (v: number) => void;
}) {
    const prefix = useId(), last = Math.max(1, Math.ceil(total / 10));
    const states = name === "email" ? ["pending", "sending", "sent", "retry_wait", "failed", "unknown", "cancelled"] : ["pending", "running", "completed", "failed", "paused"];
    return <div className="space-y-3">
    <div className="grid min-w-0 gap-3 sm:grid-cols-2"><div className="min-w-0 text-sm"><label htmlFor={prefix + "q"}>Cari referensi {name}</label><input id={prefix + "q"} className="ui-control mt-2" maxLength={150} value={q} onChange={e => setQ(e.target.value)}/></div><div className="min-w-0 text-sm"><label htmlFor={prefix + "state"}>Status {name}</label><select id={prefix + "state"} className="ui-control mt-2" value={state} onChange={e => setState(e.target.value)}><option value="">Semua status</option>{states.map(value => <option key={value} value={value}>{value === "sending" ? "Sedang dikirim" : value === "paused" ? "Dijeda" : statusLabel(value)}</option>)}</select></div></div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{total} hasil · halaman {page} dari {last}</span><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" aria-label={"Halaman sebelumnya " + name} disabled={page <= 1} onClick={() => onPage(page - 1)}>Sebelumnya</Button><Button type="button" variant="outline" aria-label={"Halaman berikutnya " + name} disabled={page >= last} onClick={() => onPage(page + 1)}>Berikutnya</Button></div></div>
  </div>;
}
export function OperationsManager() {
    const [data, setData] = useState<Operations | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
    const [error, setError] = useState(""), [notice, setNotice] = useState(""), [blocked, setBlocked] = useState(false), [action, setAction] = useState<Action | null>(null);
    const [mailQ, setMailQ] = useState(""), [mailState, setMailState] = useState(""), [mailPage, setMailPage] = useState(1);
    const [jobQ, setJobQ] = useState(""), [jobState, setJobState] = useState(""), [jobPage, setJobPage] = useState(1);
    const mounted = useRef(false), read = useRef<AbortController | null>(null), pending = useRef(false);
    const load = useCallback(async () => {
        read.current?.abort();
        const controller = new AbortController();
        read.current = controller;
        setLoading(true);
        setError("");
        try {
            const result = readOperationsResponse(operationsSchema, await masterRequest<unknown>(api + "operations", "GET", undefined, controller.signal));
            if (mounted.current && read.current === controller) {
                setData(result);
                setBlocked(false);
            }
        }
        catch (e) {
            if (mounted.current && read.current === controller)
                setError(e instanceof Error ? e.message : "Pengaturan belum dapat dimuat. Coba kembali.");
        }
        finally {
            if (mounted.current && read.current === controller)
                setLoading(false);
        }
    }, []);
    useEffect(() => {
        mounted.current = true;
        let active = true;
        queueMicrotask(() => { if (active)
            void load(); });
        return () => { active = false; mounted.current = false; read.current?.abort(); read.current = null; };
    }, [load]);
    async function save(input: unknown, signal: AbortSignal) {
        if (pending.current || blocked || loading || error || !action || !data)
            return;
        pending.current = true;
        setBusy(true);
        setNotice("");
        const current = action;
        try {
            const raw = await masterRequest<unknown>(api + current.kind, "POST", input, signal);
            if (current.kind === "settings") {
                const result = readOperationsResponse(settingsSavedSchema, raw);
                if (BigInt(result.version) <= BigInt(data.config.version))
                    throw new ApiRequestError("INVALID_RESPONSE", "Versi hasil penyimpanan tidak sesuai. Periksa data terbaru sebelum menyimpan lagi.");
            }
            else if (current.kind === "job-retry")
                readOperationsResponse(jobRetriedSchema, raw);
            else if (readOperationsResponse(emailUpdatedSchema, raw).id !== current.id)
                throw new ApiRequestError("INVALID_RESPONSE", "Referensi hasil pemeriksaan tidak sesuai. Muat ulang dan periksa data.");
            if (!mounted.current || signal.aborted)
                return;
            setAction(null);
            setBlocked(true);
            setNotice(notices[current.kind]);
            void load();
        }
        catch (e) {
            if (mounted.current && !signal.aborted && e instanceof ApiRequestError &&
                (["NETWORK_ERROR", "TIMEOUT", "INVALID_RESPONSE", "VERSION_CONFLICT", "CONFLICT", "RETRY_NOT_ALLOWED", "RECONCILE_NOT_ALLOWED"].includes(e.code) || e.status >= 500 || e.status === 409))
                setBlocked(true);
            throw e;
        }
        finally {
            pending.current = false;
            if (mounted.current)
                setBusy(false);
        }
    }
    const disabled = loading || busy || blocked || Boolean(error);
    const mail = (data?.outbox ?? []).filter(row => (!mailState || row.state === mailState) && row.id.toLowerCase().includes(mailQ.trim().toLowerCase()));
    const jobs = (data?.jobs ?? []).filter(row => (!jobState || row.state === jobState) && `${row.business_key} ${row.kind}`.toLowerCase().includes(jobQ.trim().toLowerCase()));
    const shownMailPage = Math.min(mailPage, Math.max(1, Math.ceil(mail.length / 10))), shownJobPage = Math.min(jobPage, Math.max(1, Math.ceil(jobs.length / 10)));
    return <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
    <header><p className="text-xs font-semibold uppercase tracking-widest text-primary">Administrasi madrasah</p><h1 className="text-3xl font-bold">Pengaturan operasional</h1><p className="max-w-3xl text-sm leading-7 text-muted-foreground">Atur pemeliharaan, pengiriman email, dan pekerjaan otomatis. Tinjau antrean serta catat alasan setiap perubahan.</p></header>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{data ? `Versi pengaturan ${data.config.version}` : "Data operasional aplikasi"}</p><Button variant="outline" disabled={loading || busy || action !== null} onClick={() => void load()}>Muat ulang operasional</Button></div>
    {notice && <p role="status">{notice}</p>}
    {loading && <p role="status" aria-busy="true">Memuat pengaturan dan antrean…</p>}
    <ErrorFeedback message={error} autoFocus/>
    {error && <p className="text-sm">{notice ? "Perubahan telah disimpan, tetapi data terbaru belum dapat dimuat. " : ""}Gunakan Muat ulang operasional untuk mencoba kembali. Tindakan perubahan dinonaktifkan sampai data terbaru berhasil dimuat.</p>}
    {blocked && !action && !loading && !error && <p role="status">Periksa data terbaru sebelum melanjutkan. Pilih Muat ulang operasional.</p>}
    {data && <>
      <section className="ui-panel space-y-4" aria-label="Pengaturan aplikasi"><h2 className="text-xl font-bold">Pemeliharaan aplikasi {data.maintenanceActive ? "aktif" : "tidak aktif"}</h2><p className="text-sm leading-6">Admin dan pemulihan akun tetap tersedia selama pemeliharaan. Jadwal dan waktu pemrosesan ditampilkan dalam WIB.</p>
        <dl className="grid min-w-0 gap-3 sm:grid-cols-3">{([
                ["Email pengumuman dan kegiatan", data.config.value.mailEnabled], ["Email aktivasi dan pengamanan akun", data.config.value.securityMailEnabled], ["Pekerjaan otomatis", data.config.value.jobsEnabled],
            ] as const).map(([name, enabled]) => <div key={name} className="min-w-0 rounded-xl border bg-muted/30 p-4"><dt className="text-sm text-muted-foreground">{name}</dt><dd className="mt-2 font-semibold">{enabled ? "Aktif" : "Nonaktif"}</dd></div>)}</dl>
        <p className="text-sm">Pemeliharaan segera: {data.config.value.maintenance ? "Ya" : "Tidak"}. Jadwal: {data.config.value.maintenanceStart && data.config.value.maintenanceEnd ? `${formatOperationalTime(data.config.value.maintenanceStart)} – ${formatOperationalTime(data.config.value.maintenanceEnd)} WIB` : "Belum diatur"}.</p>
        <Button variant="outline" disabled={disabled} onClick={() => setAction({ kind: "settings" })}>Atur operasional aplikasi</Button>
      </section>
      <section className="ui-panel space-y-4"><h2 className="text-xl font-bold">Pembatasan kegiatan</h2><div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{([["/admin/jurnal", "Blok jurnal mata pelajaran"], ["/admin/acara", "Blok jurnal acara"], ["/admin/honorarium/operasi", "Blok transport dan libur"]] as const).map(([href, label]) => <Link key={href} prefetch={false} className="inline-flex min-h-11 items-center underline underline-offset-4" href={href}>{label}</Link>)}</div></section>
      <section className="ui-panel space-y-4" aria-label="Antrean email"><h2 className="text-xl font-bold">Antrean email (100 terbaru)</h2><p className="text-sm leading-6">Status pengiriman tidak pasti memerlukan bukti penerimaan dan tidak dikirim ulang otomatis. Pencarian dan filter berlaku pada 100 antrean terbaru.</p>
        <QueueControls name="email" q={mailQ} setQ={v => { setMailQ(v); setMailPage(1); }} state={mailState} setState={v => { setMailState(v); setMailPage(1); }} page={shownMailPage} total={mail.length} onPage={setMailPage}/>
        {!mail.length && <EmptyState title={data.outbox.length ? "Tidak ada email sesuai filter." : "Belum ada antrean."} description={data.outbox.length ? "Ubah status atau hapus pencarian untuk melihat antrean lainnya." : "Antrean email akan tampil setelah ada pengiriman yang dijadwalkan."}/>}
        {mail.slice((shownMailPage - 1) * 10, shownMailPage * 10).map(row => <article key={row.id} className="min-w-0 space-y-3 rounded-xl border p-4"><h3 className="font-semibold">{row.state === "sending" ? "Sedang dikirim" : statusLabel(row.state)} · {row.attempts} percobaan</h3><p className="text-sm">Referensi: {row.id}</p><p className="text-sm text-muted-foreground">{["pending", "retry_wait"].includes(row.state) ? "Jadwal percobaan" : "Waktu antrean berikutnya yang tercatat"}: {formatOperationalTime(row.next_attempt_at)} WIB</p>{["failed", "unknown"].includes(row.state) && <Button variant="outline" disabled={disabled} onClick={() => setAction({ kind: row.state === "failed" ? "retry" : "reconcile", id: row.id })}>{row.state === "failed" ? "Tinjau pengiriman ulang" : "Tinjau status pengiriman"}</Button>}</article>)}
      </section>
      <section className="ui-panel space-y-4" aria-label="Pekerjaan terjadwal"><h2 className="text-xl font-bold">Pekerjaan terjadwal (100 terbaru)</h2><p className="text-sm">Panggilan pemrosesan otomatis terakhir: {data.lastWorkerAt ? formatOperationalTime(data.lastWorkerAt) + " WIB" : "Belum ada eksekusi"}. Waktu panggilan tidak menjamin seluruh pekerjaan atau email berhasil.</p>
        <QueueControls name="pekerjaan" q={jobQ} setQ={v => { setJobQ(v); setJobPage(1); }} state={jobState} setState={v => { setJobState(v); setJobPage(1); }} page={shownJobPage} total={jobs.length} onPage={setJobPage}/>
        {!jobs.length && <EmptyState title={data.jobs.length ? "Tidak ada pekerjaan sesuai filter." : "Belum ada eksekusi."} description={data.jobs.length ? "Ubah status atau hapus pencarian untuk melihat pekerjaan lainnya." : "Hasil pekerjaan akan tampil setelah pemrosesan otomatis dijalankan."}/>}
        {jobs.slice((shownJobPage - 1) * 10, shownJobPage * 10).map(row => <article key={row.business_key} className="min-w-0 space-y-3 rounded-xl border p-4"><h3 className="font-semibold">{row.business_key}</h3><p className="text-sm">{row.state === "paused" ? "Dijeda" : statusLabel(row.state)} · {row.attempts} eksekusi</p>{row.state === "failed" && <Button variant="outline" disabled={disabled} onClick={() => setAction({ kind: "job-retry", key: row.business_key })}>Tinjau pengulangan pekerjaan</Button>}</article>)}
      </section>
      {action && <OperationsEditor action={action} data={data} blocked={blocked} onSave={save} onClose={() => setAction(null)} onRecover={() => { setAction(null); void load(); }}/>}
    </>}
  </div>;
}
