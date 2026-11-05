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
      className="form-feedback-error min-w-0 [overflow-wrap:anywhere] sm:col-span-2"
    >
      <p className="flex items-start gap-2 whitespace-pre-line break-words font-semibold">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        {fields.length ? "Periksa isian formulir" : message}
      </p>
      {fields.length > 0 && <p className="mt-2 whitespace-pre-line">{message}</p>}
      {fields.length > 0 && (
        <ul className="mt-2 list-inside list-disc space-y-1">
          {fields.map((field) => (
            <li key={field.id}>
              <a
                className="inline-block rounded py-2.5 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                href={"#" + field.id}
                onClick={(event) => {
                  const control = document.getElementById(field.id);
                  if (control) {
                    event.preventDefault();
                    control.focus();
                  }
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
