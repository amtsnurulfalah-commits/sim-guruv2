"use client";
import { useEffect, useId, useRef, useState } from "react";
export const input =
  "min-h-11 w-full min-w-0 rounded border border-slate-300 bg-white p-2 text-sm text-slate-900";
export const button =
  "min-h-11 rounded bg-blue-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50";
export const secondary =
  "min-h-11 rounded border px-3 py-2 text-sm disabled:opacity-50";
export const panel = "space-y-4 rounded-xl border bg-white p-5";
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
  onSave,
  busy,
}: {
  fields: Field[];
  label: string;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) {
  const [error, setError] = useState("");
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
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
        try {
          await onSave(data);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Gagal menyimpan.");
        }
      }}
    >
      {fields.map((x) => (
        <label
          key={x.key}
          className="grid content-start gap-1 text-sm font-medium"
        >
          {x.label}
          {x.type === "multi" || x.type === "days" ? (
            <select
              multiple
              name={x.key}
              className={input}
              defaultValue={((x.value as (string | number)[]) ?? []).map(
                String,
              )}
              aria-label={x.label}
            >
              {x.options?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : x.type === "select" ? (
            <select
              name={x.key}
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
          {x.type === "multi" || x.type === "days" ? (
            <span className="font-normal text-slate-500">
              Pilih beberapa dengan Ctrl/Command.
            </span>
          ) : null}
        </label>
      ))}
      <div className="md:col-span-2">
        <button className={button} disabled={busy}>
          {label}
        </button>
        {error && (
          <p role="alert" className="mt-2 text-red-700">
            {error}
          </p>
        )}
      </div>
    </form>
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
          Saya konfirmasi perubahan ini
        </button>
        <button
          ref={cancel}
          disabled={busy}
          className={secondary}
          onClick={onCancel}
        >
          Batal
        </button>
      </div>
    </dialog>
  );
}
