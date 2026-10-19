import Link from "next/link";
import type { Metadata } from "next";
import { CircleCheck, Clock3 } from "lucide-react";
import { Workspace } from "@/components/shell/workspace";
import { ModuleCards } from "@/features/dashboard/module-cards";
import { modules } from "@/lib/navigation/modules";
import { Button } from "@/components/ui/button";
export const metadata: Metadata = { title: "Status pengembangan" };
export default function ReadinessPage() {
  return (
    <Workspace>
      <header className="mb-8 space-y-3">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary">
          Catatan rilis · Tahap 2.2
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Status pengembangan
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
          Halaman publik ini menjelaskan cakupan aplikasi. Status berikut adalah
          catatan implementasi, bukan pemeriksaan langsung ketersediaan layanan.
        </p>
      </header>
      <section
        className="mb-9 grid gap-5 md:grid-cols-2"
        aria-label="Fondasi aplikasi"
      >
        <div className="rounded-2xl border bg-card p-6">
          <CircleCheck
            aria-hidden="true"
            className="mb-4 size-6 text-primary"
          />
          <h2 className="text-lg font-bold">Fondasi dan akun tersedia</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Login, sesi, profil, onboarding, pemulihan dan manajemen pengguna
            serta kerangka dashboard tersedia. Koneksi database dan pemisahan
            hak akses sudah diverifikasi.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/dashboard">Buka ruang kerja</Link>
          </Button>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <Clock3 aria-hidden="true" className="mb-4 size-6 text-primary" />
          <h2 className="text-lg font-bold">
            Pengiriman email menunggu konfigurasi
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Antrean dan adapter tersedia. Pengiriman nyata belum diaktifkan
            karena konfigurasi penyedia email, pengirim terverifikasi dan akun
            worker belum lengkap. Akun tanpa email terverifikasi tetap dibatasi.
          </p>
        </div>
      </section>
      <section aria-labelledby="planned-heading">
        <h2 id="planned-heading" className="mb-2 text-xl font-bold">
          Ketersediaan modul
        </h2>
        <p className="mb-5 text-sm leading-7 text-muted-foreground">
          Daftar cakupan guru dan administrasi beserta status implementasinya.
          Halaman ini tidak memberikan akses atau kewenangan akun.
        </p>
        <ModuleCards items={modules} linked={false} />
      </section>
    </Workspace>
  );
}
