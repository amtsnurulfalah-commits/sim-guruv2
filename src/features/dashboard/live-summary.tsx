"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Wallet, CalendarCheck2 } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { FeatureState } from "@/components/feedback/feature-state";
import { masterRequest } from "@/features/masters/api";
import { Announcements } from "@/features/operations/announcements";
import { z } from "zod";
import { summarySchema, dashboardRows, activityLabel, rupiah, type Summary } from "@/lib/dashboard/summary";
import { Button } from "@/components/ui/button";
import { RotateCcw, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
export function LiveSummary() {
  const [value, setValue] = useState<Summary | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [page, setPage] = useState(1);
  useEffect(() => {
    const c = new AbortController();
    masterRequest<unknown>(
      "/api/dashboard",
      "GET",
      undefined,
      c.signal,
    )
      .then((v) => {
        if (c.signal.aborted) return;
        const parsed = z.object({summary:summarySchema}).safeParse(v);
        if (!parsed.success) throw new Error("Layanan ringkasan mengirim data yang belum sesuai. Coba muat ulang; jika berulang, hubungi administrator.");
        setValue(parsed.data.summary);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Ringkasan belum dapat dimuat. Coba kembali.");
      });
    return () => c.abort();
  }, [revision]);
  const confirmed = value?.tasks.filter((task) => task.confirmed).length ?? 0;
  const rows = dashboardRows(value);
  const pages = Math.max(1, Math.ceil(rows.length / 8));
  const activePage = Math.min(page,pages);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold">Ringkasan kegiatan</h2><p className="text-sm text-muted-foreground">Data pribadi hari ini dan perhitungan honorarium berjalan.</p></div>
        <Button type="button" variant="outline" disabled={!value && !error} onClick={() => { setValue(null); setPage(1); setError(""); setRevision(v => v + 1); }}><RotateCcw aria-hidden="true" />Muat ulang ringkasan</Button>
      </header>
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
          <section className="ui-panel space-y-3">
            <h2 className="font-bold">
              Jadwal dan penugasan hari ini
            </h2>
            <p className="text-sm">
              Jadwal yang belum dibentuk sebagai kegiatan dapat diperiksa pada
              menu Jadwal.
            </p>
            {value.tasks.length === 0 && value.planned.length === 0 && (
              <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Belum ada jadwal atau penugasan untuk Anda pada hari ini. Periksa menu Jadwal jika ada penugasan yang belum tampil.</p>
            )}
            {value.pendingEventJournals > 0 && <p className="rounded-lg border bg-accent/40 p-3">{value.pendingEventJournals} jurnal acara perlu dilengkapi · <Link prefetch={false} className="ui-text-link" href="/acara/jurnal">Buka jurnal acara</Link></p>}
            {value.planned.length > 0 && <Link prefetch={false} className="ui-text-link" href="/jadwal"><CalendarDays aria-hidden="true" className="size-4" />Periksa jadwal mengajar</Link>}
            <ul className="space-y-2" aria-label="Daftar jadwal dan penugasan">
              {rows.slice((activePage-1)*8,activePage*8).map(t=><li key={t.key} className="min-w-0 break-words rounded-lg border bg-muted/20 p-3 text-sm leading-6"><span className="font-semibold">{activityLabel(t.kind)}</span> · {t.start.slice(0,5)}–{t.end.slice(0,5)} WIB<p className="text-muted-foreground">{t.status}</p></li>)}
            </ul>
            {pages > 1 && <nav aria-label="Halaman penugasan" className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" disabled={activePage===1} onClick={()=>setPage(activePage-1)}><ChevronLeft aria-hidden="true" />Sebelumnya</Button>
              <p role="status" className="text-sm">Halaman {activePage} dari {pages} · {rows.length} penugasan</p>
              <Button type="button" variant="outline" disabled={activePage===pages} onClick={()=>setPage(activePage+1)}>Berikutnya<ChevronRight aria-hidden="true" /></Button>
            </nav>}
          </section>
          <Announcements />
          <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Kehadiran hari ini"
              icon={CalendarCheck2}
              value={value.attendance?.actualIn?.slice(0,5) ?? "Belum tercatat"}
            >
              <p>Jam masuk · WIB</p>
              <p>Keluar: {value.attendance?.actualOut?.slice(0,5) ?? "Belum tercatat"}</p>
              <Link prefetch={false} className="ui-text-link" href="/kehadiran">
                Buka kehadiran
              </Link>
            </MetricCard>
            <MetricCard
              title="Honor terealisasi bulan ini"
              icon={Wallet}
              value={
                value.honor.rateMissing
                  ? "Tarif belum lengkap"
                  : rupiah(value.honor.total)
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
              <Link
                prefetch={false}
                className="ui-text-link"
                href="/honorarium"
              >
                Rincian honorarium
              </Link>
            </MetricCard>
            <MetricCard
              title="Progres kegiatan tercatat"
              icon={ClipboardCheck}
              value={
                <>
                  {confirmed}
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
                    : `${confirmed} dari ${value.tasks.length} kegiatan terkonfirmasi`
                }
                max={value.tasks.length || 1}
                value={confirmed}
              />
              <p>
                {
                  value.tasks.filter(
                    (task) => task.confirmed && !task.journalComplete,
                  ).length
                }{" "}
                jurnal / BAP perlu dilengkapi
              </p>
              <Link prefetch={false} className="ui-text-link" href="/kegiatan">
                Buka kegiatan
              </Link>
            </MetricCard>
          </section>
          {value.admin && (
            <section className="ui-panel space-y-3">
              <h2 className="font-bold">Ringkasan administrasi</h2>
              <p>
                {value.admin.activeUsers} pengguna aktif ·{" "}
                {value.admin.failedMessages} email perlu ditinjau ·{" "}
                {value.admin.failedJobs} pekerjaan gagal
              </p>
              <Link
                prefetch={false}
                className="ui-text-link"
                href="/admin/operasional"
              >
                Buka pemantauan operasional
              </Link>
            </section>
          )}
        </>
      )}
      {!value && <Announcements />}
    </div>
  );
}
