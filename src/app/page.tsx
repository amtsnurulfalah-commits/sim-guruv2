import Link from "next/link";
import { ArrowRight, Check, LockKeyhole, Sprout } from "lucide-react";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  {
    number: "01",
    title: "Fondasi aplikasi",
    description: "Struktur proyek dan migrasi identitas dasar telah disiapkan.",
    state: "Tersedia",
  },
  {
    number: "02",
    title: "Akun dan akses",
    description: "Login internal, aktivasi akun, dan kewenangan pengguna.",
    state: "Tahap saat ini",
  },
  {
    number: "03",
    title: "Kegiatan dan administrasi",
    description: "Jadwal, kehadiran, jurnal, ujian, dan honorarium.",
    state: "Belum tersedia",
  },
];
export default function HomePage() {
  return (
    <div className="min-h-svh">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" aria-label="SiM-Guru, beranda">
            <Brand />
          </Link>
          <Badge className="border-primary/15 bg-primary/5 text-primary">
            Dalam pengembangan
          </Badge>
        </div>
      </header>
      <main
        id="konten-utama"
        className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-20"
      >
        <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
          <div className="py-4">
            <p className="mb-6 flex items-center gap-2 text-xs font-bold tracking-widest text-primary uppercase">
              <Sprout aria-hidden="true" className="size-4" /> Ruang kerja guru
              yang terhubung
            </p>
            <h1 className="max-w-2xl text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
              Administrasi tertata.
              <br />
              <span className="text-primary">Fokus untuk mengajar.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-muted-foreground">
              SiM-Guru sedang dibangun untuk menghubungkan kegiatan, kehadiran,
              jurnal, dan honorarium dalam satu alur yang jelas.
            </p>
            <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
              Login dan pengamanan akun sudah tersedia. Modul kegiatan masih
              dikembangkan; pengiriman email menunggu konfigurasi layanan.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/login">
                Masuk ke SiM-Guru <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <p className="mt-5 text-sm">
              <Link
                href="/kesiapan"
                className="font-semibold text-primary underline underline-offset-4"
              >
                Lihat status pengembangan
              </Link>
            </p>
            <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
              <LockKeyhole aria-hidden="true" className="size-4" /> Akun
              dikelola oleh administrator madrasah.
            </div>
          </div>
          <Card className="overflow-hidden self-start shadow-sm">
            <CardHeader className="border-b bg-muted/40 p-6">
              <p className="mb-2 text-xs tracking-widest text-muted-foreground uppercase">
                Langkah pembangunan
              </p>
              <CardTitle className="text-xl">
                Dibangun secara bertahap
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-7 p-6">
              {steps.map((step, index) => (
                <div key={step.number} className="flex gap-4">
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                  >
                    {step.number}
                  </span>
                  <div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {step.description}
                    </p>
                    <p
                      className={`mt-2 text-xs font-medium ${index === 0 ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {step.state}
                    </p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 border-t pt-5 text-xs text-muted-foreground">
                <Check aria-hidden="true" className="size-4 text-primary" />{" "}
                Acuan fitur dan kebijakan telah disusun.
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 border-t px-5 py-6 text-xs text-muted-foreground sm:px-8">
        <p>SiM-Guru · Sistem Informasi Guru</p>
        <p>Tahap 2.2 · Manajemen pengguna</p>
      </footer>
    </div>
  );
}
