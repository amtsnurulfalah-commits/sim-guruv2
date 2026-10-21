import { LoaderCircle } from "lucide-react";

export function NavigationLoading({ title }: { title: string }) {
  return (
    <section aria-busy="true" className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle
            aria-hidden="true"
            className="size-4 shrink-0 motion-safe:animate-spin"
          />
          Memuat halaman {title}…
        </p>
      </div>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="h-36 rounded-2xl border bg-card motion-safe:animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}
