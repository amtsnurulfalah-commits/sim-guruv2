"use client";
import type { Ref } from "react";
import { CircleAlert } from "lucide-react";
export function FormFeedback({
  message,
  fields,
  ref,
}: {
  message: string;
  fields: { id: string; label: string; message: string }[];
  ref?: Ref<HTMLDivElement>;
}) {
  if (!message) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="form-feedback-error sm:col-span-2"
    >
      <p className="flex items-start gap-2 whitespace-pre-line break-words font-semibold">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        {message}
      </p>
      {fields.length > 0 && (
        <ul className="mt-2 list-inside list-disc space-y-1">
          {fields.map((field) => (
            <li key={field.id}>
              <a
                className="inline-flex min-h-11 items-center underline underline-offset-4"
                href={"#" + field.id}
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById(field.id)?.focus();
                }}
              >
                {field.label}: {field.message}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
