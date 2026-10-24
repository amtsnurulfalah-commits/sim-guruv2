import { Badge } from "./badge";
import { cn } from "@/lib/utils";
const tones = {
  neutral: "border-border bg-muted text-foreground",
  success:
    "border-[var(--success-border)] bg-[var(--success-surface)] text-[var(--success)]",
  warning:
    "border-[var(--warning-border)] bg-[var(--warning-surface)] text-[var(--warning)]",
  error:
    "border-[var(--error-border)] bg-[var(--error-surface)] text-destructive",
};
/** A visible label is mandatory: never communicate status through color alone. */
export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "max-w-full whitespace-normal [overflow-wrap:anywhere]",
        tones[tone],
        className,
      )}
    >
      {label}
    </Badge>
  );
}
