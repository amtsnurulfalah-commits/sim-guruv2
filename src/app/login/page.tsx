import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login-form";
import { Brand } from "@/components/brand";
import { requireEnvironment } from "@/server/env";
export const metadata: Metadata = { title: "Masuk SiM-Guru" };
export const dynamic = "force-dynamic";
export default async function LoginPage() {
    const app = new URL(requireEnvironment("core").APP_URL);
    if ((await headers()).get("host") !== app.host)
        redirect(new URL("/login", app).toString());
    return <main id="konten-utama" className="mx-auto max-w-md px-5 py-12 sm:py-20"><Brand /><section className="mt-8 rounded-2xl border bg-card p-6 shadow-sm"><h1 className="text-2xl font-bold">Masuk ke SiM-Guru</h1><p className="mt-2 mb-7 text-sm leading-7 text-muted-foreground">Gunakan username dan kata sandi akun madrasah Anda.</p><LoginForm /></section></main>;
}
