"use client";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { ActionIcon } from "@/components/ui/action-icon";

import { EmptyState } from "@/components/feedback/feature-state";
import { FeatureState } from "@/components/feedback/feature-state";
import { useEffect, useRef, useState } from "react";
import { masterRequest } from "../masters/api";
import { wibDate } from "../../lib/calendar/schemas";
import type {
  EventBoard,
  EventDefinition,
  Impact,
} from "../../lib/programs/schemas";
import { DataForm, type Field, input, secondary, panel } from "./forms";
import { z } from "zod";
import { ApiRequestError } from "../../lib/feedback/api-error";
import { FormDialog } from "@/components/ui/dialog";
import { primaryAction } from "@/components/ui/styles";
import {
  eventAttendanceSchema,
  eventBlockSchema,
  eventJournalSchema,
} from "../../lib/programs/schemas";
import {
  eventBoardSchema,
  eventDefinitionSchema,
  eventAttendanceResponseSchema,
  eventBlockResponseSchema,
  eventJournalResponseSchema,
  eventDeletePreviewSchema,
  readEventResponse,
  validateEventSave,
  eventJournalDateMessage,
} from "../../lib/programs/event-contracts";
const reason: Field = {
  key: "reason",
  label: "Alasan perubahan (5–500 karakter)",
};
export function EventManager({
  admin,
  userId,
}: {
  admin: boolean;
  userId: string;
}) {
  const [date, setDate] = useState(wibDate()),
    [board, setBoard] = useState<EventBoard | null>(null),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [edit, setEdit] = useState<EventDefinition | null>(null),
    [type, setType] = useState<"rutin" | "insidental">("rutin"),
    [preview, setPreview] = useState<Impact | null>(null),
    [eventId, setEventId] = useState(""),
    [loading, setLoading] = useState(true),
    [activeForm, setActiveForm] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [now, setNow] = useState(() => Date.now()),
    [previewSubject, setPreviewSubject] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const pending = useRef(false),
    mounted = useRef(true),
    writes = useRef<AbortController | null>(null),
    opener = useRef<HTMLElement | null>(null);
  const today = wibDate(new Date(now));
  useEffect(() => {
    mounted.current = true;
    writes.current = new AbortController();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      writes.current?.abort();
      clearInterval(timer);
    };
  }, []);
  const visibility = (open: boolean) => setActiveForm(open);
  const restoreFocus = () =>
    requestAnimationFrame(
      () => opener.current?.isConnected && opener.current.focus(),
    );
  useEffect(() => {
    const c = new AbortController();
    queueMicrotask(() => {
      if (!c.signal.aborted) {
        setLoading(true);
        setError("");
      }
    });
    masterRequest<unknown>(
      `/api/programs/read?domain=events&date=${date}`,
      "GET",
      undefined,
      c.signal,
    )
      .then((raw) => {
        if (c.signal.aborted) return;
        const result = readEventResponse(eventBoardSchema, raw);
        if (result.date !== date)
          throw new ApiRequestError(
            "INVALID_RESPONSE",
            "Tanggal data tidak sesuai. Muat ulang acara.",
          );
        setBoard(result);
        setUncertain(false);
        setLoading(false);
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setBoard(null);
          setLoading(false);
          setError(e instanceof Error ? e.message : "Gagal memuat acara.");
        }
      });
    return () => c.abort();
  }, [date, revision]);
  const post = <T,>(action: string, data: unknown) =>
    masterRequest<T>(
      "/api/programs/" + action,
      "POST",
      data,
      writes.current?.signal,
    );
  async function run(
    work: () => Promise<unknown>,
    refresh = true,
    propagate = false,
  ) {
    if (pending.current || loading || uncertain) {
      if (propagate) throw Error("Muat ulang data sebelum melanjutkan.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      if (!mounted.current) return;
      if (refresh) {
        setLoading(true);
        setRevision((v) => v + 1);
        setMessage("Perubahan berhasil disimpan.");
      }
    } catch (e) {
      if (!mounted.current) return;
      setError(
        e instanceof z.ZodError
          ? (e.issues[0]?.message ?? "Periksa isian formulir.")
          : e instanceof Error
            ? e.message
            : "Permintaan gagal.",
      );
      if (
        e instanceof ApiRequestError &&
        ([
          "NETWORK_ERROR",
          "TIMEOUT",
          "INVALID_RESPONSE",
          "VERSION_CONFLICT",
          "PREVIEW_STALE",
        ].includes(e.code) ||
          e.status >= 500 ||
          e.status === 409 ||
          e.status === 404)
      )
        setUncertain(true);
      if (propagate) throw e;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const formRun = (work: () => Promise<unknown>, refresh = true) =>
    run(work, refresh, true);
  if (!board || (loading && !activeForm))
    return (
      <FeatureState
        error={error}
        label="Memuat acara…"
        retry={() => setRevision((v) => v + 1)}
      />
    );
  const blocked = busy || loading || uncertain;
  const history = board.attendance.filter((a) =>
    (a.eventName + " " + a.teacherName + " " + a.date + " " + (a.journal ?? ""))
      .toLocaleLowerCase("id")
      .includes(search.toLocaleLowerCase("id")),
  );
  const pages = Math.max(1, Math.ceil(history.length / 12)),
    currentPage = Math.min(page, pages);
  const masterFields: Field[] = [
    { key: "name", label: "Nama acara", value: edit?.name },
    {
      key: "dateStart",
      label: "Berlaku mulai",
      type: "date",
      value: edit?.date_start ?? date,
    },
    {
      key: "dateEnd",
      label: "Berlaku sampai",
      type: "date",
      value: edit?.date_end ?? date,
    },
    {
      key: "type",
      label: "Jenis acara",
      type: "select",
      value: edit?.type ?? type,
      options: [
        { id: "rutin", name: "Rutin" },
        { id: "insidental", name: "Insidental" },
      ],
    },
    {
      key: "days",
      label: "Hari rutin (khusus acara rutin)",
      type: "days",
      optional: true,
      value: edit?.days,
      options: [
        "Minggu",
        "Senin",
        "Selasa",
        "Rabu",
        "Kamis",
        "Jumat",
        "Sabtu",
      ].map((name, i) => ({ id: String(i), name })),
    },
    {
      key: "dates",
      label: "Tanggal insidental (satu tanggal YYYY-MM-DD per baris)",
      type: "dates",
      optional: true,
      value: edit?.dates,
    },
    {
      key: "timeStart",
      label: "Mulai",
      type: "time",
      value: edit?.time_start.slice(0, 5),
    },
    {
      key: "timeEnd",
      label: "Selesai",
      type: "time",
      value: edit?.time_end.slice(0, 5),
    },
    {
      key: "jtm",
      label: "JTM acara",
      type: "number",
      min: 1,
      max: 99,
      value: edit?.jtm ?? 1,
    },
    {
      key: "description",
      label: "Deskripsi",
      type: "textarea",
      optional: true,
      value: edit?.description ?? "",
    },
    reason,
  ];
  return (
    <div
      className="min-w-0 space-y-5 [overflow-wrap:anywhere]"
      aria-busy={busy || loading}
    >
      <h1 className="text-2xl font-semibold">Kehadiran dan jurnal acara</h1>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        Kehadiran tanpa jurnal bernilai 0 JTM. Jurnal H-1 mengikuti pengaturan
        madrasah dengan bobot 80%.
      </p>
      <label className="block max-w-xs">
        Tanggal
        <input
          className={input}
          type="date"
          aria-label="Tanggal acara"
          disabled={busy || activeForm || Boolean(preview)}
          value={date}
          onChange={(e) => {
            if (!e.target.value) return;
            setDate(e.target.value);
            setEdit(null);
            setEventId("");
            setPreview(null);
            setPage(1);
            setMessage("");
            setLoading(true);
          }}
        />
      </label>
      {error && !preview && <ErrorFeedback message={error} />}
      {date !== today && board.canOperate && (
        <p role="status" className="rounded-lg border bg-muted/30 p-3 text-sm">
          Tanggal ini hanya untuk melihat riwayat. Pencatatan dan pembatalan
          kehadiran tersedia pada hari ini (WIB).
        </p>
      )}
      {message && (
        <p role="status" className="text-green-800">
          {message}
        </p>
      )}
      {uncertain && (
        <div role="alert" className="rounded-lg border border-amber-500 p-4">
          Status perubahan belum pasti atau data sudah berubah. Tutup formulir,
          lalu muat ulang dan periksa hasil sebelum mengirim ulang.
          <button
            className={secondary}
            disabled={busy || activeForm}
            onClick={() => {
              setPreview(null);
              setRevision((v) => v + 1);
            }}
          >
            Muat ulang acara
          </button>
        </div>
      )}
      {preview && (
        <FormDialog
          trigger=""
          open
          title="Konfirmasi penghapusan acara"
          description={previewSubject}
          busy={busy}
          error={error}
          onOpenChange={(open) => {
            if (!open) {
              setPreview(null);
              restoreFocus();
            }
          }}
          footer={
            <button
              className={primaryAction}
              disabled={blocked || Date.parse(preview.expiresAt) <= now}
              onClick={() =>
                void run(async () => {
                  if (Date.parse(preview.expiresAt) <= Date.now())
                    throw Error("Pratinjau kedaluwarsa. Buat pratinjau baru.");
                  const result = await post<unknown>("event-delete", {
                    previewId: preview.previewId,
                    confirmed: true,
                  });
                  readEventResponse(
                    z.object({ deleted: z.literal(true) }),
                    result,
                  );
                  setPreview(null);
                  setEventId("");
                  restoreFocus();
                })
              }
            >
              Konfirmasi penghapusan
            </button>
          }
        >
          <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
            <p>
              Acara akan diarsipkan, kehadiran dan jurnal terkait dibatalkan,
              serta kredit JTM dibalik. Riwayat tetap disimpan.
            </p>
            <dl className="grid gap-3 sm:grid-cols-3">
              {[
                ["Kehadiran", preview.attendance],
                ["Jurnal", preview.journals],
                ["JTM bersih yang dibalik", preview.netJtm],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border p-3">
                  <dt>{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <p>
              Berlaku sampai{" "}
              {new Date(preview.expiresAt).toLocaleTimeString("id-ID", {
                timeZone: "Asia/Jakarta",
              })}{" "}
              WIB.
            </p>
            {Date.parse(preview.expiresAt) <= now && (
              <p role="alert">
                Pratinjau kedaluwarsa. Batalkan dan tinjau ulang penghapusan.
              </p>
            )}
          </div>
        </FormDialog>
      )}
      <section className={panel}>
        <h2 className="font-semibold">Acara tanggal terpilih</h2>
        {board.today.length === 0 && <p>Tidak ada acara pada tanggal ini.</p>}
        {board.today.map((e) => (
          <article
            key={e.id}
            className="min-w-0 space-y-1 rounded-xl border bg-muted/20 p-4"
          >
            <h3 className="font-medium">{e.name}</h3>
            <p>
              {e.time_start.slice(0, 5)}–{e.time_end.slice(0, 5)} · {e.jtm} JTM
              · {e.description}
            </p>
          </article>
        ))}
      </section>
      {board.canOperate &&
        (date === today || activeForm) &&
        ((board.today.length > 0 && board.teachers.length > 0) ||
          activeForm) && (
          <section className={panel}>
            <h2 className="font-semibold">Catat kehadiran peserta</h2>
            <DataForm
              key={date + revision}
              busy={busy}
              locked={blocked || date !== today}
              onVisibilityChange={visibility}
              label="Catat kehadiran peserta"
              submitLabel="Simpan kehadiran"
              fields={[
                {
                  key: "eventId",
                  label: "Acara",
                  type: "select",
                  options: board.today,
                },
                {
                  key: "userId",
                  label: "Peserta guru",
                  type: "select",
                  options: board.teachers,
                },
                { key: "timeIn", label: "Jam masuk acara", type: "time" },
                reason,
              ]}
              description="Sesuai aturan server, kehadiran hanya dicatat hari ini (WIB). Jam masuk harus dalam waktu acara."
              onSave={async (data) => {
                const v = eventAttendanceSchema.parse({
                  operation: "attend",
                  date,
                  ...data,
                });
                if (v.operation !== "attend" || date !== wibDate())
                  throw Error("Kehadiran hanya dapat dicatat hari ini (WIB).");
                const e = board.today.find((e) => e.id === v.eventId);
                if (
                  !e ||
                  v.timeIn < e.time_start.slice(0, 5) ||
                  v.timeIn >= e.time_end.slice(0, 5)
                )
                  throw new z.ZodError([
                    {
                      code: "custom",
                      path: ["timeIn"],
                      message:
                        "Jam masuk harus mulai dari jam mulai hingga sebelum jam selesai acara.",
                    },
                  ]);
                if (
                  board.attendance.some(
                    (a) =>
                      a.event_id === v.eventId &&
                      a.user_id === v.userId &&
                      a.date === date &&
                      !a.cancelled_at,
                  )
                )
                  throw new z.ZodError([
                    {
                      code: "custom",
                      path: ["userId"],
                      message: "Peserta sudah tercatat hadir pada acara ini.",
                    },
                  ]);
                await formRun(async () => {
                  const r = readEventResponse(
                    eventAttendanceResponseSchema,
                    await post("attendance", v),
                  );
                  if (
                    r.event_id !== v.eventId ||
                    r.user_id !== v.userId ||
                    r.date !== date ||
                    r.cancelled_at
                  )
                    throw new ApiRequestError(
                      "INVALID_RESPONSE",
                      "Hasil kehadiran tidak sesuai. Muat ulang sebelum mengirim ulang.",
                    );
                });
              }}
            />
          </section>
        )}
      <section className={panel}>
        <h2 className="font-semibold">
          Riwayat kehadiran dan jurnal bulan terpilih
        </h2>
        {board.attendance.length === 0 && (
          <EmptyState title="Belum ada riwayat." />
        )}
        <label className="block text-sm">
          Cari riwayat
          <input
            className={input}
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            disabled={activeForm || busy}
          />
        </label>
        {board.attendance.length > 0 && !history.length && (
          <EmptyState title="Tidak ada riwayat yang cocok." />
        )}
        {history.slice((currentPage - 1) * 12, currentPage * 12).map((a) => (
          <article key={a.id} className="space-y-2 border-b pb-4">
            <h3 className="font-semibold">
              {a.date} · {a.eventName} · {a.teacherName}
            </h3>
            <p>
              Masuk {a.time_in.slice(0, 5)} ·{" "}
              {a.cancelled_at
                ? "Dibatalkan"
                : a.journal
                  ? "Jurnal tersimpan"
                  : "Belum mengisi jurnal"}{" "}
              · {a.cancelled_at ? "0" : a.creditedJtm} JTM
            </p>
            {a.journal && <p className="whitespace-pre-wrap">{a.journal}</p>}
            {a.user_id === userId &&
              !a.cancelled_at &&
              !a.journal &&
              eventJournalDateMessage(a.date, today) && (
                <p className="text-sm text-muted-foreground">
                  {eventJournalDateMessage(a.date, today)}
                </p>
              )}
            {a.user_id === userId &&
              !a.cancelled_at &&
              !a.journal &&
              (!eventJournalDateMessage(a.date, today) || activeForm) && (
                <DataForm
                  key={a.id + a.version}
                  busy={busy}
                  locked={
                    blocked || Boolean(eventJournalDateMessage(a.date, today))
                  }
                  onVisibilityChange={visibility}
                  description={
                    a.eventName +
                    " · " +
                    a.date +
                    " · Jurnal H-1 berbobot 80% jika diizinkan pengaturan madrasah. Blokir dan periode final diperiksa server."
                  }
                  label="Tulis jurnal acara"
                  submitLabel="Kirim jurnal acara"
                  fields={[
                    {
                      key: "description",
                      label: "Uraian kegiatan (maksimal 1.000 karakter)",
                      type: "textarea",
                    },
                  ]}
                  onSave={async (data) => {
                    const v = eventJournalSchema.parse({
                      attendanceId: a.id,
                      version: a.version,
                      ...data,
                    });
                    const unavailable = eventJournalDateMessage(
                      a.date,
                      wibDate(),
                    );
                    if (unavailable) throw Error(unavailable);
                    await formRun(async () => {
                      const r = readEventResponse(
                        eventJournalResponseSchema,
                        await post("journal", v),
                      );
                      if (
                        r.attendance_id !== a.id ||
                        r.description !== v.description
                      )
                        throw new ApiRequestError(
                          "INVALID_RESPONSE",
                          "Hasil jurnal tidak sesuai. Muat ulang sebelum mengirim ulang.",
                        );
                    });
                  }}
                />
              )}
            {board.canOperate &&
              a.date === date &&
              (date === today || activeForm) &&
              !a.cancelled_at &&
              !a.journal && (
                <DataForm
                  busy={busy}
                  locked={blocked || date !== today}
                  onVisibilityChange={visibility}
                  label="Batalkan kehadiran"
                  submitLabel="Konfirmasi pembatalan kehadiran"
                  description={
                    a.eventName +
                    " · " +
                    a.teacherName +
                    " · " +
                    a.date +
                    ". Kehadiran tanpa jurnal ini akan dibatalkan."
                  }
                  fields={[reason]}
                  onSave={async (data) => {
                    if (date !== wibDate())
                      throw Error(
                        "Pembatalan hanya dapat dilakukan hari ini (WIB).",
                      );
                    const v = eventAttendanceSchema.parse({
                      operation: "cancel",
                      attendanceId: a.id,
                      version: a.version,
                      ...data,
                    });
                    await formRun(async () => {
                      const r = readEventResponse(
                        eventAttendanceResponseSchema,
                        await post("attendance", v),
                      );
                      if (
                        r.id !== a.id ||
                        !r.cancelled_at ||
                        BigInt(r.version) <= BigInt(a.version)
                      )
                        throw new ApiRequestError(
                          "INVALID_RESPONSE",
                          "Pembatalan belum dapat diverifikasi. Muat ulang acara.",
                        );
                    });
                  }}
                />
              )}
          </article>
        ))}
        {history.length > 12 && (
          <nav
            aria-label="Halaman riwayat acara"
            className="flex flex-wrap items-center gap-3"
          >
            <button
              className={secondary}
              disabled={currentPage === 1 || activeForm || busy}
              onClick={() => setPage(currentPage - 1)}
            >
              Sebelumnya
            </button>
            <span>
              Halaman {currentPage} dari {pages} · {history.length} riwayat
            </span>
            <button
              className={secondary}
              disabled={currentPage === pages || activeForm || busy}
              onClick={() => setPage(currentPage + 1)}
            >
              Berikutnya
            </button>
          </nav>
        )}
      </section>
      {admin && (
        <>
          <section className={panel}>
            <h2 className="font-semibold">
              {edit ? "Ubah" : "Tambah"} definisi acara
            </h2>
            <label>
              Jenis acara
              <select
                className={input}
                disabled={blocked || activeForm || Boolean(edit)}
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
              >
                <option value="rutin">Rutin</option>
                <option value="insidental">Insidental</option>
              </select>
            </label>
            {edit && (
              <button className={secondary} onClick={() => setEdit(null)}>
                <ActionIcon action="close" />
                Batal mengubah acara
              </button>
            )}
            <DataForm
              description={
                "Pilih hari untuk acara rutin, atau tanggal untuk acara insidental. Kosongkan pilihan jenis lainnya. Periksa rentang tanggal dan waktu sebelum menyimpan."
              }
              openOnMount={Boolean(edit)}
              onVisibilityChange={visibility}
              locked={blocked}
              onDismiss={() => {
                setEdit(null);
                restoreFocus();
              }}
              key={(edit?.id ?? "new") + type}
              busy={busy}
              label={edit ? "Ubah acara" : "Tambah acara"}
              submitLabel="Simpan acara"
              fields={masterFields}
              onSave={async (values) => {
                const { reason, ...data } = values;
                await formRun(async () => {
                  const v = validateEventSave(
                    {
                      id: edit?.id,
                      version: edit?.version ?? "0",
                      reason,
                      data: {
                        ...data,
                        type: data.type,
                        days: data.days ?? [],
                        dates: data.dates ?? [],
                        description: data.description ?? "",
                      },
                    },
                    wibDate(),
                    edit,
                  );
                  const r = readEventResponse(
                    eventDefinitionSchema,
                    await post("event-save", v),
                  );
                  if (
                    (v.id && r.id !== v.id) ||
                    r.name !== v.data.name ||
                    r.type !== v.data.type ||
                    r.date_start !== v.data.dateStart ||
                    r.date_end !== v.data.dateEnd ||
                    BigInt(r.version) <= BigInt(v.version)
                  )
                    throw new ApiRequestError(
                      "INVALID_RESPONSE",
                      "Penyimpanan acara belum dapat diverifikasi. Muat ulang acara.",
                    );
                  setEdit(null);
                  restoreFocus();
                });
              }}
            />
            {board.events.length === 0 && (
              <EmptyState
                title="Belum ada definisi acara."
                description="Tambahkan acara rutin atau insidental untuk mulai mencatat kehadiran."
              />
            )}
            {board.events.map((e) => (
              <article
                key={e.id}
                className="flex min-w-0 flex-wrap items-center gap-3 border-t pt-3"
              >
                <span className="min-w-0 flex-1 basis-56">
                  {e.name} · {e.type} · {e.date_start}–{e.date_end}
                </span>
                <button
                  className={secondary}
                  disabled={blocked || activeForm}
                  onClick={(event) => {
                    opener.current = event.currentTarget;
                    setActiveForm(true);
                    setEdit(e);
                    setType(e.type);
                  }}
                >
                  <ActionIcon action="edit" />
                  Ubah acara
                </button>
                <button
                  disabled={blocked || activeForm}
                  className={secondary}
                  onClick={(event) => {
                    opener.current = event.currentTarget;
                    void run(async () => {
                      const result = readEventResponse(
                        eventDeletePreviewSchema,
                        await post<unknown>("event-delete", {
                          entity: "event",
                          id: e.id,
                          reason:
                            "Penghapusan definisi acara oleh administrator",
                        }),
                      );
                      setPreviewSubject(
                        e.name + " · " + e.date_start + "–" + e.date_end,
                      );
                      setPreview(result);
                    }, false);
                  }}
                >
                  <ActionIcon action="preview" />
                  Tinjau penghapusan acara
                </button>
              </article>
            ))}
          </section>
          <section className={panel}>
            <h2 className="font-semibold">Blok pengisian jurnal acara</h2>
            <label>
              Acara
              <select
                className={input}
                aria-label="Sasaran blokir acara"
                disabled={blocked || activeForm}
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              >
                <option value="">Semua acara</option>
                {board.events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <DataForm
              key={date + revision}
              busy={busy}
              locked={blocked}
              onVisibilityChange={visibility}
              label="Tambah blokir jurnal acara"
              submitLabel="Aktifkan blokir jurnal"
              fields={[
                {
                  key: "eventType",
                  label: "Jenis acara",
                  type: "select",
                  optional: true,
                  options: [
                    { id: "rutin", name: "Rutin" },
                    { id: "insidental", name: "Insidental" },
                  ],
                },
                { key: "dateStart", label: "Mulai", type: "date", value: date },
                { key: "dateEnd", label: "Sampai", type: "date", value: date },
                {
                  key: "message",
                  label: "Pesan blok (5–500 karakter)",
                  type: "textarea",
                },
                reason,
              ]}
              onSave={async (data) => {
                const v = eventBlockSchema.parse({
                  eventId: eventId || null,
                  version: "0",
                  active: true,
                  ...data,
                });
                await formRun(async () => {
                  readEventResponse(
                    eventBlockResponseSchema,
                    await post("block", v),
                  );
                });
              }}
            />
            {board.blocks.length === 0 && (
              <EmptyState title="Tidak ada blokir jurnal acara." />
            )}
            {board.blocks.map((b) => (
              <div
                key={b.id}
                className="min-w-0 space-y-3 rounded-xl border p-4"
              >
                <p>
                  {b.event_id
                    ? (board.events.find((e) => e.id === b.event_id)?.name ??
                      "Acara diarsipkan")
                    : "Semua acara"}{" "}
                  · {b.event_type ?? "Semua jenis"} · {b.date_start}–
                  {b.date_end}: {b.message} ({b.active ? "Aktif" : "Nonaktif"})
                </p>
                <button
                  disabled={blocked || activeForm}
                  className={secondary}
                  onClick={() =>
                    void run(async () => {
                      const v = eventBlockSchema.parse({
                        id: b.id,
                        eventId: b.event_id,
                        eventType: b.event_type,
                        version: b.version,
                        dateStart: b.date_start,
                        dateEnd: b.date_end,
                        message: b.message,
                        active: !b.active,
                        reason: "Perubahan status blok jurnal acara",
                      });
                      const r = readEventResponse(
                        eventBlockResponseSchema,
                        await post("block", v),
                      );
                      if (
                        r.id !== b.id ||
                        r.active === b.active ||
                        BigInt(r.version) <= BigInt(b.version)
                      )
                        throw new ApiRequestError(
                          "INVALID_RESPONSE",
                          "Status blokir belum dapat diverifikasi. Muat ulang acara.",
                        );
                    })
                  }
                >
                  <ActionIcon action="toggle" />
                  {b.active
                    ? "Nonaktifkan blok jurnal"
                    : "Aktifkan blok jurnal"}
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
