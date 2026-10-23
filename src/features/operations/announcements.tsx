"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Megaphone, RotateCcw, X } from "lucide-react";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { Button } from "@/components/ui/button";
import { masterRequest } from "@/features/masters/api";
import { visibleAnnouncementsSchema, announcementDismissedSchema, readAnnouncementResponse } from "@/lib/operations/announcement-contracts";
import type { z } from "zod";
type Announcement = z.infer<typeof visibleAnnouncementsSchema>[number];
const severityLabels: Record<string, string> = { info: "Informasi", success: "Pemberitahuan", warning: "Perhatian", critical: "Penting" };
export function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const mounted = useRef(false);
  const pending = useRef(false);
  const write = useRef<AbortController | null>(null);
  useEffect(() => () => write.current?.abort(), []);
  useEffect(() => {
    mounted.current = true;
    const c = new AbortController();
    masterRequest<unknown>("/api/operations/announcements", "GET", undefined, c.signal)
      .then(v => {
        if (c.signal.aborted) return;
        const result = readAnnouncementResponse(visibleAnnouncementsSchema, v);
        setItems(result); setError("");
      })
      .catch(e => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Pengumuman belum dapat dimuat."); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => { mounted.current = false; c.abort(); };
  }, [revision]);
  async function dismiss(a: Announcement) {
    if (pending.current || loading || !a.canDismiss) return;
    pending.current = true; setBusyId(a.id); setError(""); setNotice("");
    const controller = new AbortController(); write.current = controller;
    try {
      readAnnouncementResponse(announcementDismissedSchema, await masterRequest<unknown>("/api/operations/dismiss", "POST", { id: a.id, version: a.version }, controller.signal));
      if (mounted.current) {
        setItems(current => current.filter(item => item.id !== a.id || item.version !== a.version));
        setNotice("Pengumuman berhasil ditutup.");
      }
    } catch(e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Gagal menutup pengumuman. Coba kembali.");
    } finally {
      write.current = null; pending.current = false;
      if (mounted.current) setBusyId(null);
    }
  }
  if (!items.length && !error && !notice && !loading) return null;
  return <section aria-label="Pengumuman" className="min-w-0 space-y-3">
    {loading && <p role="status" className="text-sm text-muted-foreground">Memuat pengumuman…</p>}
    {error && <div className="space-y-3"><ErrorFeedback message={error} /><Button variant="outline" disabled={busyId !== null || loading} onClick={() => { setError(""); setLoading(true); setRevision(v => v + 1); }}><RotateCcw aria-hidden="true" />Muat ulang pengumuman</Button></div>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {items.map(a => <article key={a.id} className="min-w-0 space-y-3 [overflow-wrap:anywhere] rounded-xl border bg-card p-4 sm:p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary"><Megaphone aria-hidden="true" className="size-4 shrink-0" />{Object.hasOwn(severityLabels,a.severity) ? severityLabels[a.severity] : "Informasi"}</p>
      <h2 className="text-lg font-bold">{a.title}</h2>
      <p className="whitespace-pre-wrap">{a.body}</p>
      <div className="flex flex-wrap items-center gap-3">
        {a.cta_url && <Link prefetch={false} href={a.cta_url} rel="noopener noreferrer" className="ui-text-link inline-flex min-h-11 max-w-full items-center rounded-md py-2 [overflow-wrap:anywhere]">{a.cta_text || "Lihat pengumuman"}</Link>}
        {a.canDismiss && <Button type="button" variant="outline" disabled={busyId !== null || loading || Boolean(error)} onClick={() => void dismiss(a)}><X aria-hidden="true" />{busyId === a.id ? "Menutup pengumuman…" : "Tutup pengumuman"}</Button>}
      </div>
    </article>)}
  </section>;
}
