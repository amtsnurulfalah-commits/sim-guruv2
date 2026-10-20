"use client";
import { useEffect, useState } from "react";
import { masterRequest } from "@/features/masters/api";
import { wibDate, type DayContext } from "@/lib/calendar/schemas";
export function DayContextCard() {
  const [day, setDay] = useState<DayContext | null>(null),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const c = new AbortController();
    masterRequest<DayContext>(
      "/api/day-context?date=" + wibDate(),
      "GET",
      undefined,
      c.signal,
    )
      .then((v) => {
        if (active) {
          setDay(v);
          setError(false);
        }
      })
      .catch(() => {
        if (active) {
          setDay(null);
          setError(true);
        }
      });
    return () => {
      active = false;
      c.abort();
    };
  }, [revision]);
  return (
    <section
      aria-labelledby="dashboard-day-context-title"
      className="space-y-3 rounded-2xl border bg-card p-6"
    >
      <h2 id="dashboard-day-context-title" className="text-lg font-bold">
        Konteks hari ini
      </h2>
      {day ? (
        <>
          <p className="text-sm">
            {day.date} WIB · {day.isHoliday ? "Hari libur" : "Bukan hari libur"}
          </p>
          <p className="text-sm">
            KBM {day.kbmEnabled ? "aktif" : "nonaktif"} · Ujian{" "}
            {day.examEnabled ? "aktif" : "nonaktif"}
          </p>
          <p className="text-sm">
            {day.activeAcademicPeriod
              ? day.activeAcademicPeriod.label +
                " · Semester " +
                day.activeAcademicPeriod.semester
              : "Belum ada semester aktif yang mencakup hari ini."}
          </p>
          <p className="text-sm text-muted-foreground">
            Status konteks tidak berarti sudah ada penugasan, konfirmasi, jurnal
            atau hak honorarium.
          </p>
        </>
      ) : (
        <p role="status" className="text-sm">
          {error ? "Konteks hari belum dapat dimuat." : "Memuat konteks hari…"}
        </p>
      )}
      <button
        className="ui-text-link"
        onClick={() => setRevision((v) => v + 1)}
      >
        Muat ulang konteks
      </button>
    </section>
  );
}
