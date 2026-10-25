"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Wallet, CalendarCheck2 } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { FeatureState } from "@/components/feedback/feature-state";
import { useReadResource } from "@/lib/feedback/use-read-resource";
import { dashboardRows, activityLabel, rupiah, pendingJournal, readDashboardSummary, activityHref } from "@/lib/dashboard/summary";
import { Button } from "@/components/ui/button";
import { RotateCcw, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
export function LiveSummary({date, userId, role}: {date: string; userId: string; role: "admin" | "guru"}) {
  const parse = useCallback((raw: unknown) => readDashboardSummary(raw, date, {id: userId, role}), [date, userId, role]);
  const {value, error, loading, updatedAt, refresh} = useReadResource("/api/dashboard?section=summary", parse);
  const [page, setPage] = useState(1);
  const confirmed = value?.tasks.filter((task) => task.confirmed).length ?? 0;
  const rows = dashboardRows(value);
  const pages = Math.max(1, Math.ceil(rows.length / 8));
  const activePage = Math.min(page,pages);
  return (
    <div className="space-y-5">
      <header className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-start">
        <div><h2 className="text-lg font-bold">Ringkasan kegiatan</h2><p className="text-sm text-muted-foreground">Data pribadi hari ini dan perhitungan honorarium berjalan.</p></div>
        <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={loading} onClick={() => { setPage(1); refresh(); }}><RotateCcw aria-hidden="true" />Muat ulang ringkasan</Button>
      </header>
      {value && <p role="status" className="text-sm text-muted-foreground">{loading ? "Memperbarui ringkasan…" : updatedAt ? "Diperbarui " + new Date(updatedAt).toLocaleTimeString("id-ID", {timeZone:"Asia/Jakarta"}) + " WIB" : ""}</p>}
      {!value ? (
        <FeatureState
          headingLevel={2}
          error={error}
          label="Memuat ringkasan kegiatan…"
          retry={refresh}
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
              {rows.slice((activePage-1)*8,activePage*8).map(t=><li key={t.key} className="min-w-0 break-words rounded-lg border bg-muted/20 p-3 text-sm leading-6"><span className="font-semibold">{activityLabel(t.kind)}</span> · {t.start.slice(0,5)}–{t.end.slice(0,5)} WIB<p className="text-muted-foreground">{t.status}</p><Link prefetch={false} className="ui-text-link" href={activityHref(t.kind,date)}>Buka sumber kegiatan</Link></li>)}
            </ul>
            {pages > 1 && <nav aria-label="Halaman penugasan" className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" disabled={activePage===1} onClick={()=>setPage(activePage-1)}><ChevronLeft aria-hidden="true" />Sebelumnya</Button>
              <p role="status" className="text-sm">Halaman {activePage} dari {pages} · {rows.length} penugasan</p>
              <Button type="button" variant="outline" disabled={activePage===pages} onClick={()=>setPage(activePage+1)}>Berikutnya<ChevronRight aria-hidden="true" /></Button>
            </nav>}
          </section>
          <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Kehadiran hari ini"
              icon={CalendarCheck2}
              value={value.attendance?.actualIn?.slice(0,5) ?? "Belum tercatat"}
            >
              <p>Jam masuk · WIB</p>
              <p>Keluar: {value.attendance?.actualOut?.slice(0,5) ?? "Belum tercatat"}</p>
              <Link prefetch={false} className="ui-text-link" href={"/kehadiran?date=" + date}>
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
                    pendingJournal,
                  ).length
                }{" "}
                jurnal / BAP perlu dilengkapi
              </p>
              <Link prefetch={false} className="ui-text-link" href={"/kegiatan?date=" + date}>
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
    </div>
  );
}
