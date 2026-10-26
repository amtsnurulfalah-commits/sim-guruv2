"use client";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiRequestError } from "@/lib/feedback/api-error";
import { claimDraftAccount, draftKey, readDraft, writeDraft, type Draft, type DraftFields, type DraftScope } from "@/lib/drafts/storage";

export const uncertainDraftResult = (error: unknown) => error instanceof z.ZodError ? false : error instanceof ApiRequestError ? (["NETWORK_ERROR", "TIMEOUT", "INVALID_RESPONSE"].includes(error.code) || error.status >= 500 || error.status === 409 || error.status === 404) : true;
export type FormDraftConfig = { scope: DraftScope; fields: DraftFields };
/** Only live form input is saved. Restoring never submits and never changes source IDs. */
export function useFormDraft(formId: string, config: FormDraftConfig | null, active: boolean, onRestore?: (values: Record<string, string>) => void) {
  const [view, setView] = useState<{ candidate: Draft | null; saved: number | null; error: boolean; offline: boolean; outcome?: "sending" | "uncertain" | "rejected" | "saved" }>({ candidate: null, saved: null, error: false, offline: false });
  const [element, formRef] = useState<HTMLFormElement | null>(null);
  const candidate = useRef<Draft | null>(null), suspended = useRef(false), generation = useRef(0);
  const serialized = config ? JSON.stringify(config) : "";
  useEffect(() => {
    if (!active || !serialized) return;
    const { scope, fields } = JSON.parse(serialized) as FormDraftConfig;
    const form = element;
    if (!form) return;
    let disposed = false;
    candidate.current = null;
    suspended.current = false;
    try {
      claimDraftAccount(sessionStorage, scope.account);
      candidate.current = readDraft(sessionStorage, scope, fields);
      queueMicrotask(() => { if (!disposed) setView({ candidate: candidate.current, saved: null, error: false, offline: !navigator.onLine }); });
    } catch { queueMicrotask(() => { if (!disposed) setView({ candidate: null, saved: null, error: true, offline: !navigator.onLine }); }); }
    const change = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) || !Object.hasOwn(fields, target.name) || candidate.current || suspended.current) return;
      // Persist synchronously, but defer the status render until React's delegated
      // onChange has processed controlled inputs (microtasks can run between listeners).
      try {
        const values: Record<string, string> = {};
        for (const key of Object.keys(fields)) {
          const control = form.elements.namedItem(key);
          values[key] = control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement ? control.value : "";
        }
        const saved = writeDraft(sessionStorage, scope, fields, values), ticket = generation.current;
        setTimeout(() => { if (ticket === generation.current && !disposed && !suspended.current && !candidate.current) setView(v => ({ ...v, saved: saved.savedAt, error: false })); }, 0);
      } catch { setTimeout(() => { if (!disposed) setView(v => ({ ...v, error: true })); }, 0); }
    };
    const network = () => setView(v => ({ ...v, offline: !navigator.onLine }));
    const cleared = () => { suspended.current = true; candidate.current = null; generation.current++; setView(v => ({ ...v, candidate: null, saved: null })); };
    form.addEventListener("input", change);
    form.addEventListener("change", change);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    window.addEventListener("sim-guru:drafts-cleared", cleared);
    return () => { disposed = true; form.removeEventListener("input", change); form.removeEventListener("change", change); window.removeEventListener("online", network); window.removeEventListener("offline", network); window.removeEventListener("sim-guru:drafts-cleared", cleared); };
  }, [serialized, element, active]);
  function remove() {
    if (!config) return;
    try { sessionStorage.removeItem(draftKey(config.scope)); generation.current++; candidate.current = null; suspended.current = false; setView(v => ({ candidate: null, saved: null, error: false, offline: v.offline })); }
    catch { setView(v => ({ ...v, error: true })); }
  }
  function restore() {
    if (!config) return;
    try {
      const draft = readDraft(sessionStorage, config.scope, config.fields);
      if (!draft || draft.basis !== config.scope.basis) { candidate.current = draft; setView(v => ({ ...v, candidate: draft })); return; }
      const form = document.getElementById(formId) as HTMLFormElement | null;
      if (!form) return;
      for (const [name, value] of Object.entries(draft.values)) {
        const control = form.elements.namedItem(name);
        if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) control.value = value;
      }
      onRestore?.(draft.values);
      candidate.current = null;
      const saved = writeDraft(sessionStorage, config.scope, config.fields, draft.values);
      setView(v => ({ candidate: null, saved: saved.savedAt, error: false, offline: v.offline }));
      form.dispatchEvent(new Event("input", { bubbles: true }));
    } catch { setView(v => ({ ...v, error: true })); }
  }
  function beforeSubmit() {
    if (!config) return;
    if (candidate.current) throw new ApiRequestError("FORM_NOT_READY", "Pulihkan atau hapus draft lokal terlebih dahulu sebelum menyimpan.");
    suspended.current = true;
    setView(v => ({ ...v, outcome: "sending" }));
    const ticket = generation.current;
    try {
      const form = document.getElementById(formId) as HTMLFormElement;
      const data = new FormData(form), values: Record<string, string> = {};
      for (const key of Object.keys(config.fields)) values[key] = String(data.get(key) ?? "");
      writeDraft(sessionStorage, config.scope, config.fields, values, "uncertain");
    } catch { setView(v => ({ ...v, error: true })); }
    return ticket;
  }
  function failed(error: unknown) {
    setView(v => ({ ...v, outcome: uncertainDraftResult(error) ? "uncertain" : "rejected" }));
    if (!uncertainDraftResult(error)) {
      suspended.current = false;
      if (config) try {
        const draft = readDraft(sessionStorage, config.scope, config.fields);
        if (draft) writeDraft(sessionStorage, config.scope, config.fields, draft.values, "editing");
      } catch { setView(v => ({ ...v, error: true })); }
    }
  }
  function submitted(ticket: number | undefined) {
    if (ticket === generation.current) { remove(); setView(v => ({ ...v, outcome: "saved" })); }
  }
  return { ...view, formRef, stale: !!view.candidate && view.candidate.basis !== config?.scope.basis, restore, remove, beforeSubmit, submitted, failed };
}
export function DraftStatus({ draft, disabled = false }: { draft: Omit<ReturnType<typeof useFormDraft>, "formRef">; disabled?: boolean }) {
  const [reviewedKey, setReviewedKey] = useState("");
  const candidateKey = draft.candidate ? JSON.stringify([draft.candidate.account, draft.candidate.entity, draft.candidate.basis, draft.candidate.savedAt]) : "";
  const reviewed = !!candidateKey && reviewedKey === candidateKey;
  return <section aria-label="Draft lokal" className="min-w-0 sm:col-span-2 space-y-3 rounded-xl border bg-muted/30 p-3 text-sm [overflow-wrap:anywhere]">
    {draft.outcome && <p role="status">{({ sending: "Sedang dikirim. Tunggu hasil sebelum meninggalkan formulir.", uncertain: "Hasil simpan belum pasti. Jangan kirim ulang sebelum memeriksa data terbaru.", rejected: "Permintaan belum tersimpan. Perbaiki kendala yang ditampilkan sebelum mencoba kembali.", saved: "Tersimpan di server." })[draft.outcome]}</p>}
    <p role="status">{draft.error ? "Draft lokal tidak dapat disimpan. Pertahankan formulir ini terbuka dan salin isian penting sebelum meninggalkan halaman." : draft.candidate ? "Draft lokal tersedia untuk ditinjau." : draft.saved ? `Draft tersimpan di tab ini pukul ${new Date(draft.saved).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })} WIB.` : "Isian disimpan otomatis sebagai draft di tab ini."}</p>
    <p className="text-muted-foreground">Draft belum terkirim ke server. Berlaku 24 jam; dihapus saat logout atau berganti akun. Menutup tab dapat menghapus draft.</p>
    {draft.offline && <p role="status">Koneksi terputus. Lanjutkan menulis; kirim setelah terhubung dan periksa hasil di riwayat. Tidak ada pengiriman otomatis.</p>}
    {draft.candidate && <>
      <p>Disimpan {new Date(draft.candidate.savedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB.</p>
      {draft.stale && <p role="alert">Sumber atau versinya berubah. Draft tidak dapat dipulihkan langsung. Tinjau teks di bawah dan gunakan formulir terbaru.</p>}
      {draft.candidate.state === "uncertain" && <><p role="alert">Hasil permintaan sebelumnya belum pasti. Periksa riwayat dan data terbaru untuk memastikan apakah sudah tersimpan.</p><label className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={reviewed} onChange={e => setReviewedKey(e.target.checked ? candidateKey : "")}/>Saya sudah memeriksa hasil terbaru sebelum melanjutkan.</label></>}
      <details><summary className="min-h-11 cursor-pointer py-2 font-medium">Lihat isian draft</summary><dl className="space-y-2">{Object.entries(draft.candidate.values).map(([name, text]) => <div key={name}><dt className="font-medium">{({ material: "Materi", present: "Hadir", absent: "Absen", notes: "Catatan", reason: "Alasan" } as Record<string, string>)[name] ?? name}</dt><dd className="whitespace-pre-wrap">{text || "—"}</dd></div>)}</dl></details>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={disabled || draft.stale || (draft.candidate.state === "uncertain" && !reviewed)} onClick={draft.restore}>Pulihkan draft</Button><Button type="button" variant="outline" disabled={disabled} onClick={draft.remove}>Hapus draft lokal</Button></div>
    </>}
    {!draft.candidate && draft.saved && <Button type="button" variant="outline" disabled={disabled} onClick={draft.remove}>Hapus draft lokal</Button>}
  </section>;
}
