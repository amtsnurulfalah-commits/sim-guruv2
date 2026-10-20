import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { moduleBySlug, canViewModule } from "@/lib/navigation/modules";
import { pageSession } from "@/server/auth/page-session";
import { AuthenticatedWorkspace } from "@/components/shell/authenticated-workspace";
import { ServiceState } from "@/components/feedback/service-state";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export const metadata = { title: "Status modul" };
export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    entry = moduleBySlug(slug);
  if (!entry) notFound();
  const result = await pageSession("/modul/" + slug);
  if (result.state !== "ready")
    return (
      <ServiceState
        {...(result.state === "maintenance"
          ? {
              title: "Aplikasi sedang dalam pemeliharaan",
              message: "Operasi kegiatan sementara tidak tersedia.",
            }
          : {})}
      />
    );
  if (!canViewModule(result.session.role, entry)) redirect("/dashboard");
  if (entry.href) redirect(entry.href);
  return (
    <AuthenticatedWorkspace>
      <div className="max-w-2xl space-y-6">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          {entry.group}
        </p>
        <h1 className="text-3xl font-bold">{entry.title}</h1>
        <section className="space-y-4 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Modul belum tersedia</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            {entry.description}
          </p>
          <p className="text-sm leading-7">
            Pencatatan, rekap, dan ekspor pada modul ini belum dapat digunakan.
            Hubungi administrator jika modul ini diperlukan untuk pekerjaan
            Anda.
          </p>
          <p className="text-sm leading-7 text-muted-foreground">
            Tidak ada perubahan data yang dilakukan dari halaman status ini.
          </p>
        </section>
        <Button asChild variant="outline">
          <Link href="/dashboard">Kembali ke dashboard</Link>
        </Button>
      </div>
    </AuthenticatedWorkspace>
  );
}
