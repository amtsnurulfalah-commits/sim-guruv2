import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { requireEnvironment } from "@/server/env";
import { ActivationForm } from "@/features/auth/recovery-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Aktivasi akun" };
export default async function Page() {
  const app = new URL(requireEnvironment("core").APP_URL);
  if ((await headers()).get("host") !== app.host)
    redirect(new URL("/aktivasi", app).toString());
  return (
    <main id="konten-utama" className="mx-auto max-w-2xl space-y-7 px-5 py-12">
      <Brand />
      <h1 className="text-3xl font-bold">Aktivasi akun</h1>
      <ActivationForm />
      <Link href="/akun" className="block underline">
        Kembali ke akun
      </Link>
      <Link href="/login" className="block underline">
        Ke halaman masuk
      </Link>
    </main>
  );
}
