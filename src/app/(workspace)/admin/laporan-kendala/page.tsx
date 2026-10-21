import { pageSession } from "@/server/auth/page-session";
import { ServiceState } from "@/components/feedback/service-state";
import { SupportReports } from "@/features/operations/support-reports";
export const dynamic = "force-dynamic";
export const metadata = { title: "Laporan Kendala" };
export default async function Page() {
  const result = await pageSession("/admin/laporan-kendala", { admin: true });
  if (result.state !== "ready") return <ServiceState embedded />;
  return <SupportReports />;
}
