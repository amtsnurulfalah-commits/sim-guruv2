"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { Workspace } from "./workspace";
import { SessionBoundary } from "@/features/auth/session-boundary";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { Button } from "@/components/ui/button";
import { ActionIcon } from "@/components/ui/action-icon";
import type { SessionDto } from "@/types/auth";

const GuideSession = createContext<SessionDto | null>(null);

export function GuideAccessLink() {
  const session = useContext(GuideSession);
  return (
    <Button asChild variant="outline">
      <Link
        prefetch={false}
        href={
          session
            ? session.scope === "business"
              ? "/dashboard"
              : "/akun"
            : "/login"
        }
      >
        <ActionIcon action={session ? "open" : "access"} />
        {session
          ? session.scope === "business"
            ? "Kembali ke Dashboard"
            : "Buka akun dan profil"
          : "Masuk ke SiM-Guru"}
      </Link>
    </Button>
  );
}

/** Public help with the same verified-session lifecycle as protected workspaces. */
export function GuideWorkspace({ children }: { children: ReactNode }) {
  return (
    <>
      <noscript>
        <p className="ui-panel mx-4 my-6 text-sm leading-7">
          Halaman ini memerlukan JavaScript. Aktifkan JavaScript lalu muat
          ulang, atau{" "}
          <Link href="/" prefetch={false} className="ui-text-link underline">
            kembali ke beranda
          </Link>
          .
        </p>
      </noscript>
      <SessionBoundary
        publicFallback={(message, retry) => (
          <Workspace>
            {message && (
              <div className="mb-6 space-y-3">
                <ErrorFeedback
                  message={`Status akun belum dapat diperiksa. Panduan tetap dapat dibaca.\n${message}`}
                />
                <Button variant="outline" onClick={retry}>
                  Periksa kembali sesi
                </Button>
              </div>
            )}
            {children}
          </Workspace>
        )}
      >
        {(session, logout) => (
          <GuideSession.Provider value={session}>
            <Workspace session={session} onLogout={logout}>
              {children}
            </Workspace>
          </GuideSession.Provider>
        )}
      </SessionBoundary>
    </>
  );
}
