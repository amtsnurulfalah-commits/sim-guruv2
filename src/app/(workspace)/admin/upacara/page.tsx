import { pageSession } from "@/server/auth/page-session";
import { ServiceState } from "@/components/feedback/service-state";
import { DutyManager } from "@/features/duties/duty-manager";
export const dynamic = "force-dynamic";
export default async function Page() {
  const result = await pageSession("/admin/upacara", { admin: true });
  if (result.state !== "ready") return <ServiceState embedded />;
  return (
    <>
      <DutyManager
        admin={result.session.role === "admin"}
        userId={result.session.user_id}
        initialKind="UPACARA"
      />
    </>
  );
}
