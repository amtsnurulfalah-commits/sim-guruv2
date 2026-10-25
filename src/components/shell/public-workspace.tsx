"use client";

import { createContext, useContext, type ReactNode } from "react";
import { Workspace } from "./workspace";
import { SessionBoundary } from "@/features/auth/session-boundary";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { Button } from "@/components/ui/button";
import type { SessionDto } from "@/types/auth";

const PublicSession = createContext<SessionDto | null>(null);
export const usePublicWorkspaceSession = () => useContext(PublicSession);

/** Public content uses the canonical session lifecycle without requiring login. */
export function PublicWorkspace({
  children,
  unavailableMessage,
  pendingFallback,
}: {
  children: ReactNode;
  unavailableMessage: string;
  pendingFallback?: ReactNode;
}) {
  return (
    <SessionBoundary
      pendingPublicFallback={pendingFallback}
      publicFallback={(message, retry) => {
        const feedback = message && (
          <div className="mb-6 space-y-3">
            <ErrorFeedback
              message={`Status akun belum dapat diperiksa. ${unavailableMessage}\n${message}`}
            />
            <Button variant="outline" onClick={retry}>
              Periksa kembali sesi
            </Button>
          </div>
        );
        // A failed initial check is unknown, not proof of an anonymous session.
        if (message && pendingFallback)
          return (
            <>
              <div className="mx-auto max-w-2xl px-4 pt-6">{feedback}</div>
              {pendingFallback}
            </>
          );
        return (
          <PublicSession.Provider value={null}>
            <Workspace>
              {feedback}
              {children}
            </Workspace>
          </PublicSession.Provider>
        );
      }}
    >
      {(session, logout) => (
        <PublicSession.Provider value={session}>
          <Workspace session={session} onLogout={logout}>
            {children}
          </Workspace>
        </PublicSession.Provider>
      )}
    </SessionBoundary>
  );
}
