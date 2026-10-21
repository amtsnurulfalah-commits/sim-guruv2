import type { ReactNode } from "react";
import { AuthenticatedWorkspace } from "@/components/shell/authenticated-workspace";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedWorkspace>{children}</AuthenticatedWorkspace>;
}
