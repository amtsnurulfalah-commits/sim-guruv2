import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AppModule } from "@/lib/navigation/modules";
export function ModuleCards({
  items,
  linked = true,
  describeAccess = false,
}: {
  items: readonly AppModule[];
  linked?: boolean;
  describeAccess?: boolean;
}) {
  return (
    <div
      className={
        describeAccess
          ? "grid gap-4 @min-[34rem]:grid-cols-2 @min-[60rem]:grid-cols-3"
          : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      }
    >
      {items.map((module) => (
        <article
          key={module.slug}
          className="group flex min-w-0 flex-col rounded-2xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md"
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge>{module.available ? "Tersedia" : "Belum tersedia"}</Badge>
          </div>
          <h3 className="font-semibold">{module.title}</h3>
          {describeAccess && (
            <p className="mt-2 text-xs font-semibold text-primary">
              {module.adminOnly
                ? "Khusus administrator"
                : module.slug === "laporan-pimpinan"
                  ? "Administrator atau pemegang izin laporan"
                  : "Sesuai peran dan penugasan akun"}
            </p>
          )}
          <p className="mt-2 flex-1 text-sm leading-7 text-muted-foreground">
            {module.description}
          </p>
          {linked && (
            <Link
              prefetch={false}
              href={module.href ?? "/modul/" + module.slug}
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {module.available ? "Buka modul" : "Lihat status modul"}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          )}
        </article>
      ))}
    </div>
  );
}
