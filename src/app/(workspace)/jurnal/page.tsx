import { pageSession } from "@/server/auth/page-session";
import { ServiceState } from "@/components/feedback/service-state";
import { ActivityWorkspace } from "@/features/activities/workspace";
export const dynamic = "force-dynamic";
export default async function Page() {
  const result = await pageSession("/jurnal", { admin: false });
  if (result.state !== "ready") return <ServiceState embedded />;
  return (
    <>
      <ActivityWorkspace
        admin={result.session.role === "admin"}
        userId={result.session.user_id}
        mode="journals"
      />
    </>
  );
}
