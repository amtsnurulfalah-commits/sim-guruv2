"use client";
import { ActionIcon } from "@/components/ui/action-icon";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { masterRequest } from "@/features/masters/api";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { z } from "zod";
import { wibDate } from "@/lib/calendar/schemas";
const cardDaySchema = z.object({
  date: z.iso.date(), isHoliday: z.boolean(), kbmEnabled: z.boolean(), examEnabled: z.boolean(),
  calendarEntry: z.object({description:z.string().nullable()}).nullable(),
  activeAcademicPeriod: z.object({label:z.string(),semester:z.number(),dateStart:z.iso.date(),dateEnd:z.iso.date()}).nullable(),
  override: z.object({}).nullable(), reasons:z.array(z.string()),
});
const reasonLabels: Record<string, string> = {
  NO_ACADEMIC_PERIOD: "Belum ada semester aktif yang mencakup tanggal ini.",
  HOLIDAY:
    "Tanggal ditandai sebagai hari libur; KBM dan ujian reguler dinonaktifkan.",
  SUNDAY_DEFAULT_OFF: "Hari Minggu tidak otomatis menjadi hari kegiatan.",
};
export function DayContextCard({ date = wibDate() }: { date?: string }) {
  const [day, setDay] = useState<z.infer<typeof cardDaySchema> | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const c = new AbortController();
    masterRequest<unknown>(
      "/api/day-context?date=" + date,
      "GET",
      undefined,
      c.signal,
    )
      .then((v) => {
        if (active) {
          const parsed = cardDaySchema.safeParse(v);
          if (!parsed.success) throw new Error("Data konteks hari belum sesuai. Muat ulang atau hubungi administrator.");
          setDay(parsed.data);
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setDay(null);
          setError(e instanceof Error ? e.message : "Konteks hari belum dapat dimuat.");
        }
      });
    return () => {
      active = false;
      c.abort();
    };
  }, [revision, date]);
  return (
    <section
      aria-labelledby="dashboard-day-context-title"
      className="min-w-0 space-y-3 rounded-2xl border bg-card p-4 sm:p-6"
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
            <div className="min-w-0 space-y-4 [overflow-wrap:anywhere] border-t px-4 py-4">
              <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2 [&>div]:min-w-0">
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
                    {[...new Set(day.reasons)].map((reason) => (
                      <li key={reason}>
                        {Object.hasOwn(reasonLabels, reason)
                          ? reasonLabels[reason]
                          : "Konteks hari mengikuti kebijakan kalender yang berlaku."}
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
      {error && <ErrorFeedback message={error} />}
      <button
        className="ui-action ui-action-secondary"
        type="button"
        disabled={!day && !error}
        onClick={() => {
          setDay(null);
          setError("");
          setRevision((v) => v + 1);
        }}
      >
        <ActionIcon action="refresh" />
        Muat ulang konteks
      </button>
    </section>
  );
}
