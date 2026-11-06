import type { ReactNode } from "react";
import { ChevronDown, CircleHelp } from "lucide-react";

/** Secondary explanation stays available without competing with primary actions. */
export function HelpDisclosure({ children, label = "Panduan singkat" }: { children: ReactNode; label?: string }) {
  return <details className="ui-help group/help min-w-0 text-sm print:break-inside-avoid">
    <summary className="ui-action ui-action-solid cursor-pointer list-none px-3 [&::-webkit-details-marker]:hidden">
      <CircleHelp className="size-4 shrink-0" aria-hidden="true" />{label}<ChevronDown className="size-4 shrink-0 transition-transform group-open/help:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
    </summary>
    <div className="mt-1 max-w-3xl rounded-xl border bg-muted/30 p-4 leading-6 text-muted-foreground [overflow-wrap:anywhere]">{children}</div>
  </details>;
}
