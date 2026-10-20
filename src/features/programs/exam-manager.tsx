"use client";
import { FeatureState } from "@/components/feedback/feature-state";
import { useEffect, useState } from "react";
import { masterRequest } from "../masters/api";
import { wibDate } from "../../lib/calendar/schemas";
import type {
  ExamBoard,
  ExamOccurrence,
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
  const [date, setDate] = useState(wibDate()),
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
    [preview, setPreview] = useState<{ impact: Impact; action: string } | null>(
      null,
    );
  useEffect(() => {
    const c = new AbortController();
    masterRequest<ExamBoard>(
      `/api/programs/read?domain=exams&date=${date}${period ? "&periodId=" + period : ""}`,
      "GET",
      undefined,
      c.signal,
    )
      .then(setBoard)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [date, period, revision]);
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
  const post = <T,>(action: string, data: unknown) =>
    masterRequest<T>("/api/programs/" + action, "POST", data);
  if (!board)
    return (
      <FeatureState
        error={error}
        label="Memuat ujian…"
        retry={() => setRevision((v) => v + 1)}
      />
    );
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
    await run(async () => {
      setPreview({
        impact: await post<Impact>("exam-delete", {
          entity: kind,
          id,
          reason: "Penghapusan melalui pengelolaan ujian",
        }),
        action: "exam-delete",
      });
    }, false);
  }
  function editMaster(
    kind: Entity,
    id: string,
    version: string,
    data: Record<string, unknown>,
  ) {
    setEntity(kind);
    setEdit({ id, version, data });
  }
  const occ = board.occurrences.find((o) => o.id === selected);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Ujian, panitia dan BAP</h1>
      <p>
        Konfirmasi pengawas belum menghasilkan JTM. Isi BAP setelah sesi selesai
        +5 menit, paling lambat pada tanggal akhir periode.
      </p>
      <nav className="flex flex-wrap gap-3 text-primary">
        <a href="/kehadiran">Jam kehadiran</a>
        <a href="/absensi-siswa/input">Rekap siswa</a>
      </nav>
      <div className="flex flex-wrap gap-3">
        <label>
          Tanggal
          <input
            type="date"
            className={input}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSelected("");
            }}
          />
        </label>
        <label>
          Filter periode
          <select
            className={input}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="">Semua periode</option>
            {board.periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
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
          impact={{ ...preview.impact }}
          busy={busy}
          onCancel={() => setPreview(null)}
          onConfirm={() =>
            void run(async () => {
              await post(preview.action, {
                previewId: preview.impact.previewId,
                ...(preview.action === "exam-delete"
                  ? { confirmed: true }
                  : {}),
              });
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
        {!board.occurrences.length && (
          <p>Tidak ada penugasan dalam cakupan akun ini.</p>
        )}
        {board.occurrences.map((o) => (
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
            {o.substitutionId && <p>Pengganti untuk {o.originalTeacherName}</p>}
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
                save={(data) => formRun(() => post("bap", data))}
              />
            )}
          </article>
        ))}
      </section>
      {board.canOperate && (
        <section className={panel}>
          <h2 className="font-semibold">Operasi penugasan</h2>
          <label>
            Penugasan
            <select
              className={input}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Pilih…</option>
              {board.occurrences.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.teacherName} · {o.sessionName} · {o.className ?? "Panitia"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Operasi
            <select
              className={input}
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
            >
              {Object.entries(ops).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {occ && (
            <DataForm
              key={operation + selected + occ.version}
              busy={busy}
              label="Pratinjau perubahan"
              fields={[
                ...(["substitute", "replace", "allocate"].includes(operation)
                  ? [
                      {
                        key: "userId",
                        label: "Guru tujuan",
                        type: "select" as const,
                        options: board.teachers,
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
                await formRun(
                  async () =>
                    setPreview({
                      impact: await post<Impact>("preview", {
                        occurrenceId: occ.id,
                        version: occ.version,
                        operation,
                        ...data,
                      }),
                      action: "commit",
                    }),
                  false,
                );
              }}
            />
          )}
        </section>
      )}
      {admin && (
        <section className={panel}>
          <h2 className="font-semibold">
            {edit ? "Edit" : "Tambah"} master ujian
          </h2>
          <select
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
              Batal edit
            </button>
          )}
          <DataForm
            description={"Jenis data: " + ({period:"periode ujian",session:"sesi ujian",room:"ruang ujian",supervisor:"pengawas ujian",committee:"panitia ujian"} as const)[entity] + ". Periksa relasi sebelum menyimpan."}
            openOnMount={Boolean(edit)}
            onDismiss={() => setEdit(null)}
            key={entity + (edit?.id ?? "new")}
            busy={busy}
            label="Simpan master"
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
                await post("exam-save", {
                  entity,
                  id: edit?.id,
                  version: edit?.version ?? "0",
                  reason,
                  data,
                });
                setEdit(null);
              });
            }}
          />
          {board.periods.map((p) => (
            <details key={p.id} className="rounded border p-3">
              <summary className="cursor-pointer font-medium">
                {p.name} · {p.date_start}–{p.date_end}
              </summary>
              <div className="my-2 flex gap-2">
                <button
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
                  Edit periode
                </button>
                <button
                  disabled={busy}
                  className={secondary}
                  onClick={() => void remove("period", p.id)}
                >
                  Hapus periode…
                </button>
              </div>
              {board.sessions
                .filter((s) => s.period_id === p.id)
                .map((s) => (
                  <details key={s.id} className="ml-3 border-l p-3">
                    <summary>
                      {s.date} · {s.name} ({s.time_start}–{s.time_end}) ·{" "}
                      {s.scheduled_jtm} JTM
                    </summary>
                    <div className="flex gap-2">
                      <button
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
                        Edit sesi
                      </button>
                      <button
                        disabled={busy}
                        className={secondary}
                        onClick={() => void remove("session", s.id)}
                      >
                        Hapus sesi…
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
                            Edit ruang
                          </button>{" "}
                          <button
                            disabled={busy}
                            className={secondary}
                            onClick={() => void remove("room", r.id)}
                          >
                            Hapus ruang…
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
                disabled={busy}
                className={secondary}
                onClick={() =>
                  void remove(
                    o.kind === "EXAM_COMMITTEE" ? "committee" : "supervisor",
                    o.sourceId,
                  )
                }
              >
                Hapus penugasan…
              </button>
              {o.kind === "EXAM_SUPERVISOR" && (
                <button
                  className={secondary}
                  onClick={() =>
                    editMaster("supervisor", o.sourceId, o.sourceVersion, {
                      roomId: o.roomId ?? "",
                      userId: o.originalUserId,
                      overrideJtm: o.overrideJtm,
                    })
                  }
                >
                  Edit pengawas
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
        <div className="overflow-x-auto">
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
              {board.baps.map((b) => (
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
        </div>
      </section>
    </div>
  );
}
function BapForm({
  occurrence: o,
  busy,
  save,
}: {
  occurrence: ExamOccurrence;
  busy: boolean;
  save: (data: unknown) => Promise<void>;
}) {
  return (
    <details>
      <summary className="cursor-pointer text-primary">
        {o.bap ? "Edit BAP" : "Isi BAP"} (total siswa: {o.expectedStudents})
      </summary>
      <DataForm
        busy={busy}
        label={o.bap ? "Simpan edit BAP" : "Kirim BAP"}
        description={"Total siswa pada penugasan ini: " + o.expectedStudents + ". Periksa jumlah hadir dan tidak hadir."}
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
