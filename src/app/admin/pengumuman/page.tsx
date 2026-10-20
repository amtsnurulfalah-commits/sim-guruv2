import { pageSession } from "@/server/auth/page-session";
import { AuthenticatedWorkspace } from "@/components/shell/authenticated-workspace";
import { ServiceState } from "@/components/feedback/service-state";
import { AnnouncementManager } from "@/features/operations/managers";
export const dynamic = "force-dynamic";
export const metadata = { title: "Pengumuman" };
export default async function Page() {
  const result = await pageSession("/admin/pengumuman", { admin: true });
  if (result.state !== "ready") return <ServiceState />;
  return (
    <AuthenticatedWorkspace>
      <AnnouncementManager />
    </AuthenticatedWorkspace>
  );
}
