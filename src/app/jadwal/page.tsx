import { pageSession } from "@/server/auth/page-session";
import { AuthenticatedWorkspace } from "@/components/shell/authenticated-workspace";
import { ServiceState } from "@/components/feedback/service-state";
import { ScheduleManager } from "@/features/schedules/schedule-manager";
export const dynamic = "force-dynamic";
export const metadata = { title: "Jadwal KBM" };
export default async function Page() {
  const result = await pageSession("/jadwal");
  if (result.state !== "ready") return <ServiceState />;
  return (
    <AuthenticatedWorkspace>
      <ScheduleManager admin={result.session.role === "admin"} />
    </AuthenticatedWorkspace>
  );
}
