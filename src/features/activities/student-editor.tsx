"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { FormDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { Field } from "@/features/auth/account-lifecycle";
import { commandSchemas } from "@/lib/activities/schemas";
import { validateAccount } from "@/lib/accounts/client-validation";
import { ApiRequestError, serverFieldErrors } from "@/lib/feedback/api-error";
import { applyFieldErrors } from "@/lib/feedback/form-fields";
import {
  studentTotal,
  type StudentClass,
  type StudentRecap,
  type StudentProgress,
} from "@/lib/activities/student-contracts";
export type StudentSelection = {
  date: string;
  classes: StudentClass[];
  rows: StudentRecap[];
  progress: StudentProgress;
  initialClass: string;
};
const fields = [
  ["hadir", "Hadir"],
  ["sakit", "Sakit"],
  ["izin", "Izin"],
  ["alpa", "Alpa"],
] as const;
export function StudentEditor({
  selection,
  blocked,
  onSave,
  onClose,
  onRecover,
}: {
  selection: StudentSelection;
  blocked: boolean;
  onSave: (
    input: unknown,
    signal: AbortSignal,
    previous: StudentRecap | undefined,
  ) => Promise<void>;
  onClose: () => void;
  onRecover: () => void;
}) {
  const prefix = useId(),
    formId = prefix + "form";
  const [classId, setClassId] = useState(selection.initialClass),
    [numbers, setNumbers] = useState(() => values(selection.initialClass)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const mounted = useRef(false),
    pending = useRef(false),
    request = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  function values(id: string) {
    const row = selection.rows.find((r) => r.class_id === id);
    return Object.fromEntries(
      fields.map(([name]) => [name, String(row?.[name] ?? 0)]),
    );
  }
  const current = selection.rows.find((r) => r.class_id === classId),
    klass = selection.classes.find((c) => c.id === classId);
  const privateComplete =
    !current &&
    selection.progress.required.some((c) => c.id === classId && c.complete);
  const total = fields.every(
    ([name]) => numbers[name] !== "" && Number.isInteger(Number(numbers[name])),
  )
    ? fields.reduce((sum, [name]) => sum + Number(numbers[name]), 0)
    : null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || blocked || privateComplete) return;
    const form = event.currentTarget,
      controller = new AbortController();
    request.current = controller;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      applyFieldErrors(form, {});
      const data = new FormData(form),
        counts = Object.fromEntries(
          fields.map(([name]) => [
            name,
            numbers[name] === "" ? undefined : Number(numbers[name]),
          ]),
        );
      const input = validateAccount(
        commandSchemas["students-save"],
        {
          classId,
          date: selection.date,
          ...counts,
          version: current?.version ?? "0",
          reason: String(data.get("reason") ?? ""),
        },
        true,
      );
      if (!klass)
        throw new ApiRequestError(
          "VALIDATION_ERROR",
          "Pilih kelas yang tersedia pada periode tanggal ini.",
        );
      if (
        klass.expectedStudents > 0 &&
        studentTotal(input) !== klass.expectedStudents
      )
        throw new ApiRequestError(
          "STUDENT_COUNT_MISMATCH",
          `Jumlah seluruh kategori harus ${klass.expectedStudents} siswa.`,
          422,
          Object.fromEntries(
            fields.map(([name]) => [
              name,
              [
                "Cocokkan jumlah hadir, sakit, izin, dan alpa dengan standar kelas.",
              ],
            ]),
          ),
        );
      await onSave(input, controller.signal, current);
    } catch (e) {
      if (mounted.current && !controller.signal.aborted) {
        const errors = serverFieldErrors(e);
        if (
          e instanceof ApiRequestError &&
          ["STUDENT_COUNT_MISMATCH", "STUDENT_ATTENDANCE_MISMATCH"].includes(
            e.code,
          )
        )
          for (const [name] of fields)
            errors[name] ??=
              "Cocokkan jumlah kategori dengan standar kelas dan jurnal aktif.";
        applyFieldErrors(form, errors);
        setError(
          e instanceof Error ? e.message : "Rekap belum dapat disimpan.",
        );
      }
    } finally {
      pending.current = false;
      request.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <FormDialog
      open
      trigger=""
      title="Rekap absensi siswa"
      description="Periksa tanggal dan kelas. Angka yang sudah tersimpan dimuat dari rekap harian, terpisah dari filter riwayat."
      busy={busy}
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
      footer={
        <Button
          type="submit"
          form={formId}
          disabled={busy || blocked || privateComplete || !klass}
        >
          {busy ? "Menyimpan…" : "Simpan rekap siswa"}
        </Button>
      }
    >
      <form
        id={formId}
        method="post"
        onSubmit={(e) => void submit(e)}
        className="min-w-0 space-y-5 [overflow-wrap:anywhere]"
        aria-busy={busy}
      >
        <p className="rounded-xl border bg-muted/30 p-3 text-sm">
          Tanggal {selection.date} WIB ·{" "}
          {current ? `Perbarui rekap versi ${current.version}` : "Input rekap"}.
          Perubahan tetap diperiksa terhadap hak akses, periode final, dan
          jurnal aktif.
        </p>
        <fieldset disabled={busy || blocked} className="min-w-0 space-y-5">
          <div className="min-w-0 space-y-2 text-sm">
            <label htmlFor={prefix + "class"} className="font-medium">
              Kelas
            </label>
            <select
              id={prefix + "class"}
              name="classId"
              className="ui-control"
              required
              value={classId}
              onChange={(e) => {
                if (e.currentTarget.form)
                  applyFieldErrors(e.currentTarget.form, {});
                setClassId(e.target.value);
                setNumbers(values(e.target.value));
                setError("");
              }}
            >
              <option value="" disabled>
                Pilih kelas…
              </option>
              {selection.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {privateComplete ? (
            <p
              role="status"
              className="rounded-xl border p-4 text-sm leading-6"
            >
              Rekap kelas ini sudah diisi oleh operator lain. Detail dan
              versinya tidak tersedia pada riwayat akun Anda. Hubungi admin
              untuk memeriksa atau memperbaruinya; rekap tidak akan ditimpa
              sebagai data baru.
            </p>
          ) : (
            <>
              <p className="text-sm">
                Standar kelas:{" "}
                {klass?.expectedStudents
                  ? `${klass.expectedStudents} siswa`
                  : "belum ditetapkan; total wajib 1–1000 siswa"}
                . Total isian: {total ?? "periksa angka"}.
              </p>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                {fields.map(([name, label]) => (
                  <div key={name} className="min-w-0 space-y-2 text-sm">
                    <div className="ui-floating-field"><label htmlFor={prefix + name} className="font-medium ui-floating-label">
                      {label}
                    </label>
                    <input placeholder=" "
                      id={prefix + name}
                      name={name}
                      className="ui-control"
                      type="number"
                      min={0}
                      max={1000}
                      step={1}
                      required
                      value={numbers[name]}
                      onChange={(e) =>
                        setNumbers((v) => ({ ...v, [name]: e.target.value }))
                      }
                    /></div>
                  </div>
                ))}
              </div>
              <Field
                name="reason"
                label="Alasan pencatatan"
                minLength={5}
                maxLength={500}
                multiline
              />
            </>
          )}
        </fieldset>
        <ErrorFeedback message={error} autoFocus />
        {blocked && (
          <div className="space-y-3 text-sm leading-6">
            <p>
              Muat ulang dan periksa rekap terbaru sebelum mencoba lagi.
              Formulir akan ditutup dan isian yang belum tersimpan dikosongkan.
            </p>
            <Button variant="outline" type="button" onClick={onRecover}>
              Muat ulang dan periksa absensi
            </Button>
          </div>
        )}
      </form>
    </FormDialog>
  );
}
