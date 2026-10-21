"use client";
import { CircleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
export function ErrorFeedback({
  message,
  autoFocus = false,
  className,
}: {
  message: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message && autoFocus) summary.current?.focus();
  }, [message, autoFocus]);
  if (!message) return null;
  return (
    <div
      ref={summary}
      tabIndex={-1}
      role="alert"
      className={cn(
        "form-feedback-error min-w-0 space-y-2 break-words",
        className,
      )}
    >
      <p className="flex items-start gap-2 font-semibold">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        Permintaan belum dapat diselesaikan
      </p>
      <p className="whitespace-pre-line text-sm leading-6">{message}</p>
    </div>
  );
}
