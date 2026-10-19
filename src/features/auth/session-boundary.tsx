"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  ServiceState,
  PageSkeleton,
} from "@/components/feedback/service-state";
import type { ApiResult } from "@/types/api";
import type { SessionDto } from "@/types/auth";
export function SessionBoundary({
  children,
  business = false,
}: {
  children: (session: SessionDto, requestLogout: () => void) => ReactNode;
  business?: boolean;
}) {
  const [logoutRequested, setLogoutRequested] = useState(false);
  const [resolved, setResolved] = useState(false);
  const identity = useRef<string | null>(null);
  const [session, setSession] = useState<SessionDto | null>(null),
    [message, setMessage] = useState("Memeriksa sesi…"),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null),
    channel = useRef<BroadcastChannel | null>(null),
    lastActivity = useRef(0);
  useEffect(() => {
    let active = true,
      inFlight = false;
    async function check() {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await fetch("/api/auth/session", {
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
          }),
          data: ApiResult<SessionDto> = await res.json();
        if (!active) return;
        if (res.status === 401) {
          setSession(null);
          setLogoutRequested(false);
          window.location.replace("/login?status=expired");
          return;
        }
        if (!data.ok) throw new Error();
        if (business && data.data.scope !== "business") {
          setSession(null);
          setLogoutRequested(false);
          window.location.replace("/akun");
          return;
        }
        const nextIdentity = data.data.user.id + ":" + data.data.user.role;
        if (identity.current !== null && identity.current !== nextIdentity) {
          setSession(null);
          setLogoutRequested(false);
          window.location.reload();
          return;
        }
        identity.current = nextIdentity;
        setSession(data.data);
        setMessage("");
      } catch {
        if (active) {
          setSession(null);
          setLogoutRequested(false);
          setMessage("Sesi belum dapat diperiksa. Coba kembali.");
        }
      } finally {
        if (active) setResolved(true);
        inFlight = false;
      }
    }
    async function activity() {
      if (
        Date.now() - lastActivity.current < 60000 ||
        document.visibilityState !== "visible"
      )
        return;
      lastActivity.current = Date.now();
      try {
        const r = await fetch("/api/auth/csrf?intent=session", {
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
          }),
          csrf: ApiResult<{
            csrfToken: string;
          }> = await r.json();
        if (!csrf.ok) {
          void check();
          return;
        }
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "X-CSRF-Token": csrf.data.csrfToken },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) void check();
      } catch {
        /* check berkala menyembunyikan UI bila layanan tidak tersedia. */
      }
    }
    void check();
    const timer = window.setInterval(() => void check(), 30000);
    const focus = () => void check();
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    if ("BroadcastChannel" in window) {
      channel.current = new BroadcastChannel("sim-guru-auth");
      channel.current.onmessage = (event) => {
        if (event.data === "logout") {
          setSession(null);
          setLogoutRequested(false);
          window.location.replace("/login?status=logout");
        }
      };
    }
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      channel.current?.close();
      channel.current = null;
    };
  }, [revision, business]);
  useEffect(() => {
    if (logoutRequested) dialog.current?.showModal();
  }, [logoutRequested]);
  function requestLogout() {
    setLogoutRequested(true);
  }
  async function logout() {
    setBusy(true);
    try {
      const r = await fetch("/api/auth/csrf?intent=session", {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (r.status === 401) {
        setSession(null);
        setLogoutRequested(false);
        window.location.replace("/login?status=expired");
        return;
      }
      const csrf: ApiResult<{
        csrfToken: string;
      }> = await r.json();
      if (!csrf.ok) throw new Error(csrf.error.message);
      const res = await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "X-CSRF-Token": csrf.data.csrfToken },
          signal: AbortSignal.timeout(15000),
        }),
        data: ApiResult<{
          loggedOut: boolean;
        }> = await res.json();
      if (!data.ok) throw new Error(data.error.message);
      setSession(null);
      setLogoutRequested(false);
      channel.current?.postMessage("logout");
      window.location.replace("/login?status=logout");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Belum dapat keluar. Coba kembali.",
      );
      dialog.current?.close();
    } finally {
      setBusy(false);
    }
  }
  if (!session && !resolved) return <PageSkeleton />;
  if (!session)
    return (
      <ServiceState
        title="Pemeriksaan sesi"
        message={message || "Memeriksa akses akun…"}
        retry={() => {
          setResolved(false);
          setRevision((v) => v + 1);
        }}
      />
    );
  if (business && session.maintenance && session.user.role !== "admin")
    return (
      <ServiceState
        title="Aplikasi sedang dalam pemeliharaan"
        message="Operasi kegiatan sementara tidak tersedia. Pengamanan akun tetap dapat diakses."
        retry={() => {
          setResolved(false);
          setRevision((v) => v + 1);
        }}
      />
    );
  return (
    <>
      <SessionExpiry session={session} />
      {message && <p role="status">{message}</p>}
      {children(session, requestLogout)}
      <dialog
        ref={dialog}
        onClose={() => setLogoutRequested(false)}
        aria-labelledby="logout-title"
        aria-describedby="logout-description"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border bg-card p-6 text-card-foreground shadow-xl backdrop:bg-black/45"
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <h2 id="logout-title" className="text-lg font-semibold">
          Keluar dari SiM-Guru?
        </h2>
        <p
          id="logout-description"
          className="mt-3 text-sm leading-7 text-muted-foreground"
        >
          Sesi pada browser ini akan diakhiri. Anda dapat masuk kembali
          menggunakan akun Anda.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            Batal
          </Button>
          <Button disabled={busy} onClick={() => void logout()}>
            {busy ? "Mengakhiri sesi…" : "Ya, keluar"}
          </Button>
        </div>
      </dialog>
    </>
  );
}

function SessionExpiry({ session }: { session: SessionDto }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  const remaining =
    Math.min(
      new Date(session.expiresAt).getTime(),
      new Date(session.idleExpiresAt).getTime(),
    ) - now;
  useEffect(() => {
    if (remaining <= 0) window.location.replace("/login?status=expired");
  }, [remaining]);
  return remaining <= 60000 ? (
    <p
      role="status"
      className="sticky top-0 z-30 border-b bg-accent px-5 py-3 text-sm"
    >
      Sesi segera berakhir. Simpan pekerjaan dan masuk kembali bila diperlukan.
    </p>
  ) : null;
}
