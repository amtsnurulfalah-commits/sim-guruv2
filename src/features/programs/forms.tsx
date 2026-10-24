"use client";
import { DraftStatus, useFormDraft, type FormDraftConfig } from "@/features/drafts/form-draft";
import { serverFieldErrors } from "@/lib/feedback/api-error";
import { ActionIcon } from "@/components/ui/action-icon";

import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { notifySuccess } from "@/components/feedback/toast-region";
export {
  control as input,
  primaryAction as button,
  secondaryAction as secondary,
  surface as panel,
} from "@/components/ui/styles";
import {
  control as input,
  primaryAction as button,
  secondaryAction as secondary,
  surface as panel,
} from "@/components/ui/styles";
import { FormFeedback } from "@/components/ui/form-feedback";
import { FormDialog } from "@/components/ui/dialog";
export type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "date"
    | "time"
    | "number"
    | "textarea"
    | "select"
    | "multi"
    | "dates"
    | "days";
  options?: { id: string; name: string }[];
  optional?: boolean;
  value?: string | number | string[] | number[] | undefined;
  min?: number;
  max?: number;
};
export function DataForm({
  fields,
  label,
  submitLabel = label,
  onSave,
  busy,
  inline = false,
  openOnMount = false,
  onDismiss,
  description,
  locked = false,
  onVisibilityChange,
  successMessage = "Permintaan berhasil diproses.",
  draftConfig,
}: {
  draftConfig?: FormDraftConfig;
  locked?: boolean;
  onVisibilityChange?: (open: boolean) => void;
  successMessage?: string | false;
  inline?: boolean;
  openOnMount?: boolean;
  onDismiss?: () => void;
  description?: string;
  fields: Field[];
  label: string;
  submitLabel?: string;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) {
  const [error, setError] = useState(""),
    [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}),
    [open, setOpen] = useState(openOnMount),
    [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const feedback = useRef<HTMLDivElement>(null);
  const focusFeedback = () =>
    requestAnimationFrame(() => feedback.current?.focus());
  const prefix = useId();
  const { formRef: attachDraftForm, ...draft } = useFormDraft(prefix + "-form", draftConfig ?? null, inline || open);
  const form = (
    <form
      ref={attachDraftForm}
      id={prefix + "-form"}
      className="ui-form"
      aria-busy={saving || busy}
      onInvalid={(event) => {
        event.preventDefault();
        const control: EventTarget = event.target;
        if (
          !(
            control instanceof HTMLInputElement ||
            control instanceof HTMLSelectElement ||
            control instanceof HTMLTextAreaElement
          )
        )
          return;
        const field = fields.find((field) => field.key === control.name);
        if (!field) return;
        const message = control.validity.valueMissing
          ? field.label + " wajib diisi."
          : "Periksa nilai " + field.label.toLowerCase() + ".";
        setFieldErrors((previous) => ({ ...previous, [field.key]: message }));
        setError("Periksa isian yang ditandai sebelum menyimpan.");
        focusFeedback();
      }}
      onChangeCapture={(event) => {
        const control: EventTarget = event.target;
        if (
          !(
            control instanceof HTMLInputElement ||
            control instanceof HTMLSelectElement ||
            control instanceof HTMLTextAreaElement
          )
        )
          return;
        const key = control.name;
        if (!fieldErrors[key]) return;
        setFieldErrors((previous) => {
          const next = { ...previous };
          delete next[key];
          return next;
        });
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending.current || busy || locked) return;
        const f = new FormData(e.currentTarget);
        const data: Record<string, unknown> = {};
        for (const x of fields) {
          const v = String(f.get(x.key) ?? "").trim();
          data[x.key] =
            x.type === "multi"
              ? f.getAll(x.key)
              : x.type === "days"
                ? f.getAll(x.key).map(Number)
                : x.type === "dates"
                  ? v.split(/[\s,]+/).filter(Boolean)
                  : x.type === "number"
                    ? Number(v)
                    : x.optional && !v
                      ? null
                      : v;
        }
        setError("");
        setFieldErrors({});
        let draftTicket: number | undefined;
        try {
          z.record(z.string(), z.unknown())
            .superRefine((value, ctx) => {
              for (const field of fields) {
                const v = value[field.key];
                if (
                  !field.optional &&
                  (v === "" ||
                    v === null ||
                    v === undefined ||
                    (Array.isArray(v) && v.length === 0))
                )
                  ctx.addIssue({
                    code: "custom",
                    path: [field.key],
                    message: field.label + " wajib diisi.",
                  });
                if (
                  field.type === "number" &&
                  (typeof v !== "number" ||
                    !Number.isFinite(v) ||
                    (field.min !== undefined && v < field.min) ||
                    (field.max !== undefined && v > field.max))
                )
                  ctx.addIssue({
                    code: "custom",
                    path: [field.key],
                    message:
                      "Periksa rentang " + field.label.toLowerCase() + ".",
                  });
                if (
                  field.key === "reason" &&
                  typeof v === "string" &&
                  v.length < 5
                )
                  ctx.addIssue({
                    code: "custom",
                    path: [field.key],
                    message: "Alasan harus berisi minimal 5 karakter.",
                  });
              }
            })
            .parse(data);
          pending.current = true;
          setSaving(true);
          draftTicket = draft.beforeSubmit();
          await onSave(data);
          draft.submitted(draftTicket);
          setOpen(false);
          onVisibilityChange?.(false);
          if (successMessage) notifySuccess(successMessage);
        } catch (e) {
          draft.failed(e);
          setError(
            e instanceof z.ZodError
              ? (e.issues[0]?.message ?? "Periksa isian formulir.")
              : e instanceof Error
                ? e.message
                : "Gagal menyimpan.",
          );
          setFieldErrors(serverFieldErrors(e));
          if (e instanceof z.ZodError) {
            const errors: Record<string, string> = {};
            for (const issue of e.issues) {
              const key = String(issue.path[0] ?? "");
              if (fields.some((field) => field.key === key))
                errors[key] ??= issue.message;
            }
            setFieldErrors(errors);
          }
          focusFeedback();
        } finally {
          pending.current = false;
          setSaving(false);
        }
      }}
    >
      <FormFeedback
        ref={feedback}
        message={error}
        fields={fields
          .filter((field) => fieldErrors[field.key])
          .map((field) => ({
            id: prefix + field.key,
            label: field.label,
            message: fieldErrors[field.key]!,
          }))}
      />
      {draftConfig && <DraftStatus draft={draft} disabled={busy || saving}/>}
      <fieldset disabled={busy || saving || locked || !!draft.candidate} className="contents">
        {fields.map((x) => (
          <div
            key={x.key}
            className="grid content-start gap-1 text-sm font-medium"
          >
            <label id={prefix + x.key + "-label"} htmlFor={prefix + x.key}>
              <span>
                {x.label}
                {!x.optional && (
                  <span aria-hidden="true" className="ml-1 text-destructive">
                    *
                  </span>
                )}
              </span>
            </label>
            {x.type === "multi" || x.type === "days" ? (
              <fieldset
                id={prefix + x.key}
                tabIndex={-1}
                aria-invalid={Boolean(fieldErrors[x.key])}
                aria-describedby={[
                  prefix + x.key + "-hint",
                  fieldErrors[x.key] ? prefix + x.key + "-error" : "",
                ].filter(Boolean).join(" ")}
                aria-labelledby={prefix + x.key + "-label"}
                className="grid max-h-52 gap-1 overflow-y-auto rounded-lg border bg-muted/30 p-2"
              >
                {x.options?.map((o) => (
                  <label
                    key={o.id}
                    className="flex! min-h-11 cursor-pointer flex-row! items-center gap-3 rounded-md px-2 hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      name={x.key}
                      value={o.id}
                      defaultChecked={((x.value as (string | number)[]) ?? [])
                        .map(String)
                        .includes(o.id)}
                    />
                    <span>{o.name}</span>
                  </label>
                ))}
              </fieldset>
            ) : x.type === "select" ? (
              <select
                name={x.key}
                id={prefix + x.key}
                aria-invalid={Boolean(fieldErrors[x.key])}
                aria-describedby={
                  fieldErrors[x.key] ? prefix + x.key + "-error" : undefined
                }
                className={input}
                required={!x.optional}
                defaultValue={String(x.value ?? "")}
              >
                <option value="">Pilih…</option>
                {x.options?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            ) : x.type === "textarea" || x.type === "dates" ? (
              <textarea
                name={x.key}
                id={prefix + x.key}
                aria-invalid={Boolean(fieldErrors[x.key])}
                aria-describedby={
                  fieldErrors[x.key] ? prefix + x.key + "-error" : undefined
                }
                className={input}
                maxLength={x.type === "dates" ? 5000 : 1000}
                required={!x.optional}
                defaultValue={
                  Array.isArray(x.value) ? x.value.join("\n") : (x.value ?? "")
                }
              />
            ) : (
              <input
                name={x.key}
                id={prefix + x.key}
                aria-invalid={Boolean(fieldErrors[x.key])}
                aria-describedby={
                  fieldErrors[x.key] ? prefix + x.key + "-error" : undefined
                }
                className={input}
                type={x.type ?? "text"}
                required={!x.optional}
                min={x.min}
                max={x.max}
                step={x.type === "number" ? 1 : undefined}
                maxLength={x.key === "reason" ? 500 : 120}
                defaultValue={x.value as string | number | undefined}
              />
            )}
            {fieldErrors[x.key] && (
              <p
                id={prefix + x.key + "-error"}
                className="text-sm font-normal text-destructive"
              >
                {fieldErrors[x.key]}
              </p>
            )}
            {x.type === "multi" || x.type === "days" ? (
              <span id={prefix + x.key + "-hint"} className="font-normal text-muted-foreground">
                {x.optional ? "Centang pilihan yang diperlukan." : "Wajib: centang minimal satu pilihan."}
              </span>
            ) : null}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3 border-t pt-4 sm:col-span-2">
          {inline && (
            <button className={button} disabled={busy || saving || locked || !!draft.candidate}>
              <ActionIcon action="submit" />
              {busy || saving ? "Memproses…" : submitLabel}
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
  if (inline) return form;
  return (
    <FormDialog
      title={label}
      {...(draftConfig ? { onDiscard: draft.remove } : {})}
      {...(description ? { description } : {})}
      trigger={label}
      footer={
        <button
          className={button}
          type="submit"
          form={prefix + "-form"}
          disabled={busy || saving || locked || !!draft.candidate}
        >
          <ActionIcon action="submit" />
          {busy || saving ? "Memproses…" : submitLabel}
        </button>
      }
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onVisibilityChange?.(next);
        if (next) {
          setError("");
          setFieldErrors({});
        } else onDismiss?.();
      }}
      busy={busy || saving}
    >
      {form}
    </FormDialog>
  );
}
export function ImpactDialog({
  impact,
  onConfirm,
  onCancel,
  busy,
}: {
  impact: Record<string, unknown>;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    cancel = useRef<HTMLButtonElement>(null),
    titleId = useId();
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const el = dialog.current;
    if (!el?.open) el?.showModal();
    cancel.current?.focus();
    return () => {
      el?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  const labels: Record<string, string> = {
    assignments: "Penugasan terdampak",
    baps: "BAP tersimpan",
    sessions: "Sesi terdampak",
    rooms: "Ruang terdampak",
    attendance: "Kehadiran terdampak",
    journals: "Jurnal terdampak",
    netJtm: "JTM bersih yang akan dibalik",
    activeNetJtm: "JTM bersih saat ini",
    activeBaps: "BAP aktif yang akan dikunci",
    operation: "Operasi",
  };
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className={
        panel +
        " m-auto max-h-[calc(100svh-2rem)] w-[min(40rem,calc(100%-2rem))] overflow-y-auto border-amber-500 bg-amber-50 text-slate-900 shadow-xl backdrop:bg-black/45"
      }
    >
      <h2 id={titleId} className="font-semibold">
        Konfirmasi dampak perubahan
      </h2>
      <p>
        Periksa perubahan ini. Riwayat bukti tetap disimpan; kredit terkait akan
        direkonsiliasi. BAP lama yang dikunci harus dibuat ulang oleh pemilik
        penugasan yang sah.
      </p>
      <dl className="grid gap-2">
        {Object.entries(impact)
          .filter(([k]) => labels[k])
          .map(([k, v]) => (
            <div key={k}>
              <dt className="inline font-medium">{labels[k]}: </dt>
              <dd className="inline">{String(v)}</dd>
            </div>
          ))}
      </dl>
      <div className="flex gap-2">
        <button disabled={busy} className={button} onClick={onConfirm}>
          <ActionIcon action="confirm" />
          Konfirmasi perubahan
        </button>
        <button
          ref={cancel}
          disabled={busy}
          className={secondary}
          onClick={onCancel}
        >
          <ActionIcon action="close" />
          Batal
        </button>
      </div>
    </dialog>
  );
}
