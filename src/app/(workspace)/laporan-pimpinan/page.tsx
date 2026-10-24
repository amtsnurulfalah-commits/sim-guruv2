import { pageSession } from "@/server/auth/page-session";
import { ServiceState } from "@/components/feedback/service-state";
import { ReportsWorkspace } from "@/features/reports/workspace";
export const dynamic = "force-dynamic";
export default async function Page() {
  const r = await pageSession("/laporan-pimpinan");
  if (r.state !== "ready") return <ServiceState embedded />;
  return <ReportsWorkspace />;
}
