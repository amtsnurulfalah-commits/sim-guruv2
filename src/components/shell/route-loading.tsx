"use client";
import { usePathname } from "next/navigation";
import { modulesFor } from "@/lib/navigation/modules";
import { NavigationLoading } from "./navigation-loading";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/akun": "Akun dan profil",
  "/profil": "Akun dan profil",
  "/onboarding": "Pengamanan akun",
  "/admin/pemulihan": "Pemulihan akun",
};
export function RouteLoading() {
  const pathname = usePathname();
  const entry = modulesFor("admin")
    .filter(
      (item) =>
        item.href &&
        (pathname === item.href || pathname.startsWith(item.href + "/")),
    )
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0];
  return (
    <NavigationLoading
      title={titles[pathname] ?? entry?.title ?? "Halaman tujuan"}
    />
  );
}
