import { pageSession } from "@/server/auth/page-session";
import { ServiceState } from "@/components/feedback/service-state";
import { SemesterPreparationWorkspace } from "@/features/semester-preparation/workspace";
export const metadata={title:"Persiapan semester"};
export const dynamic = "force-dynamic";
export default async function Page() {
  const r = await pageSession("/admin/persiapan-semester", { admin: true });
  if (r.state !== "ready") return <ServiceState embedded />;
  return <SemesterPreparationWorkspace />;
}
