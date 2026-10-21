"use client";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { Inbox, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
export function EmptyState({
  title,
  description = "Sesuaikan pencarian, tanggal, atau filter untuk memeriksa data lainnya.",
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-5 py-9 text-center">
      <span className="mb-3 rounded-full bg-muted p-3">
        <Inbox className="size-5 text-muted-foreground" aria-hidden="true" />
      </span>
      <p className="font-semibold">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
export function FeatureState({
  error,
  label,
  retry,
  headingLevel = 1,
}: {
  error: string;
  label: string;
  retry: () => void;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  if (error)
    return (
      <section className="ui-panel space-y-4">
        <Heading className="text-xl">Data belum dapat dimuat</Heading>
        <ErrorFeedback message={error} />
        <Button variant="outline" onClick={retry}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Coba kembali
        </Button>
      </section>
    );
  return (
    <section aria-busy="true" aria-label={label} className="space-y-5">
      <p
        role="status"
        aria-busy="true"
        className="text-sm text-muted-foreground"
      >
        {label}
      </p>
      <div className="h-9 w-2/3 rounded-lg bg-muted motion-safe:animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((n) => (
          <div
            key={n}
            className="h-40 rounded-2xl border bg-card motion-safe:animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}
