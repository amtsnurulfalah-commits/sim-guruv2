import { pageSession } from "@/server/auth/page-session";
import { AuthenticatedWorkspace } from "@/components/shell/authenticated-workspace";
import { ServiceState } from "@/components/feedback/service-state";
import { ActivityWorkspace } from "@/features/activities/workspace";
export const dynamic = "force-dynamic";
export default async function Page() {
  const result = await pageSession("/admin/jadwal-kehadiran", { admin: true });
  if (result.state !== "ready") return <ServiceState />;
  return (
    <AuthenticatedWorkspace>
      <ActivityWorkspace
        admin={result.session.role === "admin"}
        userId={result.session.user_id}
        mode="attendance"
      />
    </AuthenticatedWorkspace>
  );
}
