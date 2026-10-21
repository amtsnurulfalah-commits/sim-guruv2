import Link from "next/link";
import { BookOpen, CalendarCheck2, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import type { ReactNode } from "react";
export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main id="konten-utama" className="grid min-h-svh lg:grid-cols-[1fr_1.1fr]">
      <section
        className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-white lg:flex xl:p-16"
        aria-label="Tentang SiM-Guru"
      >
        <Link
          prefetch={false}
          href="/"
          className="text-xl font-bold tracking-tight"
        >
          SiM-Guru
          <span className="mt-1 block text-xs font-normal tracking-wide text-white/80">
            SISTEM INFORMASI GURU
          </span>
        </Link>
        <div className="relative z-10 max-w-lg space-y-6">
          <span className="inline-flex rounded-full border border-white/30 px-3 py-1 text-xs">
            Ruang kerja madrasah
          </span>
          <h2 className="text-4xl leading-tight font-semibold xl:text-5xl">
            Administrasi tertata.
            <br />
            Lebih fokus mengajar.
          </h2>
          <p className="text-base leading-8 text-white/85">
            Jadwal, kehadiran, jurnal, dan honorarium dalam alur kerja yang
            terhubung.
          </p>
          <div className="grid gap-4 pt-4 text-sm">
            <p className="flex items-center gap-3">
              <CalendarCheck2 className="size-5" aria-hidden="true" />
              Kegiatan harian lebih terarah
            </p>
            <p className="flex items-center gap-3">
              <BookOpen className="size-5" aria-hidden="true" />
              Catatan pembelajaran tersusun rapi
            </p>
            <p className="flex items-center gap-3">
              <ShieldCheck className="size-5" aria-hidden="true" />
              Akses sesuai kewenangan akun
            </p>
          </div>
        </div>
        <p className="text-xs text-white/75">
          SiM-Guru · Sistem Informasi Guru
        </p>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-36 -bottom-32 size-[30rem] rounded-full border-[70px] border-white/5"
        />
      </section>
      <section className="flex min-w-0 flex-col justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-lg">
          <div className="mb-9 lg:hidden">
            <Link prefetch={false} href="/">
              <Brand />
            </Link>
          </div>
          <div className="mb-7">
            <p className="mb-3 text-xs font-semibold tracking-widest text-primary uppercase">
              Selamat datang
            </p>
            <h1 className="text-3xl">{title}</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="ui-panel space-y-5 sm:p-7">{children}</div>
          <p className="mt-6 text-center text-xs leading-6 text-muted-foreground">
            Gunakan akun yang diberikan administrator madrasah.
          </p>
        </div>
      </section>
    </main>
  );
}
