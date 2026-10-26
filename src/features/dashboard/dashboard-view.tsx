"use client";
import { Announcements } from "@/features/operations/announcements";
import { TaskCenter } from "@/features/tasks/task-center";
import { useDashboardDay } from "./use-dashboard-day";
import Link from "next/link";
import { LiveSummary } from "./live-summary";
import { DayContextCard } from "@/features/calendar/day-context-card";
import { ArrowRight, ShieldCheck, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import type { dashboardDto } from "@/server/dashboard/query";
export function DashboardView({
  data,
}: {
  data: ReturnType<typeof dashboardDto>;
}) {
  const date = useDashboardDay(data.date);
  const dateLabel = new Intl.DateTimeFormat("id-ID", {dateStyle:"full",timeZone:"Asia/Jakarta"}).format(new Date(date + "T12:00:00Z"));
  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere] sm:space-y-8">
      <header className="space-y-3 rounded-2xl border bg-gradient-to-br from-accent/60 to-card p-4 sm:p-6">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          {dateLabel} · WIB
        </p>
        <h1 className="text-2xl leading-tight font-bold tracking-tight sm:text-4xl">
          Selamat datang, {data.user.fullName}
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
          {data.user.role === "admin"
            ? "Ruang administrasi madrasah. Kelola kegiatan, data akademik, pengguna, dan honorarium dari satu ruang kerja."
            : "Ruang kerja guru. Pantau jadwal, catat kehadiran, lengkapi jurnal, dan lihat honorarium Anda."}
        </p>
        <nav aria-label="Aksi cepat Dashboard" className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link prefetch={false} href="/jadwal">Lihat jadwal</Link></Button>
          <Button asChild variant="outline"><Link prefetch={false} href={"/kehadiran?date=" + date}>Catat kehadiran</Link></Button>
          <Button asChild><Link prefetch={false} href={"/jurnal?date=" + date}>Isi jurnal</Link></Button>
        </nav>
      </header>
      <DashboardSection title="Tugas hari ini dan tertunda">
        <TaskCenter key={data.user.id + date + "-tasks"} compact date={date} embedded />
      </DashboardSection>
      <DashboardSection title="Konteks hari ini">
        <DayContextCard key={data.user.id + date} date={date} embedded />
      </DashboardSection>
      <Announcements key={data.user.id} refreshKey={date} />
      <LiveSummary key={data.user.id + date} date={date} userId={data.user.id} role={data.user.role} />
      <section
        className={data.user.role === "admin" ? "grid min-w-0 gap-4 lg:grid-cols-2" : "grid min-w-0 gap-4"}
        aria-label="Akses yang tersedia"
      >
        <div className="min-w-0 rounded-2xl border bg-accent/60 p-4 sm:p-6 text-accent-foreground">
          <ShieldCheck className="mb-5 size-7" aria-hidden="true" />
          <h2 className="text-lg font-bold">Akun sudah terlindungi</h2>
          <p className="mt-2 text-sm leading-7">
            Kata sandi permanen, email terverifikasi dan pertanyaan keamanan
            telah lengkap.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link prefetch={false} href="/akun">
              Kelola akun <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
        {data.user.role === "admin" && (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5">
            <div>
              <h2 className="font-semibold">Verifikasi pemulihan akun</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tinjau permintaan sesuai bukti identitas pemilik akun.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link prefetch={false} href="/admin/pemulihan">
                Buka pemulihan <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </section>
        )}
      </section>

    </div>
  );
}

/** Native disclosure keeps loaded data/state mounted while the section is collapsed. */
function DashboardSection({title,children}:{title:string;children:ReactNode}) {
  return <details className="group/dashboard-section min-w-0 rounded-2xl border bg-card">
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-4 focus-visible:outline-2 focus-visible:outline-ring sm:p-6 [&::-webkit-details-marker]:hidden">
      <h2 className="min-w-0 text-lg font-bold">{title}</h2>
      <ChevronDown aria-hidden="true" className="size-5 shrink-0 transition-transform group-open/dashboard-section:rotate-180 motion-reduce:transition-none" />
    </summary>
    <div className="min-w-0 border-t p-4 sm:p-6">{children}</div>
  </details>;
}
