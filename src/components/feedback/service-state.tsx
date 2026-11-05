"use client";
import { ActionIcon } from "@/components/ui/action-icon";

import Link from "next/link";
import { Brand } from "@/components/brand";
import { WifiOff } from "lucide-react";
import { LoadingMessage } from "./loading-message";
import { Button } from "@/components/ui/button";
export function ServiceState({
  title = "Layanan belum dapat dihubungi",
  message = "Silakan coba kembali. Jika gangguan berlanjut, hubungi administrator.",
  retry,
  embedded = false,
}: {
  title?: string;
  message?: string;
  retry?: () => void;
  embedded?: boolean;
}) {
  const Container = embedded ? "section" : "main";
  return (
    <Container
      id={embedded ? undefined : "konten-utama"}
      className="ui-panel mx-4 my-12 max-w-lg space-y-5 sm:mx-auto sm:p-8"
    >
      <Brand />
      <WifiOff
        className="mt-7 size-9 text-muted-foreground"
        aria-hidden="true"
      />
      <h1 className="text-2xl font-bold">{title}</h1>
      <p role="alert" className="whitespace-pre-line break-words text-sm leading-7 text-muted-foreground">
        {message}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={retry ?? (() => window.location.reload())}>
          <ActionIcon action="refresh" />
          Coba kembali
        </Button>
        <Button asChild variant="outline">
          <Link prefetch={false} href="/akun">
            <ActionIcon action="open" />
            Ke akun
          </Link>
        </Button>
      </div>
    </Container>
  );
}
export function PageSkeleton({ embedded = false }: { embedded?: boolean }) {
  const Container = embedded ? "div" : "main";
  return (
    <Container
      id={embedded ? undefined : "konten-utama"}
      aria-label="Memuat halaman"
      className="mx-auto max-w-6xl space-y-6 p-6 sm:p-10"
    >
      <LoadingMessage label="Menyiapkan ruang kerja…" />
      <div aria-hidden="true" className="h-10 w-2/3 rounded-xl bg-muted motion-safe:animate-pulse" />
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-36 rounded-2xl border bg-card motion-safe:animate-pulse"
          />
        ))}
      </div>
    </Container>
  );
}
