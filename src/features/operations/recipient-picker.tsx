"use client";
import { useEffect, useState } from "react";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { Button } from "@/components/ui/button";
import { masterRequest } from "@/features/masters/api";
import { recipientListSchema, readAnnouncementResponse } from "@/lib/operations/announcement-contracts";
import type { z } from "zod";
export function RecipientPicker({ label, value, onChange, names, disabled = false, name }: {
    label: string;
    value: string[];
    onChange: (v: string[]) => void;
    names: Record<string, string>;
    disabled?: boolean;
    name?: string;
}) {
    const [q, setQ] = useState(""), [page, setPage] = useState(1), [users, setUsers] = useState<z.infer<typeof recipientListSchema> | null>(null);
    const [known, setKnown] = useState<Record<string, string>>({}), [error, setError] = useState(""), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
    useEffect(() => {
        const c = new AbortController();
        let active = true;
        const timer = setTimeout(() => {
            setLoading(true);
            setError("");
            void masterRequest<unknown>("/api/users?" + new URLSearchParams({ q, page: String(page), pageSize: "20", status: "active" }), "GET", undefined, c.signal)
                .then(raw => {
                const v = readAnnouncementResponse(recipientListSchema, raw);
                if (!active)
                    return;
                const last = Math.max(1, Math.ceil(v.total / 20));
                if (page > last) {
                    setPage(last);
                    return;
                }
                setUsers(v);
                setKnown(old => ({ ...old, ...Object.fromEntries(v.items.map(u => [u.id, `${u.fullName} (${u.username})`])) }));
            }).catch(e => { if (active) {
                setUsers(null);
                setError(e instanceof Error ? e.message : "Pilihan pengguna belum dapat dimuat.");
            } })
                .finally(() => { if (active)
                setLoading(false); });
        }, 150);
        return () => { active = false; clearTimeout(timer); c.abort(); };
    }, [q, page, revision]);
    return <fieldset disabled={disabled} className="min-w-0 space-y-3 rounded-xl border p-3 [overflow-wrap:anywhere]">
  <legend className="max-w-full px-1 text-sm font-semibold">{label} · {value.length} dipilih</legend>
  <label className="block text-sm">Cari nama atau username<input className="ui-control mt-2" value={q} maxLength={100} onChange={e => { setLoading(true); setQ(e.target.value); setPage(1); }}/></label>
  <div className="flex min-w-0 flex-wrap gap-2">{value.map((id, i) => <Button type="button" variant="outline" key={id} onClick={() => onChange(value.filter(v => v !== id))}>{names[id] ?? known[id] ?? `Pengguna terpilih ${i + 1}`} · Hapus</Button>)}</div>
  <select name={name} className="ui-control" value="" aria-label={"Tambah " + label} disabled={disabled || loading || Boolean(error) || value.length >= 1000} onChange={e => { const id = e.target.value; if (id && !value.includes(id))
        onChange([...value, id]); }}>
   <option value="">Pilih pengguna…</option>{users?.items.filter(u => !value.includes(u.id)).map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.username})</option>)}
  </select>
  {loading && <p role="status" className="text-xs">Memuat pilihan pengguna…</p>}
  {!loading && !error && !users?.items.length && <p role="status" className="text-xs">Tidak ada pengguna sesuai pencarian.</p>}
  {error && <><ErrorFeedback message={error}/><Button type="button" variant="outline" onClick={() => { setLoading(true); setRevision(v => v + 1); }}>Coba muat pengguna</Button></>}
  <div className="flex flex-wrap items-center gap-2">
   <Button type="button" variant="outline" disabled={loading || page <= 1} onClick={() => { setLoading(true); setPage(p => p - 1); }}>Sebelumnya</Button>
   <span className="text-xs">Halaman {page}</span>
   <Button type="button" variant="outline" disabled={loading || !users || page * 20 >= users.total} onClick={() => { setLoading(true); setPage(p => p + 1); }}>Berikutnya</Button>
  </div>
 </fieldset>;
}
