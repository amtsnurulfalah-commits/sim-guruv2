"use client";
import { useEffect, useId, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
/** Keeps the value in the input and supports password managers, paste and keyboard use. */
export function PasswordInput({
  className,
  id,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  const generated = useId();
  const inputId = id ?? generated;
  useEffect(() => {
    const resetVisibility = (event:Event) => {
      const input = document.getElementById(inputId);
      if (input instanceof HTMLInputElement && input.form === event.target) setVisible(false);
    };
    document.addEventListener("reset", resetVisibility, true);
    return () => document.removeEventListener("reset", resetVisibility, true);
  }, [inputId]);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative min-w-0">
      <input
        {...props}
        id={inputId}
        type={visible ? "text" : "password"}
        className={cn("ui-control pr-14", className)}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex min-h-11 w-12 items-center justify-center rounded-r-lg text-muted-foreground hover:bg-accent hover:text-primary disabled:pointer-events-none"
        disabled={props.disabled}
        aria-label={
          visible ? "Sembunyikan isian rahasia" : "Tampilkan isian rahasia"
        }
        aria-pressed={visible}
        aria-controls={inputId}
        onClick={() => setVisible((value) => !value)}
      >
        <Icon className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
