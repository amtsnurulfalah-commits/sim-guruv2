"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowLeftRight } from "lucide-react";
/** A named, keyboard-scrollable viewport without changing table semantics or data. */
export function TableRegion({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const hint = useId();
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setOverflow(node.scrollWidth > node.clientWidth + 1),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    const table = node.querySelector("table");
    if (table) observer.observe(table);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <section className="min-w-0 space-y-2">
      {overflow && (
        <p
          id={hint}
          className="flex items-center gap-2 text-xs text-muted-foreground print:hidden"
        >
          <ArrowLeftRight className="size-4 shrink-0" aria-hidden="true" />
          Geser tabel atau gunakan tombol panah untuk melihat kolom lainnya.
        </p>
      )}
      <div
        ref={viewport}
        role="region"
        aria-label={label}
        aria-describedby={overflow ? hint : undefined}
        tabIndex={overflow ? 0 : undefined}
        className="ui-table-region overflow-x-auto"
      >
        {children}
      </div>
    </section>
  );
}
