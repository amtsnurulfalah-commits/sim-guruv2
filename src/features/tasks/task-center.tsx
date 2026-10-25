"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { tasksSchema, taskPriority } from "@/lib/tasks/contracts";
import { journalEligibilityText } from "@/lib/activities/journal-contracts";
import { useReadResource } from "@/lib/feedback/use-read-resource";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { FeatureState, EmptyState } from "@/components/feedback/feature-state";
export function TaskCenter({ compact = false, date }: { compact?: boolean; date?: string }) {
  const parse = useCallback((raw: unknown) => {
    const parsed = tasksSchema.safeParse(raw);
    if (!parsed.success || (date && parsed.data.date !== date)) throw Error("Data pusat tugas belum sesuai. Muat ulang atau hubungi administrator.");
    return parsed.data;
  }, [date]);
  const {value: data, error, loading, refresh} = useReadResource("/api/operations/tasks", parse);
  const [status, setStatus] = useState("all"), [page, setPage] = useState(1);
  const tasks = (data?.items ?? []).filter(
    (task) => status === "all" || task.blocked === (status === "blocked"),
  );
  const size = compact ? 5 : 20,
    activePage = Math.min(page, Math.max(1, Math.ceil(tasks.length / size)));
  return (
    <section className="ui-panel min-w-0 space-y-4" aria-label="Pusat tugas">
      <header className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-xl font-bold">
            {compact
              ? "Tugas hari ini dan tertunda"
              : "Tugas yang perlu ditindaklanjuti"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Status mengikuti sumber kegiatan. Kelengkapan administrasi bukan
            penilaian kinerja.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={loading}
          onClick={() => { setPage(1); refresh(); }}
        >
          Muat ulang tugas
        </Button>
      </header>
      {!data ? (
        <FeatureState
          headingLevel={2}
          error={error}
          label="Memuat pusat tugas…"
          retry={refresh}
        />
      ) : (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {loading ? "Memperbarui tugas… · " : ""}Diperbarui{" "}
            {new Date(data.generatedAt).toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
            })}{" "}
            WIB · {data.items.length} tugas aktif
          </p>
          {!compact && (
            <label className="block max-w-sm space-y-2 text-sm">
              <span>Status tugas</span>
              <select
                className="ui-control"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Semua</option>
                <option value="ready">Dapat ditindaklanjuti</option>
                <option value="blocked">Perlu prasyarat</option>
              </select>
            </label>
          )}
          {!tasks.length && (
            <EmptyState
              title="Tidak ada tugas pada tampilan ini"
              description="Tugas yang selesai atau tidak lagi berlaku hilang setelah data dimuat ulang. Jadwal yang akan datang dapat diperiksa di menu Jadwal."
            />
          )}
          <ul className={compact ? "grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3" : "grid min-w-0 gap-3"} aria-label="Daftar tugas aktif">
            {tasks
              .slice((activePage - 1) * size, activePage * size)
              .map((task) => (
                <li
                  key={task.id}
                  className="min-w-0 space-y-3 rounded-xl border p-4 [overflow-wrap:anywhere]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-semibold">{task.title}</h3>
                    <StatusBadge
                      label={taskPriority(task)}
                      tone={task.blocked ? "neutral" : "warning"}
                    />
                  </div>
                  <p className="text-sm">
                    {task.date} ·{" "}
                    {task.kind === "operations" ? "Administrasi" : "Kegiatan"}
                  </p>
                  <p className="text-sm leading-6">
                    {/^[A-Z_]+$/.test(task.reason)
                      ? task.reason === "ATTENDANCE_TIME_INVALID"
                        ? "Tunggu sampai lima menit setelah kegiatan selesai."
                        : journalEligibilityText(task.reason)
                      : task.reason}
                  </p>
                  {task.deadline && (
                    <p className="text-sm">
                      Batas waktu:{" "}
                      {new Date(task.deadline).toLocaleString("id-ID", {
                        timeZone: "Asia/Jakarta",
                      })}{" "}
                      WIB (sebelum waktu ini).
                    </p>
                  )}

                  <Button asChild variant="outline">
                    <Link prefetch={false} href={task.href}>
                      {task.blocked ? "Periksa prasyarat" : "Buka sumber tugas"}
                    </Link>
                  </Button>
                </li>
              ))}
          </ul>
          {compact ? (
            <Button asChild variant="outline">
              <Link prefetch={false} href="/tugas">
                Lihat semua tugas
              </Link>
            </Button>
          ) : (
            <Pagination
              page={activePage}
              pageSize={size}
              total={tasks.length}
              onPageChange={setPage}
              label="Halaman pusat tugas"
            />
          )}
        </>
      )}
    </section>
  );
}
