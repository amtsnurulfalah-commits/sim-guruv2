import { pageSession } from "@/server/auth/page-session";
import { ServiceState } from "@/components/feedback/service-state";
import { FinanceManager } from "@/features/finance/finance-manager";
export const dynamic = "force-dynamic";
export default async function Page() {
  const r = await pageSession("/admin/honorarium/operasi", { admin: true });
  if (r.state !== "ready") return <ServiceState embedded />;
  return (
    <>
      <FinanceManager admin={r.session.role === "admin"} view="operations" />
    </>
  );
}
