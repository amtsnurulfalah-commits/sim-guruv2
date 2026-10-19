"use client";
import type { ReactNode } from "react";
import { Workspace } from "./workspace";
import { SessionBoundary } from "@/features/auth/session-boundary";
export function AuthenticatedWorkspace({
  children,
  business = true,
}: {
  children: ReactNode;
  business?: boolean;
}) {
  return (
    <SessionBoundary business={business}>
      {(session, logout) => (
        <Workspace session={session} onLogout={logout}>
          {children}
        </Workspace>
      )}
    </SessionBoundary>
  );
}
