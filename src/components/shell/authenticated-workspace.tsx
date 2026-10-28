"use client";
import { InstallRequired } from "@/features/pwa/install-required";
import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Workspace } from "./workspace";
import { SessionBoundary } from "@/features/auth/session-boundary";
import type { SessionDto } from "@/types/auth";

const WorkspaceSession = createContext<SessionDto | null>(null);
export function useWorkspaceSession() {
  const session = useContext(WorkspaceSession);
  if (!session) throw new Error("WORKSPACE_SESSION_REQUIRED");
  return session;
}

export function AuthenticatedWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const business = !["/akun", "/profil", "/onboarding"].includes(pathname);
  return (
    <SessionBoundary business={business}>
      {(session, logout) => (
        <WorkspaceSession.Provider value={session}>
          <Workspace session={session} onLogout={logout}>
            <InstallRequired required={business && session.scope === "business" && session.user.role !== "admin"}>{children}</InstallRequired>
          </Workspace>
        </WorkspaceSession.Provider>
      )}
    </SessionBoundary>
  );
}
