"use client";
import { ActionIcon } from "./action-icon";
import { Button } from "./button";
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  disabled = false,
  label = "Halaman daftar",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav
      aria-label={label}
      className="flex min-w-0 flex-wrap items-center justify-between gap-3"
    >
      <Button
        type="button"
        variant="outline"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ActionIcon action="previous" />
        Sebelumnya
      </Button>
      <div
        role="status"
        aria-live="polite"
        className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]"
      >
        Halaman {page} dari {last} · {total} data
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || page >= last}
        onClick={() => onPageChange(page + 1)}
      >
        <ActionIcon action="next" />
        Berikutnya
      </Button>
    </nav>
  );
}
