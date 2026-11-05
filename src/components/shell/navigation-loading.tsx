import { LoadingMessage } from "@/components/feedback/loading-message";

export function NavigationLoading({ title }: { title: string }) {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">{title}</h1>
        <LoadingMessage key={title} label={`Memuat halaman ${title}…`} />
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
