import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
export function MetricCard({
  title,
  value,
  icon: Icon,
  children,
}: {
  title: string;
  value: ReactNode;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <article className="ui-panel flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
        <span className="rounded-lg bg-accent p-2 text-primary">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      </div>
      <p className="ui-metric-value">{value}</p>
      <div className="mt-auto space-y-3 text-sm leading-6">{children}</div>
    </article>
  );
}
