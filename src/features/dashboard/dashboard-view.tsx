import Link from "next/link";
import { LiveSummary } from "./live-summary";
import { DayContextCard } from "@/features/calendar/day-context-card";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { dashboardDto } from "@/server/dashboard/query";
export function DashboardView({
  data,
}: {
  data: ReturnType<typeof dashboardDto>;
}) {
  return (
    <div className="space-y-9">
      <header className="space-y-3">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          {data.dateLabel} · WIB
        </p>
        <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
          Selamat datang, {data.user.fullName}
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
          {data.user.role === "admin"
            ? "Ruang administrasi madrasah. Kelola kegiatan, data akademik, pengguna, dan honorarium dari satu ruang kerja."
            : "Ruang kerja guru. Pantau jadwal, catat kehadiran, lengkapi jurnal, dan lihat honorarium Anda."}
        </p>
      </header>
      <section
        className="grid gap-5 lg:grid-cols-2"
        aria-label="Akses yang tersedia"
      >
        <div className="rounded-2xl border bg-accent/60 p-6 text-accent-foreground">
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
      <DayContextCard />
      <LiveSummary />
    </div>
  );
}
