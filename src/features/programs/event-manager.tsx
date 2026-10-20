"use client";
import { EmptyState } from "@/components/feedback/feature-state";
import { FeatureState } from "@/components/feedback/feature-state";
import { useEffect, useState } from "react";
import { masterRequest } from "../masters/api";
import { wibDate } from "../../lib/calendar/schemas";
import type {
  EventBoard,
  EventDefinition,
  Impact,
} from "../../lib/programs/schemas";
import {
  DataForm,
  ImpactDialog,
  type Field,
  input,
  secondary,
  panel,
} from "./forms";
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
    [eventId, setEventId] = useState("");
  useEffect(() => {
    const c = new AbortController();
    masterRequest<EventBoard>(
      `/api/programs/read?domain=events&date=${date}`,
      "GET",
      undefined,
      c.signal,
    )
      .then(setBoard)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [date, revision]);
  const post = <T,>(action: string, data: unknown) =>
    masterRequest<T>("/api/programs/" + action, "POST", data);
  async function run(
    work: () => Promise<unknown>,
    refresh = true,
    propagate = false,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      if (refresh) {
        setRevision((v) => v + 1);
        setMessage("Perubahan berhasil disimpan.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Permintaan gagal.");
      if (propagate) throw e;
    } finally {
      setBusy(false);
    }
  }
  const formRun = (work: () => Promise<unknown>, refresh = true) =>
    run(work, refresh, true);
  if (!board)
    return (
      <FeatureState
        error={error}
        label="Memuat acara…"
        retry={() => setRevision((v) => v + 1)}
      />
    );
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
    ...(type === "rutin"
      ? [
          {
            key: "days",
            label: "Hari rutin",
            type: "days" as const,
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
        ]
      : [
          {
            key: "dates",
            label: "Tanggal insidental (satu tanggal YYYY-MM-DD per baris)",
            type: "dates" as const,
            value: edit?.dates,
          },
        ]),
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
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Kehadiran dan jurnal acara</h1>
      <p>
        Kehadiran tanpa jurnal bernilai 0 JTM. Jurnal H-1 mengikuti pengaturan
        madrasah dengan bobot 80%.
      </p>
      <label className="block max-w-xs">
        Tanggal
        <input
          className={input}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-green-800">
          {message}
        </p>
      )}
      {preview && (
        <ImpactDialog
          impact={{ ...preview }}
          busy={busy}
          onCancel={() => setPreview(null)}
          onConfirm={() =>
            void run(async () => {
              await post("event-delete", {
                previewId: preview.previewId,
                confirmed: true,
              });
              setPreview(null);
            })
          }
        />
      )}
      <section className={panel}>
        <h2 className="font-semibold">Acara tanggal terpilih</h2>
        {board.today.length === 0 && <p>Tidak ada acara pada tanggal ini.</p>}
        {board.today.map((e) => (
          <article key={e.id}>
            <h3 className="font-medium">{e.name}</h3>
            <p>
              {e.time_start}–{e.time_end} · {e.jtm} JTM · {e.description}
            </p>
          </article>
        ))}
      </section>
      {board.canOperate && (
        <section className={panel}>
          <h2 className="font-semibold">Catat kehadiran peserta</h2>
          <DataForm
            key={date + revision}
            busy={busy}
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
            onSave={async (data) =>
              formRun(() =>
                post("attendance", { operation: "attend", date, ...data }),
              )
            }
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
        {board.attendance.map((a) => (
          <article key={a.id} className="space-y-2 border-b pb-4">
            <h3 className="font-semibold">
              {a.date} · {a.eventName} · {a.teacherName}
            </h3>
            <p>
              Masuk {a.time_in} ·{" "}
              {a.cancelled_at
                ? "Dibatalkan"
                : a.journal
                  ? "Jurnal tersimpan"
                  : "Belum mengisi jurnal"}{" "}
              · {a.cancelled_at ? "0" : a.creditedJtm} JTM
            </p>
            {a.journal && <p>{a.journal}</p>}
            {a.user_id === userId && !a.cancelled_at && !a.journal && (
              <DataForm
                key={a.id + a.version}
                busy={busy}
                label="Tulis jurnal acara"
                submitLabel="Kirim jurnal acara"
                fields={[
                  {
                    key: "description",
                    label: "Uraian kegiatan (maksimal 1.000 karakter)",
                    type: "textarea",
                  },
                ]}
                onSave={async (data) =>
                  formRun(() =>
                    post("journal", {
                      attendanceId: a.id,
                      version: a.version,
                      ...data,
                    }),
                  )
                }
              />
            )}
            {board.canOperate &&
              a.date === date &&
              !a.cancelled_at &&
              !a.journal && (
                <button
                  disabled={busy}
                  className={secondary}
                  onClick={() =>
                    void run(() =>
                      post("attendance", {
                        operation: "cancel",
                        attendanceId: a.id,
                        version: a.version,
                        reason: "Pembatalan kehadiran acara oleh petugas",
                      }),
                    )
                  }
                >
                  Batalkan kehadiran
                </button>
              )}
          </article>
        ))}
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
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
              >
                <option value="rutin">Rutin</option>
                <option value="insidental">Insidental</option>
              </select>
            </label>
            {edit && (
              <button className={secondary} onClick={() => setEdit(null)}>
                Batal mengubah acara
              </button>
            )}
            <DataForm
              description={
                "Acara " +
                type +
                ". Periksa tanggal, waktu, dan sasaran sebelum menyimpan."
              }
              openOnMount={Boolean(edit)}
              onDismiss={() => setEdit(null)}
              key={(edit?.id ?? "new") + type}
              busy={busy}
              label={edit ? "Ubah acara" : "Tambah acara"}
              submitLabel="Simpan acara"
              fields={masterFields}
              onSave={async (values) => {
                const { reason, ...data } = values;
                await formRun(async () => {
                  await post("event-save", {
                    id: edit?.id,
                    version: edit?.version ?? "0",
                    reason,
                    data: {
                      ...data,
                      type,
                      days: data.days ?? [],
                      dates: data.dates ?? [],
                      description: data.description ?? "",
                    },
                  });
                  setEdit(null);
                });
              }}
            />
            {board.events.map((e) => (
              <article
                key={e.id}
                className="flex flex-wrap items-center gap-3 border-t pt-3"
              >
                <span>
                  {e.name} · {e.type} · {e.date_start}–{e.date_end}
                </span>
                <button
                  className={secondary}
                  onClick={() => {
                    setEdit(e);
                    setType(e.type);
                  }}
                >
                  Ubah acara
                </button>
                <button
                  disabled={busy}
                  className={secondary}
                  onClick={() =>
                    void run(
                      async () =>
                        setPreview(
                          await post<Impact>("event-delete", {
                            entity: "event",
                            id: e.id,
                            reason:
                              "Penghapusan definisi acara oleh administrator",
                          }),
                        ),
                      false,
                    )
                  }
                >
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
              label="Tambah blokir jurnal acara"
              submitLabel="Aktifkan blokir jurnal"
              fields={[
                {
                  key: "eventType",
                  label: "Jenis acara",
                  type: "select",
                  optional: true,
                  options: [
                    { id: "", name: "Semua jenis" },
                    { id: "rutin", name: "Rutin" },
                    { id: "insidental", name: "Insidental" },
                  ],
                },
                { key: "dateStart", label: "Mulai", type: "date", value: date },
                { key: "dateEnd", label: "Sampai", type: "date", value: date },
                { key: "message", label: "Pesan blok" },
                reason,
              ]}
              onSave={async (data) =>
                formRun(() =>
                  post("block", {
                    eventId: eventId || null,
                    version: "0",
                    active: true,
                    ...data,
                  }),
                )
              }
            />
            {board.blocks.map((b) => (
              <div key={b.id}>
                <p>
                  {b.date_start}–{b.date_end}: {b.message} (
                  {b.active ? "Aktif" : "Nonaktif"})
                </p>
                <button
                  disabled={busy}
                  className={secondary}
                  onClick={() =>
                    void run(() =>
                      post("block", {
                        id: b.id,
                        eventId: b.event_id,
                        eventType: b.event_type,
                        version: b.version,
                        dateStart: b.date_start,
                        dateEnd: b.date_end,
                        message: b.message,
                        active: !b.active,
                        reason: "Perubahan status blok jurnal acara",
                      }),
                    )
                  }
                >
                  {b.active ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
