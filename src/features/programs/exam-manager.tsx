"use client";
import { useActivityDate } from "@/lib/navigation/use-activity-date";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { ActionIcon } from "@/components/ui/action-icon";

import { TableRegion } from "@/components/ui/table-region";
import { FeatureState } from "@/components/feedback/feature-state";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  examBoardSchema,
  examBapSchema,
  examOccurrenceSchema,
  examPreviewSchema,
  examDeletePreviewSchema,
  readExamResponse,
  examOperations,
  bapAvailability,
  validateBap,
  validateExamOperation,
  validateExamSave,
  verifyExamSave,
} from "../../lib/programs/exam-contracts";
import { ExamImpactDialog } from "./exam-impact-dialog";
import { masterRequest } from "../masters/api";
import { wibDate } from "../../lib/calendar/schemas";
import type {
  ExamBoard,
  ExamOccurrence,
  Impact,
} from "../../lib/programs/schemas";
import { DataForm, type Field, input, secondary, panel } from "./forms";
const names = {
  period: "Periode",
  session: "Sesi",
  room: "Ruang",
  supervisor: "Pengawas",
  committee: "Panitia",
};
type Entity = keyof typeof names;
const reason: Field = {
  key: "reason",
  label: "Alasan perubahan (5–500 karakter)",
};
const ops: Record<string, string> = {
  confirm: "Konfirmasi",
  revoke: "Cabut konfirmasi",
  substitute: "Tunjuk pengganti",
  replace: "Ganti pengganti",
  "cancel-substitute": "Batalkan pengganti",
  adjust: "Sesuaikan JTM",
  allocate: "Alokasikan selisih JTM",
  "remove-allocation": "Hapus alokasi",
  reset: "Reset JTM dan alokasi",
};
export function ExamManager({
  admin,
  userId,
}: {
  admin: boolean;
  userId: string;
}) {
  const lock = useRef(false),
    live = useRef(true),
    opener = useRef<HTMLButtonElement | null>(null);
  const [loading, setLoading] = useState(true),
    [activeForm, setActiveForm] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [now, setNow] = useState(() => Date.now()),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [bapPage, setBapPage] = useState(1);
  const today = wibDate(new Date(now));
  useEffect(() => {
    live.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      live.current = false;
      clearInterval(timer);
    };
  }, []);
  const [date, setDate] = useActivityDate(),
    [period, setPeriod] = useState(""),
    [board, setBoard] = useState<ExamBoard | null>(null),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [entity, setEntity] = useState<Entity>("period"),
    [edit, setEdit] = useState<{
      id: string;
      version: string;
      data: Record<string, unknown>;
    } | null>(null),
    [operation, setOperation] = useState("confirm"),
    [selected, setSelected] = useState(""),
    [preview, setPreview] = useState<{
      impact: Impact;
      action: string;
      subject: string;
      occurrence?: ExamOccurrence;
    } | null>(null);
  useEffect(() => {
    const c = new AbortController();
    if (!date) return () => c.abort();
    void masterRequest<unknown>(
      `/api/programs/read?domain=exams&date=${date}${period ? "&periodId=" + period : ""}`,
      "GET",
      undefined,
      c.signal,
    )
      .then((raw) => {
        if (c.signal.aborted) return;
        const value = readExamResponse(examBoardSchema, raw);
        if (
          value.date !== date ||
          value.admin !== admin ||
          (period && value.occurrences.some((o) => o.periodId !== period))
        )
          throw Error(
            "Tanggal, periode atau hak akses respons ujian tidak sesuai. Muat ulang.",
          );
        setBoard(value);
        setError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setBoard(null);
          setError(e instanceof Error ? e.message : "Gagal memuat ujian.");
        }
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [date, period, revision, admin]);
  function refresh() {
    setLoading(true);
    setBoard(null);
    setError("");
    setSelected("");
    setEdit(null);
    setPreview(null);
    setUncertain(false);
    setRevision((v) => v + 1);
  }
  async function run(
    work: () => Promise<unknown>,
    refreshAfter = true,
    propagate = false,
  ) {
    if (lock.current) {
      if (propagate) throw Error("Permintaan sebelumnya masih diproses.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      if (live.current && refreshAfter) {
        refresh();
        setMessage("Perubahan berhasil disimpan.");
      }
    } catch (e) {
      if (live.current)
        setError(e instanceof Error ? e.message : "Permintaan gagal.");
      if (propagate) throw e;
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }
  const formRun = (work: () => Promise<unknown>, refreshAfter = true) =>
    run(work, refreshAfter, true);
  async function post<T>(action: string, data: unknown): Promise<T> {
    if (uncertain && action !== "preview")
      throw Error(
        "Muat ulang panel dan periksa status sebelum mengirim ulang.",
      );
    const mutates =
      action !== "preview" &&
      !(
        action === "exam-delete" &&
        !("previewId" in (data as Record<string, unknown>))
      );
    try {
      return await masterRequest<T>("/api/programs/" + action, "POST", data);
    } catch (e) {
      if (live.current && mutates) setUncertain(true);
      throw e;
    }
  }
  function markUncertain() {
    if (live.current) setUncertain(true);
  }
  const eligible = (o: ExamOccurrence) =>
    examOperations(o, board!, userId, today);
  if (!board)
    return <FeatureState error={error} label="Memuat ujian…" retry={refresh} />;
  const fields: Record<Entity, Field[]> = {
    period: [
      {
        key: "academicPeriodId",
        label: "Semester",
        type: "select",
        options: board.academicPeriods,
      },
      { key: "name", label: "Nama periode" },
      { key: "dateStart", label: "Tanggal mulai", type: "date", value: date },
      { key: "dateEnd", label: "Tanggal akhir", type: "date", value: date },
      { key: "committeeJtm", label: "JTM panitia per hari", value: "1" },
    ],
    session: [
      {
        key: "periodId",
        label: "Periode",
        type: "select",
        options: board.periods,
        value: period,
      },
      { key: "date", label: "Tanggal", type: "date", value: date },
      { key: "name", label: "Nama sesi" },
      { key: "timeStart", label: "Mulai", type: "time" },
      { key: "timeEnd", label: "Selesai", type: "time" },
      { key: "jtm", label: "JTM sesi", value: "1" },
    ],
    room: [
      {
        key: "sessionId",
        label: "Sesi",
        type: "select",
        options: board.sessions.map((s) => ({
          id: s.id,
          name: s.date + " · " + s.name,
        })),
      },
      { key: "name", label: "Nama ruang" },
      {
        key: "subjectId",
        label: "Mata pelajaran",
        type: "select",
        options: board.subjects,
      },
      {
        key: "totalStudents",
        label: "Total siswa (0 bila tidak ditetapkan)",
        type: "number",
        value: 0,
        min: 0,
        max: 1000,
      },
      {
        key: "classIds",
        label: "Kelas peserta (dapat digabung)",
        type: "multi",
        options: board.classes,
      },
    ],
    supervisor: [
      {
        key: "roomId",
        label: "Ruang",
        type: "select",
        options: board.rooms.map((r) => ({
          id: r.id,
          name:
            r.name +
            " · " +
            board.sessions.find((s) => s.id === r.session_id)?.name,
        })),
      },
      {
        key: "userId",
        label: "Guru pengawas",
        type: "select",
        options: board.teachers,
      },
      {
        key: "overrideJtm",
        label: "Override JTM positif (kosong memakai JTM sesi)",
        optional: true,
      },
    ],
    committee: [
      {
        key: "periodId",
        label: "Periode",
        type: "select",
        options: board.periods,
        value: period,
      },
      { key: "date", label: "Tanggal", type: "date", value: date },
      {
        key: "userId",
        label: "Guru panitia",
        type: "select",
        options: board.teachers,
      },
      {
        key: "jtm",
        label: "JTM (kosong memakai default periode)",
        optional: true,
      },
      {
        key: "exclusiveStart",
        label: "Awal tugas eksklusif (opsional)",
        type: "time",
        optional: true,
      },
      {
        key: "exclusiveEnd",
        label: "Akhir tugas eksklusif (opsional)",
        type: "time",
        optional: true,
      },
    ],
  };
  async function remove(kind: Entity, id: string) {
    opener.current =
      document.activeElement instanceof HTMLButtonElement
        ? document.activeElement
        : null;
    await run(async () => {
      const impact = readExamResponse(
        examDeletePreviewSchema,
        await post<unknown>("exam-delete", {
          entity: kind,
          id,
          reason: "Penghapusan melalui pengelolaan ujian",
        }),
      );
      const name =
        kind === "period"
          ? board?.periods.find((p) => p.id === id)?.name
          : kind === "session"
            ? board?.sessions.find((s) => s.id === id)?.name
            : kind === "room"
              ? board?.rooms.find((r) => r.id === id)?.name
              : board?.occurrences.find((o) => o.sourceId === id)?.teacherName;
      if (live.current)
        setPreview({
          impact,
          action: "exam-delete",
          subject: `Hapus ${names[kind]} — ${name ?? id}`,
        });
    }, false);
  }
  function editMaster(
    kind: Entity,
    id: string,
    version: string,
    data: Record<string, unknown>,
  ) {
    opener.current =
      document.activeElement instanceof HTMLButtonElement
        ? document.activeElement
        : null;
    setActiveForm(true);
    setEntity(kind);
    setEdit({ id, version, data });
  }
  const occ = board.occurrences.find((o) => o.id === selected),
    actions = occ ? eligible(occ) : [];
  const matches = (text: string) =>
    text.toLocaleLowerCase("id").includes(query.trim().toLocaleLowerCase("id"));
  const occurrences = board.occurrences.filter((o) =>
      matches(
        [
          o.teacherName,
          o.originalTeacherName,
          o.sessionName,
          o.periodName,
          o.className,
        ].join(" "),
      ),
    ),
    baps = board.baps.filter((b) =>
      matches([b.teacherName, b.date, b.notes].join(" ")),
    );
  const currentPage = Math.min(
      page,
      Math.max(1, Math.ceil(occurrences.length / 12)),
    ),
    currentBapPage = Math.min(
      bapPage,
      Math.max(1, Math.ceil(baps.length / 20)),
    );

  return (
    <div
      className="min-w-0 space-y-5 [overflow-wrap:anywhere]"
      aria-busy={loading}
    >
      <h1 className="text-2xl font-semibold">Ujian, panitia dan BAP</h1>
      <p>
        Konfirmasi pengawas belum menghasilkan JTM. Isi BAP setelah sesi selesai
        +5 menit, paling lambat pada tanggal akhir periode.
      </p>
      <fieldset
        disabled={busy || activeForm || !!preview}
        className="flex min-w-0 flex-wrap gap-3"
      >
        <label>
          Tanggal
          <input
            aria-label="Tanggal"
            type="date"
            required
            className={input}
            value={date}
            onChange={(e) => {
              if (!e.target.value) {
                setError("Tanggal kegiatan wajib diisi.");
                return;
              }
              setLoading(true);
              setBoard(null);
              setError("");
              setPreview(null);
              setEdit(null);
              setPage(1);
              setBapPage(1);
              setDate(e.target.value);
              setSelected("");
            }}
          />
        </label>
        <label>
          Filter periode
          <select
            aria-label="Filter periode"
            className={input}
            value={period}
            onChange={(e) => {
              setLoading(true);
              setBoard(null);
              setError("");
              setPreview(null);
              setEdit(null);
              setSelected("");
              setPage(1);
              setBapPage(1);
              setPeriod(e.target.value);
            }}
          >
            <option value="">Semua periode</option>
            {board.periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button className={secondary} onClick={refresh}>
          Muat ulang ujian
        </button>
      </fieldset>
      <label className="grid gap-1 text-sm">
        Cari penugasan dan BAP
        <input
          aria-label="Cari penugasan dan BAP"
          type="search"
          className={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
            setBapPage(1);
          }}
          placeholder="Guru, sesi, periode, ruang atau catatan"
        />
      </label>
      {error && <ErrorFeedback message={error} />}
      {message && (
        <p role="status" className="text-green-800">
          {message}
        </p>
      )}
      {uncertain && !preview && (
        <p role="alert">
          Status penyimpanan perlu diperiksa. Tutup formulir lalu muat ulang
          panel sebelum mengirim ulang.
        </p>
      )}
      {preview && !activeForm && (
        <ExamImpactDialog
          impact={preview.impact}
          subject={preview.subject}
          now={now}
          busy={busy}
          blocked={
            uncertain ||
            (!!preview.occurrence && preview.occurrence.date !== today)
          }
          blockedReason={
            preview.occurrence && preview.occurrence.date !== today
              ? "Tanggal kegiatan telah berubah (WIB). Batalkan pratinjau dan muat ulang panel."
              : "Status penyimpanan perlu diperiksa. Tutup pratinjau, lalu muat ulang panel sebelum mengirim ulang."
          }
          error={error}
          onCancel={() => {
            setPreview(null);
            requestAnimationFrame(() => opener.current?.focus());
          }}
          onConfirm={() =>
            void run(async () => {
              if (Date.parse(preview.impact.expiresAt) <= now)
                throw Error("Pratinjau kedaluwarsa. Buat pratinjau baru.");
              const raw = await post<unknown>(preview.action, {
                previewId: preview.impact.previewId,
                ...(preview.action === "exam-delete"
                  ? { confirmed: true }
                  : {}),
              });
              try {
                if (preview.action === "exam-delete")
                  readExamResponse(z.object({ deleted: z.literal(true) }), raw);
                else {
                  const value = readExamResponse(
                    examOccurrenceSchema.omit({
                      sourceId: true,
                      sourceVersion: true,
                      roomId: true,
                      overrideJtm: true,
                      periodId: true,
                      sessionName: true,
                      periodName: true,
                      bap: true,
                      lockedBaps: true,
                      netJtm: true,
                    }),
                    raw,
                  );
                  if (
                    value.id !== preview.occurrence?.id ||
                    BigInt(value.version) <= BigInt(preview.occurrence.version)
                  )
                    throw Error(
                      "Hasil perubahan tidak sesuai penugasan. Muat ulang.",
                    );
                }
              } catch (e) {
                markUncertain();
                throw e;
              }
              setPreview(null);
            })
          }
        />
      )}
      <section className={panel}>
        <h2 className="font-semibold">Kelengkapan rekap kelas ujian</h2>
        <p>
          {board.required.filter((c) => c.complete).length}/
          {board.required.length} kelas selesai.{" "}
          {board.required.length === 0 ? "Tidak ada kelas wajib." : ""}
        </p>
        {board.required.map((c) => (
          <p key={c.id}>
            {c.name}: {c.complete ? "Selesai" : "Belum diisi"}
          </p>
        ))}
      </section>
      <section className={panel}>
        <h2 className="font-semibold">Penugasan dan kredit tanggal terpilih</h2>
        {!occurrences.length && (
          <p>Tidak ada penugasan dalam cakupan akun ini.</p>
        )}
        {occurrences
          .slice((currentPage - 1) * 12, currentPage * 12)
          .map((o) => (
            <article className="space-y-2 border-b pb-4" key={o.id}>
              <h3 className="font-semibold">
                {o.kind === "EXAM_COMMITTEE"
                  ? "Panitia"
                  : o.sessionName + " · " + o.className}{" "}
                — {o.teacherName}
              </h3>
              <p>
                {o.timeStart}–{o.timeEnd} ·{" "}
                {o.confirmed ? "Terkonfirmasi" : "Belum dikonfirmasi"} · JTM
                terjadwal {o.scheduledJtm}, dasar {o.adjustedJtm}, bersih{" "}
                {o.netJtm}, sisa alokasi {o.remainingJtm}
              </p>
              {o.substitutionId && (
                <p>Pengganti untuk {o.originalTeacherName}</p>
              )}
              {o.adjustmentReason && <p>Penyesuaian: {o.adjustmentReason}</p>}
              {o.allocations.map((a) => (
                <p key={a.id}>
                  Alokasi {a.teacherName}: {a.jtm} JTM
                </p>
              ))}
              {o.lockedBaps > 0 && (
                <p>{o.lockedBaps} BAP lama terkunci dalam riwayat.</p>
              )}
              {o.kind === "EXAM_SUPERVISOR" && o.userId === userId && (
                <BapForm
                  key={o.id + ":" + o.bap?.version}
                  occurrence={o}
                  busy={busy}
                  blocked={uncertain}
                  unavailable={bapAvailability(o, board, userId, now)}
                  onVisibilityChange={setActiveForm}
                  save={(data) =>
                    formRun(async () => {
                      const unavailable = bapAvailability(
                        o,
                        board,
                        userId,
                        now,
                      );
                      if (unavailable) throw Error(unavailable);
                      const payload = validateBap(data, o),
                        raw = await post<unknown>("bap", payload);
                      try {
                        const value = readExamResponse(examBapSchema, raw);
                        if (
                          value.occurrence_id !== o.id ||
                          value.state !== "active" ||
                          value.present !== payload.present ||
                          value.absent !== payload.absent ||
                          value.notes !== payload.notes ||
                          (o.bap && value.id !== o.bap.id) ||
                          BigInt(value.version) <= BigInt(payload.version)
                        )
                          throw Error(
                            "Hasil BAP tidak sesuai penugasan atau versi.",
                          );
                      } catch (e) {
                        markUncertain();
                        throw e;
                      }
                    })
                  }
                />
              )}
            </article>
          ))}
      </section>
      <ExamPagination
        label="Halaman penugasan"
        page={currentPage}
        total={occurrences.length}
        size={12}
        change={setPage}
      />
      {board.canOperate && (
        <section className={panel}>
          <h2 className="font-semibold">Operasi penugasan</h2>
          <p className="text-sm text-muted-foreground">
            Operasi hanya tersedia pada hari kegiatan (WIB). Panitia dapat
            mengelola pengawas pada periode yang sama setelah rekap kelas wajib
            lengkap; tugas sendiri tidak dapat dikelola.
          </p>
          <label>
            Penugasan
            <select
              aria-label="Penugasan"
              disabled={busy || activeForm || !!preview}
              className={input}
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setOperation(
                  (e.target.value
                    ? eligible(
                        board.occurrences.find((o) => o.id === e.target.value)!,
                      )
                    : []
                  ).at(0) ?? "confirm",
                );
                setPreview(null);
              }}
            >
              <option value="">Pilih…</option>
              {board.occurrences
                .filter((o) => eligible(o).length)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.teacherName} · {o.sessionName} ·{" "}
                    {o.className ?? "Panitia"}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Operasi
            <select
              aria-label="Operasi"
              disabled={busy || activeForm || !!preview || !occ}
              className={input}
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
            >
              {actions.map((id) => (
                <option key={id} value={id}>
                  {ops[id]}
                </option>
              ))}
            </select>
          </label>
          {occ && (actions.includes(operation) || activeForm) && (
            <DataForm
              successMessage={false}
              key={operation + selected + occ.version}
              busy={busy}
              locked={uncertain || !actions.includes(operation)}
              onVisibilityChange={(open) => {
                setActiveForm(open);
                if (open && document.activeElement instanceof HTMLButtonElement)
                  opener.current = document.activeElement;
              }}
              label="Atur perubahan penugasan"
              submitLabel="Buat pratinjau perubahan"
              fields={[
                ...(["substitute", "replace", "allocate"].includes(operation)
                  ? [
                      {
                        key: "userId",
                        label: "Guru tujuan",
                        type: "select" as const,
                        options: board.teachers.filter(
                          (t) =>
                            ![occ.userId, occ.originalUserId, userId].includes(
                              t.id,
                            ),
                        ),
                      },
                    ]
                  : []),
                ...(operation === "adjust"
                  ? [
                      {
                        key: "adjustedJtm",
                        label:
                          "JTM dasar baru (bilangan bulat; 0 diperbolehkan)",
                        value: "0",
                      },
                    ]
                  : []),
                ...(operation === "allocate"
                  ? [
                      {
                        key: "allocatedJtm",
                        label: "Jumlah alokasi (maksimal 4 desimal)",
                      },
                    ]
                  : []),
                ...(operation === "remove-allocation"
                  ? [
                      {
                        key: "allocationId",
                        label: "Alokasi yang dihapus",
                        type: "select" as const,
                        options: occ.allocations.map((a) => ({
                          id: a.id,
                          name: a.teacherName + " · " + a.jtm,
                        })),
                      },
                    ]
                  : []),
                reason,
              ]}
              onSave={async (data) => {
                await formRun(async () => {
                  if (
                    !examOperations(occ, board, userId, wibDate()).includes(
                      operation,
                    )
                  )
                    throw Error(
                      "Hak operasi atau tanggal kegiatan berubah. Muat ulang panel.",
                    );
                  const payload = validateExamOperation(
                      {
                        occurrenceId: occ.id,
                        version: occ.version,
                        operation,
                        ...data,
                      },
                      occ,
                    ),
                    impact = readExamResponse(
                      examPreviewSchema,
                      await post<unknown>("preview", payload),
                    );
                  if (
                    impact.current.id !== occ.id ||
                    impact.current.version !== occ.version ||
                    impact.operation !== operation ||
                    JSON.stringify(impact.request) !== JSON.stringify(payload)
                  )
                    throw Error(
                      "Pratinjau tidak sesuai isian. Buat pratinjau baru.",
                    );
                  if (live.current)
                    setPreview({
                      impact,
                      action: "commit",
                      subject: `${ops[operation]} — ${occ.teacherName} · ${occ.date} · ${data.reason}`,
                      occurrence: occ,
                    });
                }, false);
              }}
            />
          )}
        </section>
      )}
      {admin && (
        <section className={panel}>
          <h2 className="font-semibold">
            {edit ? "Ubah" : "Tambah"} master ujian
          </h2>
          <select
            disabled={busy || activeForm || !!preview}
            aria-label="Jenis master ujian"
            className={input}
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value as Entity);
              setEdit(null);
            }}
          >
            {Object.entries(names).map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </select>
          {edit && (
            <button className={secondary} onClick={() => setEdit(null)}>
              <ActionIcon action="close" />
              Batal mengubah data
            </button>
          )}
          <DataForm
            successMessage={false}
            description={
              "Jenis data: " +
              (
                {
                  period: "periode ujian",
                  session: "sesi ujian",
                  room: "ruang ujian",
                  supervisor: "pengawas ujian",
                  committee: "panitia ujian",
                } as const
              )[entity] +
              ". Periksa relasi sebelum menyimpan."
            }
            openOnMount={Boolean(edit)}
            locked={uncertain}
            onVisibilityChange={setActiveForm}
            onDismiss={() => {
              setEdit(null);
              setActiveForm(false);
              requestAnimationFrame(() => opener.current?.focus());
            }}
            key={entity + (edit?.id ?? "new")}
            busy={busy}
            label={edit ? "Ubah data ujian" : "Tambah data ujian"}
            submitLabel="Simpan data ujian"
            fields={[
              ...fields[entity].map((f) => ({
                ...f,
                ...(edit ? { value: edit.data[f.key] as Field["value"] } : {}),
              })),
              reason,
            ]}
            onSave={async (values) => {
              const { reason, ...data } = values;
              await formRun(async () => {
                const payload = validateExamSave(
                  {
                    entity,
                    id: edit?.id,
                    version: edit?.version ?? "0",
                    reason,
                    data,
                  },
                  board,
                  wibDate(),
                );
                const raw = await post<unknown>("exam-save", payload);
                try {
                  verifyExamSave(raw, payload);
                } catch (e) {
                  markUncertain();
                  throw e;
                }
                setEdit(null);
              });
            }}
          />
          {board.periods.map((p) => (
            <details key={p.id} className="rounded border p-3">
              <summary className="cursor-pointer font-medium">
                {p.name} · {p.date_start}–{p.date_end}
              </summary>
              <div className="my-2 flex flex-wrap gap-2">
                <button
                  disabled={
                    busy || activeForm || !!preview || p.date_start <= today
                  }
                  className={secondary}
                  onClick={() =>
                    editMaster("period", p.id, p.version, {
                      academicPeriodId: p.academic_period_id,
                      name: p.name,
                      dateStart: p.date_start,
                      dateEnd: p.date_end,
                      committeeJtm: p.default_committee_jtm,
                    })
                  }
                >
                  <ActionIcon action="edit" />
                  Ubah periode
                </button>
                <button
                  disabled={busy || activeForm || !!preview}
                  className={secondary}
                  onClick={() => void remove("period", p.id)}
                >
                  <ActionIcon action="preview" />
                  Tinjau penghapusan periode
                </button>
              </div>
              {board.sessions
                .filter((s) => s.period_id === p.id)
                .map((s) => (
                  <details
                    key={s.id}
                    className="min-w-0 border-l p-2 sm:ml-3 sm:p-3"
                  >
                    <summary>
                      {s.date} · {s.name} ({s.time_start}–{s.time_end}) ·{" "}
                      {s.scheduled_jtm} JTM
                    </summary>
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={
                          busy || activeForm || !!preview || s.date <= today
                        }
                        className={secondary}
                        onClick={() =>
                          editMaster("session", s.id, s.version, {
                            periodId: s.period_id,
                            date: s.date,
                            name: s.name,
                            timeStart: s.time_start.slice(0, 5),
                            timeEnd: s.time_end.slice(0, 5),
                            jtm: s.scheduled_jtm,
                          })
                        }
                      >
                        <ActionIcon action="edit" />
                        Ubah sesi
                      </button>
                      <button
                        disabled={busy || activeForm || !!preview}
                        className={secondary}
                        onClick={() => void remove("session", s.id)}
                      >
                        <ActionIcon action="preview" />
                        Tinjau penghapusan sesi
                      </button>
                    </div>
                    {board.rooms
                      .filter((r) => r.session_id === s.id)
                      .map((r) => (
                        <div key={r.id} className="my-2 border-t pt-2">
                          <p>
                            {r.name} · {r.total_students} siswa ·{" "}
                            {r.classIds
                              .map(
                                (id) =>
                                  board.classes.find((c) => c.id === id)?.name,
                              )
                              .join(", ")}
                          </p>
                          <button
                            disabled={
                              busy ||
                              activeForm ||
                              !!preview ||
                              s.date < today ||
                              (s.date === today &&
                                board.occurrences.some(
                                  (o) => o.roomId === r.id,
                                ))
                            }
                            className={secondary}
                            onClick={() =>
                              editMaster("room", r.id, r.version, {
                                sessionId: r.session_id,
                                name: r.name,
                                subjectId: r.subject_id,
                                totalStudents: r.total_students,
                                classIds: r.classIds,
                              })
                            }
                          >
                            <ActionIcon action="edit" />
                            Ubah ruang
                          </button>{" "}
                          <button
                            disabled={busy || activeForm || !!preview}
                            className={secondary}
                            onClick={() => void remove("room", r.id)}
                          >
                            <ActionIcon action="preview" />
                            Tinjau penghapusan ruang
                          </button>
                        </div>
                      ))}
                  </details>
                ))}
            </details>
          ))}
          {board.occurrences.map((o) => (
            <div key={o.id} className="flex flex-wrap gap-2">
              <span>
                {o.teacherName} · {o.sessionName}
              </span>
              <button
                disabled={busy || activeForm || !!preview}
                className={secondary}
                onClick={() =>
                  void remove(
                    o.kind === "EXAM_COMMITTEE" ? "committee" : "supervisor",
                    o.sourceId,
                  )
                }
              >
                <ActionIcon action="preview" />
                Tinjau penghapusan penugasan
              </button>
              {o.kind === "EXAM_SUPERVISOR" && (
                <button
                  disabled={busy || activeForm || !!preview || o.date <= today}
                  className={secondary}
                  onClick={() =>
                    editMaster("supervisor", o.sourceId, o.sourceVersion, {
                      roomId: o.roomId ?? "",
                      userId: o.originalUserId,
                      overrideJtm: o.overrideJtm,
                    })
                  }
                >
                  <ActionIcon action="edit" />
                  Ubah pengawas
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      <section className={panel}>
        <h2 className="font-semibold">Rekap JTM dan BAP periode terpilih</h2>
        <p>
          Kredit dan reversal ditampilkan terpisah agar riwayat koreksi dapat
          diperiksa.
        </p>
        {board.recaps.map((r, i) => (
          <p key={i}>
            {r.teacherName} · {r.sourceKind}: {r.jtm} JTM
          </p>
        ))}
        <TableRegion label="Data ujian">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Guru</th>
                <th>Hadir/absen</th>
                <th>Catatan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {!baps.length && (
                <tr>
                  <td colSpan={5} className="p-4 text-muted-foreground">
                    Belum ada BAP yang sesuai filter.
                  </td>
                </tr>
              )}
              {baps
                .slice((currentBapPage - 1) * 20, currentBapPage * 20)
                .map((b) => (
                  <tr key={b.id}>
                    <td>{b.date}</td>
                    <td>{b.teacherName}</td>
                    <td>
                      {b.present}/{b.absent}
                    </td>
                    <td>{b.notes}</td>
                    <td>{b.state === "active" ? "Aktif" : "Terkunci"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </TableRegion>
        <ExamPagination
          label="Halaman BAP"
          page={currentBapPage}
          total={baps.length}
          size={20}
          change={setBapPage}
        />
      </section>
    </div>
  );
}
function BapForm({
  occurrence: o,
  busy,
  save,
  blocked,
  unavailable,
  onVisibilityChange,
}: {
  blocked: boolean;
  unavailable: string;
  onVisibilityChange: (open: boolean) => void;
  occurrence: ExamOccurrence;
  busy: boolean;
  save: (data: unknown) => Promise<void>;
}) {
  return (
    <details>
      <summary className="cursor-pointer text-primary">
        {o.bap ? "Ubah BAP" : "Isi BAP"} (total siswa: {o.expectedStudents})
      </summary>
      {unavailable && (
        <p className="my-3 text-sm text-muted-foreground">{unavailable}</p>
      )}
      <DataForm
        successMessage={false}
        locked={blocked || !!unavailable}
        onVisibilityChange={onVisibilityChange}
        busy={busy}
        label={o.bap ? "Ubah BAP" : "Isi BAP"}
        submitLabel={o.bap ? "Simpan perubahan BAP" : "Kirim BAP"}
        description={
          "Total siswa pada penugasan ini: " +
          o.expectedStudents +
          ". Periksa jumlah hadir dan tidak hadir. " +
          unavailable
        }
        fields={[
          {
            key: "present",
            label: "Hadir",
            type: "number",
            min: 0,
            max: 1000,
            value: o.bap?.present ?? o.expectedStudents,
          },
          {
            key: "absent",
            label: "Absen",
            type: "number",
            min: 0,
            max: 1000,
            value: o.bap?.absent ?? 0,
          },
          {
            key: "notes",
            label: "Catatan",
            type: "textarea",
            optional: true,
            value: o.bap?.notes ?? "",
          },
        ]}
        onSave={async (data) =>
          save({
            occurrenceId: o.id,
            operation: o.bap ? "edit" : "create",
            version: o.bap?.version ?? "0",
            ...data,
            notes: data.notes ?? "",
          })
        }
      />
    </details>
  );
}

function ExamPagination({
  label,
  page,
  total,
  size,
  change,
}: {
  label: string;
  page: number;
  total: number;
  size: number;
  change: (page: number) => void;
}) {
  if (total <= size) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-3">
      <button
        className={secondary}
        disabled={page === 1}
        onClick={() => change(page - 1)}
      >
        Sebelumnya
      </button>
      <span>
        {page} / {Math.ceil(total / size)} · {total} data
      </span>
      <button
        className={secondary}
        disabled={page * size >= total}
        onClick={() => change(page + 1)}
      >
        Berikutnya
      </button>
    </nav>
  );
}
