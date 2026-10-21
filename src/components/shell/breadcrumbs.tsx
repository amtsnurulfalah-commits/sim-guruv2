"use client";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { modulesFor } from "@/lib/navigation/modules";
import type { SessionDto } from "@/types/auth";
type Role = SessionDto["user"]["role"];
const pages: Record<string, string> = {
  akun: "Akun dan profil",
  profil: "Profil",
  onboarding: "Pengamanan akun",
  dashboard: "Dashboard",
  kesiapan: "Panduan aplikasi",
  pemulihan: "Pemulihan akun",
  input: "Input data",
  riwayat: "Riwayat",
  operasi: "Operasi",
  jurnal: "Jurnal",
  kehadiran: "Kehadiran",
  panitia: "Panitia",
  bap: "Berita acara",
};
export function Breadcrumbs({
  pathname,
  role,
  ready,
}: {
  pathname: string;
  role?: Role | undefined;
  ready: boolean;
}) {
  const currentModule = role
    ? modulesFor(role)
        .filter(
          (m) =>
            m.href &&
            (pathname === m.href || pathname.startsWith(m.href + "/")),
        )
        .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0]
    : undefined;
  const segments = pathname.split("/").filter(Boolean),
    leaf = segments.at(-1) ?? "";
  const title =
    currentModule && pathname === currentModule.href
      ? currentModule.title
      : (pages[leaf] ?? currentModule?.title ?? "Ruang kerja");
  return (
    <nav
      aria-label="Jejak navigasi"
      className="mb-6 flex min-w-0 flex-wrap items-center gap-2 text-xs leading-6 text-muted-foreground"
    >
      <Link
        prefetch={false}
        href={ready ? "/dashboard" : "/"}
        className="inline-flex min-h-11 items-center gap-2 rounded-md hover:text-primary"
      >
        <Home className="size-3.5" aria-hidden="true" />
        Beranda
      </Link>
      <ChevronRight className="size-3.5" aria-hidden="true" />
      {currentModule && pathname !== currentModule.href && (
        <>
          <Link
            prefetch={false}
            href={currentModule.href!}
            className="inline-flex min-h-11 items-center rounded-md hover:text-primary"
          >
            {currentModule.title}
          </Link>
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </>
      )}
      <span aria-current="page" className="font-semibold text-foreground">
        {title}
      </span>
    </nav>
  );
}
