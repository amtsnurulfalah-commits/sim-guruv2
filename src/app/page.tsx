import Link from "next/link";
import { ArrowRight, BookOpenCheck, CalendarDays, Check, ChevronDown, ClipboardCheck, LockKeyhole, Wallet } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import "./home.css";

const features = [
  { icon: CalendarDays, title: "Jadwal lebih terarah", description: "Temukan jadwal mengajar dan penugasan untuk menyiapkan kegiatan Anda." },
  { icon: ClipboardCheck, title: "Catatan tersusun rapi", description: "Isi kehadiran, rekap siswa, dan jurnal sesuai kegiatan yang Anda jalankan." },
  { icon: Wallet, title: "Administrasi mudah ditinjau", description: "Periksa riwayat kegiatan dan rincian honorarium melalui akun Anda." },
];

const steps = [
  { title: "Masuk dengan akun Anda", description: "Gunakan username dan kata sandi dari administrator madrasah." },
  { title: "Periksa kegiatan hari ini", description: "Buka jadwal dan tugas untuk mengetahui kegiatan yang perlu diselesaikan." },
  { title: "Lengkapi catatan kegiatan", description: "Simpan kehadiran dan jurnal, lalu periksa kembali riwayatnya." },
];

export default function HomePage() {
  return (
    <div className="public-home home-landing min-h-svh min-w-0 [overflow-wrap:anywhere]">
      <header className="home-header border-b bg-card">
        <div className="home-container flex flex-wrap items-center justify-between gap-3 py-4">
          <Link prefetch={false} href="/" aria-label="SiM-Guru, beranda" className="home-brand inline-flex min-h-11 items-center rounded-lg"><Brand /></Link>
          <nav aria-label="Navigasi beranda" className="flex flex-wrap items-center gap-2 sm:gap-5">
            <a href="#fitur" className="home-nav-link hidden sm:inline-flex">Fitur</a>
            <a href="#mulai" className="home-nav-link hidden sm:inline-flex">Cara mulai</a>
            <Button asChild size="sm"><Link prefetch={false} href="/login">Masuk <ArrowRight aria-hidden="true" /></Link></Button>
          </nav>
        </div>
      </header>
      <main id="konten-utama" tabIndex={-1}>
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-container grid items-center gap-10 py-12 sm:py-20 lg:grid-cols-2 lg:gap-14 lg:py-24">
            <div className="min-w-0">
              <p className="home-eyebrow"><span aria-hidden="true" className="size-2 rounded-full bg-primary" /> Sistem Informasi Guru</p>
              <h1 id="home-title" className="mt-6 text-4xl leading-[1.12] font-bold tracking-tight sm:text-5xl xl:text-6xl">
                SiM-Guru untuk <span className="text-primary">kegiatan harian</span>
              </h1>
              <p className="mt-6 max-w-lg text-base leading-8 text-muted-foreground sm:text-lg">
                Jadwal, kehadiran, jurnal, dan honorarium dalam satu ruang kerja madrasah.
              </p>
              <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg"><Link prefetch={false} href="/login">Masuk ke SiM-Guru <ArrowRight aria-hidden="true" /></Link></Button>
                <Button asChild variant="solid" size="lg"><Link prefetch={false} href="/kesiapan">Panduan penggunaan SiM-Guru</Link></Button>
              </div>
              <p className="mt-5 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
                <LockKeyhole aria-hidden="true" className="mt-1 size-4 shrink-0" /> Akun dikelola oleh administrator madrasah.
              </p>
            </div>
            <div className="home-visual min-w-0" aria-label="Gambaran alur kerja SiM-Guru">
              <div className="home-visual-card">
                <div className="flex items-center justify-between gap-3 border-b pb-5">
                  <span className="flex items-center gap-2 text-sm font-semibold"><BookOpenCheck aria-hidden="true" className="size-5 text-primary" /> Ruang kerja guru</span>
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-primary">Ilustrasi alur</span>
                </div>
                <p className="mt-6 text-xl font-semibold">Mulai dari jadwal.<br /><span className="text-muted-foreground">Selesaikan langkah berikutnya.</span></p>
                <div className="mt-6 space-y-3">
                  {[{ icon: CalendarDays, title: "Lihat jadwal", text: "Siapkan kegiatan Anda" }, { icon: ClipboardCheck, title: "Catat kehadiran", text: "Lengkapi sesuai penugasan" }, { icon: BookOpenCheck, title: "Isi jurnal", text: "Simpan catatan pembelajaran" }].map(({ icon: Icon, title, text }, index) => (
                    <div key={title} className="home-flow-row">
                      <span className="home-icon"><Icon aria-hidden="true" className="size-5" /></span>
                      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>
                      <span aria-hidden="true" className="text-xs font-semibold text-muted-foreground">0{index + 1}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Check aria-hidden="true" className="size-4 shrink-0 text-primary" /> Tinjau kembali melalui riwayat kegiatan.</p>
              </div>
            </div>
          </div>
        </section>
        <section id="fitur" aria-labelledby="features-title" className="home-section border-y bg-card">
          <div className="home-container">
            <p className="home-eyebrow">Kebutuhan harian, saling terhubung</p>
            <h2 id="features-title" className="mt-3 max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">Lebih mudah mengikuti pekerjaan Anda.</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <article key={title} className="home-feature">
                  <span className="home-icon"><Icon aria-hidden="true" className="size-5" /></span>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="mulai" aria-labelledby="steps-title" className="home-section">
          <div className="home-container grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div><p className="home-eyebrow">Baru menggunakan SiM-Guru?</p><h2 id="steps-title" className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Mulai dengan tiga langkah.</h2><p className="mt-4 text-sm leading-7 text-muted-foreground">Menu yang tersedia menyesuaikan peran dan penugasan akun Anda.</p></div>
            <ol aria-label="Tiga langkah menggunakan SiM-Guru" className="space-y-5">
              {steps.map((step, index) => <li key={step.title} className="flex min-w-0 gap-4"><span aria-hidden="true" className="home-step-number">0{index + 1}</span><div className="min-w-0 border-b pb-5"><h3 className="font-semibold">{step.title}</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">{step.description}</p></div></li>)}
            </ol>
          </div>
        </section>
        <section aria-labelledby="help-title" className="home-container pb-12 sm:pb-16">
          <div className="home-help">
            <div><p className="home-eyebrow">Bantuan singkat</p><h2 id="help-title" className="mt-3 text-2xl font-bold">Siap menggunakan akun Anda?</h2></div>
            <div className="mt-6 space-y-3">
              {[["Bagaimana mendapatkan akun?", "Hubungi administrator madrasah untuk memperoleh akun dan petunjuk aktivasi."], ["Bagaimana jika lupa kata sandi?", "Pilih Lupa kata sandi pada halaman masuk, lalu ikuti langkah pemulihan yang tersedia."], ["Apakah bisa digunakan melalui ponsel?", "SiM-Guru dapat dibuka melalui browser ponsel. Setelah masuk, ikuti petunjuk pemasangan aplikasi jika diminta."]].map(([question, answer]) => (
                <details key={question} className="rounded-xl border bg-card">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-4 font-medium focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">{question}<ChevronDown aria-hidden="true" className="size-4 shrink-0" /></summary>
                  <p className="px-4 pb-4 text-sm leading-7 text-muted-foreground">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t bg-card"><div className="home-container flex flex-wrap items-center justify-between gap-3 py-6 text-xs leading-6 text-muted-foreground"><p>SiM-Guru · Sistem Informasi Guru</p><Link prefetch={false} href="/pembaruan" className="home-nav-link">Catatan pembaruan</Link></div></footer>
    </div>
  );
}
