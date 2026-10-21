"use client";
import { ActionIcon } from "@/components/ui/action-icon";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Wallet,
  Users,
  Database,
  Megaphone,
  ArrowLeftRight,
  NotebookPen,
  GraduationCap,
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
  Search,
  LoaderCircle,
} from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";
import { NavigationLoading } from "./navigation-loading";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { modulesFor } from "@/lib/navigation/modules";
import { cn } from "@/lib/utils";
import type { SessionDto } from "@/types/auth";
const moduleIcons: Record<string, typeof LayoutDashboard> = {
  jadwal: CalendarDays,
  jurnal: NotebookPen,
  kegiatan: ClipboardCheck,
  "absensi-siswa": Users,
  piket: ClipboardList,
  ujian: GraduationCap,
  kehadiran: ClipboardCheck,
  acara: CalendarDays,
  honorarium: Wallet,
  pengguna: Users,
  master: Database,
  kalender: CalendarDays,
  pengumuman: Megaphone,
  "laporan-kendala": Search,
  operasional: Settings2,
  migrasi: ArrowLeftRight,
};
export function Workspace({
  children,
  session,
  onLogout,
}: {
  children: ReactNode;
  session?: SessionDto;
  onLogout?: () => void;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [destination, setDestination] = useState<{
    href: string;
    label: string;
  } | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  function navigate(
    event: { preventDefault: () => void },
    href: string,
    label: string,
  ) {
    event.preventDefault();
    if (drawer.current?.open) closeDrawer();
    if (href === pathname && !navigating) return;
    setDestination({ href, label });
    startNavigation(() => router.push(href));
  }
  const pathname = usePathname(),
    [collapsed, setCollapsed] = useState(false),
    [query, setQuery] = useState(""),
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
    setQuery("");
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
  const matches = (label: string) =>
    label
      .toLocaleLowerCase("id-ID")
      .includes(query.trim().toLocaleLowerCase("id-ID"));
  const filteredLinks = links.filter((module) =>
    matches(module.title + " " + module.group),
  );
  const activeHref = [
    "/dashboard",
    "/akun",
    "/admin/pemulihan",
    "/kesiapan",
    ...links.map((m) => m.href ?? "/modul/" + m.slug),
  ]
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];
  function nav(compact = false) {
    const item = (href: string, label: string, Icon: typeof LayoutDashboard) =>
      !matches(label) &&
      !filteredLinks.some((module) => module.title === label) ? null : (
        <Link
          prefetch={intent === href ? "auto" : false}
          key={href}
          href={href}
          onMouseEnter={() => setIntent(href)}
          onFocus={() => setIntent(href)}
          onTouchStart={() => setIntent(href)}
          onNavigate={(event) => navigate(event, href, label)}
          aria-busy={navigating && destination?.href === href}
          aria-current={
            pathname === href || activeHref === href ? "page" : undefined
          }
          title={compact ? label : undefined}
          className={cn(
            "ui-nav-item group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
            pathname === href || activeHref === href
              ? "bg-accent font-semibold text-accent-foreground ring-1 ring-primary/15"
              : "text-muted-foreground",
            compact && "justify-center",
          )}
        >
          {navigating && destination?.href === href ? (
            <LoaderCircle
              className="size-5 shrink-0 motion-safe:animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Icon className="size-5 shrink-0" aria-hidden="true" />
          )}
          <span className={compact ? "sr-only" : ""}>{label}</span>
        </Link>
      );
    return (
      <nav aria-label="Navigasi utama" className="space-y-2">
        {!compact && (
          <label className="relative mb-4 block">
            <span className="sr-only">Cari menu</span>
            <Search
              className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="ui-control pl-9"
              placeholder="Cari menu…"
            />
          </label>
        )}
        {query.trim() && (
          <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
            {filteredLinks.length} modul sesuai pencarian.{" "}
            <button
              type="button"
              className="ui-action ui-action-secondary mt-1"
              onClick={() => setQuery("")}
            >
              <ActionIcon action="close" />
              Hapus pencarian
            </button>
          </p>
        )}
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
          const list = filteredLinks.filter((m) => m.group === group);
          if (!list.length) return null;
          return compact ? (
            <div key={group} className="border-t pt-2">
              {list.map((m) =>
                item(
                  m.href ?? "/modul/" + m.slug,
                  m.title,
                  moduleIcons[m.slug] ?? BookOpen,
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
                    m.href ?? "/modul/" + m.slug,
                    m.title,
                    moduleIcons[m.slug] ?? Settings2,
                  ),
                )}
              </div>
            </details>
          );
        })}
        <div className="border-t pt-2">
          {item("/kesiapan", "Panduan aplikasi", CircleHelp)}
        </div>
      </nav>
    );
  }
  return (
    <div className="min-h-svh lg:flex">
      <aside
        aria-label="Sidebar desktop"
        className={cn(
          "ui-sidebar sticky top-0 hidden h-svh shrink-0 flex-col border-r lg:flex",
          collapsed ? "w-20" : "w-72",
        )}
      >
        <div className="flex h-20 shrink-0 items-center justify-center border-b px-4">
          {collapsed ? (
            <Link
              prefetch={false}
              href={ready ? "/dashboard" : session ? "/akun" : "/"}
              aria-label="SiM-Guru, halaman utama"
            >
              <BookOpen aria-hidden="true" className="size-7 text-primary" />
            </Link>
          ) : (
            <Link
              prefetch={false}
              href={ready ? "/dashboard" : session ? "/akun" : "/"}
            >
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
        <header className="ui-topbar sticky top-0 z-20 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur-md sm:px-8">
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
            <div className="min-w-0 [overflow-wrap:anywhere]">
              <p className="text-sm font-semibold">
                {session
                  ? session.user.role === "admin"
                    ? "Ruang administrator"
                    : "Ruang guru"
                  : "SiM-Guru"}
              </p>
              <p className="max-w-40 truncate sm:max-w-56 text-xs text-muted-foreground">
                {session?.user.fullName ?? "Panduan penggunaan SiM-Guru"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border bg-muted px-3 py-1 text-xs sm:inline">
              {role === "admin"
                ? "Administrator"
                : role === "guru"
                  ? "Guru"
                  : "SiM-Guru"}
            </span>
            {onLogout ? (
              <Button variant="outline" onClick={onLogout}>
                <LogOut aria-hidden="true" />
                Keluar
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link prefetch={false} href="/login">
                  <ActionIcon action="access" />
                  Masuk
                </Link>
              </Button>
            )}
          </div>
        </header>
        <main
          id="konten-utama"
          tabIndex={-1}
          className="workspace-content mx-auto w-full max-w-[1440px] px-4 py-5 outline-none sm:px-8 sm:py-7 xl:px-10"
        >
          <Breadcrumbs
            pathname={navigating && destination ? destination.href : pathname}
            role={role}
            ready={ready}
          />
          {navigating && destination && (
            <div data-slot="navigation-pending">
              <NavigationLoading title={destination.label} />
            </div>
          )}
          <div hidden={navigating}>{children}</div>
        </main>
        <footer className="border-t px-5 py-6 text-xs leading-6 text-muted-foreground sm:px-8">
          SiM-Guru · Sistem Informasi Guru · Ruang kerja madrasah.
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
