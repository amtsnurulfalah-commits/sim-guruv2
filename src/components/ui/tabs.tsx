"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type TabItem = {
  value: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
};

/** Mounted panels retain drafts; hidden panels are excluded from keyboard navigation. */
export function Tabs({
  items,
  defaultValue,
  label,
  value,
  onValueChange,
}: {
  items: readonly TabItem[];
  defaultValue: string;
  label: string;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  const id = useId();
  const [localSelected, setLocalSelected] = useState(defaultValue);
  const selected = value ?? localSelected;
  function setSelected(next: string) {
    if (value === undefined) setLocalSelected(next);
    onValueChange?.(next);
  }
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="horizontal"
        className="flex min-w-0 flex-wrap gap-1 rounded-xl border bg-muted/60 p-1"
      >
        {items.map((item, index) => (
          <button
            key={item.value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${item.value}`}
            aria-controls={`${id}-panel-${item.value}`}
            aria-selected={selected === item.value}
            tabIndex={selected === item.value ? 0 : -1}
            className={cn(
              "ui-action inline-flex min-h-11 min-w-0 max-w-full flex-1 basis-28 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-center text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-4 [&_svg]:shrink-0",
              selected === item.value
                ? "border-primary/25 bg-card text-primary shadow-xs"
                : "ui-action-solid border-transparent",
            )}
            onClick={() => setSelected(item.value)}
            onKeyDown={(event) => {
              let next: number;
              if (event.key === "ArrowRight") next = (index + 1) % items.length;
              else if (event.key === "ArrowLeft")
                next = (index - 1 + items.length) % items.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = items.length - 1;
              else return;
              event.preventDefault();
              setSelected(items[next]!.value);
              buttons.current[next]?.focus();
            }}
          >
            {item.icon}
            <span className="min-w-0 break-words">{item.label}</span>
          </button>
        ))}
      </div>
      {items.map((item) => (
        <div
          key={item.value}
          role="tabpanel"
          id={`${id}-panel-${item.value}`}
          aria-labelledby={`${id}-tab-${item.value}`}
          hidden={selected !== item.value}
          tabIndex={0}
          className="space-y-6 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
