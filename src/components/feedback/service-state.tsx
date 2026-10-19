"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export function ServiceState({
  title = "Layanan belum dapat dihubungi",
  message = "Silakan coba kembali. Jika gangguan berlanjut, hubungi administrator.",
  retry,
}: {
  title?: string;
  message?: string;
  retry?: () => void;
}) {
  return (
    <main id="konten-utama" className="mx-auto max-w-lg space-y-5 px-5 py-20">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p role="alert" className="text-sm leading-7 text-muted-foreground">
        {message}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={retry ?? (() => window.location.reload())}>
          Coba kembali
        </Button>
        <Button asChild variant="outline">
          <Link href="/akun">Ke akun</Link>
        </Button>
      </div>
    </main>
  );
}
export function PageSkeleton() {
  return (
    <main
      id="konten-utama"
      aria-busy="true"
      aria-label="Memuat halaman"
      className="mx-auto max-w-6xl space-y-6 p-6 sm:p-10"
    >
      <p role="status" className="text-sm text-muted-foreground">
        Menyiapkan ruang kerja…
      </p>
      <div className="h-10 w-2/3 rounded-xl bg-muted motion-safe:animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-36 rounded-2xl border bg-card motion-safe:animate-pulse"
          />
        ))}
      </div>
    </main>
  );
}
