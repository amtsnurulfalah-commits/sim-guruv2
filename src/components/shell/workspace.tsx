"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { modulesFor } from "@/lib/navigation/modules";
import { cn } from "@/lib/utils";
import type { SessionDto } from "@/types/auth";
export function Workspace({
  children,
  session,
  onLogout,
}: {
  children: ReactNode;
  session?: SessionDto;
  onLogout?: () => void;
}) {
  const pathname = usePathname(),
    [collapsed, setCollapsed] = useState(false),
    drawer = useRef<HTMLDialogElement>(null),
    mobileTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let active = true;
    async function restore() {
      await Promise.resolve();
      if (!active) return;
      try {
        setCollapsed(
          localStorage.getItem("sim-guru:sidebar:v1") === "collapsed",
        );
      } catch {
        /* Preferensi bersifat opsional. */
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, []);
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(
        "sim-guru:sidebar:v1",
        next ? "collapsed" : "expanded",
      );
    } catch {
      /* Tidak menyimpan actor, token, peran atau flag onboarding. */
    }
  }
  function closeDrawer() {
    drawer.current?.close();
    mobileTrigger.current?.focus();
  }
  const role = session?.user.role,
    ready = session?.scope === "business";
  const links = role && ready ? modulesFor(role) : [];
  function nav(compact = false) {
    const item = (
      href: string,
      label: string,
      Icon: typeof LayoutDashboard,
    ) => (
      <Link
        key={href}
        href={href}
        onClick={() => {
          if (drawer.current?.open) closeDrawer();
        }}
        aria-current={pathname === href ? "page" : undefined}
        title={compact ? label : undefined}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
          pathname === href
            ? "bg-accent font-semibold text-primary"
            : "text-muted-foreground",
          compact && "justify-center",
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden="true" />
        <span className={compact ? "sr-only" : ""}>{label}</span>
      </Link>
    );
    return (
      <nav aria-label="Navigasi utama" className="space-y-2">
        {session ? (
          <>
            {ready && item("/dashboard", "Dashboard", LayoutDashboard)}
            {item("/akun", "Akun dan profil", UserRound)}
            {role === "admin" &&
              ready &&
              item("/admin/pemulihan", "Pemulihan akun", ShieldCheck)}
          </>
        ) : (
          <>
            {item("/", "Beranda", LayoutDashboard)}
            {item("/login", "Masuk ke akun", UserRound)}
          </>
        )}
        {(["Kegiatan", "Administrasi"] as const).map((group) => {
          const list = links.filter((m) => m.group === group);
          if (!list.length) return null;
          return compact ? (
            <div key={group} className="border-t pt-2">
              {list.map((m) =>
                item(
                  "/modul/" + m.slug,
                  m.title,
                  group === "Kegiatan" ? BookOpen : Settings2,
                ),
              )}
            </div>
          ) : (
            <details key={group} open className="border-t pt-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {group}
                <ChevronDown className="size-4" aria-hidden="true" />
              </summary>
              <div className="space-y-1">
                {list.map((m) =>
                  item(
                    "/modul/" + m.slug,
                    m.title,
                    group === "Kegiatan" ? CalendarDays : Settings2,
                  ),
                )}
              </div>
            </details>
          );
        })}
        <div className="border-t pt-2">
          {item("/kesiapan", "Status pengembangan", CircleHelp)}
        </div>
      </nav>
    );
  }
  return (
    <div className="min-h-svh lg:flex">
      <aside
        aria-label="Sidebar desktop"
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 flex-col border-r bg-card lg:flex",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <div className="flex h-20 shrink-0 items-center justify-center border-b px-4">
          {collapsed ? (
            <Link
              href={session ? "/akun" : "/"}
              aria-label="SiM-Guru, halaman utama"
            >
              <BookOpen aria-hidden="true" className="size-7 text-primary" />
            </Link>
          ) : (
            <Link href={session ? "/akun" : "/"}>
              <Brand />
            </Link>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {nav(collapsed)}
        </div>
        <div className="border-t p-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={toggle}
            aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight aria-hidden="true" />
            ) : (
              <>
                <ChevronLeft aria-hidden="true" />
                Ciutkan menu
              </>
            )}
          </Button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b bg-card/95 px-4 py-4 backdrop-blur-sm sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              ref={mobileTrigger}
              variant="outline"
              className="lg:hidden"
              aria-label="Buka navigasi"
              aria-haspopup="dialog"
              aria-controls="mobile-navigation"
              onClick={() => drawer.current?.showModal()}
            >
              <Menu aria-hidden="true" />
            </Button>
            <div>
              <p className="text-sm font-semibold">
                {session
                  ? session.user.role === "admin"
                    ? "Ruang administrator"
                    : "Ruang guru"
                  : "SiM-Guru"}
              </p>
              <p className="max-w-56 truncate text-xs text-muted-foreground">
                {session?.user.fullName ?? "Status pengembangan aplikasi"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border bg-muted px-3 py-1 text-xs sm:inline">
              Tahap 1.6
            </span>
            {onLogout ? (
              <Button variant="outline" onClick={onLogout}>
                <LogOut aria-hidden="true" />
                Keluar
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/login">Masuk</Link>
              </Button>
            )}
          </div>
        </header>
        <main
          id="konten-utama"
          tabIndex={-1}
          className="mx-auto max-w-6xl px-4 py-8 outline-none sm:px-8 sm:py-10"
        >
          {children}
        </main>
        <footer className="border-t px-5 py-6 text-xs leading-6 text-muted-foreground sm:px-8">
          SiM-Guru · Sistem Informasi Guru · Modul dikembangkan secara bertahap.
        </footer>
      </div>
      <dialog
        id="mobile-navigation"
        ref={drawer}
        aria-labelledby="mobile-navigation-title"
        className="fixed inset-y-0 left-0 m-0 h-svh max-h-none w-[min(20rem,calc(100%-2rem))] max-w-none border-r bg-card p-0 text-foreground shadow-xl backdrop:bg-black/45"
        onClose={() => mobileTrigger.current?.focus()}
      >
        <div className="flex min-h-20 items-center justify-between gap-2 border-b px-5">
          <h2 id="mobile-navigation-title" className="font-bold">
            Navigasi SiM-Guru
          </h2>
          <Button
            variant="outline"
            aria-label="Tutup navigasi"
            onClick={closeDrawer}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <div className="max-h-[calc(100svh-5rem)] overflow-y-auto p-4">
          {nav()}
        </div>
      </dialog>
    </div>
  );
}
