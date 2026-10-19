import Link from "next/link";
import { cookieNames } from "@/server/auth/security";
import { getAuthService } from "@/server/auth/runtime";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { requireEnvironment } from "@/server/env";
import { AdminRecovery } from "@/features/auth/admin-recovery";
export const dynamic = "force-dynamic";
export const metadata = { title: "Verifikasi pemulihan akun" };
export default async function Page() {
  const app = new URL(requireEnvironment("core").APP_URL);
  if ((await headers()).get("host") !== app.host)
    redirect(new URL("/admin/pemulihan", app).toString());
  const token = (await cookies()).get(
    cookieNames(process.env.NODE_ENV === "production").session,
  )?.value;
  if (!token) redirect("/login");
  const session = await (await getAuthService()).session(token);
  if (!session) redirect("/login?status=expired");
  if (session.scope !== "business" || session.role !== "admin")
    redirect("/akun");
  return (
    <main id="konten-utama" className="mx-auto max-w-2xl space-y-7 px-5 py-12">
      <Brand />
      <h1 className="text-3xl font-bold">Verifikasi pemulihan akun</h1>
      <AdminRecovery />
      <Link href="/akun" className="block underline">
        Kembali ke akun
      </Link>
      <Link href="/login" className="block underline">
        Ke halaman masuk
      </Link>
    </main>
  );
}
