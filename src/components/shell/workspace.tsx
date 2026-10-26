"use client";
import { WorkspacePreferences, PreferenceControls, useWorkspacePreferences } from "@/features/preferences/workspace-preferences";
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
import { ConnectivityStatus } from "@/components/feedback/connectivity-status";
import { Breadcrumbs } from "./breadcrumbs";
import { NavigationLoading } from "./navigation-loading";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { modulesFor, navigationGroups } from "@/lib/navigation/modules";
import { cn } from "@/lib/utils";
import { capabilitiesSchema } from "@/lib/reports/contracts";
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
  "persiapan-semester": CalendarDays,
  master: Database,
  kalender: CalendarDays,
  pengumuman: Megaphone,
  "laporan-kendala": Search,
  operasional: Settings2,
  migrasi: ArrowLeftRight,
  "laporan-pimpinan": ClipboardList,
};
type WorkspaceProps = { children: ReactNode; session?: SessionDto; onLogout?: () => void };
export function Workspace(props: WorkspaceProps) {
  const scope = props.session ? props.session.user.id + ":" + props.session.user.role : null;
  return <WorkspacePreferences key={scope ?? "public"} scope={scope}><WorkspaceContent {...props}/></WorkspacePreferences>;
}
function WorkspaceContent({ children, session, onLogout }: WorkspaceProps) {
  const preferences = useWorkspacePreferences();
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
    if (drawer.current?.open) closeDrawer("content");
    if (href === pathname && !navigating) return;
    setDestination({ href, label });
    startNavigation(() => router.push(href));
  }
  const pathname = usePathname(),
    [collapsed, setCollapsed] = useState(false),
    [query, setQuery] = useState(""),
    drawer = useRef<HTMLDialogElement>(null),
    mobileTrigger = useRef<HTMLButtonElement>(null),
    drawerFocus = useRef<"trigger" | "content">("trigger"),
    backdropPress = useRef(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches && drawer.current?.open) {
        drawerFocus.current = "content";
        drawer.current.close();
      }
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
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
  // Native close events also cover Escape and breakpoint changes.
  function closeDrawer(focus: "trigger" | "content" = "trigger") {
    drawerFocus.current = focus;
    drawer.current?.close();
  }
  useEffect(() => {
    if (drawer.current?.open) {
      drawerFocus.current = "content";
      drawer.current.close();
    }
  }, [pathname]);
  const role = session?.user.role,
    ready = session?.scope === "business";
  const [reportReader, setReportReader] = useState<{
    key: string;
    allowed: boolean;
    unavailable: boolean;
  } | null>(null);
  const [reportRetry, setReportRetry] = useState(0);
  const userId = session?.user.id;
  const capabilityKey =
    ready && userId && role !== "admin"
      ? `${userId}:${pathname}:${reportRetry}`
      : null;
  useEffect(() => {
    if (!capabilityKey) return;
    const c = new AbortController();
    const publish = (allowed: boolean, unavailable = false) => {
      if (!c.signal.aborted)
        setReportReader({ key: capabilityKey, allowed, unavailable });
    };
    fetch("/api/reports/read?kind=capabilities", {
      cache: "no-store",
      signal: c.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((r) => {
        const result =
          r?.ok === true ? capabilitiesSchema.safeParse(r.data) : null;
        if (result?.success)
          publish(result.data.academic || result.data.finance);
        else publish(false, true);
      })
      .catch(() => publish(false, true));
    return () => c.abort();
  }, [capabilityKey]);
  const reportAllowed =
    reportReader?.key === capabilityKey && reportReader?.allowed === true;
  const links = role && ready ? modulesFor(role, reportAllowed) : [];
  const matches = (label: string) =>
    label
      .toLocaleLowerCase("id-ID")
      .includes(query.trim().toLocaleLowerCase("id-ID"));
  const filteredLinks = links.filter((module) =>
    matches(module.title + " " + module.group),
  );
  const primaryLinks = session
    ? [
        ...(ready
          ? [
              { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
              { href: "/tugas", label: "Pusat tugas", icon: ClipboardCheck },
              { href: "/notifikasi", label: "Notifikasi", icon: Megaphone },
            ]
          : []),
        { href: "/akun", label: "Akun dan profil", icon: UserRound },
        ...(role === "admin" && ready
          ? [
              {
                href: "/admin/pemulihan",
                label: "Pemulihan akun",
                icon: ShieldCheck,
              },
            ]
          : []),
      ]
    : [
        { href: "/", label: "Beranda", icon: LayoutDashboard },
        { href: "/login", label: "Masuk ke akun", icon: UserRound },
      ];
  const searchCount =
    filteredLinks.length +
    primaryLinks.filter((link) => matches(link.label)).length +
    Number(matches("Panduan aplikasi"));
  const activeHref = [
    "/dashboard",
    "/tugas",
    "/notifikasi",
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
            "ui-nav-item group flex min-h-11 min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring [overflow-wrap:anywhere]",
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
              maxLength={100}
              autoComplete="off"
            />
          </label>
        )}
        {query.trim() && (
          <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
            {searchCount} menu sesuai pencarian.{" "}
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
        {!compact && capabilityKey && reportReader?.key !== capabilityKey && (
          <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
            Memeriksa menu laporan…
          </p>
        )}
        {capabilityKey &&
          reportReader?.key === capabilityKey &&
          reportReader.unavailable && (
            <div
              className={cn(
                "space-y-2 rounded-xl border bg-card p-2",
                compact && "p-0",
              )}
            >
              {!compact && (
                <p className="px-1 text-xs leading-6 text-muted-foreground">
                  Menu laporan belum dapat diperiksa.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                aria-label="Periksa izin laporan"
                title={compact ? "Periksa izin laporan" : undefined}
                onClick={() => setReportRetry((value) => value + 1)}
              >
                <ActionIcon action="refresh" />
                <span className={compact ? "sr-only" : ""}>
                  Periksa izin laporan
                </span>
              </Button>
            </div>
          )}
        {primaryLinks.map((link) => item(link.href, link.label, link.icon))}
        {navigationGroups.map((group) => {
          const list = filteredLinks.filter((m) => m.group === group);
          if (!list.length) return null;
          return compact ? (
            <div
              key={group}
              role="group"
              aria-label={group}
              className="border-t pt-2"
            >
              {list.map((m) =>
                item(
                  m.href ?? "/modul/" + m.slug,
                  m.title,
                  moduleIcons[m.slug] ?? BookOpen,
                ),
              )}
            </div>
          ) : (
            <details
              key={query.trim() ? `${group}:search:${query.trim()}` : group}
              open
              className="group/nav-section border-t pt-2"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase [overflow-wrap:anywhere]">
                {group}
                <ChevronDown
                  className="size-4 shrink-0 -rotate-90 transition-transform group-open/nav-section:rotate-0"
                  aria-hidden="true"
                />
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
    <div className="min-h-svh lg:flex" data-table-density={preferences.values.density}>
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
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg"
            >
              <BookOpen aria-hidden="true" className="size-7 text-primary" />
            </Link>
          ) : (
            <Link
              prefetch={false}
              href={ready ? "/dashboard" : session ? "/akun" : "/"}
              className="inline-flex min-h-11 max-w-full items-center rounded-lg"
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
      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        <header className="ui-topbar sticky top-0 z-20 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur-md sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              ref={mobileTrigger}
              variant="outline"
              className="min-w-11 shrink-0 lg:hidden"
              aria-label="Buka navigasi"
              aria-haspopup="dialog"
              aria-controls="mobile-navigation"
              aria-expanded={drawerOpen}
              onClick={() => {
                if (drawer.current && !drawer.current.open) {
                  drawerFocus.current = "trigger";
                  drawer.current.showModal();
                  setDrawerOpen(true);
                }
              }}
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
              <p
                title={session?.user.fullName}
                className="max-w-40 line-clamp-2 text-xs text-muted-foreground sm:max-w-56 [overflow-wrap:anywhere]"
              >
                {session?.user.fullName ?? "Panduan penggunaan SiM-Guru"}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
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
          className="workspace-content mx-auto w-full min-w-0 max-w-[1440px] flex-1 px-4 py-5 outline-none sm:px-8 sm:py-7 xl:px-10"
        >
          <ConnectivityStatus />
          <Breadcrumbs
            pathname={navigating && destination ? destination.href : pathname}
            role={role}
            ready={ready}
            reportAccess={reportAllowed}
          />
          {ready && session && <>
            <PreferenceControls links={links}/>
            {links.some(link => preferences.values.pins.includes(link.slug)) && <nav aria-label="Pintasan pilihan" className="mb-5 flex min-w-0 flex-wrap gap-2">{links.filter(link => preferences.values.pins.includes(link.slug)).map(link => <Button key={link.slug} asChild variant="outline"><Link prefetch={false} href={link.href ?? "/modul/" + link.slug} onNavigate={event => navigate(event, link.href ?? "/modul/" + link.slug, link.title)}>{link.title}</Link></Button>)}</nav>}
          </>}
          {navigating && destination && (
            <div data-slot="navigation-pending">
              <NavigationLoading title={destination.label} />
            </div>
          )}
          <div hidden={navigating}>{children}</div>
        </main>
        <footer className="mt-auto flex min-w-0 flex-wrap justify-between gap-x-6 gap-y-1 border-t px-5 py-5 text-xs leading-6 text-muted-foreground sm:px-8 [overflow-wrap:anywhere]">
          <p>
            <span className="font-semibold text-foreground">SiM-Guru</span> ·
            Sistem Informasi Guru
          </p>
          <p>Ruang kerja madrasah.</p>
        </footer>
      </div>
      <dialog
        id="mobile-navigation"
        ref={drawer}
        aria-labelledby="mobile-navigation-title"
        className="fixed top-0 left-0 m-0 h-dvh max-h-dvh w-[min(22rem,100%)] max-w-none border-r bg-card p-0 text-foreground shadow-xl backdrop:bg-black/45 open:flex open:flex-col"
        onClose={() => {
          setDrawerOpen(false);
          backdropPress.current = false;
          if (
            drawerFocus.current === "content" ||
            window.matchMedia("(min-width: 1024px)").matches
          )
            document
              .getElementById("konten-utama")
              ?.focus({ preventScroll: true });
          else mobileTrigger.current?.focus({ preventScroll: true });
        }}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          backdropPress.current =
            event.target === event.currentTarget &&
            (event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom);
        }}
        onPointerCancel={() => {
          backdropPress.current = false;
        }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            backdropPress.current &&
            event.target === event.currentTarget &&
            (event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom)
          )
            closeDrawer();
          backdropPress.current = false;
        }}
      >
        <div className="flex min-h-20 shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
          <h2
            id="mobile-navigation-title"
            className="min-w-0 font-bold [overflow-wrap:anywhere]"
          >
            Navigasi SiM-Guru
          </h2>
          <Button
            variant="outline"
            aria-label="Tutup navigasi"
            className="min-w-11 shrink-0"
            onClick={() => closeDrawer()}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {nav()}
        </div>
      </dialog>
    </div>
  );
}
