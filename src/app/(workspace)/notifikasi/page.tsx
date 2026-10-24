import { pageSession } from "@/server/auth/page-session";
import { ServiceState } from "@/components/feedback/service-state";
import { NotificationInbox } from "@/features/tasks/notification-inbox";
export const dynamic = "force-dynamic";
export default async function Page() {
 const result = await pageSession("/notifikasi");
 if (result.state !== "ready") return <ServiceState embedded/>;
 return <><NotificationInbox/></>;
}
