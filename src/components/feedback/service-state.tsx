"use client";
import { ActionIcon } from "@/components/ui/action-icon";

import Link from "next/link";
import { Brand } from "@/components/brand";
import { WifiOff } from "lucide-react";
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
    <main
      id="konten-utama"
      className="ui-panel mx-4 my-12 max-w-lg space-y-5 sm:mx-auto sm:p-8"
    >
      <Brand />
      <WifiOff
        className="mt-7 size-9 text-muted-foreground"
        aria-hidden="true"
      />
      <h1 className="text-2xl font-bold">{title}</h1>
      <p role="alert" className="text-sm leading-7 text-muted-foreground">
        {message}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={retry ?? (() => window.location.reload())}>
          <ActionIcon action="refresh" />
          Coba kembali
        </Button>
        <Button asChild variant="outline">
          <Link href="/akun">
            <ActionIcon action="open" />
            Ke akun
          </Link>
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
