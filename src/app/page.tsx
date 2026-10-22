import Link from "next/link";
import { ArrowRight, Check, LockKeyhole, Sprout } from "lucide-react";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  {
    number: "01",
    title: "Periksa jadwal",
    description: "Jadwal, kehadiran, dan jurnal dalam satu ruang kerja.",
  },
  {
    number: "02",
    title: "Catat kegiatan",
    description:
      "Lengkapi kehadiran, rekap siswa, dan jurnal sesuai penugasan.",
  },
  {
    number: "03",
    title: "Pantau administrasi",
    description: "Tinjau riwayat kegiatan dan rincian honorarium Anda.",
  },
];
export default function HomePage() {
  return (
    <div className="public-home flex min-h-svh min-w-0 flex-col [overflow-wrap:anywhere]">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8 sm:py-5">
          <Link
            prefetch={false}
            href="/"
            aria-label="SiM-Guru, beranda"
            className="inline-flex min-h-11 max-w-full items-center rounded-md [&>span]:flex-wrap [&>span>span:first-child]:shrink-0"
          >
            <Brand />
          </Link>
          <Badge className="max-w-full border-primary/15 bg-primary/5 text-primary">
            Ruang kerja madrasah
          </Badge>
        </div>
      </header>
      <main
        id="konten-utama"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-5 py-8 sm:px-8 sm:py-16"
      >
        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-12">
          <div className="min-w-0 py-4">
            <p className="mb-5 flex items-start gap-2 text-xs font-bold tracking-widest text-primary uppercase">
              <Sprout aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> Ruang kerja guru
              yang terhubung
            </p>
            <h1 className="max-w-2xl text-3xl leading-tight font-bold tracking-tight min-[375px]:text-4xl sm:text-5xl">
              Administrasi tertata.
              <br />
              <span className="text-primary">Fokus untuk mengajar.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-muted-foreground">
              SiM-Guru menghubungkan kegiatan, kehadiran, jurnal, dan honorarium
              dalam satu alur yang jelas.
            </p>
            <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
              Akses modul mengikuti peran dan kewenangan akun. Mulai dari
              jadwal, lengkapi catatan kegiatan, lalu pantau rekap administrasi
              Anda.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 h-auto min-h-12 w-full py-3 sm:w-auto"
            >
              <Link prefetch={false} href="/login">
                Masuk ke SiM-Guru <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <p className="mt-5 text-sm">
              <Link
                prefetch={false}
                href="/kesiapan"
                className="ui-text-link max-w-full rounded-md py-2 underline underline-offset-4 hover:text-accent-foreground"
              >
                Panduan penggunaan SiM-Guru
              </Link>
            </p>
            <div className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
              <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> Akun
              dikelola oleh administrator madrasah.
            </div>
          </div>
          <Card
            aria-labelledby="home-workflow-title"
            className="min-w-0 self-start shadow-sm"
          >
            <CardHeader className="border-b bg-muted/40 p-6">
              <p className="mb-2 text-xs tracking-widest text-muted-foreground uppercase">
                Alur kerja SiM-Guru
              </p>
              <CardTitle id="home-workflow-title" className="text-xl">
                Mulai dari kegiatan harian
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              <ol
                role="list"
                className="space-y-6"
                aria-label="Tiga langkah menggunakan SiM-Guru"
              >
                {steps.map((step, index) => (
                  <li key={step.number} className="flex min-w-0 gap-3 sm:gap-4">
                    <span
                      aria-hidden="true"
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    >
                      {step.number}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-6 flex items-start gap-2 border-t pt-5 text-xs text-muted-foreground">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />{" "}
                Akses dikelola oleh administrator madrasah.
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-2 border-t px-5 py-6 text-xs text-muted-foreground sm:px-8">
        <p>SiM-Guru · Sistem Informasi Guru</p>
        <p>Ruang kerja madrasah</p>
      </footer>
    </div>
  );
}
