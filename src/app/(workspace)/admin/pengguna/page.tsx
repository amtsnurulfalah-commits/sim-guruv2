import { pageSession } from "@/server/auth/page-session";
import { ServiceState } from "@/components/feedback/service-state";
import { UserManager } from "@/features/users/user-manager";
export const dynamic = "force-dynamic";
export const metadata = { title: "Manajemen pengguna" };
export default async function UsersPage() {
  const result = await pageSession("/admin/pengguna", { admin: true });
  if (result.state !== "ready") return <ServiceState embedded />;
  return (
    <>
      <UserManager />
    </>
  );
}
