import { pageSession } from "@/server/auth/page-session";
import { SessionPanel } from "@/features/auth/session-panel";
import { ServiceState } from "@/components/feedback/service-state";
export const dynamic = "force-dynamic";
export const metadata = { title: "Akun dan profil" };
export default async function AccountPage() {
  const result = await pageSession("/akun", { business: false });
  if (result.state !== "ready") return <ServiceState embedded />;
  return <SessionPanel />;
}
