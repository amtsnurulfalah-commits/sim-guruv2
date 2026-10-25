import { pageSession } from "@/server/auth/page-session";
import { ServiceState } from "@/components/feedback/service-state";
import { TaskWorkspace } from "@/features/tasks/task-workspace";
import { wibDate } from "@/lib/calendar/schemas";
export const dynamic = "force-dynamic";
export const metadata = { title: "Pusat tugas" };
export default async function Page() {
  const result = await pageSession("/tugas");
  if (result.state !== "ready") return <ServiceState embedded {...(result.state === "maintenance" ? {
    title: "Aplikasi sedang dalam pemeliharaan",
    message: "Daftar tugas sementara tidak tersedia. Pengamanan akun tetap dapat diakses.",
  } : {})}/>;
  return <TaskWorkspace initialDate={wibDate()} accountId={result.session.user_id}/>;
}
