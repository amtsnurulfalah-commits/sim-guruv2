"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type TabItem = {
  value: string;
  label: string;
  icon: ReactNode;
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
        className={cn(
          "grid gap-2 rounded-2xl border bg-muted/60 p-2",
          items.length === 3
            ? "grid-cols-1 md:grid-cols-3"
            : "grid-cols-2 lg:grid-cols-4",
        )}
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
              "inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-center text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-4 [&_svg]:shrink-0",
              selected === item.value
                ? "border-primary/25 bg-card text-primary shadow-xs"
                : "border-transparent text-muted-foreground hover:bg-card/70 hover:text-foreground",
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
