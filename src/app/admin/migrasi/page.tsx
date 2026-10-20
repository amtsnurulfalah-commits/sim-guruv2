import { pageSession } from "@/server/auth/page-session";
import { AuthenticatedWorkspace } from "@/components/shell/authenticated-workspace";
import { ServiceState } from "@/components/feedback/service-state";
import { MigrationManager } from "@/features/migration/manager";
export const dynamic = "force-dynamic";
export const metadata = { title: "Migrasi dan kesiapan peluncuran" };
export default async function Page() {
  const result = await pageSession("/admin/migrasi", { admin: true });
  if (result.state !== "ready") return <ServiceState />;
  return (
    <AuthenticatedWorkspace>
      <MigrationManager />
    </AuthenticatedWorkspace>
  );
}
