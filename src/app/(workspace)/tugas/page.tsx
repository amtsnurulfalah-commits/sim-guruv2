import { pageSession } from "@/server/auth/page-session";
import { ServiceState } from "@/components/feedback/service-state";
import { TaskCenter } from "@/features/tasks/task-center";
export const dynamic = "force-dynamic";
export default async function Page() {
 const result = await pageSession("/tugas");
 if (result.state !== "ready") return <ServiceState embedded/>;
 return <><h1 className="mb-6">Pusat tugas</h1><TaskCenter/></>;
}
