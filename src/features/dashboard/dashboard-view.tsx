import Link from "next/link";
import { DayContextCard } from "@/features/calendar/day-context-card";
import { ArrowRight, BookOpenCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModuleCards } from "./module-cards";
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
            ? "Ruang administrasi madrasah. Kelola akses akun yang tersedia dan pantau kesiapan modul aplikasi."
            : "Ruang kerja guru. Akses pengamanan akun dan pantau kesiapan modul kegiatan Anda."}
        </p>
      </header>
      <DayContextCard />
      <section
        className="grid gap-5 md:grid-cols-2"
        aria-label="Akses yang tersedia"
      >
        <div className="rounded-2xl border bg-primary p-6 text-primary-foreground">
          <ShieldCheck className="mb-5 size-7" aria-hidden="true" />
          <h2 className="text-lg font-bold">Akun sudah terlindungi</h2>
          <p className="mt-2 text-sm leading-7">
            Kata sandi permanen, email terverifikasi dan pertanyaan keamanan
            telah lengkap.
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-5 border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/akun">
              Kelola akun <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <BookOpenCheck
            className="mb-5 size-7 text-primary"
            aria-hidden="true"
          />
          <h2 className="text-lg font-bold">Kegiatan belum dapat dicatat</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Jadwal, kehadiran, jurnal dan honorarium belum diaktifkan. Ringkasan
            kegiatan serta nominal akan muncul setelah modul sumber datanya
            tersedia.
          </p>
          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            Belum tersedia bukan berarti jumlah kegiatan atau honorarium
            bernilai nol.
          </p>
        </div>
      </section>
      {data.user.role === "admin" && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5">
          <div>
            <h2 className="font-semibold">Verifikasi pemulihan akun</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tinjau permintaan sesuai bukti identitas pemilik akun.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/pemulihan">
              Buka pemulihan <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </section>
      )}
      <section aria-labelledby="module-heading">
        <div className="mb-5 space-y-2">
          <h2 id="module-heading" className="text-xl font-bold">
            Modul ruang kerja
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">
            Berikut cakupan modul sesuai peran Anda. Halaman status menyediakan
            penjelasan tahap pengerjaannya.
          </p>
        </div>
        <ModuleCards items={data.modules} />
      </section>
    </div>
  );
}
