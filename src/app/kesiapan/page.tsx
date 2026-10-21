import { ActionIcon } from "@/components/ui/action-icon";
import Link from "next/link";
import type { Metadata } from "next";
import { CircleHelp, LogIn } from "lucide-react";
import { Workspace } from "@/components/shell/workspace";
import { ModuleCards } from "@/features/dashboard/module-cards";
import { modules } from "@/lib/navigation/modules";
import { Button } from "@/components/ui/button";
export const metadata: Metadata = { title: "Panduan aplikasi" };
export default function ReadinessPage() {
  return (
    <Workspace>
      <header className="mb-8 space-y-3">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary">
          Bantuan pengguna
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Panduan aplikasi</h1>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
          Gunakan SiM-Guru untuk memeriksa jadwal, mencatat kegiatan, dan
          memantau administrasi madrasah. Menu yang tersedia mengikuti peran dan
          kewenangan akun Anda.
        </p>
      </header>
      <section
        className="mb-9 grid gap-5 md:grid-cols-2"
        aria-label="Mulai menggunakan aplikasi"
      >
        <div className="ui-panel space-y-4">
          <LogIn aria-hidden="true" className="size-6 text-primary" />
          <h2 className="text-lg font-bold">Masuk dan lengkapi akun</h2>
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-7 text-muted-foreground">
            <li>Dapatkan akun dari administrator madrasah.</li>
            <li>
              Masuk dengan username dan kata sandi Anda. Selesaikan aktivasi
              atau pengamanan akun jika diminta.
            </li>
            <li>
              Buka jadwal dan pilih tanggal kegiatan. Lengkapi kehadiran serta
              jurnal sesuai penugasan Anda.
            </li>
          </ol>
          <Button asChild variant="outline">
            <Link prefetch={false} href="/login">
              <ActionIcon action="access" />
              Masuk ke SiM-Guru
            </Link>
          </Button>
        </div>
        <div className="ui-panel space-y-4">
          <CircleHelp aria-hidden="true" className="size-6 text-primary" />
          <h2 className="text-lg font-bold">Saat membutuhkan bantuan</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            Lupa kata sandi? Gunakan pemulihan akun. Jika aktivasi atau kode
            verifikasi belum diterima, periksa folder spam dan hubungi
            administrator untuk memeriksa status pengiriman.
          </p>
          <p className="text-sm leading-7 text-muted-foreground">
            Jika jadwal atau penugasan tidak sesuai, sampaikan tanggal dan
            kegiatan terkait kepada administrator. Jangan membagikan kata sandi,
            kode OTP, atau tautan pemulihan akun.
          </p>
          <Button asChild variant="outline">
            <Link prefetch={false} href="/lupa-password">
              <ActionIcon action="open" />
              Buka pemulihan akun
            </Link>
          </Button>
        </div>
      </section>
      <section
        className="page-section space-y-5 rounded-2xl border bg-card p-5"
        aria-labelledby="modules-heading"
      >
        <h2 id="modules-heading" className="text-xl font-bold">
          Modul SiM-Guru
        </h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Daftar ini menjelaskan fungsi aplikasi. Masuk untuk menggunakan modul
          yang diizinkan bagi akun Anda.
        </p>
        <ModuleCards items={modules} linked={false} />
      </section>
    </Workspace>
  );
}
