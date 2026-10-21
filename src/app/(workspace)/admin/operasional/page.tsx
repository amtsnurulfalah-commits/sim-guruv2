import { pageSession } from "@/server/auth/page-session";
import { ServiceState } from "@/components/feedback/service-state";
import { OperationsManager } from "@/features/operations/managers";
export const dynamic = "force-dynamic";
export const metadata = { title: "Pengaturan operasional" };
export default async function Page() {
  const result = await pageSession("/admin/operasional", { admin: true });
  if (result.state !== "ready") return <ServiceState embedded />;
  return (
    <>
      <OperationsManager />
    </>
  );
}
