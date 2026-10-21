import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/shell/auth-layout";
import { requireEnvironment } from "@/server/env";
import { RecoveryForm } from "@/features/auth/recovery-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Pemulihan akun" };
export default async function Page() {
  const app = new URL(requireEnvironment("core").APP_URL);
  if ((await headers()).get("host") !== app.host)
    redirect(new URL("/lupa-password", app).toString());
  return (
    <AuthLayout
      title="Pemulihan akun"
      description="Ikuti langkah verifikasi untuk memulihkan akses akun Anda."
    >
      <RecoveryForm />
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
