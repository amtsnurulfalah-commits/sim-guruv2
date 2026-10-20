import { pageSession } from "@/server/auth/page-session";
import { AuthenticatedWorkspace } from "@/components/shell/authenticated-workspace";
import { ServiceState } from "@/components/feedback/service-state";
import { DutyManager } from "@/features/duties/duty-manager";
export const dynamic = "force-dynamic";
export default async function Page() {
  const result = await pageSession("/piket", { admin: false });
  if (result.state !== "ready") return <ServiceState />;
  return (
    <AuthenticatedWorkspace>
      <DutyManager
        admin={result.session.role === "admin"}
        userId={result.session.user_id}
        initialKind="PIKET"
      />
    </AuthenticatedWorkspace>
  );
}
