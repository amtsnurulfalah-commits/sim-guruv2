import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Badge({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="badge" className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", className)} {...props} />;
}
