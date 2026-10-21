import { pageSession } from "@/server/auth/page-session";
import { ServiceState } from "@/components/feedback/service-state";
import { MasterManager } from "@/features/masters/master-manager";
export const dynamic = "force-dynamic";
export const metadata = { title: "Master sekolah dan akademik" };
export default async function Page() {
  const result = await pageSession("/admin/master", { admin: true });
  if (result.state !== "ready") return <ServiceState embedded />;
  return (
    <>
      <MasterManager />
    </>
  );
}
