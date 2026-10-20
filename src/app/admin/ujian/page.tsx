import { pageSession } from "@/server/auth/page-session";
import { AuthenticatedWorkspace } from "@/components/shell/authenticated-workspace";
import { ServiceState } from "@/components/feedback/service-state";
import { ExamManager } from "@/features/programs/exam-manager";
export const dynamic = "force-dynamic";
export default async function Page() {
  const r = await pageSession("/admin/ujian", { admin: true });
  if (r.state !== "ready") return <ServiceState />;
  return (
    <AuthenticatedWorkspace>
      <ExamManager
        admin={r.session.role === "admin"}
        userId={r.session.user_id}
      />
    </AuthenticatedWorkspace>
  );
}
