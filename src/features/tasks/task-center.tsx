"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { tasksSchema, taskPriority } from "@/lib/tasks/contracts";
import { journalEligibilityText } from "@/lib/activities/journal-contracts";
import { masterRequest } from "@/features/masters/api";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { FeatureState, EmptyState } from "@/components/feedback/feature-state";
export function TaskCenter({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<ReturnType<typeof tasksSchema.parse> | null>(
    null,
  );
  const [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [status, setStatus] = useState("all"),
    [page, setPage] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      if (document.visibilityState === "visible") setRevision((v) => v + 1);
    };
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    masterRequest<unknown>(
      "/api/operations/tasks",
      "GET",
      undefined,
      controller.signal,
    )
      .then((value) => {
        const parsed = tasksSchema.safeParse(value);
        if (!parsed.success)
          throw Error(
            "Data pusat tugas belum sesuai. Muat ulang atau hubungi administrator.",
          );
        if (!controller.signal.aborted) {
          setData(parsed.data);
          setError("");
        }
      })
      .catch((value) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(
            value instanceof Error
              ? value.message
              : "Tugas belum dapat dimuat.",
          );
        }
      });
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [revision]);
  const tasks = (data?.items ?? []).filter(
    (task) => status === "all" || task.blocked === (status === "blocked"),
  );
  const size = compact ? 5 : 20,
    activePage = Math.min(page, Math.max(1, Math.ceil(tasks.length / size)));
  return (
    <section className="ui-panel min-w-0 space-y-4" aria-label="Pusat tugas">
      <header className="flex flex-wrap items-start justify-between gap-3">
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
          onClick={() => {
            setData(null);
            setError("");
            setRevision((v) => v + 1);
          }}
        >
          Muat ulang tugas
        </Button>
      </header>
      {!data ? (
        <FeatureState
          headingLevel={2}
          error={error}
          label="Memuat pusat tugas…"
          retry={() => {
            setError("");
            setRevision((v) => v + 1);
          }}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Diperbarui{" "}
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
          <ul className="grid min-w-0 gap-3" aria-label="Daftar tugas aktif">
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
