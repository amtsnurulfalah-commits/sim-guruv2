import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AppModule } from "@/lib/navigation/modules";
export function ModuleCards({
  items,
  linked = true,
}: {
  items: readonly AppModule[];
  linked?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((module) => (
        <article
          key={module.slug}
          className="flex flex-col rounded-2xl border bg-card p-5"
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge>{module.available ? "Tersedia" : "Belum tersedia"}</Badge>
            <span className="text-xs text-muted-foreground">
              Tahap {module.stage}
            </span>
          </div>
          <h3 className="font-semibold">{module.title}</h3>
          <p className="mt-2 flex-1 text-sm leading-7 text-muted-foreground">
            {module.description}
          </p>
          {linked && (
            <Link
              href={module.href ?? "/modul/" + module.slug}
              className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
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
