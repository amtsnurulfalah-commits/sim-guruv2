"use client";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { Inbox, RotateCcw, SearchX } from "lucide-react";
import { LoadingMessage } from "./loading-message";
import { Button } from "@/components/ui/button";
export function EmptyState({
  title,
  description = "Data akan muncul di sini setelah tersedia.",
  resetSearch,
}: {
  title: string;
  description?: string;
  resetSearch?: (() => void) | undefined;
}) {
  const Icon = resetSearch ? SearchX : Inbox;
  return (
    <div className="flex min-w-0 flex-col items-center rounded-2xl border border-dashed bg-muted/30 px-4 py-7 text-center sm:px-6">
      <span className="mb-3 rounded-full bg-muted p-3">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      </span>
      <p className="font-semibold">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {resetSearch && <Button type="button" variant="outline" className="mt-4" onClick={resetSearch}>Hapus pencarian dan filter</Button>}
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
        <ErrorFeedback message={error} title="Periksa detail gangguan" />
        <Button variant="outline" onClick={retry}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Coba kembali
        </Button>
      </section>
    );
  return (
    <section aria-label={label} className="space-y-5">
      <LoadingMessage key={label} label={label} />
      <div aria-hidden="true" className="space-y-4">
        <div className="h-9 w-2/3 rounded-lg bg-muted motion-safe:animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((n) => (
            <div
              key={n}
              className="h-40 rounded-2xl border bg-card motion-safe:animate-pulse"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
