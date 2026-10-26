"use client";
import { resetBrowserPreferences } from "@/lib/preferences/storage";
import { claimDraftAccount, resetBrowserDrafts } from "@/lib/drafts/storage";
import { ActionIcon } from "@/components/ui/action-icon";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  ServiceState,
  PageSkeleton,
} from "@/components/feedback/service-state";
import { ApiRequestError, requestJson } from "@/lib/feedback/api-error";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import type { SessionDto } from "@/types/auth";
function resetPrivateBrowserState() {
  resetBrowserDrafts();
  resetBrowserPreferences();
}
export function SessionBoundary({
  children,
  business = false,
  publicFallback,
  pendingPublicFallback,
}: {
  children: (session: SessionDto, requestLogout: () => void) => ReactNode;
  business?: boolean;
  publicFallback?: (message: string, retry: () => void) => ReactNode;
  pendingPublicFallback?: ReactNode;
}) {
  const isPublic = publicFallback !== undefined;
  const [logoutRequested, setLogoutRequested] = useState(false);
  const [logoutError, setLogoutError] = useState("");
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
        const data = await requestJson<SessionDto>("/api/auth/session", {
          signal: AbortSignal.timeout(15000),
        });
        if (!active) return;
        if (business && data.scope !== "business") {
          setSession(null);
          setLogoutRequested(false);
          window.location.replace("/akun");
          return;
        }
        const nextIdentity = data.user.id + ":" + data.user.role;
        if (identity.current !== null && identity.current !== nextIdentity) {
          resetPrivateBrowserState();
          setSession(null);
          setLogoutRequested(false);
          window.location.reload();
          return;
        }
        try {
          claimDraftAccount(sessionStorage, data.user.id);
        } catch {
          /* Form reports storage failures. */
        }
        identity.current = nextIdentity;
        setSession(data);
        setMessage("");
      } catch (error) {
        if (
          active &&
          error instanceof ApiRequestError &&
          error.status === 401
        ) {
          setSession(null);
          setLogoutRequested(false);
          if (isPublic) {
            if (identity.current !== null) resetPrivateBrowserState();
            else resetBrowserPreferences();
            identity.current = null;
            setMessage("");
            return;
          }
          resetPrivateBrowserState();
          window.location.replace("/login?status=expired");
          return;
        }
        if (active) {
          if (!isPublic) setSession(null);
          setLogoutRequested(false);
          setMessage(
            error instanceof Error
              ? error.message
              : "Sesi belum dapat diperiksa. Coba kembali.",
          );
        }
      } finally {
        if (active) setResolved(true);
        inFlight = false;
      }
    }
    async function activity() {
      if (
        (isPublic && identity.current === null) ||
        Date.now() - lastActivity.current < 60000 ||
        document.visibilityState !== "visible"
      )
        return;
      lastActivity.current = Date.now();
      try {
        const csrf = await requestJson<{ csrfToken: string }>(
          "/api/auth/csrf?intent=session",
          { signal: AbortSignal.timeout(15000) },
        );
        await requestJson("/api/auth/session", {
          method: "POST",
          headers: { "X-CSRF-Token": csrf.csrfToken },
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        void check();
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
          resetPrivateBrowserState();
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
  }, [revision, business, isPublic]);
  useEffect(() => {
    if (logoutRequested) dialog.current?.showModal();
  }, [logoutRequested]);
  function requestLogout() {
    setLogoutError("");
    setLogoutRequested(true);
  }
  async function logout() {
    setBusy(true);
    setLogoutError("");
    try {
      const csrf = await requestJson<{ csrfToken: string }>(
        "/api/auth/csrf?intent=session",
        { signal: AbortSignal.timeout(15000) },
      );
      await requestJson<{ loggedOut: boolean }>("/api/auth/logout", {
        method: "POST",
        headers: { "X-CSRF-Token": csrf.csrfToken },
        signal: AbortSignal.timeout(15000),
      });
      resetPrivateBrowserState();
      setSession(null);
      setLogoutRequested(false);
      channel.current?.postMessage("logout");
      window.location.replace("/login?status=logout");
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setSession(null);
        setLogoutRequested(false);
        resetPrivateBrowserState();
        window.location.replace("/login?status=expired");
        return;
      }
      setLogoutError(
        error instanceof Error
          ? error.message
          : "Belum dapat keluar. Coba kembali.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!session && !resolved)
    return isPublic && pendingPublicFallback ? (
      pendingPublicFallback
    ) : (
      <PageSkeleton />
    );
  if (!session && publicFallback)
    return publicFallback(message, () => {
      setResolved(false);
      setRevision((v) => v + 1);
    });
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
      {message &&
        (isPublic ? (
          <ErrorFeedback message={message} />
        ) : (
          <p role="status">{message}</p>
        ))}
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
          menggunakan akun Anda. Draft lokal jurnal dan BAP di tab ini akan
          dihapus.
        </p>
        <ErrorFeedback message={logoutError} autoFocus className="mt-4" />
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            <ActionIcon action="close" />
            Batal
          </Button>
          <Button disabled={busy} onClick={() => void logout()}>
            <ActionIcon action="logout" />
            {busy ? "Mengakhiri sesi…" : "Keluar dari akun"}
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
    if (remaining <= 0) {
      resetPrivateBrowserState();
      window.location.replace("/login?status=expired");
    }
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
