import { pageSession } from "@/server/auth/page-session";
import { dashboardDto } from "@/server/dashboard/query";
import { DashboardView } from "@/features/dashboard/dashboard-view";
import { ServiceState } from "@/components/feedback/service-state";
export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };
export default async function DashboardPage() {
  const result = await pageSession("/dashboard");
  if (result.state !== "ready")
    return (
      <ServiceState
        embedded
        {...(result.state === "maintenance"
          ? {
              title: "Aplikasi sedang dalam pemeliharaan",
              message:
                "Operasi kegiatan sementara tidak tersedia. Pengamanan akun tetap dapat diakses.",
            }
          : {})}
      />
    );
  return (
    <>
      <DashboardView data={dashboardDto(result.session)} />
    </>
  );
}
