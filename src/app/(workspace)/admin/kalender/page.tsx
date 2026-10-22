import { pageSession } from "@/server/auth/page-session";
import { ServiceState } from "@/components/feedback/service-state";
import { CalendarManager } from "@/features/calendar/calendar-manager";
export const dynamic = "force-dynamic";
export const metadata = { title: "Kalender Akademik" };
export default async function Page() {
  const result = await pageSession("/admin/kalender", { admin: true });
  if (result.state !== "ready") return <ServiceState embedded />;
  return (
    <>
      <CalendarManager />
    </>
  );
}
