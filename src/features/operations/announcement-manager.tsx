"use client";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { EmptyState } from "@/components/feedback/feature-state";
import { Field } from "@/features/auth/account-lifecycle";
import { masterRequest } from "@/features/masters/api";
import { validateAccount } from "@/lib/accounts/client-validation";
import { ApiRequestError, serverFieldErrors } from "@/lib/feedback/api-error";
import { applyFieldErrors } from "@/lib/feedback/form-fields";
import { commands } from "@/lib/operations/schemas";
import { managedAnnouncementsSchema, announcementSavedSchema, readAnnouncementResponse, type ManagedAnnouncement } from "@/lib/operations/announcement-contracts";
import { RecipientPicker } from "./recipient-picker";
import type { z } from "zod";
const severityLabels = { info: "Informasi", success: "Pemberitahuan", warning: "Perhatian", critical: "Penting" };
const uncertain = (e: unknown) => e instanceof ApiRequestError && (["NETWORK_ERROR", "TIMEOUT", "INVALID_RESPONSE"].includes(e.code) || e.status >= 500);
type SaveInput = z.infer<typeof commands.save>;
function AnnouncementEditor({ edit, disabled, onSave }: {
    edit: ManagedAnnouncement | null;
    disabled: boolean;
    onSave: (v: SaveInput, signal: AbortSignal) => Promise<void>;
}) {
    const [targets, setTargets] = useState(edit?.target_users ?? []), [allow, setAllow] = useState(edit?.allow_dismiss ?? []), [deny, setDeny] = useState(edit?.deny_dismiss ?? []);
    const [error, setError] = useState(""), [saving, setSaving] = useState(false);
    const pending = useRef(false), mounted = useRef(false), controller = useRef<AbortController | null>(null);
    const prefix = useId();
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending.current || disabled)
            return;
        pending.current = true;
        setSaving(true);
        setError("");
        const form = event.currentTarget, request = new AbortController();
        controller.current = request;
        try {
            applyFieldErrors(form, {});
            const values = new FormData(form);
            const data = Object.fromEntries([...values].map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));
            const input = validateAccount(commands.save, { ...data, id: edit?.id ?? null, version: edit?.version ?? null, active: data.active === "true", dismissible: data.dismissible === "true", sendEmail: data.sendEmail === "true", from: data.from || null, to: data.to || null, ctaText: data.ctaText || null, ctaUrl: data.ctaUrl || null, targetUsers: targets, allowDismiss: allow, denyDismiss: deny, reminderOffsets: values.getAll("reminderOffsets").map(Number) }, true);
            await onSave(input, request.signal);
        }
        catch (e) {
            if (mounted.current && !request.signal.aborted) {
                applyFieldErrors(form, serverFieldErrors(e));
                setError(e instanceof Error ? e.message : "Pengumuman belum dapat disimpan.");
            }
        }
        finally {
            pending.current = false;
            controller.current = null;
            if (mounted.current)
                setSaving(false);
        }
    }
    const selects = [
        { name: "severity", label: "Prioritas", value: edit?.severity ?? "info", options: Object.entries(severityLabels) },
        { name: "targetRole", label: "Sasaran peran", value: edit?.target_role ?? "all", options: [["all", "Semua"], ["guru", "Guru"], ["admin", "Admin"]] },
        { name: "active", label: "Aktif", value: String(edit?.active ?? true), options: [["true", "Ya"], ["false", "Tidak"]] },
        { name: "dismissible", label: "Dapat ditutup", value: String(edit?.dismissible ?? true), options: [["true", "Ya"], ["false", "Tidak"]] },
        { name: "sendEmail", label: "Antrekan email", value: String(edit?.send_email ?? false), options: [["false", "Tidak"], ["true", "Ya"]] },
    ];
    return <form method="post" onSubmit={e => void submit(e)} aria-busy={saving} className="min-w-0 space-y-5">
  <fieldset disabled={disabled || saving} className="min-w-0 space-y-5">
   <div className="grid min-w-0 gap-4 sm:grid-cols-2">
    <div className="sm:col-span-2"><Field name="title" label="Judul" value={edit?.title ?? ""} maxLength={200}/></div>
    <div className="sm:col-span-2"><Field name="body" label="Isi (teks biasa)" value={edit?.body ?? ""} maxLength={5000} multiline/></div>
    {selects.map(s => <div key={s.name} className="min-w-0 space-y-2 text-sm"><label htmlFor={prefix + s.name} className="block font-medium">{s.label}</label><select id={prefix + s.name} name={s.name} defaultValue={s.value} className="ui-control" required>{s.options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>)}
    <Field name="from" label="Tanggal mulai inklusif (WIB)" type="date" value={edit?.date_start ?? ""} required={false}/>
    <Field name="to" label="Tanggal akhir inklusif (WIB)" type="date" value={edit?.date_end ?? ""} required={false}/>
   </div>
   <fieldset className="min-w-0 space-y-2 rounded-xl border p-3"><legend className="px-1 text-sm font-semibold">Pengingat sebelum tanggal akhir</legend><div className="flex flex-wrap gap-4">{[3, 2, 1].map(n => <label key={n} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="reminderOffsets" value={n} defaultChecked={edit?.reminder_offsets.includes(n) ?? false}/>H-{n}</label>)}</div><p className="text-xs text-muted-foreground">Pengingat mengikuti tanggal akhir dan pengaturan pekerjaan otomatis.</p></fieldset>
   <div className="grid min-w-0 gap-4 sm:grid-cols-2"><Field name="ctaText" label="Teks tautan" maxLength={100} value={edit?.cta_text ?? ""} required={false}/><Field name="ctaUrl" label="URL http/https" maxLength={2000} value={edit?.cta_url ?? ""} required={false}/></div>
   <p className="text-sm text-muted-foreground">Isi teks dan URL tautan bersama-sama, atau kosongkan keduanya.</p>
   <details className="min-w-0 rounded-xl border p-3" open={Boolean(targets.length || allow.length || deny.length)}><summary className="min-h-11 cursor-pointer text-sm font-semibold">Sasaran dan pengecualian pengguna · {targets.length + allow.length + deny.length} pilihan</summary><div className="min-w-0 space-y-4 pt-3">
    <p className="text-sm leading-6">Pengguna tertentu menggantikan sasaran peran. Kosongkan sasaran pengguna untuk mengikuti peran. Jangan masukkan pengguna yang sama pada kedua pengecualian menutup.</p>
    <RecipientPicker name="targetUsers" label="Sasaran pengguna tertentu" value={targets} onChange={setTargets} names={edit?.recipientNames ?? {}} disabled={disabled || saving}/>
    <RecipientPicker name="allowDismiss" label="Pengecualian: boleh menutup" value={allow} onChange={setAllow} names={edit?.recipientNames ?? {}} disabled={disabled || saving}/>
    <RecipientPicker name="denyDismiss" label="Pengecualian: tidak boleh menutup" value={deny} onChange={setDeny} names={edit?.recipientNames ?? {}} disabled={disabled || saving}/>
   </div></details>
   <Field name="reason" label="Alasan perubahan (min. 5 karakter)" minLength={5} maxLength={500} multiline/>
   <Button type="submit" className="w-full sm:w-auto">{saving ? "Menyimpan…" : "Simpan pengumuman"}</Button>
  </fieldset>
  {error && <ErrorFeedback message={error} autoFocus/>}
 </form>;
}
export function AnnouncementManager() {
    const [items, setItems] = useState<ManagedAnnouncement[]>([]), [edit, setEdit] = useState<ManagedAnnouncement | null>(null), [draft, setDraft] = useState(0);
    const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(""), [message, setMessage] = useState(""), [blocked, setBlocked] = useState(false);
    const [recoveryMessage, setRecoveryMessage] = useState("");
    const [q, setQ] = useState(""), [active, setActive] = useState(""), [page, setPage] = useState(1);
    const mounted = useRef(false), read = useRef<AbortController | null>(null), pending = useRef(false), resetOnRead = useRef(false), editor = useRef<HTMLElement>(null);
    const load = useCallback(async () => {
        read.current?.abort();
        const c = new AbortController();
        read.current = c;
        setLoading(true);
        setError("");
        try {
            const value = readAnnouncementResponse(managedAnnouncementsSchema, await masterRequest<unknown>("/api/operations/manage", "GET", undefined, c.signal));
            if (mounted.current && !c.signal.aborted) {
                setItems(value);
                if (resetOnRead.current) {
                    resetOnRead.current = false;
                    setBlocked(false);
                    setEdit(null);
                    setDraft(v => v + 1);
                }
            }
        }
        catch (e) {
            if (mounted.current && !c.signal.aborted)
                setError(e instanceof Error ? e.message : "Pengumuman belum dapat dimuat.");
        }
        finally {
            if (mounted.current && !c.signal.aborted)
                setLoading(false);
        }
    }, []);
    useEffect(() => { mounted.current = true; let active = true; queueMicrotask(() => { if (active) void load(); }); return () => { active = false; mounted.current = false; read.current?.abort(); }; }, [load]);
    async function save(input: SaveInput, signal: AbortSignal) {
        if (pending.current || blocked)
            return;
        pending.current = true;
        setBusy(true);
        setMessage("");
        try {
            const result = readAnnouncementResponse(announcementSavedSchema, await masterRequest<unknown>("/api/operations/save", "POST", input, signal));
            if (input.id && (result.id !== input.id || BigInt(result.version) <= BigInt(input.version!)))
                throw new ApiRequestError("INVALID_RESPONSE", "Identitas hasil penyimpanan tidak sesuai.");
            if (!mounted.current || signal.aborted)
                return;
            setEdit(null);
            setDraft(v => v + 1);
            setMessage("Pengumuman berhasil disimpan. Email mengikuti pengaturan pengiriman dan pekerjaan otomatis.");
            void load();
        }
        catch (e) {
            if (mounted.current && !signal.aborted && (uncertain(e) || (e instanceof ApiRequestError && e.code === "VERSION_CONFLICT"))) {
                resetOnRead.current = true;
                setBlocked(true);
                setRecoveryMessage(e instanceof ApiRequestError && e.code === "VERSION_CONFLICT" ? "Data pengumuman telah berubah. Isian ini belum disimpan. Muat ulang daftar lalu pilih pengumuman terbaru sebelum mengubah kembali. Isian akan dikosongkan setelah pemuatan berhasil." : "Status penyimpanan belum dapat dipastikan. Muat ulang daftar dan periksa pengumuman sebelum membuat perubahan baru. Isian akan dikosongkan setelah pemeriksaan ulang berhasil.");
            }
            throw e;
        }
        finally {
            pending.current = false;
            if (mounted.current)
                setBusy(false);
        }
    }
    const filtered = items.filter(a => (!active || String(a.active) === active) && `${a.title} ${a.body}`.toLocaleLowerCase('id-ID').includes(q.trim().toLocaleLowerCase('id-ID')));
    const last = Math.max(1, Math.ceil(filtered.length / 20)), shownPage = Math.min(page, last), shown = filtered.slice((shownPage - 1) * 20, shownPage * 20);
    function select(a: ManagedAnnouncement | null) { if (pending.current || blocked)
        return; setEdit(a); setDraft(v => v + 1); setMessage(""); requestAnimationFrame(() => { editor.current?.scrollIntoView({ block: "start" }); editor.current?.querySelector<HTMLInputElement>('input[name="title"]')?.focus(); }); }
    return <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
  <header><p className="text-xs font-semibold uppercase tracking-widest text-primary">Administrasi madrasah</p><h1 className="mt-2 text-3xl font-bold">Pengumuman</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">Kelola informasi untuk warga madrasah. Email dikirim hanya jika pengiriman dan pekerjaan otomatis diaktifkan pada pengaturan operasional.</p></header>
  {message && <p role="status" className="rounded-xl border bg-primary/5 p-4 text-sm leading-6">{message}</p>}
  {blocked && <ErrorFeedback message={recoveryMessage} autoFocus/>}
  <section ref={editor} className="ui-panel min-w-0 space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{edit ? "Ubah pengumuman" : "Pengumuman baru"}</h2>{edit && <Button type="button" variant="outline" disabled={busy || blocked} onClick={() => select(null)}>Batal mengubah</Button>}</div>
   <AnnouncementEditor key={(edit?.id ?? "new") + draft} edit={edit} disabled={busy || loading || blocked || Boolean(error)} onSave={save}/>
  </section>
  <section className="ui-panel min-w-0 space-y-4" aria-label="Daftar pengumuman"><h2 className="text-xl font-bold">Daftar pengumuman</h2>
   <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3"><label className="min-w-0 text-sm">Cari judul atau isi<input className="ui-control mt-2" value={q} maxLength={100} onChange={e => { setQ(e.target.value); setPage(1); }}/></label><div className="min-w-0 text-sm"><label htmlFor="announcement-status">Status</label><select id="announcement-status" className="ui-control mt-2" value={active} onChange={e => { setActive(e.target.value); setPage(1); }}><option value="">Semua</option><option value="true">Aktif</option><option value="false">Nonaktif</option></select></div><Button variant="outline" disabled={busy || loading} onClick={() => void load()}>Muat ulang pengumuman</Button></div>
   {loading && <p role="status">Memuat pengumuman…</p>}{error && <ErrorFeedback message={error} autoFocus/>}
   {!loading && !error && <><p className="text-sm">{filtered.length} pengumuman · halaman {shownPage} dari {last}</p>{!shown.length && <EmptyState title="Belum ada pengumuman sesuai filter."/>}{shown.map(a => <article key={a.id} className="min-w-0 space-y-3 rounded-xl border p-4"><div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-primary"><span>{severityLabels[a.severity]}</span><span>· {a.active ? "Aktif" : "Nonaktif"} · versi {a.version}</span></div><h3 className="text-lg font-bold">{a.title}</h3><p className="whitespace-pre-wrap text-sm leading-7">{a.body}</p><p className="text-xs text-muted-foreground">{a.date_start ?? "Tanpa batas awal"} – {a.date_end ?? "Tanpa batas akhir"} · {a.target_users.length ? `${a.target_users.length} pengguna tertentu` : a.target_role === "all" ? "Semua peran" : a.target_role === "guru" ? "Guru" : "Admin"}</p><Button variant="outline" disabled={busy || blocked} onClick={() => select(a)}>Ubah pengumuman</Button></article>)}<div className="flex flex-wrap justify-between gap-3"><Button variant="outline" disabled={shownPage <= 1} onClick={() => setPage(shownPage - 1)}>Sebelumnya</Button><Button variant="outline" disabled={shownPage >= last} onClick={() => setPage(shownPage + 1)}>Berikutnya</Button></div></>}
  </section>
 </div>;
}
