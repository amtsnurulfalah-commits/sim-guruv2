"use client";
import { useActivityDate } from "@/lib/navigation/use-activity-date";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Tabs } from "@/components/ui/tabs";
import { ActionIcon } from "@/components/ui/action-icon";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { EmptyState } from "@/components/feedback/feature-state";
import {
  control,
  primaryAction,
  secondaryAction,
  surface,
} from "@/components/ui/styles";
import { masterRequest } from "../masters/api";
import { ApiRequestError, downloadFile } from "../../lib/feedback/api-error";
import { wibDate } from "../../lib/calendar/schemas";
import { dayFilter } from "../../lib/activities/schemas";
import {
  attendanceOptionsSchema,
  attendanceTemplatesSchema,
  attendanceHistoryFilter,
  attendancePreviewSchema,
  readAttendanceResponse,
  verifyAttendanceList,
  verifyAttendanceMutation,
  validateAttendanceInput,
  attendancePermissions,
  type AttendanceRow,
  type AttendanceAction,
  type AttendanceTemplate,
} from "../../lib/activities/attendance-contracts";
import {
  AttendanceEditor,
  Field,
  days,
  type AttendanceSelection,
} from "./attendance-editor";
type Page = ReturnType<typeof verifyAttendanceList>;
const api = "/api/activities/";
const needsReload = (e: unknown) =>
  e instanceof ApiRequestError &&
  (["NETWORK_ERROR", "TIMEOUT", "INVALID_RESPONSE"].includes(e.code) ||
    e.status >= 500 ||
    [404, 409].includes(e.status));
export function AttendanceWorkspace({
  admin,
  userId,
}: {
  admin: boolean;
  userId: string;
}) {
  const [tab, setTab] = useState("daily"),
    [date, setDate] = useActivityDate(),
    [from, setFrom] = useState(wibDate().slice(0, 7) + "-01"),
    [to, setTo] = useState(wibDate),
    [filterTeacher, setFilterTeacher] = useState(""),
    [page, setPage] = useState(1),
    [dailyPage, setDailyPage] = useState(1),
    [revision, setRevision] = useState(0);
  const [daily, setDaily] = useState<Page | null>(null),
    [history, setHistory] = useState<Page | null>(null),
    [dailyLoading, setDailyLoading] = useState(true),
    [historyLoading, setHistoryLoading] = useState(true),
    [dailyError, setDailyError] = useState(""),
    [historyError, setHistoryError] = useState("");
  const [options, setOptions] = useState<z.infer<
      typeof attendanceOptionsSchema
    > | null>(null),
    [templates, setTemplates] = useState<AttendanceTemplate[] | null>(null),
    [optionsError, setOptionsError] = useState(""),
    [templateError, setTemplateError] = useState("");
  const [selection, setSelection] = useState<AttendanceSelection | null>(null),
    [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [templateId, setTemplateId] = useState(""),
    [now, setNow] = useState(() => Date.now());
  const mounted = useRef(false),
    pending = useRef(false),
    mutation = useRef<AbortController | null>(null),
    opener = useRef<HTMLButtonElement | null>(null);
  const today = wibDate(new Date(now));
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      mutation.current?.abort();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const c = new AbortController();
    async function load() {
      setOptionsError("");
      try {
        const value = readAttendanceResponse(
          attendanceOptionsSchema,
          await masterRequest<unknown>(
            api + "options",
            "GET",
            undefined,
            c.signal,
          ),
        );
        if (!c.signal.aborted) setOptions(value);
      } catch (e) {
        if (!c.signal.aborted) {
          setOptions(null);
          setOptionsError(
            e instanceof Error ? e.message : "Gagal memuat pilihan guru.",
          );
        }
      }
    }
    void load();
    return () => c.abort();
  }, [revision]);
  useEffect(() => {
    if (!admin) return;
    const c = new AbortController();
    async function load() {
      setTemplateError("");
      try {
        const value = readAttendanceResponse(
          attendanceTemplatesSchema,
          await masterRequest<unknown>(
            api + "templates",
            "GET",
            undefined,
            c.signal,
          ),
        );
        if (!c.signal.aborted) {
          setTemplates(value.items);
          setTemplateId((current) =>
            value.items.some((t) => t.id === current) ? current : "",
          );
        }
      } catch (e) {
        if (!c.signal.aborted) {
          setTemplates(null);
          setTemplateError(
            e instanceof Error ? e.message : "Gagal memuat pola kehadiran.",
          );
        }
      }
    }
    void load();
    return () => c.abort();
  }, [admin, revision]);
  useEffect(() => {
    const c = new AbortController();
    async function load() {
      setDaily(null);
      setDailyLoading(true);
      setDailyError("");
      try {
        if (!dayFilter.safeParse({ date }).success)
          throw Error("Pilih tanggal kegiatan yang valid.");
        const raw = await masterRequest<unknown>(
          api +
            "attendance?" +
            new URLSearchParams({
              from: date,
              to: date,
              page: String(dailyPage),
              pageSize: "25",
            }),
          "GET",
          undefined,
          c.signal,
        );
        const value = verifyAttendanceList(raw, {
          from: date,
          to: date,
          page: dailyPage,
          pageSize: 25,
          admin,
          userId,
        });
        if (!c.signal.aborted) {
          if (dailyPage > 1 && (dailyPage - 1) * 25 >= value.total) {
            setDailyPage(Math.max(1, Math.ceil(value.total / 25)));
            return;
          }
          setDaily(value);
        }
      } catch (e) {
        if (!c.signal.aborted)
          setDailyError(
            e instanceof Error ? e.message : "Gagal memuat kehadiran harian.",
          );
      } finally {
        if (!c.signal.aborted) setDailyLoading(false);
      }
    }
    void load();
    return () => c.abort();
  }, [date, dailyPage, revision, admin, userId]);
  useEffect(() => {
    const c = new AbortController();
    async function load() {
      setHistory(null);
      setHistoryLoading(true);
      setHistoryError("");
      try {
        const parsed = attendanceHistoryFilter.safeParse({
          from,
          to,
          page,
          pageSize: 25,
          ...(filterTeacher ? { userId: filterTeacher } : {}),
        });
        if (!parsed.success)
          throw Error(
            "Pilih rentang riwayat yang valid: tanggal akhir tidak sebelum tanggal mulai, maksimal 366 hari.",
          );
        const raw = await masterRequest<unknown>(
          api +
            "attendance?" +
            new URLSearchParams({
              from,
              to,
              page: String(page),
              pageSize: "25",
              ...(filterTeacher ? { userId: filterTeacher } : {}),
            }),
          "GET",
          undefined,
          c.signal,
        );
        const value = verifyAttendanceList(raw, {
          from,
          to,
          page,
          pageSize: 25,
          admin,
          userId,
          filterTeacher,
        });
        if (!c.signal.aborted) {
          if (page > 1 && (page - 1) * 25 >= value.total) {
            setPage(Math.max(1, Math.ceil(value.total / 25)));
            return;
          }
          setHistory(value);
        }
      } catch (e) {
        if (!c.signal.aborted)
          setHistoryError(
            e instanceof Error ? e.message : "Gagal memuat riwayat kehadiran.",
          );
      } finally {
        if (!c.signal.aborted) setHistoryLoading(false);
      }
    }
    void load();
    return () => c.abort();
  }, [from, to, page, filterTeacher, revision, admin, userId]);
  function refresh() {
    setBlocked(false);
    setError("");
    setDaily(null);
    setHistory(null);
    setDailyLoading(true);
    setHistoryLoading(true);
    setRevision((v) => v + 1);
  }
  function open(
    value: AttendanceSelection,
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    opener.current = event.currentTarget;
    setSelection(value);
    setError("");
  }
  function close() {
    setSelection(null);
    requestAnimationFrame(() => opener.current?.focus());
  }
  async function save(
    action: AttendanceAction,
    input: unknown,
    before: AttendanceRow | undefined,
    signal: AbortSignal,
  ) {
    if (pending.current || blocked)
      throw Error("Periksa status terbaru sebelum mengirim ulang.");
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = validateAttendanceInput(action, input, before);
      if (before && action !== "manual") {
        const allowed = attendancePermissions(before, {
          admin,
          userId,
          canOperate: options?.canOperate ?? false,
          now: new Date().getTime(),
        });
        if (
          (action === "in" && !allowed.in) ||
          (action === "out" && !allowed.out) ||
          (action === "leave" && !allowed.leave) ||
          (action === "delete-leave" && !allowed.deleteLeave)
        )
          throw Error(
            "Tindakan tidak tersedia pada tanggal, jam atau akses ini. Muat ulang.",
          );
      }
      if (action === "manual" && (payload as { date: string }).date > wibDate())
        throw Error(
          "Kehadiran manual tidak dapat dicatat untuk tanggal mendatang.",
        );
      if (
        action === "template-apply" &&
        selection?.kind === "apply" &&
        (Date.parse(selection.preview.expiresAt) <= new Date().getTime() ||
          selection.preview.date < wibDate())
      )
        throw Error(
          "Pratinjau kedaluwarsa atau tanggalnya sudah lewat. Tinjau ulang pola.",
        );
      const raw = await masterRequest<unknown>(
        api + action,
        "POST",
        payload,
        signal,
      );
      try {
        if (action === "template-save" || action === "template-delete") {
          const value = readAttendanceResponse(z.object({ id: z.uuid() }), raw);
          if (selection?.kind === "template") {
            const key = payload as { dayIndex: number; type: string };
            const original = selection.templates.find(
              (t) => t.day_index === key.dayIndex && t.sched_type === key.type,
            );
            if (original && value.id !== original.id)
              throw new ApiRequestError(
                "INVALID_RESPONSE",
                "Hasil pola tidak sesuai pola yang diubah. Muat ulang.",
              );
          }
        } else if (action === "template-apply") {
          const v = readAttendanceResponse(
            z.object({
              applied: z.literal(true),
              count: z.number().int().nonnegative(),
            }),
            raw,
          );
          if (
            selection?.kind === "apply" &&
            v.count !== selection.preview.participants.length
          )
            throw new ApiRequestError(
              "INVALID_RESPONSE",
              "Jumlah penerapan pola belum sesuai. Muat ulang untuk memeriksa status.",
            );
        } else verifyAttendanceMutation(raw, payload, before, action);
      } catch (e) {
        if (mounted.current) setBlocked(true);
        throw e;
      }
      if (mounted.current) {
        setMessage("Perubahan kehadiran berhasil disimpan.");
        refresh();
      }
    } catch (e) {
      if (mounted.current && needsReload(e)) setBlocked(true);
      throw e;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function preview(event: React.MouseEvent<HTMLButtonElement>) {
    if (pending.current || blocked) return;
    const t = templates?.find((t) => t.id === templateId);
    if (!t) return;
    opener.current = event.currentTarget;
    pending.current = true;
    setBusy(true);
    setError("");
    const c = new AbortController();
    mutation.current = c;
    try {
      if (
        date < today ||
        Date.parse(date) - Date.parse(today) > 365 * 86400000 ||
        new Date(date + "T00:00:00Z").getUTCDay() !== t.day_index
      )
        throw Error(
          "Pilih tanggal hari yang sesuai pola, antara hari ini dan 365 hari ke depan.",
        );
      const value = readAttendanceResponse(
        attendancePreviewSchema,
        await masterRequest<unknown>(
          api + "template-preview",
          "POST",
          validateAttendanceInput("template-preview", { date, templateId }),
          c.signal,
        ),
      );
      if (
        value.date !== date ||
        value.timeIn !== t.time_in.slice(0, 5) ||
        value.timeOut !== t.time_out.slice(0, 5)
      )
        throw new ApiRequestError(
          "INVALID_RESPONSE",
          "Pratinjau tidak sesuai tanggal atau pola yang dipilih. Muat ulang.",
        );
      if (mounted.current) setSelection({ kind: "apply", preview: value });
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "Gagal menyiapkan pratinjau.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function download(format: "csv" | "pdf") {
    if (pending.current || !history || historyLoading) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const c = new AbortController();
    mutation.current = c;
    try {
      await downloadFile(
        api +
          "export?" +
          new URLSearchParams({
            kind: "attendance",
            from,
            to,
            ...(filterTeacher ? { userId: filterTeacher } : {}),
            format,
          }),
        "attendance." + format,
        { signal: AbortSignal.any([c.signal, AbortSignal.timeout(40000)]) },
      );
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "Unduhan gagal. Coba kembali.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const disabled = busy || !!selection,
    actor = { admin, userId, canOperate: options?.canOperate ?? false, now };
  const cards = (rows: AttendanceRow[]) => (
    <AttendanceCards
      rows={rows}
      actor={actor}
      disabled={disabled || blocked}
      onOpen={open}
    />
  );
  return (
    <div
      className="min-w-0 space-y-6 [overflow-wrap:anywhere]"
      aria-busy={tab === "daily" ? dailyLoading : historyLoading}
    >
      <header>
        <h1 className="text-2xl font-bold">Kehadiran guru</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tanggal operasional memakai WIB. Jam hadir harian dan konfirmasi
          kegiatan merupakan bukti yang berbeda.
        </p>
      </header>
      {error && <ErrorFeedback message={error} />}{" "}
      {message && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-green-900">
          {message}
        </p>
      )}
      {blocked && (
        <p role="alert" className="rounded-lg border border-amber-300 p-3">
          Status penyimpanan perlu diperiksa. Tutup formulir dan muat ulang data
          sebelum mengirim ulang.
        </p>
      )}
      {optionsError && <ErrorFeedback message={optionsError} />}
      <div className="flex flex-wrap gap-3">
        <button
          className={secondaryAction}
          disabled={disabled}
          onClick={refresh}
        >
          <ActionIcon action="refresh" />
          Muat ulang
        </button>
        {admin && (
          <>
            <button
              className={primaryAction}
              disabled={disabled || !options}
              onClick={(e) =>
                open(
                  { kind: "manual", date, teachers: options?.teachers ?? [] },
                  e,
                )
              }
            >
              Kehadiran harian
            </button>
            <button
              className={secondaryAction}
              disabled={disabled || !templates}
              onClick={(e) =>
                open(
                  {
                    kind: "template",
                    templates: templates ?? [],
                    initialId: "",
                  },
                  e,
                )
              }
            >
              Pola jam kehadiran
            </button>
          </>
        )}
      </div>
      <Tabs
        label="Halaman kehadiran"
        value={tab}
        defaultValue="daily"
        onValueChange={(v) => {
          if (!disabled) setTab(v);
        }}
        items={[
          {
            value: "daily",
            label: "Kehadiran harian",
            icon: <ActionIcon action="access" />,
            content: (
              <>
                <section className={surface}>
                  <h2 className="font-semibold">Tanggal kegiatan dan input</h2>
                  <Field label="Tanggal kegiatan / input">
                    <input
                      aria-label="Tanggal kegiatan / input"
                      className={control}
                      type="date"
                      value={date}
                      disabled={disabled}
                      onChange={(e) => {
                        setDaily(null);
                        setDailyLoading(true);
                        setDate(e.target.value);
                        setDailyPage(1);
                      }}
                    />
                  </Field>
                  <p className="text-sm text-muted-foreground">
                    Masuk, pulang, dan izin tersedia untuk hari ini sesuai jam
                    serta hak akses. Koreksi admin dapat dilakukan pada tanggal
                    lampau yang belum dikunci.
                  </p>
                </section>
                <section className={surface}>
                  <h2 className="font-semibold">
                    Catatan pada tanggal {date || "pilihan"}
                  </h2>
                  {dailyLoading && (
                    <p role="status">Memuat kehadiran harian…</p>
                  )}
                  {dailyError && <ErrorFeedback message={dailyError} />}{" "}
                  {daily && !daily.items.length && (
                    <EmptyState
                      title="Belum ada catatan kehadiran pada tanggal ini"
                      description="Admin dapat menerapkan pola atau mencatat kehadiran manual sesuai penugasan."
                    />
                  )}
                  {daily && cards(daily.items)}
                  {daily && (
                    <Pagination
                      page={daily.page}
                      total={daily.total}
                      disabled={disabled || dailyLoading}
                      change={(v) => {
                        setDaily(null);
                        setDailyLoading(true);
                        setDailyPage(v);
                      }}
                      label="Halaman kehadiran harian"
                    />
                  )}
                </section>
                {admin && (
                  <section className={surface}>
                    <h2 className="font-semibold">
                      Terapkan pola kehadiran ke tanggal {date || "pilihan"}
                    </h2>
                    {templateError && <ErrorFeedback message={templateError} />}
                    <Field label="Pola kehadiran">
                      <select
                        aria-label="Pola kehadiran"
                        className={control}
                        value={templateId}
                        disabled={disabled || !templates}
                        onChange={(e) => setTemplateId(e.target.value)}
                      >
                        <option value="">Pilih pola…</option>
                        {templates?.map((t) => (
                          <option key={t.id} value={t.id}>
                            {days[t.day_index]} · {t.sched_type} ·{" "}
                            {t.time_in.slice(0, 5)}–{t.time_out.slice(0, 5)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <button
                      className={secondaryAction}
                      disabled={
                        disabled ||
                        blocked ||
                        !templates?.some((t) => t.id === templateId) ||
                        !date
                      }
                      onClick={(e) => void preview(e)}
                    >
                      Tinjau penerapan pola
                    </button>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      {templates?.map((t) => (
                        <article
                          className="min-w-0 space-y-2 rounded-lg border p-3"
                          key={t.id}
                        >
                          <h3 className="font-medium">
                            {days[t.day_index]} · {t.sched_type}
                          </h3>
                          <p className="text-sm">
                            {t.time_in.slice(0, 5)}–{t.time_out.slice(0, 5)}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              className={secondaryAction}
                              disabled={disabled}
                              onClick={(e) =>
                                open(
                                  {
                                    kind: "template",
                                    templates: templates ?? [],
                                    initialId: t.id,
                                  },
                                  e,
                                )
                              }
                            >
                              Ubah pola
                            </button>
                            <button
                              className={secondaryAction}
                              disabled={disabled}
                              onClick={(e) =>
                                open(
                                  {
                                    kind: "template",
                                    templates: templates ?? [],
                                    initialId: t.id,
                                    remove: true,
                                  },
                                  e,
                                )
                              }
                            >
                              Hapus pola
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    {templates?.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Belum ada pola KBM atau ujian. Tambahkan pola sebelum
                        meninjau peserta.
                      </p>
                    )}
                  </section>
                )}
              </>
            ),
          },
          {
            value: "history",
            label: "Riwayat kehadiran",
            icon: <ActionIcon action="history" />,
            content: (
              <>
                <section className={surface}>
                  <h2 className="font-semibold">Filter riwayat dan unduhan</h2>
                  <fieldset
                    disabled={disabled}
                    className="grid min-w-0 gap-4 sm:grid-cols-3"
                  >
                    <Field label="Riwayat mulai">
                      <input
                        aria-label="Riwayat mulai"
                        className={control}
                        type="date"
                        value={from}
                        onChange={(e) => {
                          setHistory(null);
                          setHistoryLoading(true);
                          setFrom(e.target.value);
                          setPage(1);
                        }}
                      />
                    </Field>
                    <Field label="Riwayat sampai">
                      <input
                        aria-label="Riwayat sampai"
                        className={control}
                        type="date"
                        value={to}
                        onChange={(e) => {
                          setHistory(null);
                          setHistoryLoading(true);
                          setTo(e.target.value);
                          setPage(1);
                        }}
                      />
                    </Field>
                    {admin && (
                      <Field label="Filter guru (kosong: semua)">
                        <select
                          aria-label="Filter guru (kosong: semua)"
                          className={control}
                          value={filterTeacher}
                          onChange={(e) => {
                            setHistory(null);
                            setHistoryLoading(true);
                            setFilterTeacher(e.target.value);
                            setPage(1);
                          }}
                        >
                          <option value="">Semua guru</option>
                          {options?.teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                  </fieldset>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className={secondaryAction}
                      disabled={disabled || historyLoading || !history}
                      onClick={() => void download("csv")}
                    >
                      Unduh CSV
                    </button>
                    <button
                      className={secondaryAction}
                      disabled={disabled || historyLoading || !history}
                      onClick={() => void download("pdf")}
                    >
                      Unduh PDF
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Unduhan mencakup seluruh hasil filter, bukan hanya halaman
                    yang ditampilkan.
                  </p>
                </section>
                <section className={surface}>
                  {historyLoading && <p role="status">Memuat riwayat…</p>}
                  {historyError && (
                    <ErrorFeedback message={historyError} />
                  )}{" "}
                  {history && !history.items.length && (
                    <EmptyState title="Belum ada catatan kehadiran pada rentang ini" />
                  )}
                  {history && cards(history.items)}
                  {history && (
                    <Pagination
                      page={history.page}
                      total={history.total}
                      disabled={disabled || historyLoading}
                      change={(v) => {
                        setHistory(null);
                        setHistoryLoading(true);
                        setPage(v);
                      }}
                      label="Halaman riwayat kehadiran"
                    />
                  )}
                </section>
              </>
            ),
          },
        ]}
      />
      {selection && (
        <AttendanceEditor
          selection={selection}
          blocked={blocked}
          now={now}
          onSave={save}
          onClose={close}
        />
      )}
    </div>
  );
}
function AttendanceCards({
  rows,
  actor,
  disabled,
  onOpen,
}: {
  rows: AttendanceRow[];
  actor: Parameters<typeof attendancePermissions>[1];
  disabled: boolean;
  onOpen: (
    selection: AttendanceSelection,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => void;
}) {
  return (
    <div className="space-y-3">
      {rows.map((d) => {
        const p = attendancePermissions(d, actor);
        return (
          <article
            key={d.id}
            className="min-w-0 space-y-3 rounded-xl border p-4"
          >
            <h3 className="font-semibold">
              {d.teacherName} · {d.date}
            </h3>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                Jadwal {d.scheduledIn ?? "—"}–{d.scheduledOut ?? "—"}
              </p>
              <p>
                Aktual {d.actualIn ?? "—"}–{d.actualOut ?? "—"}
              </p>
              <p>
                Efektif {d.effectiveMinutes.toFixed(1)} menit · rasio{" "}
                {d.ratio.toFixed(3)}
              </p>
              <p>
                {d.extra ? "Peserta tambahan · " : ""}Sumber jam masuk:{" "}
                {d.source ?? "Belum tercatat"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.in && (
                <button
                  className={secondaryAction}
                  disabled={disabled}
                  onClick={(e) => onOpen({ kind: "in", row: d }, e)}
                >
                  Catat masuk sekarang
                </button>
              )}
              {p.out && (
                <button
                  className={secondaryAction}
                  disabled={disabled}
                  onClick={(e) => onOpen({ kind: "out", row: d }, e)}
                >
                  Catat pulang
                </button>
              )}
              {p.leave && (
                <button
                  className={secondaryAction}
                  disabled={disabled}
                  onClick={(e) => onOpen({ kind: "leave", row: d }, e)}
                >
                  Ajukan izin keluar
                </button>
              )}
              {p.manual && (
                <button
                  className={secondaryAction}
                  disabled={disabled}
                  onClick={(e) =>
                    onOpen(
                      { kind: "manual", row: d, date: d.date, teachers: [] },
                      e,
                    )
                  }
                >
                  Koreksi kehadiran
                </button>
              )}
            </div>
            {d.leaves.map((l) => (
              <div
                key={l.id}
                className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 text-sm"
              >
                <p className="min-w-0 flex-1">
                  Izin {l.leaveTime}–{l.returnTime}: {l.reason}
                </p>
                {p.deleteLeave && (
                  <button
                    className={secondaryAction}
                    disabled={disabled}
                    onClick={(e) =>
                      onOpen({ kind: "delete-leave", row: d, leaveId: l.id }, e)
                    }
                  >
                    Hapus izin
                  </button>
                )}
              </div>
            ))}
          </article>
        );
      })}
    </div>
  );
}
function Pagination({
  page,
  total,
  disabled,
  change,
  label,
}: {
  page: number;
  total: number;
  disabled: boolean;
  change: (page: number) => void;
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <button
        className={secondaryAction}
        disabled={disabled || page <= 1}
        onClick={() => change(page - 1)}
      >
        Sebelumnya
      </button>
      <span className="text-sm">
        Halaman {page} · {total} catatan
      </span>
      <button
        className={secondaryAction}
        disabled={disabled || page * 25 >= total}
        onClick={() => change(page + 1)}
      >
        Berikutnya
      </button>
    </nav>
  );
}
