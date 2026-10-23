"use client";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { ActionIcon } from "@/components/ui/action-icon";

import { FormDialog } from "@/components/ui/dialog";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { z } from "zod";
import { fieldLabel } from "../../lib/feedback/catalog";
import {
  dutyBoardSchema,
  dutyOccurrenceSchema,
  dutyPreviewSchema,
  dutyScheduleResultSchema,
  readDutyResponse,
  dutyOperations,
  validateDutySchedule,
  validateDutyOperation,
} from "../../lib/duties/contracts";
import { masterRequest } from "../masters/api";
import { wibDate } from "../../lib/calendar/schemas";
import type {
  DutyBoard,
  DutyScheduleInput,
  DutyOccurrence,
  DutyPreview,
  DutySchedule,
} from "../../lib/duties/schemas";
import {
  control as input,
  primaryAction as button,
  secondaryAction as secondary,
  surface as panel,
} from "@/components/ui/styles";
const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const labels: Record<string, string> = {
  PIKET: "Piket",
  UPACARA: "Pembina upacara",
  KBM: "KBM",
  confirm: "Konfirmasi",
  revoke: "Cabut konfirmasi",
  substitute: "Tunjuk pengganti",
  replace: "Ganti pengganti",
  "cancel-substitute": "Batalkan pengganti",
  adjust: "Sesuaikan JTM",
  allocate: "Alokasikan JTM",
  "remove-allocation": "Hapus alokasi",
  reset: "Reset penyesuaian dan alokasi",
};
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-medium">
      {label}
      {isValidElement<{ "aria-label"?: string }>(children)
        ? cloneElement(children, { "aria-label": label })
        : children}
    </label>
  );
}
function Choice({
  label,
  value,
  set,
  items,
  disabled = false,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  items: { id: string; name: string }[];
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <select
        disabled={disabled}
        aria-label={label}
        className={input}
        required
        value={value}
        onChange={(e) => set(e.target.value)}
      >
        <option value="">Pilih…</option>
        {items.map((x) => (
          <option value={x.id} key={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function DutyManager({
  admin,
  userId,
  initialKind = "PIKET",
}: {
  admin: boolean;
  userId: string;
  initialKind?: "PIKET" | "UPACARA";
}) {
  const lock = useRef(false),
    live = useRef(true),
    opener = useRef<HTMLButtonElement | null>(null);
  const [now, setNow] = useState(() => Date.now()),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [schedulePage, setSchedulePage] = useState(1);
  const today = wibDate(new Date(now));
  const [scheduleOpen, setScheduleOpen] = useState(false),
    [scheduleError, setScheduleError] = useState(""),
    [operationError, setOperationError] = useState(""),
    [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    live.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      live.current = false;
      clearInterval(timer);
    };
  }, []);
  const [date, setDate] = useState(wibDate()),
    [board, setBoard] = useState<DutyBoard | null>(null),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [selected, setSelected] = useState(""),
    [operation, setOperation] = useState("confirm"),
    [target, setTarget] = useState(""),
    [adjusted, setAdjusted] = useState("0"),
    [allocated, setAllocated] = useState("1"),
    [allocationId, setAllocationId] = useState(""),
    [reason, setReason] = useState(""),
    [preview, setPreview] = useState<DutyPreview | null>(null);
  const [editing, setEditing] = useState<DutySchedule | null>(null),
    [kind, setKind] = useState(initialKind),
    [teacher, setTeacher] = useState(""),
    [period, setPeriod] = useState(""),
    [day, setDay] = useState("1"),
    [from, setFrom] = useState(wibDate()),
    [to, setTo] = useState(wibDate()),
    [timeStart, setTimeStart] = useState("07:00"),
    [timeEnd, setTimeEnd] = useState(
      initialKind === "UPACARA" ? "07:30" : "14:00",
    ),
    [active, setActive] = useState(true),
    [scheduleReason, setScheduleReason] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    if (!date) return () => controller.abort();
    void masterRequest<unknown>(
      `/api/duties/board?date=${date}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((v) => {
        if (live) {
          const value = readDutyResponse(dutyBoardSchema, v);
          if (value.date !== date || value.admin !== admin)
            throw Error(
              "Tanggal atau akses panel dari server tidak sesuai. Muat ulang.",
            );
          setBoard(value);
          setError("");
        }
      })
      .catch((e) => {
        if (live) {
          setBoard(null);
          setError(
            e instanceof Error ? e.message : "Gagal memuat panel tugas.",
          );
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [date, revision, admin]);
  function refresh() {
    setLoading(true);
    setBoard(null);
    setError("");
    setRevision((v) => v + 1);
    setSelected("");
    setPreview(null);
    setUncertain(false);
  }
  function resetSchedule() {
    setEditing(null);
    setKind(initialKind);
    setTeacher("");
    setPeriod("");
    setDay(
      String(
        new Date((date < today ? today : date) + "T00:00:00Z").getUTCDay(),
      ),
    );
    setFrom(date < today ? today : date);
    setTo(date < today ? today : date);
    setTimeStart("07:00");
    setTimeEnd(initialKind === "UPACARA" ? "07:30" : "14:00");
    setActive(true);
    setScheduleReason("");
    setScheduleError("");
  }
  function closeSchedule() {
    setScheduleOpen(false);
    resetSchedule();
    requestAnimationFrame(() => opener.current?.focus());
  }
  async function submit(path: string, data: unknown, o?: DutyOccurrence) {
    if (lock.current) return undefined;
    lock.current = true;
    setBusy(true);
    setMessage("");
    const fail = path === "schedule" ? setScheduleError : setOperationError;
    fail("");
    let sent = false;
    try {
      if (path !== "schedule" && o?.date !== wibDate())
        throw Error(
          "Tindakan hanya tersedia pada hari kegiatan (WIB). Muat ulang panel.",
        );
      if (
        path === "commit" &&
        (!preview || Date.parse(preview.expiresAt) <= now)
      )
        throw Error("Pratinjau kedaluwarsa. Ubah isian lalu tinjau ulang.");
      const payload =
        path === "schedule"
          ? validateDutySchedule(data, board!, wibDate())
          : path === "preview"
            ? validateDutyOperation(data, o!)
            : data;
      sent = true;
      const raw = await masterRequest<unknown>(
        "/api/duties/" + path,
        "POST",
        payload,
      );
      if (!live.current) return undefined;
      if (path === "preview") {
        const v = readDutyResponse(dutyPreviewSchema, raw);
        if (
          v.current.id !== o!.id ||
          v.current.version !== o!.version ||
          v.current.date !== o!.date ||
          v.operation !== v.request.operation ||
          JSON.stringify(v.request) !== JSON.stringify(payload)
        )
          throw Error("Pratinjau tidak sesuai isian. Buat pratinjau baru.");
        return v;
      }
      if (path === "commit") {
        const v = readDutyResponse(dutyOccurrenceSchema, raw);
        if (
          v.id !== o!.id ||
          v.date !== o!.date ||
          BigInt(v.version) <= BigInt(o!.version)
        )
          throw Error(
            "Hasil perubahan tidak sesuai kegiatan atau versi. Periksa ulang status.",
          );
        return v;
      }
      const v = readDutyResponse(dutyScheduleResultSchema, raw);
      const expected = payload as DutyScheduleInput;
      if (
        (expected.id && v.id !== expected.id) ||
        v.user_id !== expected.userId ||
        v.kind !== expected.kind ||
        v.academic_period_id !== expected.academicPeriodId ||
        v.day_index !== expected.dayIndex ||
        v.date !== expected.date ||
        v.valid_from !== expected.validFrom ||
        v.valid_to !== expected.validTo ||
        v.time_start.slice(0, 5) !== expected.timeStart ||
        v.time_end.slice(0, 5) !== expected.timeEnd ||
        v.active !== expected.active ||
        BigInt(v.version) <= BigInt(expected.version)
      )
        throw Error("Hasil jadwal tidak sesuai isian. Periksa status terbaru.");
      return v;
    } catch (e) {
      if (live.current) {
        fail(
          e instanceof z.ZodError
            ? e.issues
                .map((i) => `${fieldLabel(i.path.join("."))}: ${i.message}`)
                .join("\n")
            : e instanceof Error
              ? e.message
              : "Gagal menyimpan tugas.",
        );
        if (sent && (path === "commit" || path === "schedule"))
          setUncertain(true);
      }
      return undefined;
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }
  const occurrence = board?.occurrences.find((o) => o.id === selected);
  function edit(s: DutySchedule) {
    setEditing(s);
    setScheduleError("");
    setUncertain(false);
    setScheduleOpen(true);
    setKind(s.kind);
    setTeacher(s.user_id);
    setPeriod(s.academic_period_id);
    setDay(String(s.day_index));
    setFrom(s.valid_from);
    setTo(s.valid_to);
    setTimeStart(s.time_start.slice(0, 5));
    setTimeEnd(s.time_end.slice(0, 5));
    setActive(s.active);
    setScheduleReason("");
  }
  function choose(o: DutyOccurrence) {
    const actions = dutyOperations(o, {
      admin,
      canOperate: !!board?.canOperate,
      userId,
      today,
    });
    setSelected(o.id);
    setOperation(actions[0] ?? "confirm");
    setReason("");
    setAdjusted(String(Math.floor(Number(o.adjustedJtm))));
    setAllocated("1");
    setTarget("");
    setAllocationId("");
    setPreview(null);
    setOperationError("");
    setUncertain(false);
  }
  const operations = occurrence
    ? dutyOperations(occurrence, {
        admin,
        canOperate: !!board?.canOperate,
        userId,
        today,
      })
    : [];
  const matches = (text: string) =>
    text.toLocaleLowerCase("id").includes(query.trim().toLocaleLowerCase("id"));
  const rows = (board?.occurrences ?? []).filter((o) =>
    matches(
      [
        labels[o.kind],
        o.teacherName,
        o.originalTeacherName,
        o.className,
        o.subjectName,
      ].join(" "),
    ),
  );
  const scheduleRows = (board?.schedules ?? []).filter((o) =>
    matches(labels[o.kind] + " " + o.teacherName + " " + days[o.day_index]),
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 12))),
    currentSchedulePage = Math.min(
      schedulePage,
      Math.max(1, Math.ceil(scheduleRows.length / 12)),
    );
  return (
    <div
      className="min-w-0 space-y-6 [overflow-wrap:anywhere]"
      aria-busy={loading}
    >
      <header>
        <h1 className="text-2xl font-bold">Piket, upacara dan pengganti</h1>
        <p className="mt-2 text-sm text-slate-600">
          Konfirmasi piket memberi 4 JTM; upacara memberi 5 JTM. Pengganti wajib
          dikonfirmasi kembali. Klaim pribadi tidak memberi kredit.
        </p>
      </header>
      <div>
        {error && <ErrorFeedback message={error} />}
        {message && (
          <p className="rounded bg-green-50 p-3 text-green-800">{message}</p>
        )}
      </div>
      <section className={panel}>
        <Field label="Tanggal kegiatan (WIB)">
          <input
            className={input}
            disabled={busy || !!selected || scheduleOpen}
            type="date"
            value={date}
            onChange={(e) => {
              setBoard(null);
              setError("");
              setPage(1);
              setSchedulePage(1);
              if (!e.target.value) {
                setLoading(false);
                setDate("");
                return;
              }
              setLoading(true);
              setDate(e.target.value);
              setSelected("");
              setPreview(null);
            }}
          />
        </Field>
        <p>
          {admin
            ? "Panel administrator"
            : board?.canOperate
              ? "Piket operasional aktif: sudah dikonfirmasi dan memiliki jam masuk."
              : "Akses pribadi. Hak operasional piket memerlukan konfirmasi sah dan jam masuk."}
        </p>
        <button
          className={secondary}
          disabled={loading || busy || !date || scheduleOpen}
          onClick={refresh}
        >
          <ActionIcon action="refresh" />
          Muat ulang
        </button>
        {loading && <p role="status">Memuat penugasan…</p>}
        {!date && (
          <p role="alert">Pilih tanggal kegiatan untuk memuat panel.</p>
        )}
      </section>
      <Field label="Cari kegiatan dan jadwal">
        <input
          className={input}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
            setSchedulePage(1);
          }}
          placeholder="Nama guru, jenis tugas, kelas, atau mata pelajaran"
        />
      </Field>
      <section className={panel}>
        <h2 className="font-semibold">Kegiatan tanggal {date}</h2>
        {!loading && board && !rows.length && (
          <p>
            Belum ada penugasan pada tanggal ini. Pastikan jadwal dan konteks
            KBM aktif.
          </p>
        )}
        {!loading &&
          rows.slice((currentPage - 1) * 12, currentPage * 12).map((o) => (
            <article key={o.id} className="space-y-2 rounded border p-4">
              <h3 className="font-semibold">
                {labels[o.kind]} · {o.teacherName}
                {o.className ? ` · ${o.className} · ${o.subjectName}` : ""}
              </h3>
              <p>
                {o.timeStart}–{o.timeEnd} ·{" "}
                {o.confirmed ? "Terkonfirmasi" : "Belum dikonfirmasi"}
              </p>
              {o.substitutionId && (
                <p className="text-sm">
                  Menggantikan {o.originalTeacherName}. Identitas guru asli
                  tetap disimpan.
                </p>
              )}
              <p className="text-sm">
                Terjadwal {o.scheduledJtm} · basis pemilik {o.adjustedJtm} ·
                sisa belum dialokasikan {o.remainingJtm} JTM
              </p>
              {o.adjustmentReason && (
                <p className="text-sm">
                  Alasan penyesuaian: {o.adjustmentReason}
                </p>
              )}
              {o.allocations.map((a) => (
                <p className="text-sm" key={a.id}>
                  Alokasi {a.teacherName}: {a.jtm} JTM — {a.reason}
                </p>
              ))}
              {dutyOperations(o, {
                admin,
                canOperate: !!board?.canOperate,
                userId,
                today,
              }).length > 0 && (
                <button
                  className={secondary}
                  disabled={busy || loading}
                  onClick={(e) => {
                    opener.current = e.currentTarget;
                    choose(o);
                  }}
                >
                  <ActionIcon action="open" />
                  Kelola kegiatan
                </button>
              )}
            </article>
          ))}
      </section>
      {board && rows.length > 12 && (
        <nav
          aria-label="Halaman kegiatan"
          className="flex flex-wrap items-center gap-3"
        >
          <button
            className={secondary}
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Sebelumnya
          </button>
          <span>
            {currentPage} / {Math.ceil(rows.length / 12)} · {rows.length}{" "}
            kegiatan
          </span>
          <button
            className={secondary}
            disabled={currentPage * 12 >= rows.length}
            onClick={() => setPage(currentPage + 1)}
          >
            Berikutnya
          </button>
        </nav>
      )}
      {occurrence && (
        <FormDialog
          key={occurrence.id}
          trigger=""
          title={`Kelola ${labels[occurrence.kind]}`}
          open
          busy={busy}
          error={operationError}
          onOpenChange={(v) => {
            if (!v) {
              setSelected("");
              setPreview(null);
              requestAnimationFrame(() => opener.current?.focus());
            }
          }}
        >
          <form
            className="min-w-0 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = {
                occurrenceId: occurrence.id,
                version: occurrence.version,
                operation,
                reason,
                ...(["substitute", "replace", "allocate"].includes(operation)
                  ? { userId: target }
                  : {}),
                ...(operation === "adjust" ? { adjustedJtm: adjusted } : {}),
                ...(operation === "allocate"
                  ? { allocatedJtm: allocated }
                  : {}),
                ...(operation === "remove-allocation" ? { allocationId } : {}),
              };
              const result = await submit("preview", data, occurrence);
              if (result) setPreview(result as DutyPreview);
            }}
          >
            <h2 className="font-semibold">
              Kelola {labels[occurrence.kind]} — {occurrence.teacherName}
            </h2>
            <fieldset
              disabled={busy || uncertain || !!preview || !operations.length}
              className="min-w-0 space-y-4"
            >
              <Choice
                label="Tindakan"
                value={operation}
                set={(v) => {
                  setOperation(v);
                  setPreview(null);
                }}
                items={operations.map((id) => ({ id, name: labels[id]! }))}
              />
              {["substitute", "replace", "allocate"].includes(operation) && (
                <Choice
                  label="Guru pengganti / penerima"
                  value={target}
                  set={(v) => {
                    setTarget(v);
                    setPreview(null);
                  }}
                  items={(board?.teachers ?? []).filter(
                    (t) =>
                      ![
                        occurrence.originalUserId,
                        occurrence.userId,
                        userId,
                      ].includes(t.id),
                  )}
                />
              )}
              {operation === "adjust" && (
                <Field label="JTM basis pemilik (bilangan bulat)">
                  <input
                    className={input}
                    type="number"
                    min={0}
                    max={Number(occurrence.scheduledJtm)}
                    step={1}
                    required
                    value={adjusted}
                    onChange={(e) => {
                      setAdjusted(e.target.value);
                      setPreview(null);
                    }}
                  />
                </Field>
              )}
              {operation === "allocate" && (
                <Field label="JTM alokasi (maksimal 4 desimal)">
                  <input
                    className={input}
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    required
                    value={allocated}
                    onChange={(e) => {
                      setAllocated(e.target.value);
                      setPreview(null);
                    }}
                  />
                </Field>
              )}
              {operation === "remove-allocation" && (
                <Choice
                  label="Alokasi yang dihapus"
                  value={allocationId}
                  set={(v) => {
                    setAllocationId(v);
                    setPreview(null);
                  }}
                  items={occurrence.allocations.map((a) => ({
                    id: a.id,
                    name: a.teacherName + " · " + a.jtm + " JTM",
                  }))}
                />
              )}
              <Field label="Alasan tindakan">
                <textarea
                  className={input}
                  minLength={1}
                  maxLength={500}
                  required
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setPreview(null);
                  }}
                />
              </Field>
              <button
                className={button}
                disabled={busy || loading || !operations.includes(operation)}
              >
                <ActionIcon action="preview" />
                Tinjau dampak perubahan
              </button>
            </fieldset>
            {uncertain && (
              <p role="alert">
                Status penyimpanan perlu diperiksa sebelum mengirim ulang. Tutup
                formulir, lalu muat ulang panel.
              </p>
            )}
            {!operations.length && (
              <p role="alert">
                Tindakan tidak tersedia lagi pada tanggal atau akses ini. Tutup
                formulir dan muat ulang.
              </p>
            )}
            {preview && (
              <section className="space-y-3 rounded border border-amber-300 bg-amber-50 p-4">
                <h3 className="font-semibold">
                  Konfirmasi {labels[preview.operation]}
                </h3>
                <p>
                  {preview.current.teacherName} · {preview.current.date}. Kredit
                  bersih aktif saat ini {preview.activeNetJtm} JTM;{" "}
                  {preview.activeJournals} jurnal aktif.
                </p>
                <p className="text-sm">
                  Pencabutan dan pergantian membalik kredit, menghapus jurnal
                  aktif dari daftar, serta membersihkan alokasi dan penyesuaian
                  kegiatan ini. Riwayat tetap disimpan; kehadiran harian dan
                  tugas lain tetap ada. Penunjukan pengganti akan diperiksa
                  ulang terhadap bentrok.
                </p>
                <p className="text-sm">Alasan: {preview.request.reason}</p>
                <p className="text-sm">
                  Pratinjau berlaku sampai{" "}
                  {new Date(preview.expiresAt).toLocaleTimeString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })}{" "}
                  WIB.{" "}
                  {Date.parse(preview.expiresAt) <= now
                    ? "Pratinjau kedaluwarsa; kembali dan tinjau ulang."
                    : "Perubahan baru diterapkan setelah dikonfirmasi."}
                </p>
                <button
                  type="button"
                  className={button}
                  disabled={
                    busy ||
                    uncertain ||
                    !operations.includes(operation) ||
                    Date.parse(preview.expiresAt) <= now
                  }
                  onClick={async () => {
                    if (
                      await submit(
                        "commit",
                        { previewId: preview.previewId },
                        occurrence,
                      )
                    ) {
                      setPreview(null);
                      setSelected("");
                      refresh();
                      setMessage(
                        "Tindakan berhasil disimpan beserta perubahan kredit terkait.",
                      );
                    }
                  }}
                >
                  <ActionIcon action="confirm" />
                  {labels[preview.request.operation ?? ""] ??
                    "Konfirmasi perubahan tugas"}
                </button>
                <button
                  type="button"
                  className={secondary}
                  disabled={busy}
                  onClick={() => setPreview(null)}
                >
                  <ActionIcon action="close" />
                  Ubah isian / tinjau ulang
                </button>
              </section>
            )}
          </form>
        </FormDialog>
      )}
      {admin && (
        <>
          <button
            className={button}
            disabled={busy || loading || !board || !!selected}
            onClick={(e) => {
              opener.current = e.currentTarget;
              resetSchedule();
              setUncertain(false);
              setScheduleOpen(true);
            }}
          >
            <ActionIcon action="add" />
            Tambah jadwal tugas
          </button>
          {scheduleOpen && (
            <FormDialog
              trigger=""
              open
              title={editing ? "Ubah jadwal tugas" : "Tambah jadwal tugas"}
              busy={busy}
              error={scheduleError}
              onOpenChange={(v) => {
                if (!v) closeSchedule();
              }}
            >
              <form
                className={panel}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const result = await submit("schedule", {
                    ...(editing ? { id: editing.id } : {}),
                    version: editing?.version ?? "0",
                    kind,
                    userId: teacher,
                    academicPeriodId: period,
                    dayIndex: kind === "UPACARA" ? 1 : Number(day),
                    date: kind === "UPACARA" ? from : null,
                    validFrom: from,
                    validTo: kind === "UPACARA" ? from : to,
                    timeStart,
                    timeEnd,
                    active,
                    reason: scheduleReason,
                  });
                  if (result) {
                    if (date < from || date > (kind === "UPACARA" ? from : to))
                      setDate(from);
                    closeSchedule();
                    refresh();
                    setMessage("Jadwal tugas tersimpan.");
                  }
                }}
              >
                <h2 className="font-semibold">
                  {editing
                    ? "Ubah jadwal tugas"
                    : "Tambah jadwal piket / pembina upacara"}
                </h2>
                <fieldset
                  disabled={busy || uncertain}
                  className="min-w-0 space-y-4"
                >
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <Choice
                      disabled={!!editing}
                      label="Jenis tugas"
                      value={kind}
                      set={(v) => {
                        if (editing) return;
                        setKind(v as typeof kind);
                        setTimeEnd(v === "UPACARA" ? "07:30" : "14:00");
                      }}
                      items={[
                        { id: "PIKET", name: "Piket mingguan" },
                        { id: "UPACARA", name: "Pembina upacara Senin" },
                      ]}
                    />
                    <Choice
                      label="Guru"
                      value={teacher}
                      set={setTeacher}
                      items={board?.teachers ?? []}
                    />
                    <Choice
                      disabled={!!editing}
                      label="Periode akademik"
                      value={period}
                      set={(v) => {
                        if (!editing) setPeriod(v);
                      }}
                      items={board?.periods ?? []}
                    />
                    {kind === "PIKET" && (
                      <Choice
                        label="Hari"
                        value={day}
                        set={setDay}
                        items={days.map((name, i) => ({ id: String(i), name }))}
                      />
                    )}
                    <Field
                      label={
                        kind === "UPACARA" ? "Tanggal Senin" : "Berlaku mulai"
                      }
                    >
                      <input
                        className={input}
                        type="date"
                        required
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </Field>
                    {kind === "PIKET" && (
                      <Field label="Berlaku sampai">
                        <input
                          className={input}
                          type="date"
                          required
                          value={to}
                          onChange={(e) => setTo(e.target.value)}
                        />
                      </Field>
                    )}
                    <Field label="Jam mulai">
                      <input
                        className={input}
                        type="time"
                        required
                        value={timeStart}
                        onChange={(e) => setTimeStart(e.target.value)}
                      />
                    </Field>
                    <Field label="Jam selesai">
                      <input
                        className={input}
                        type="time"
                        required
                        value={timeEnd}
                        onChange={(e) => setTimeEnd(e.target.value)}
                      />
                    </Field>
                  </div>
                  {editing && (
                    <p className="text-sm">
                      Jenis tugas dan periode akademik dipertahankan saat edit.
                      Jadwal yang telah dipakai kegiatan tidak dapat
                      dinonaktifkan atau diubah guru, hari, maupun jamnya.
                    </p>
                  )}
                  <p className="text-sm">
                    Piket merupakan pengawasan umum dan tidak otomatis melarang
                    jadwal mengajar pada jam yang sama. Upacara dan kegiatan KBM
                    diperiksa bentroknya.
                  </p>
                  <label className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                    />
                    Jadwal aktif
                  </label>
                  <Field label="Alasan perubahan jadwal">
                    <textarea
                      className={input}
                      minLength={5}
                      maxLength={500}
                      required
                      value={scheduleReason}
                      onChange={(e) => setScheduleReason(e.target.value)}
                    />
                  </Field>
                  <div className="flex gap-2">
                    <button className={button} disabled={busy || loading}>
                      <ActionIcon action="save" />
                      Simpan jadwal tugas
                    </button>
                  </div>
                </fieldset>
                {uncertain && (
                  <p role="alert">
                    Periksa isian dan status terbaru sebelum mengirim ulang.
                    Tutup formulir, lalu muat ulang panel.
                  </p>
                )}
              </form>
            </FormDialog>
          )}
          <section className={panel}>
            <h2 className="font-semibold">
              Jadwal yang berlaku pada tanggal pilihan
            </h2>
            {!loading && board && !scheduleRows.length && (
              <p className="text-sm text-slate-600">
                Tidak ada jadwal yang sesuai tanggal dan pencarian.
              </p>
            )}
            {!loading &&
              scheduleRows
                .slice((currentSchedulePage - 1) * 12, currentSchedulePage * 12)
                .map((s) => (
                  <article
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <h3>
                        {labels[s.kind]} · {s.teacherName}
                      </h3>
                      <p className="text-sm">
                        {days[s.day_index]} · {s.valid_from}–{s.valid_to} ·{" "}
                        {s.time_start.slice(0, 5)}–{s.time_end.slice(0, 5)} ·{" "}
                        {s.active ? "Aktif" : "Nonaktif"}
                      </p>
                    </div>
                    <button
                      className={secondary}
                      disabled={
                        busy || loading || !!selected || s.valid_to < today
                      }
                      onClick={(e) => {
                        opener.current = e.currentTarget;
                        edit(s);
                      }}
                    >
                      <ActionIcon action="edit" />
                      Ubah jadwal tugas
                    </button>
                  </article>
                ))}
            {scheduleRows.length > 12 && (
              <nav
                aria-label="Halaman jadwal"
                className="flex flex-wrap items-center gap-3"
              >
                <button
                  className={secondary}
                  disabled={currentSchedulePage === 1}
                  onClick={() => setSchedulePage(currentSchedulePage - 1)}
                >
                  Sebelumnya
                </button>
                <span>
                  {currentSchedulePage} / {Math.ceil(scheduleRows.length / 12)}
                </span>
                <button
                  className={secondary}
                  disabled={currentSchedulePage * 12 >= scheduleRows.length}
                  onClick={() => setSchedulePage(currentSchedulePage + 1)}
                >
                  Berikutnya
                </button>
              </nav>
            )}
          </section>
        </>
      )}
    </div>
  );
}
