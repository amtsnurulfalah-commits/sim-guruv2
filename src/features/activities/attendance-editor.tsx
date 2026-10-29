"use client";
import { useEffect, useId, useRef, useState } from "react";
import { FormDialog } from "@/components/ui/dialog";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { control, primaryAction } from "@/components/ui/styles";
import { masterRequest } from "../masters/api";
import { commandSchemas } from "../../lib/activities/schemas";
import { validateAccount } from "../../lib/accounts/client-validation";
import { applyFieldErrors } from "../../lib/feedback/form-fields";
import { serverFieldErrors } from "../../lib/feedback/api-error";
import { wibDate } from "../../lib/calendar/schemas";
import {
  validateAttendanceInput,
  verifyAttendanceList,
  type AttendanceAction,
  type AttendanceRow,
  type AttendanceTemplate,
  type AttendancePreview,
} from "../../lib/activities/attendance-contracts";
export type AttendanceSelection =
  | {
      kind: "manual";
      date: string;
      row?: AttendanceRow;
      teachers: { id: string; name: string }[];
    }
  | {
      kind: "in" | "out" | "leave" | "delete-leave";
      row: AttendanceRow;
      leaveId?: string;
    }
  | {
      kind: "template";
      templates: AttendanceTemplate[];
      initialId: string;
      remove?: boolean;
    }
  | { kind: "apply"; preview: AttendancePreview };
export function AttendanceEditor({
  selection: s,
  blocked,
  now,
  onSave,
  onClose,
}: {
  selection: AttendanceSelection;
  blocked: boolean;
  now: number;
  onSave: (
    action: AttendanceAction,
    input: unknown,
    before: AttendanceRow | undefined,
    signal: AbortSignal,
  ) => Promise<void>;
  onClose: () => void;
}) {
  const id = useId(),
    formId = id + "form",
    pending = useRef(false),
    mounted = useRef(false),
    request = useRef<AbortController | null>(null);
  const firstTemplate =
    s.kind === "template"
      ? s.templates.find((t) => t.id === s.initialId)
      : undefined;
  const [teacher, setTeacher] = useState(
      s.kind === "manual" ? (s.row?.userId ?? "") : "",
    ),
    [date, setDate] = useState(s.kind === "manual" ? s.date : ""),
    [day, setDay] = useState(
      String(
        firstTemplate?.day_index ?? new Date(now + 7 * 3600000).getUTCDay(),
      ),
    ),
    [type, setType] = useState(firstTemplate?.sched_type ?? "KBM");
  const initial = s.kind === "manual" ? s.row : undefined;
  const [values, setValues] = useState(() => manualValues(initial)),
    [reason, setReason] = useState(""),
    [leaveTime, setLeaveTime] = useState(""),
    [returnTime, setReturnTime] = useState("");
  const [timeIn, setTimeIn] = useState(
      firstTemplate?.time_in.slice(0, 5) ?? "07:30",
    ),
    [timeOut, setTimeOut] = useState(
      firstTemplate?.time_out.slice(0, 5) ?? "14:00",
    );
  const [lookup, setLookup] = useState<{
      scope: string;
      row: AttendanceRow | null;
      error: string;
    }>({ scope: "", row: null, error: "" }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const scope = teacher + ":" + date,
    lookupPending = s.kind === "manual" && !s.row && lookup.scope !== scope,
    current =
      s.kind === "manual"
        ? (s.row ??
          (lookup.scope === scope ? (lookup.row ?? undefined) : undefined))
        : undefined;
  const template =
    s.kind === "template"
      ? s.templates.find(
          (t) => String(t.day_index) === day && t.sched_type === type,
        )
      : undefined;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (s.kind !== "manual" || s.row) return;
    const controller = new AbortController();
    if (!teacher || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      return () => controller.abort();
    void masterRequest<unknown>(
      "/api/activities/attendance?" +
        new URLSearchParams({
          from: date,
          to: date,
          userId: teacher,
          page: "1",
          pageSize: "1",
        }),
      "GET",
      undefined,
      controller.signal,
    )
      .then((raw) => {
        if (controller.signal.aborted) return;
        const result = verifyAttendanceList(raw, {
          from: date,
          to: date,
          page: 1,
          pageSize: 1,
          admin: true,
          userId: teacher,
          filterTeacher: teacher,
        });
        if (result.total > 1 || result.total !== result.items.length)
          throw Error(
            "Terdapat lebih dari satu catatan harian. Hubungi administrator.",
          );
        const row = result.items[0] ?? null;
        setLookup({ scope, row, error: "" });
        setValues(manualValues(row ?? undefined));
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setLookup({
            scope,
            row: null,
            error:
              e instanceof Error
                ? e.message
                : "Gagal memeriksa catatan harian.",
          });
      });
    return () => controller.abort();
  }, [s, teacher, date, scope]);
  const today = wibDate(new Date(now)),
    expired =
      s.kind === "apply" &&
      (Date.parse(s.preview.expiresAt) <= now || s.preview.date < today),
    dateBlocked =
      s.kind !== "manual" &&
      s.kind !== "template" &&
      s.kind !== "apply" &&
      s.row.date !== today;
  const title =
    s.kind === "manual"
      ? "Kehadiran harian"
      : s.kind === "template"
        ? s.remove
          ? "Hapus pola kehadiran"
          : "Pola jam kehadiran"
        : s.kind === "apply"
          ? "Tinjau penerapan pola"
          : s.kind === "leave"
            ? "Izin keluar sementara"
            : s.kind === "delete-leave"
              ? "Hapus izin keluar"
              : s.kind === "in"
                ? "Catat masuk sekarang"
                : "Catat pulang";
  const disabled =
    busy ||
    blocked ||
    expired ||
    dateBlocked ||
    (s.kind === "manual" &&
      (lookupPending || !!lookup.error || !teacher || date > today)) ||
    (s.kind === "template" && !!s.remove && !template);
  function chooseTemplate(nextDay: string, nextType: string) {
    setDay(nextDay);
    setType(nextType as typeof type);
    const t =
      s.kind === "template"
        ? s.templates.find(
            (t) => String(t.day_index) === nextDay && t.sched_type === nextType,
          )
        : undefined;
    setTimeIn(t?.time_in.slice(0, 5) ?? "07:30");
    setTimeOut(t?.time_out.slice(0, 5) ?? "14:00");
    setReason("");
    setError("");
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || disabled) return;
    const form = event.currentTarget,
      controller = new AbortController();
    request.current = controller;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      applyFieldErrors(form, {});
      let action: AttendanceAction,
        input: unknown,
        before: AttendanceRow | undefined;
      if (s.kind === "manual") {
        action = "manual";
        before = current;
        input = {
          userId: teacher,
          date,
          scheduledIn: values.scheduledIn || null,
          scheduledOut: values.scheduledOut || null,
          actualIn: values.actualIn || null,
          actualOut: values.actualOut || null,
          extra: values.extra,
          version: current?.version ?? "0",
          reason,
        };
      } else if (s.kind === "template") {
        action = s.remove ? "template-delete" : "template-save";
        input = {
          dayIndex: Number(day),
          type,
          version: template?.version ?? "0",
          reason,
          ...(s.remove ? {} : { timeIn, timeOut }),
        };
      } else if (s.kind === "apply") {
        action = "template-apply";
        input = { previewId: s.preview.previewId, reason };
      } else {
        action = s.kind;
        before = s.row;
        input = {
          attendanceId: s.row.id,
          version: s.row.version,
          reason,
          ...(s.kind === "leave" ? { leaveTime, returnTime } : {}),
          ...(s.kind === "delete-leave" ? { leaveId: s.leaveId } : {}),
        };
      }
      input = validateAccount<unknown>(commandSchemas[action], input, true);
      validateAttendanceInput(action, input, before);
      await onSave(action, input, before, controller.signal);
      if (mounted.current) onClose();
    } catch (e) {
      if (mounted.current) {
        applyFieldErrors(form, serverFieldErrors(e));
        setError(e instanceof Error ? e.message : "Gagal menyimpan kehadiran.");
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <FormDialog
      trigger=""
      open
      title={title}
      description={
        s.kind === "manual"
          ? "Tanggal dan guru diperiksa langsung pada server agar versi koreksi tidak bergantung pada filter riwayat."
          : s.kind === "template"
            ? "Pilih hari dan konteks. Pola tersimpan akan dimuat sebelum perubahan dibuat."
            : "Periksa catatan dan alasan sebelum melanjutkan. Waktu operasional menggunakan WIB."
      }
      busy={busy}
      error={error}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      footer={
        <button
          className={primaryAction}
          type="submit"
          form={formId}
          disabled={disabled}
        >
          {busy
            ? "Menyimpan…"
            : s.kind === "manual"
              ? "Simpan kehadiran manual"
              : s.kind === "leave"
                ? "Simpan izin"
                : s.kind === "template"
                  ? s.remove
                    ? "Hapus pola kehadiran"
                    : "Simpan pola kehadiran"
                  : s.kind === "apply"
                    ? "Terapkan pola kehadiran"
                    : s.kind === "delete-leave"
                      ? "Hapus izin"
                      : "Konfirmasi pencatatan"}
        </button>
      }
    >
      <form
        id={formId}
        onSubmit={submit}
        className="min-w-0 space-y-4 [overflow-wrap:anywhere]"
      >
        {blocked && (
          <p role="alert">
            Status penyimpanan perlu diperiksa. Tutup formulir dan muat ulang
            sebelum mengirim ulang.
          </p>
        )}
        {dateBlocked && (
          <p role="alert">
            Tanggal kegiatan sudah berubah. Tutup formulir dan muat ulang panel.
          </p>
        )}
        {expired && (
          <p role="alert">
            Pratinjau sudah kedaluwarsa atau tanggalnya telah lewat. Tutup dan
            buat pratinjau baru.
          </p>
        )}
        {s.kind === "manual" && (
          <>
            {s.row ? (
              <p className="rounded-lg bg-muted p-3 font-medium">
                {s.row.teacherName} · {s.date} · versi {s.row.version}
              </p>
            ) : (
              <fieldset
                disabled={busy || blocked}
                className="grid min-w-0 gap-4 sm:grid-cols-2"
              >
                <Field label="Guru">
                  <select
                    name="userId"
                    aria-label="Guru"
                    className={control}
                    value={teacher}
                    required
                    onChange={(e) => {
                      setTeacher(e.target.value);
                      setError("");
                    }}
                  >
                    <option value="">Pilih guru…</option>
                    {s.teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tanggal kehadiran">
                  <input placeholder=" "
                    aria-label="Tanggal kehadiran"
                    name="date"
                    className={control}
                    type="date"
                    value={date}
                    max={today}
                    required
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
              </fieldset>
            )}
            {lookupPending && teacher && (
              <p role="status">Memeriksa catatan dan versi terbaru…</p>
            )}
            {lookup.error && <ErrorFeedback message={lookup.error} />}
            {!s.row && !lookupPending && teacher && !lookup.error && (
              <p className="text-sm text-muted-foreground">
                {current
                  ? "Catatan sudah ada. Isian dimuat untuk koreksi, bukan penambahan catatan baru."
                  : "Belum ada catatan untuk guru dan tanggal ini."}
              </p>
            )}
            <fieldset
              disabled={busy || blocked || lookupPending || !!lookup.error}
              className="grid min-w-0 gap-4 sm:grid-cols-2"
            >
              {[
                ["scheduledIn", "Jadwal masuk"],
                ["scheduledOut", "Jadwal pulang"],
                ["actualIn", "Aktual masuk (boleh kosong)"],
                ["actualOut", "Aktual pulang (boleh kosong)"],
              ].map(([key, label]) => (
                <Field key={key} label={label!}>
                  <input placeholder=" "
                    aria-label={label}
                    className={control}
                    name={key}
                    type="time"
                    value={String(values[key as keyof typeof values])}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [key!]: e.target.value }))
                    }
                  />
                </Field>
              ))}
            </fieldset>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                disabled={busy || blocked || lookupPending}
                type="checkbox"
                checked={values.extra}
                onChange={(e) =>
                  setValues((v) => ({ ...v, extra: e.target.checked }))
                }
              />
              Peserta tambahan tanpa penugasan
            </label>
          </>
        )}
        {s.kind === "template" && (
          <fieldset
            disabled={busy || blocked}
            className="grid min-w-0 gap-4 sm:grid-cols-2"
          >
            <Field label="Hari">
              <select
                name="dayIndex"
                aria-label="Hari"
                className={control}
                value={day}
                disabled={!!s.remove}
                onChange={(e) => chooseTemplate(e.target.value, type)}
              >
                {days.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Konteks">
              <select
                name="type"
                aria-label="Konteks"
                className={control}
                value={type}
                disabled={!!s.remove}
                onChange={(e) => chooseTemplate(day, e.target.value)}
              >
                <option value="KBM">KBM</option>
                <option value="UJIAN">Ujian</option>
              </select>
            </Field>
            <Field label="Jam masuk">
              <input placeholder=" "
                aria-label="Jam masuk"
                className={control}
                name="timeIn"
                type="time"
                value={timeIn}
                disabled={!!s.remove}
                required
                onChange={(e) => setTimeIn(e.target.value)}
              />
            </Field>
            <Field label="Jam pulang">
              <input placeholder=" "
                aria-label="Jam pulang"
                className={control}
                name="timeOut"
                type="time"
                value={timeOut}
                disabled={!!s.remove}
                required
                onChange={(e) => setTimeOut(e.target.value)}
              />
            </Field>
            <p className="text-sm text-muted-foreground sm:col-span-2">
              {template
                ? "Mengubah pola yang sudah tersimpan · versi " +
                  template.version
                : "Membuat pola baru untuk hari dan konteks ini."}{" "}
              Pola yang sudah digunakan dilindungi sebagai riwayat.
            </p>
          </fieldset>
        )}
        {s.kind !== "manual" && s.kind !== "template" && s.kind !== "apply" && (
          <p className="rounded-lg bg-muted p-3">
            {s.row.teacherName} · {s.row.date} · jadwal{" "}
            {s.row.scheduledIn ?? "—"}–{s.row.scheduledOut ?? "—"}
          </p>
        )}
        {s.kind === "out" && (
          <p className="text-sm">
            Jam pulang memakai waktu server, dibatasi jadwal pulang. Guru dapat
            mencatat setelah jadwal pulang +5 menit.
          </p>
        )}
        {s.kind === "in" && (
          <p className="text-sm">
            Jam masuk akan dicatat menggunakan waktu server, bukan waktu
            perangkat.
          </p>
        )}
        {s.kind === "leave" && (
          <fieldset
            disabled={busy || blocked || dateBlocked}
            className="grid min-w-0 gap-4 sm:grid-cols-2"
          >
            <Field label="Jam keluar">
              <input placeholder=" "
                aria-label="Jam keluar"
                className={control}
                name="leaveTime"
                type="time"
                value={leaveTime}
                required
                onChange={(e) => setLeaveTime(e.target.value)}
              />
            </Field>
            <Field label="Jam kembali">
              <input placeholder=" "
                aria-label="Jam kembali"
                className={control}
                name="returnTime"
                type="time"
                value={returnTime}
                required
                onChange={(e) => setReturnTime(e.target.value)}
              />
            </Field>
            <p className="text-sm sm:col-span-2">
              Interval yang bertumpang tindih ditolak. Durasi izin yang
              beririsan dengan jam hadir akan mengurangi waktu efektif.
            </p>
          </fieldset>
        )}
        {s.kind === "delete-leave" && (
          <p>
            Hapus izin {s.row.leaves.find((l) => l.id === s.leaveId)?.leaveTime}
            –{s.row.leaves.find((l) => l.id === s.leaveId)?.returnTime}? Durasi
            efektif akan dihitung ulang; riwayat koreksi tetap disimpan.
          </p>
        )}
        {s.kind === "apply" && (
          <>
            <p>
              {s.preview.date} · {s.preview.timeIn}–{s.preview.timeOut} ·{" "}
              {s.preview.participants.length} guru. Jam aktual yang sudah
              tercatat akan dipertahankan.
            </p>
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-3">
              {s.preview.participants.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
            <p className="text-sm">
              Berlaku sampai{" "}
              {new Date(s.preview.expiresAt).toLocaleTimeString("id-ID", {
                timeZone: "Asia/Jakarta",
              })}{" "}
              WIB.
            </p>
          </>
        )}
        <Field label="Alasan">
          <textarea placeholder=" "
            aria-label="Alasan"
            className={control}
            name="reason"
            value={reason}
            minLength={5}
            maxLength={500}
            required
            disabled={busy || blocked}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </form>
    </FormDialog>
  );
}
function manualValues(row?: AttendanceRow) {
  return {
    scheduledIn: row ? (row.scheduledIn ?? "") : "07:30",
    scheduledOut: row ? (row.scheduledOut ?? "") : "14:00",
    actualIn: row?.actualIn ?? "",
    actualOut: row?.actualOut ?? "",
    extra: row?.extra ?? false,
  };
}
export const days = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-medium ui-floating-field">
      <span className="ui-floating-label">{label}</span>
      {children}
    </label>
  );
}
