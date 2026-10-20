"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Wallet, CalendarCheck2 } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { FeatureState } from "@/components/feedback/feature-state";
import { masterRequest } from "@/features/masters/api";
import { Announcements } from "@/features/operations/announcements";
type Summary = {
  date: string;
  planned: { id: string; kind: string; time_start: string; time_end: string }[];
  pendingEventJournals: number;
  tasks: {
    id: string;
    kind: string;
    start: string;
    end: string;
    confirmed: boolean;
    journalComplete: boolean;
  }[];
  attendance: { actualIn: string | null; actualOut: string | null } | null;
  honor: { total: string; totalJtm: string; rateMissing: boolean };
  pendingHolidays: number;
  admin: {
    activeUsers: number;
    failedMessages: number;
    failedJobs: number;
  } | null;
};
export function LiveSummary() {
  const [value, setValue] = useState<Summary | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    masterRequest<{ summary: Summary }>(
      "/api/dashboard",
      "GET",
      undefined,
      c.signal,
    )
      .then((v) => {
        if (!c.signal.aborted) setValue(v.summary);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [revision]);
  return (
    <div className="space-y-5">
      <Announcements />
      {!value ? (
        <FeatureState
          headingLevel={2}
          error={error}
          label="Memuat ringkasan kegiatan…"
          retry={() => {
            setError("");
            setRevision((value) => value + 1);
          }}
        />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              title="Kehadiran hari ini"
              icon={CalendarCheck2}
              value={value.attendance?.actualIn ?? "Belum tercatat"}
            >
              <p>Jam masuk · WIB</p>
              <p>Keluar: {value.attendance?.actualOut ?? "Belum tercatat"}</p>
              <Link className="ui-text-link" href="/kehadiran">
                Buka kehadiran
              </Link>
            </MetricCard>
            <MetricCard
              title="Honor terealisasi bulan ini"
              icon={Wallet}
              value={
                value.honor.rateMissing
                  ? "Tarif belum lengkap"
                  : "Rp " +
                    value.honor.total
                      .split(".")[0]!
                      .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
              }
            >
              <p>
                {value.honor.totalJtm} JTM · {value.pendingHolidays} hak libur
                belum diproses
              </p>
              {value.honor.rateMissing && (
                <p>Tarif belum lengkap; nominal belum dapat disimpulkan.</p>
              )}
              <p className="text-muted-foreground">
                Perhitungan berjalan, dapat berubah sampai finalisasi.
              </p>
              <Link className="ui-text-link" href="/honorarium">
                Rincian honorarium
              </Link>
            </MetricCard>
            <MetricCard
              title="Progres kegiatan tercatat"
              icon={ClipboardCheck}
              value={
                <>
                  {value.tasks.filter((task) => task.confirmed).length}
                  <span className="ml-2 text-base font-medium text-muted-foreground">
                    / {value.tasks.length}
                  </span>
                </>
              }
            >
              <p>Terkonfirmasi hari ini</p>
              <progress
                className="ui-progress"
                aria-label="Kegiatan terkonfirmasi"
                aria-valuetext={
                  value.tasks.length === 0
                    ? "Belum ada kegiatan tercatat"
                    : `${value.tasks.filter((task) => task.confirmed).length} dari ${value.tasks.length} kegiatan terkonfirmasi`
                }
                max={value.tasks.length || 1}
                value={value.tasks.filter((task) => task.confirmed).length}
              />
              <p>
                {
                  value.tasks.filter(
                    (task) => task.confirmed && !task.journalComplete,
                  ).length
                }{" "}
                jurnal / BAP perlu dilengkapi
              </p>
              <Link className="ui-text-link" href="/kegiatan">
                Buka kegiatan
              </Link>
            </MetricCard>
          </section>
          <section className="ui-panel space-y-3">
            <h2 className="font-bold">
              Penugasan efektif yang sudah tercatat hari ini
            </h2>
            <p className="text-sm">
              Jadwal yang belum dibentuk sebagai kegiatan dapat diperiksa pada
              menu Jadwal.
            </p>
            {value.tasks.length === 0 && (
              <p>Belum ada penugasan kegiatan tercatat untuk Anda.</p>
            )}
            {value.planned.map((t) => (
              <p key={t.id}>
                {t.kind} · {t.time_start.slice(0, 5)}–{t.time_end.slice(0, 5)}{" "}
                WIB · Terjadwal, belum tercatat
              </p>
            ))}
            <p>{value.pendingEventJournals} jurnal acara perlu dilengkapi</p>
            {value.tasks.map((t) => (
              <p key={t.id}>
                {t.kind} · {t.start.slice(0, 5)}–{t.end.slice(0, 5)} WIB ·{" "}
                {t.confirmed ? "Terkonfirmasi" : "Menunggu konfirmasi"}
                {t.confirmed && !t.journalComplete
                  ? " · Jurnal/BAP belum lengkap"
                  : ""}
              </p>
            ))}
          </section>
          {value.admin && (
            <section className="ui-panel space-y-3">
              <h2 className="font-bold">Ringkasan administrasi</h2>
              <p>
                {value.admin.activeUsers} pengguna aktif ·{" "}
                {value.admin.failedMessages} email perlu ditinjau ·{" "}
                {value.admin.failedJobs} pekerjaan gagal
              </p>
              <Link className="underline" href="/admin/operasional">
                Buka pemantauan operasional
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  );
}
