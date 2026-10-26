"use client";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { defaultPreferences, preferencesSchema, preferenceEvent, preferenceKey, readPreferences, writePreferences, type Preferences } from "@/lib/preferences/storage";
type Patch = Partial<Preferences> | ((current: Preferences) => Partial<Preferences>);
const Context = createContext<{ values: Preferences; saved: boolean; ready: boolean; update: (patch: Patch) => void; reset: () => void }>({ values: defaultPreferences(), saved: false, ready: false, update: () => {}, reset: () => {} });
export const useWorkspacePreferences = () => useContext(Context);
export function WorkspacePreferences({ scope, children }: { scope: string | null; children: ReactNode }) {
  const [state, setState] = useState({ values: defaultPreferences(), saved: false, ready: false });
  const current = useRef(defaultPreferences());
  useEffect(() => {
    let active = true, invalidated = false;
    let values = defaultPreferences(), saved = false;
    if (scope) try { values = readPreferences(sessionStorage, scope); saved = true; } catch { /* Keep usable defaults. */ }
    queueMicrotask(() => { if (active && !invalidated) { current.current = values; setState({ values, saved, ready: true }); } });
    const cleared = () => { invalidated = true; current.current = defaultPreferences(); setState({ values: current.current, saved: false, ready: true }); };
    window.addEventListener(preferenceEvent, cleared);
    return () => { active = false; window.removeEventListener(preferenceEvent, cleared); };
  }, [scope]);
  function update(patch: Patch) {
    if (!scope || !state.ready) return;
    const parsed = preferencesSchema.safeParse({ ...current.current, ...(typeof patch === "function" ? patch(current.current) : patch) });
    if (!parsed.success) return;
    current.current = parsed.data;
    let saved = false;
    try { writePreferences(sessionStorage, scope, parsed.data); saved = true; } catch { /* Changes still apply in this visit. */ }
    setState({ values: parsed.data, saved, ready: true });
  }
  function reset() {
    let saved = false;
    try { sessionStorage.removeItem(preferenceKey); saved = true; } catch { /* Do not block reset. */ }
    current.current = defaultPreferences();
    setState({ values: current.current, saved, ready: true });
  }
  return <Context.Provider value={{ ...state, update, reset }}>{children}</Context.Provider>;
}
export function PreferenceControls({ links }: { links: { slug: string; title: string }[] }) {
  const { values, saved, ready, update, reset } = useWorkspacePreferences();
  const prefix = useId();
  const allowedPins = values.pins.filter(slug => links.some(link => link.slug === slug));
  return <details className="mb-5 min-w-0 rounded-xl border bg-card p-3 text-sm leading-6 [overflow-wrap:anywhere]">
    <summary className="min-h-11 cursor-pointer py-2 font-semibold">Preferensi tampilan dan pintasan</summary>
    <p className="my-3 text-muted-foreground">Berlaku untuk akun ini di tab ini, tidak disinkronkan antarperangkat. Dihapus saat logout atau berganti akun/peran. Filter dan izin akses tetap mengikuti halaman sumber.</p>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <div className="min-w-0 space-y-2"><label htmlFor={prefix + "-density"} className="block font-medium">Kepadatan tabel desktop</label><select id={prefix + "-density"} aria-describedby={prefix + "-density-hint"} className="ui-control" disabled={!ready} value={values.density} onChange={e => update({ density: e.target.value as Preferences["density"] })}><option value="comfortable">Nyaman</option><option value="compact">Ringkas</option></select><p id={prefix + "-density-hint"} className="text-muted-foreground">Mode ringkas berlaku di desktop dengan mouse/trackpad. Ukuran tombol tetap nyaman disentuh.</p></div>
      <div className="min-w-0 space-y-2"><label htmlFor={prefix + "-task-size"} className="block font-medium">Tugas per halaman</label><select id={prefix + "-task-size"} aria-describedby={prefix + "-task-size-hint"} className="ui-control" disabled={!ready} value={values.taskPageSize} onChange={e => update({ taskPageSize: Number(e.target.value) as Preferences["taskPageSize"] })}>{[10,20,50].map(n => <option key={n} value={n}>{n} tugas</option>)}</select><p id={prefix + "-task-size-hint"} className="text-muted-foreground">Berlaku di Pusat tugas; ringkasan dashboard tetap 5 tugas.</p></div>
    </div>
    <fieldset className="my-4 min-w-0 space-y-2" disabled={!ready}><legend className="font-medium">Pintasan menu (maksimal 4)</legend><div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">{links.map(link => <label key={link.slug} className="flex min-h-11 min-w-0 items-center gap-3"><input type="checkbox" className="size-5 shrink-0" checked={values.pins.includes(link.slug)} disabled={!values.pins.includes(link.slug) && allowedPins.length >= 4} onChange={e => update(current => ({ pins: e.target.checked ? [...current.pins.filter(slug => links.some(link => link.slug === slug)), link.slug] : current.pins.filter(v => v !== link.slug && links.some(link => link.slug === v)) }))}/><span>{link.title}</span></label>)}</div></fieldset>
    <Button type="button" variant="outline" disabled={!ready} onClick={reset}>Reset preferensi tampilan</Button>
    {ready && <p role="status" className="ui-feedback-neutral mt-3 text-muted-foreground">{saved ? "Preferensi tersedia di tab ini." : "Preferensi tidak dapat disimpan di tab ini. Perubahan hanya berlaku selama halaman ini terbuka."}</p>}
  </details>;
}
