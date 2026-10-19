import { pageSession } from "@/server/auth/page-session";
import { AuthenticatedWorkspace } from "@/components/shell/authenticated-workspace";
import { ServiceState } from "@/components/feedback/service-state";
import { AdminRecovery } from "@/features/auth/admin-recovery";
export const dynamic = "force-dynamic";
export const metadata = { title: "Verifikasi pemulihan akun" };
export default async function Page() {
  const result = await pageSession("/admin/pemulihan", { admin: true });
  if (result.state !== "ready") return <ServiceState />;
  return (
    <AuthenticatedWorkspace>
      <h1 className="mb-7 text-3xl font-bold">Verifikasi pemulihan akun</h1>
      <AdminRecovery />
    </AuthenticatedWorkspace>
  );
}
