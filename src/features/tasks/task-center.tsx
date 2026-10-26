"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useWorkspacePreferences } from "@/features/preferences/workspace-preferences";
import Link from "next/link";
import { RotateCcw, Search, X } from "lucide-react";
import { tasksSchema, taskPriority } from "@/lib/tasks/contracts";
import { filterTasks, taskKinds, taskReason, type TaskStatus } from "@/lib/tasks/presentation";
import { useReadResource } from "@/lib/feedback/use-read-resource";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { FeatureState, EmptyState } from "@/components/feedback/feature-state";

export function TaskCenter({ compact = false, date, embedded = false }: { compact?: boolean; date?: string; embedded?: boolean }) {
  const preferences = useWorkspacePreferences();
  const parse = useCallback((raw: unknown) => {
    const parsed = tasksSchema.safeParse(raw);
    if (!parsed.success || (date && parsed.data.date !== date)) {
      throw Error("Data pusat tugas belum sesuai. Muat ulang atau hubungi administrator.");
    }
    return parsed.data;
  }, [date]);
  const { value: data, error, loading, refresh } = useReadResource("/api/operations/tasks", parse);
  const [status, setStatus] = useState<TaskStatus>("all");
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const listTitle = useRef<HTMLHeadingElement>(null);
  const statusId = useId(), kindId = useId();
  const tasks = filterTasks(data?.items ?? [], status, kind, query);
  const size = compact ? 5 : preferences.values.taskPageSize;
  const previousSize = useRef(size);
  useEffect(() => {
    if (previousSize.current === size) return;
    previousSize.current = size;
    let active = true;
    queueMicrotask(() => { if (active) setPage(1); });
    return () => { active = false; };
  }, [size]);
  const pages = Math.max(1, Math.ceil(tasks.length / size));
  const activePage = Math.min(page, pages);
  // Persist clamping after background refresh, so later growth cannot restore an obsolete page.
  // Preserve page through temporary loading/error states until a valid snapshot arrives.
  const validPages = data ? pages : null;
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active && validPages !== null) setPage(current => Math.min(current, validPages));
    });
    return () => { active = false; };
  }, [validPages]);
  const hasFilters = status !== "all" || kind !== "all" || Boolean(query.trim());
  const blocked = data?.items.filter(task => task.blocked).length ?? 0;
  function resetFilters() {
    setStatus("all"); setKind("all"); setQuery(""); setPage(1);
  }
  function changePage(next: number) {
    setPage(next);
    listTitle.current?.focus({ preventScroll: true });
    listTitle.current?.scrollIntoView({ block: "start" });
  }
  return (
    <section className={`${embedded ? "" : compact ? "ui-panel" : "ui-workspace-pilot"} min-w-0 space-y-5 [overflow-wrap:anywhere]`} aria-label="Pusat tugas">
      <header className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          {!embedded && <h2 className="text-xl font-bold">{compact ? "Tugas hari ini dan tertunda" : "Daftar tindak lanjut"}</h2>}
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Status mengikuti kegiatan sumber, bukan penilaian kinerja.</p>
        </div>
        <Button type="button" variant="outline" className="w-full sm:w-auto sm:shrink-0" disabled={loading}
          onClick={() => { setPage(1); refresh(); }}>
          <RotateCcw aria-hidden="true"/>Muat ulang tugas
        </Button>
      </header>
      {!data ? <FeatureState headingLevel={2} error={error} label="Memuat pusat tugas…" retry={refresh}/> : <>
        <p role="status" className="ui-feedback-neutral text-sm text-muted-foreground">
          {loading ? "Memperbarui tugas… · " : ""}Diperbarui {new Date(data.generatedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB · {data.items.length} tugas aktif
        </p>
        {!compact && <>
          <dl aria-label="Ringkasan beban tugas" className="grid min-w-0 gap-1 rounded-xl border bg-muted/20 p-3 sm:grid-cols-3 sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0">
            {[{label: "Tugas aktif", value: data.items.length}, {label: "Dapat ditindaklanjuti", value: data.items.length - blocked}, {label: "Perlu prasyarat", value: blocked}].map(item =>
              <div key={item.label} className="flex min-w-0 items-center justify-between gap-3 px-1 py-1 sm:block sm:rounded-xl sm:border sm:bg-muted/20 sm:p-4">
                <dt className="text-sm text-muted-foreground">{item.label}</dt><dd className="text-xl font-bold tabular-nums sm:mt-2 sm:text-2xl">{item.value}</dd>
              </div>)}
          </dl>
          <div role="search" aria-label="Filter pusat tugas" className="grid min-w-0 gap-4 rounded-xl bg-muted/40 p-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="min-w-0 space-y-2 text-sm sm:col-span-2 xl:col-span-1">
              <span className="flex items-center gap-2 font-medium"><Search aria-hidden="true" className="size-4"/>Cari tugas</span>
              <input type="search" className="ui-control" maxLength={200} placeholder="Judul/keterangan/tanggal" value={query}
                onChange={event => { setQuery(event.target.value); setPage(1); }}/>
            </label>
            <div className="min-w-0 space-y-2 text-sm"><label htmlFor={statusId} className="font-medium">Status tugas</label>
              <select id={statusId} className="ui-control" value={status} onChange={event => { setStatus(event.target.value as TaskStatus); setPage(1); }}>
                <option value="all">Semua</option><option value="ready">Dapat ditindaklanjuti</option><option value="blocked">Perlu prasyarat</option>
              </select>
            </div>
            <div className="min-w-0 space-y-2 text-sm"><label htmlFor={kindId} className="font-medium">Jenis tugas</label>
              <select id={kindId} className="ui-control" value={kind} onChange={event => { setKind(event.target.value); setPage(1); }}>
                <option value="all">Semua jenis</option>{Object.entries(taskKinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            {hasFilters && <Button type="button" variant="outline" className="sm:col-span-2 xl:col-span-3 sm:justify-self-start" onClick={resetFilters}><X aria-hidden="true"/>Hapus filter</Button>}
          </div>
        </>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 ref={listTitle} tabIndex={-1} className="scroll-mt-24 rounded font-semibold focus-visible:outline-2 focus-visible:outline-ring">Daftar tugas aktif</h3>
          <p role="status" className="ui-feedback-neutral text-sm text-muted-foreground">{tasks.length ? `Menampilkan ${(activePage - 1) * size + 1}–${Math.min(activePage * size, tasks.length)} dari ${tasks.length} tugas` : "0 tugas ditampilkan"}</p>
        </div>
        {!tasks.length && <div className="space-y-3">
          <EmptyState title={hasFilters ? "Tidak ada tugas yang cocok" : "Belum ada tugas aktif"} description={hasFilters
            ? "Tidak ada tugas yang cocok dengan pencarian atau filter. Hapus filter untuk memeriksa semua tugas aktif."
            : "Tugas yang selesai atau tidak lagi berlaku hilang setelah data dimuat ulang. Jadwal yang akan datang dapat diperiksa di menu Jadwal."}/>
          {!hasFilters && <Button asChild variant="outline"><Link prefetch={false} href="/jadwal">Periksa jadwal</Link></Button>}
        </div>}
        <ul className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Daftar tugas aktif">
          {tasks.slice((activePage - 1) * size, activePage * size).map(task => {
            const priority = taskPriority(task);
            return <li key={task.id} className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="min-w-0 font-semibold">{task.title}</h4>
                <StatusBadge label={priority} tone={task.blocked ? "neutral" : priority === "Batas waktu terlewati" ? "error" : priority === "Segera" ? "warning" : "neutral"}/>
              </div>
              <p className="text-sm text-muted-foreground">{task.date} · {taskKinds[task.kind]}</p>
              <p className="text-sm leading-6">{taskReason(task)}</p>
              {task.deadline && <p className="text-sm leading-6">Batas waktu: {new Date(task.deadline).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB (sebelum waktu ini).</p>}
              <Button asChild variant="outline" className="mt-auto w-full sm:w-auto sm:self-start"><Link prefetch={false} href={task.href}>
                {task.blocked ? "Periksa prasyarat" : "Buka sumber tugas"}
              </Link></Button>
            </li>;
          })}
        </ul>
        {compact ? <Button asChild variant="outline"><Link prefetch={false} href="/tugas">Lihat semua tugas</Link></Button>
          : <Pagination page={activePage} pageSize={size} total={tasks.length} onPageChange={changePage} label="Halaman pusat tugas"/>}
      </>}
    </section>
  );
}
