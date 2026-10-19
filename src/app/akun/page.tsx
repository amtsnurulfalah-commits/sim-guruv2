import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SessionPanel } from "@/features/auth/session-panel";
import { Brand } from "@/components/brand";
import { getAuthService } from "@/server/auth/runtime";
import { cookieNames } from "@/server/auth/security";
import { requireEnvironment } from "@/server/env";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
    const app = new URL(requireEnvironment("core").APP_URL);
    if ((await headers()).get("host") !== app.host)
        redirect(new URL("/akun", app).toString());
    const token = (await cookies()).get(cookieNames(process.env.NODE_ENV === "production").session)?.value;
    if (!token)
        redirect("/login");
    let available = true, valid = false;
    try {
        valid = Boolean(await (await getAuthService()).session(token));
    }
    catch {
        available = false;
    }
    if (available && !valid)
        redirect("/login?status=expired");
    return <main id="konten-utama" className="mx-auto max-w-2xl px-5 py-12"><Brand /><h1 className="mt-8 text-3xl font-bold">Akun SiM-Guru</h1><section className="mt-6 rounded-2xl border bg-card p-6">{available ? <SessionPanel /> : <p role="alert">Layanan akun belum dapat dihubungi. Silakan muat ulang halaman atau hubungi administrator.</p>}</section></main>;
}
