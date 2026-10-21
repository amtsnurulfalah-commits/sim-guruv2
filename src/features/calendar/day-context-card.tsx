"use client";
import { ActionIcon } from "@/components/ui/action-icon";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { masterRequest } from "@/features/masters/api";
import { wibDate, type DayContext } from "@/lib/calendar/schemas";
const reasonLabels: Record<string, string> = {
  NO_ACADEMIC_PERIOD: "Belum ada semester aktif yang mencakup tanggal ini.",
  HOLIDAY:
    "Tanggal ditandai sebagai hari libur; KBM dan ujian reguler dinonaktifkan.",
  SUNDAY_DEFAULT_OFF: "Hari Minggu tidak otomatis menjadi hari kegiatan.",
};
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
          <details className="group rounded-xl border bg-background">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
              Lihat rincian konteks hari
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            <div className="space-y-4 border-t px-4 py-4">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold">Catatan kalender</dt>
                  <dd className="mt-1 leading-6 text-muted-foreground">
                    {day.calendarEntry?.description ||
                      "Tidak ada catatan kalender untuk hari ini."}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Semester aktif</dt>
                  <dd className="mt-1 leading-6 text-muted-foreground">
                    {day.activeAcademicPeriod
                      ? `${day.activeAcademicPeriod.label} · Semester ${day.activeAcademicPeriod.semester}`
                      : "Belum ada semester aktif yang mencakup hari ini."}
                  </dd>
                </div>
                {day.activeAcademicPeriod && (
                  <div>
                    <dt className="font-semibold">Periode semester</dt>
                    <dd className="mt-1 leading-6 text-muted-foreground">
                      {day.activeAcademicPeriod.dateStart} sampai{" "}
                      {day.activeAcademicPeriod.dateEnd}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="font-semibold">Pengaturan kegiatan</dt>
                  <dd className="mt-1 leading-6 text-muted-foreground">
                    {day.override
                      ? "Pengaturan khusus untuk tanggal ini diterapkan."
                      : "Mengikuti pengaturan kalender dan semester."}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Kegiatan belajar mengajar</dt>
                  <dd className="mt-1 text-muted-foreground">
                    {day.kbmEnabled ? "Aktif" : "Nonaktif"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Kegiatan ujian</dt>
                  <dd className="mt-1 text-muted-foreground">
                    {day.examEnabled ? "Aktif" : "Nonaktif"}
                  </dd>
                </div>
              </dl>
              {day.reasons.length > 0 && (
                <div className="border-t pt-4 text-sm">
                  <h3 className="font-semibold">Keterangan status hari</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 leading-6 text-muted-foreground">
                    {day.reasons.map((reason) => (
                      <li key={reason}>
                        {reasonLabels[reason] ??
                          "Konteks hari mengikuti kebijakan kalender yang berlaku."}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="border-t pt-4 text-sm leading-6 text-muted-foreground">
                Status konteks tidak berarti sudah ada penugasan, konfirmasi,
                jurnal atau hak honorarium.
              </p>
            </div>
          </details>
        </>
      ) : (
        <p role="status" className="text-sm">
          {error ? "Konteks hari belum dapat dimuat." : "Memuat konteks hari…"}
        </p>
      )}
      <button
        className="ui-action ui-action-secondary"
        type="button"
        disabled={!day && !error}
        onClick={() => {
          setDay(null);
          setError(false);
          setRevision((v) => v + 1);
        }}
      >
        <ActionIcon action="refresh" />
        Muat ulang konteks
      </button>
    </section>
  );
}
