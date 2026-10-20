import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login-form";
import { AuthLayout } from "@/components/shell/auth-layout";
import { requireEnvironment } from "@/server/env";
export const metadata: Metadata = { title: "Masuk SiM-Guru" };
export const dynamic = "force-dynamic";
export default async function LoginPage() {
  const app = new URL(requireEnvironment("core").APP_URL);
  if ((await headers()).get("host") !== app.host)
    redirect(new URL("/login", app).toString());
  return (
    <AuthLayout
      title="Masuk ke SiM-Guru"
      description="Gunakan username dan kata sandi akun madrasah Anda."
    >
      <LoginForm />
    </AuthLayout>
  );
}
