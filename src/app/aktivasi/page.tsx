import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/shell/auth-layout";
import { requireEnvironment } from "@/server/env";
import { ActivationForm } from "@/features/auth/recovery-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Aktivasi akun" };
export default async function Page() {
  const app = new URL(requireEnvironment("core").APP_URL);
  if ((await headers()).get("host") !== app.host)
    redirect(new URL("/aktivasi", app).toString());
  return (
    <AuthLayout
      title="Aktivasi akun"
      description="Aktifkan akun menggunakan informasi yang diberikan administrator."
    >
      <ActivationForm />
      <Link
        prefetch={false}
        href="/login"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4"
      >
        Kembali ke halaman masuk
      </Link>
    </AuthLayout>
  );
}
