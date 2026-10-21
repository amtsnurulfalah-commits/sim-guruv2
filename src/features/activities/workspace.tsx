"use client";
import Link from "next/link";
import { ActionIcon } from "@/components/ui/action-icon";

import { FormDialog } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { masterRequest } from "../masters/api";
import { wibDate } from "../../lib/calendar/schemas";
import type {
  Attendance,
  Journal,
  List,
  Occurrence,
  Options,
  StudentRecap,
} from "../../lib/activities/schemas";
import {
  control as inputClass,
  primaryAction as buttonClass,
  secondaryAction as smallButton,
  surface as panel,
} from "@/components/ui/styles";
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
function Text({
  label,
  value,
  set,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        className={inputClass}
        type={type}
        value={value}
        onChange={(e) => set(e.target.value)}
        required={required}
      />
    </Field>
  );
}
function Select({
  label,
  value,
  set,
  items,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  items: { id: string; name: string }[];
}) {
  return (
    <Field label={label}>
      <select
        className={inputClass}
        value={value}
        onChange={(e) => set(e.target.value)}
        required
      >
        <option value="">Pilih…</option>
        {items.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
function Count({
  label,
  value,
  set,
}: {
  label: string;
  value: number;
  set: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        className={inputClass}
        type="number"
        min={0}
        max={1000}
        step={1}
        value={value}
        onChange={(e) => set(e.target.valueAsNumber)}
        required
      />
    </Field>
  );
}
type Mode = "occurrences" | "attendance" | "students" | "journals";
const titles: Record<Mode, string> = {
  occurrences: "Kegiatan dan konfirmasi KBM",
  attendance: "Kehadiran guru",
  students: "Rekap absensi siswa",
  journals: "Jurnal pembelajaran",
};
export function ActivityWorkspace({
  admin,
  userId,
  mode,
}: {
  admin: boolean;
  userId: string;
  mode: Mode;
}) {
  const [manualEditor, setManualEditor] = useState(0),
    [journalEditor, setJournalEditor] = useState(0),
    [leaveEditor, setLeaveEditor] = useState(0);
  const [date, setDate] = useState(wibDate()),
    [from, setFrom] = useState(wibDate().slice(0, 7) + "-01"),
    [to, setTo] = useState(wibDate()),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [options, setOptions] = useState<Options>({
      teachers: [],
      classes: [],
      subjects: [],
      h1Enabled: false,
    }),
    [rows, setRows] = useState<
      (Attendance | Journal | StudentRecap | Occurrence)[]
    >([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [eligible, setEligible] = useState<Occurrence[]>([]),
    [progress, setProgress] = useState<{
      required: { id: string; name: string; complete: boolean }[];
      completedCount: number;
      requiredCount: number;
    } | null>(null);
  const [teacher, setTeacher] = useState(""),
    [filterTeacher, setFilterTeacher] = useState(""),
    [query, setQuery] = useState("");
  const [templates, setTemplates] = useState<
    {
      id: string;
      day_index: number;
      sched_type: string;
      time_in: string;
      time_out: string;
      version: string;
    }[]
  >([]);
  const [preview, setPreview] = useState<{
    previewId: string;
    date: string;
    timeIn: string;
    timeOut: string;
    participants: { id: string; name: string }[];
  } | null>(null);
  const [templateId, setTemplateId] = useState(""),
    [day, setDay] = useState("1"),
    [type, setType] = useState("KBM"),
    [timeIn, setTimeIn] = useState("07:30"),
    [timeOut, setTimeOut] = useState("14:00");
  const [scheduledIn, setScheduledIn] = useState("07:30"),
    [scheduledOut, setScheduledOut] = useState("14:00"),
    [actualIn, setActualIn] = useState(""),
    [actualOut, setActualOut] = useState(""),
    [extra, setExtra] = useState(false),
    [reason, setReason] = useState("");
  const [attendanceId, setAttendanceId] = useState(""),
    [leaveTime, setLeaveTime] = useState(""),
    [returnTime, setReturnTime] = useState("");
  const [classId, setClassId] = useState(""),
    [hadir, setHadir] = useState(0),
    [sakit, setSakit] = useState(0),
    [izin, setIzin] = useState(0),
    [alpa, setAlpa] = useState(0);
  const [occurrenceId, setOccurrenceId] = useState(""),
    [editing, setEditing] = useState<Journal | null>(null),
    [material, setMaterial] = useState(""),
    [present, setPresent] = useState(0),
    [absent, setAbsent] = useState(0),
    [notes, setNotes] = useState("");
  const [subjectId, setSubjectId] = useState(""),
    [blockFrom, setBlockFrom] = useState(wibDate()),
    [blockTo, setBlockTo] = useState(wibDate()),
    [blockMessage, setBlockMessage] = useState("");
  const [blocks, setBlocks] = useState<
    {
      id: string;
      subject_id: string;
      date_start: string;
      date_end: string;
      message: string;
      active: boolean;
      version: string;
    }[]
  >([]);
  useEffect(() => {
    const ctrl = new AbortController();
    let live = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const opts = await masterRequest<Options>(
          "/api/activities/options",
          "GET",
          undefined,
          ctrl.signal,
        );
        const params = new URLSearchParams({
          from,
          to,
          page: String(page),
          pageSize: "25",
          ...(filterTeacher ? { userId: filterTeacher } : {}),
          ...(mode === "journals" && query ? { q: query } : {}),
        });
        const result = await masterRequest<
          List<Attendance | Journal | StudentRecap | Occurrence>
        >(
          mode === "occurrences"
            ? `/api/activities/occurrences?date=${date}`
            : `/api/activities/${mode}?${params}`,
          "GET",
          undefined,
          ctrl.signal,
        );
        if (!live) return;
        setOptions(opts);
        setRows(result.items);
        setTotal(result.total ?? result.items.length);
        if (mode === "journals") {
          const e = await masterRequest<{ items: Occurrence[] }>(
            `/api/activities/eligible?date=${date}`,
            "GET",
            undefined,
            ctrl.signal,
          );
          if (live) setEligible(e.items);
          if (admin) {
            const b = await masterRequest<{ items: typeof blocks }>(
              "/api/activities/blocks",
              "GET",
              undefined,
              ctrl.signal,
            );
            if (live) setBlocks(b.items);
          }
        }
        if (mode === "attendance" && admin) {
          const t = await masterRequest<{ items: typeof templates }>(
            "/api/activities/templates",
            "GET",
            undefined,
            ctrl.signal,
          );
          if (live) setTemplates(t.items);
        }
        if (mode === "students" && (admin || opts.canOperate)) {
          const p = await masterRequest<NonNullable<typeof progress>>(
            `/api/activities/students-progress?date=${date}`,
            "GET",
            undefined,
            ctrl.signal,
          );
          if (live) setProgress(p);
        }
      } catch (e) {
        if (live)
          setError(e instanceof Error ? e.message : "Gagal memuat data.");
      } finally {
        if (live) setLoading(false);
      }
    }
    void load();
    return () => {
      live = false;
      ctrl.abort();
    };
  }, [mode, date, from, to, page, revision, admin, filterTeacher, query]);
  async function run(
    action: string,
    data: unknown,
    success = "Data berhasil disimpan.",
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await masterRequest<unknown>(
        `/api/activities/${action}`,
        "POST",
        data,
      );
      setMessage(success);
      setRevision((v) => v + 1);
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan data.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  const attendanceRows = mode === "attendance" ? (rows as Attendance[]) : [];
  const selectedAttendance = attendanceRows.find((r) => r.id === attendanceId);
  const currentManual = attendanceRows.find(
    (r) => r.userId === teacher && r.date === date,
  );
  const currentStudent = (rows as StudentRecap[]).find(
    (r) => r.class_id === classId && r.date === date,
  );
  const selectedTemplate = templates.find(
    (t) => String(t.day_index) === day && t.sched_type === type,
  );
  const exportQuery = new URLSearchParams({
    kind: mode === "attendance" ? "attendance" : "journals",
    from,
    to,
    ...(filterTeacher ? { userId: filterTeacher } : {}),
    ...(mode === "journals" && query ? { q: query } : {}),
  });
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{titles[mode]}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Tanggal operasional memakai WIB. Konfirmasi kegiatan dan jam hadir
          harian merupakan bukti yang berbeda.
        </p>
      </header>
      <nav className="flex flex-wrap gap-3 text-sm" aria-label="Modul kegiatan">
        <Link prefetch={false} className="underline" href="/kegiatan">
          Konfirmasi KBM
        </Link>
        <Link prefetch={false} className="underline" href="/kehadiran">
          Kehadiran dan izin
        </Link>
        <Link
          prefetch={false}
          className="underline"
          href="/absensi-siswa/input"
        >
          Rekap siswa
        </Link>
        <Link prefetch={false} className="underline" href="/jurnal">
          Jurnal KBM
        </Link>
      </nav>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <section className={panel}>
        <h2 className="font-semibold">Tanggal dan filter kegiatan</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Text
            label="Tanggal kegiatan / input"
            value={date}
            set={(v) => {
              setDate(v);
              setPreview(null);
            }}
            type="date"
          />
          {mode !== "occurrences" && (
            <>
              <Text
                label="Riwayat mulai"
                value={from}
                set={(v) => {
                  setFrom(v);
                  setPage(1);
                }}
                type="date"
              />
              <Text
                label="Riwayat sampai"
                value={to}
                set={(v) => {
                  setTo(v);
                  setPage(1);
                }}
                type="date"
              />
            </>
          )}
          {admin && ["attendance", "journals"].includes(mode) && (
            <Select
              label="Filter guru (kosong: semua)"
              value={filterTeacher}
              set={(v) => {
                setFilterTeacher(v);
                setPage(1);
              }}
              items={options.teachers}
            />
          )}{" "}
          {mode === "journals" && (
            <Text
              label="Cari materi/catatan"
              value={query}
              set={(v) => {
                setQuery(v);
                setPage(1);
              }}
            />
          )}
        </div>
        <button
          className={smallButton}
          onClick={() => setRevision((v) => v + 1)}
          disabled={loading}
        >
          <ActionIcon action="refresh" />
          Muat ulang
        </button>
        {loading && <p role="status">Memuat data…</p>}
      </section>
      {mode === "occurrences" && (
        <section className={panel}>
          <h2 className="font-semibold">Penugasan tanggal {date}</h2>
          <p className="text-sm">
            Klaim pribadi tidak memberi kredit JTM. Admin mengesahkan kegiatan
            sebelum jurnal diisi.
          </p>
          <Text
            label="Alasan klaim / konfirmasi"
            value={reason}
            set={setReason}
            required
          />
          {!loading && rows.length === 0 && (
            <p>Tidak ada penugasan pada tanggal ini.</p>
          )}
          {(rows as Occurrence[]).map((o) => (
            <article className="space-y-2 rounded border p-4" key={o.id}>
              <h3 className="font-semibold">
                {o.teacherName} — {o.subjectName} · {o.className}
              </h3>
              <p>
                {o.timeStart}–{o.timeEnd} · {o.scheduledJtm} JTM ·{" "}
                {o.confirmed ? "Terkonfirmasi" : "Belum dikonfirmasi"}
                {o.claimed ? " · Sudah diklaim" : ""}
              </p>
              <div className="flex gap-2">
                {o.userId === userId && !o.claimed && (
                  <button
                    className={smallButton}
                    disabled={busy || reason.trim().length < 5}
                    onClick={() =>
                      run("claim", {
                        occurrenceId: o.id,
                        version: o.version,
                        reason,
                      })
                    }
                  >
                    <ActionIcon action="submit" />
                    Ajukan klaim kehadiran
                  </button>
                )}
                {admin && (
                  <button
                    className={smallButton}
                    disabled={busy || reason.trim().length < 5}
                    onClick={() => {
                      if (
                        o.confirmed &&
                        !window.confirm(
                          "Cabut konfirmasi kegiatan ini? Jurnal aktif harus dihapus terlebih dahulu.",
                        )
                      )
                        return;
                      void run(o.confirmed ? "revoke" : "confirm", {
                        occurrenceId: o.id,
                        version: o.version,
                        reason,
                      });
                    }}
                  >
                    <ActionIcon action="confirm" />
                    {o.confirmed ? "Cabut konfirmasi" : "Konfirmasi KBM"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
      {mode === "attendance" && (
        <>
          <section className={panel}>
            <h2 className="font-semibold">Riwayat kehadiran</h2>
            <div className="flex gap-4 text-sm">
              <a
                className="ui-action ui-action-secondary"
                href={`/api/activities/export?${exportQuery}&format=csv`}
              >
                <ActionIcon action="download" />
                Unduh CSV
              </a>
              <a
                className="ui-action ui-action-secondary"
                href={`/api/activities/export?${exportQuery}&format=pdf`}
              >
                <ActionIcon action="download" />
                Unduh PDF
              </a>
            </div>
            {!loading && rows.length === 0 && (
              <p>Belum ada catatan kehadiran pada rentang ini.</p>
            )}
            {attendanceRows.map((d) => (
              <article key={d.id} className="space-y-2 rounded border p-4">
                <h3 className="font-semibold">
                  {d.teacherName} · {d.date}
                </h3>
                <p>
                  Jadwal {d.scheduledIn ?? "—"}–{d.scheduledOut ?? "—"}; aktual{" "}
                  {d.actualIn ?? "—"}–{d.actualOut ?? "—"}
                </p>
                <p className="text-sm">
                  Efektif {Number(d.effectiveMinutes).toFixed(1)} menit · rasio{" "}
                  {Number(d.ratio).toFixed(3)}
                  {d.extra ? " · Peserta tambahan" : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {!d.actualIn && (
                    <button
                      className={smallButton}
                      disabled={busy}
                      onClick={() =>
                        run("in", {
                          attendanceId: d.id,
                          version: d.version,
                          reason: "Mencatat jam masuk sesuai waktu server",
                        })
                      }
                    >
                      <ActionIcon action="access" />
                      Catat masuk sekarang
                    </button>
                  )}
                  {d.actualIn && !d.actualOut && (
                    <button
                      className={smallButton}
                      disabled={busy}
                      onClick={() =>
                        run("out", {
                          attendanceId: d.id,
                          version: d.version,
                          reason: "Mencatat jam pulang sesuai jadwal",
                        })
                      }
                    >
                      <ActionIcon action="submit" />
                      Catat pulang
                    </button>
                  )}
                  <button
                    className={smallButton}
                    onClick={() => {
                      setAttendanceId(d.id);
                      setLeaveEditor((value) => value + 1);
                    }}
                  >
                    <ActionIcon action="access" />
                    Ajukan izin keluar
                  </button>
                  {admin && (
                    <button
                      className={smallButton}
                      onClick={() => {
                        setTeacher(d.userId);
                        setDate(d.date);
                        setScheduledIn(d.scheduledIn ?? "");
                        setScheduledOut(d.scheduledOut ?? "");
                        setActualIn(d.actualIn ?? "");
                        setActualOut(d.actualOut ?? "");
                        setExtra(d.extra);
                        setManualEditor((v) => v + 1);
                      }}
                    >
                      <ActionIcon action="edit" />
                      Koreksi kehadiran
                    </button>
                  )}
                </div>
                {d.leaves.map((l) => (
                  <p key={l.id} className="text-sm">
                    Izin {l.leaveTime}–{l.returnTime}: {l.reason}{" "}
                    <button
                      className="ui-action ui-action-secondary"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Hapus izin ini? Durasi hadir akan dihitung ulang.",
                          )
                        )
                          void run("delete-leave", {
                            attendanceId: d.id,
                            version: d.version,
                            leaveId: l.id,
                            reason: "Menghapus interval izin melalui riwayat",
                          });
                      }}
                    >
                      <ActionIcon action="delete" />
                      Hapus izin
                    </button>
                  </p>
                ))}
              </article>
            ))}
          </section>
          <FormDialog
            title="Izin keluar sementara"
            onDiscard={() => {
              setLeaveTime("");
              setReturnTime("");
              setReason("");
            }}
            revealKey={
              leaveEditor ? attendanceId + ":" + leaveEditor : undefined
            }
            busy={busy}
            success={message}
            error={error}
          >
            <form
              className={panel}
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedAttendance)
                  void run("leave", {
                    attendanceId: selectedAttendance.id,
                    version: selectedAttendance.version,
                    leaveTime,
                    returnTime,
                    reason,
                  });
              }}
            >
              <h2 className="font-semibold">Izin keluar sementara</h2>
              <Select
                label="Catatan kehadiran"
                value={attendanceId}
                set={setAttendanceId}
                items={attendanceRows.map((d) => ({
                  id: d.id,
                  name: d.teacherName + " · " + d.date,
                }))}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Text
                  label="Jam keluar"
                  value={leaveTime}
                  set={setLeaveTime}
                  type="time"
                  required
                />
                <Text
                  label="Jam kembali"
                  value={returnTime}
                  set={setReturnTime}
                  type="time"
                  required
                />
              </div>
              <Text label="Alasan" value={reason} set={setReason} required />
              <button
                className={buttonClass}
                disabled={busy || !selectedAttendance}
              >
                <ActionIcon action="save" />
                Simpan izin
              </button>
            </form>
          </FormDialog>
          {admin && (
            <>
              <FormDialog
                title="Kehadiran harian"
                onDiscard={() => {
                  setTeacher("");
                  setActualIn("");
                  setActualOut("");
                  setExtra(false);
                  setReason("");
                }}
                busy={busy}
                success={message}
                error={error}
                revealKey={manualEditor ? String(manualEditor) : undefined}
              >
                <form
                  className={panel}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run("manual", {
                      userId: teacher,
                      date,
                      scheduledIn: scheduledIn || null,
                      scheduledOut: scheduledOut || null,
                      actualIn: actualIn || null,
                      actualOut: actualOut || null,
                      extra,
                      version: currentManual?.version ?? "0",
                      reason,
                    });
                  }}
                >
                  <h2 className="font-semibold">
                    Jadwal, peserta tambahan dan koreksi manual admin
                  </h2>
                  <Select
                    label="Guru"
                    value={teacher}
                    set={setTeacher}
                    items={options.teachers}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Text
                      label="Jadwal masuk"
                      value={scheduledIn}
                      set={setScheduledIn}
                      type="time"
                    />
                    <Text
                      label="Jadwal pulang"
                      value={scheduledOut}
                      set={setScheduledOut}
                      type="time"
                    />
                    <Text
                      label="Aktual masuk (boleh kosong)"
                      value={actualIn}
                      set={setActualIn}
                      type="time"
                    />
                    <Text
                      label="Aktual pulang (boleh kosong)"
                      value={actualOut}
                      set={setActualOut}
                      type="time"
                    />
                  </div>
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={extra}
                      onChange={(e) => setExtra(e.target.checked)}
                    />
                    Peserta tambahan tanpa penugasan
                  </label>
                  <Text
                    label="Alasan perubahan / peserta tambahan"
                    value={reason}
                    set={setReason}
                    required
                  />
                  <button
                    className={buttonClass}
                    disabled={busy || !teacher || loading}
                  >
                    <ActionIcon action="save" />
                    Simpan kehadiran manual
                  </button>
                </form>
              </FormDialog>
              <FormDialog
                title="Pola jam kehadiran"
                onDiscard={() => {
                  setTemplateId("");
                  setTimeIn("07:30");
                  setTimeOut("14:00");
                  setDay("1");
                  setType("KBM");
                  setReason("");
                }}
                busy={busy}
                success={message}
                error={error}
                revealKey={templateId}
              >
                <form
                  className={panel}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run("template-save", {
                      dayIndex: Number(day),
                      type,
                      timeIn,
                      timeOut,
                      version: selectedTemplate?.version ?? "0",
                      reason,
                    });
                  }}
                >
                  <h2 className="font-semibold">Pola jam kehadiran</h2>
                  <p className="text-sm">
                    Pilih konteks KBM atau ujian dan rentang jam. Tinjau peserta
                    pada tanggal tujuan sebelum menerapkan pola kehadiran.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select
                      label="Hari"
                      value={day}
                      set={setDay}
                      items={[
                        "Minggu",
                        "Senin",
                        "Selasa",
                        "Rabu",
                        "Kamis",
                        "Jumat",
                        "Sabtu",
                      ].map((name, i) => ({ id: String(i), name }))}
                    />
                    <Select
                      label="Konteks"
                      value={type}
                      set={setType}
                      items={[
                        { id: "KBM", name: "KBM" },
                        { id: "UJIAN", name: "Ujian" },
                      ]}
                    />
                    <Text
                      label="Jam masuk"
                      value={timeIn}
                      set={setTimeIn}
                      type="time"
                      required
                    />
                    <Text
                      label="Jam pulang"
                      value={timeOut}
                      set={setTimeOut}
                      type="time"
                      required
                    />
                  </div>
                  <Text
                    label="Alasan perubahan pola"
                    value={reason}
                    set={setReason}
                    required
                  />
                  <div className="flex gap-2">
                    <button className={buttonClass} disabled={busy}>
                      <ActionIcon action="save" />
                      Simpan pola kehadiran
                    </button>
                    {selectedTemplate && (
                      <button
                        className={smallButton}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Hapus pola kehadiran? Pola yang sudah digunakan tetap dilindungi sebagai riwayat.",
                            )
                          )
                            void run("template-delete", {
                              dayIndex: Number(day),
                              type,
                              version: selectedTemplate.version,
                              reason,
                            });
                        }}
                      >
                        <ActionIcon action="delete" />
                        Hapus pola kehadiran
                      </button>
                    )}
                  </div>
                </form>
              </FormDialog>
              <section className={panel}>
                <h2 className="font-semibold">
                  Terapkan pola kehadiran ke tanggal {date}
                </h2>
                <Select
                  label="Pola kehadiran"
                  value={templateId}
                  set={(v) => {
                    setTemplateId(v);
                    setPreview(null);
                  }}
                  items={templates.map((t) => ({
                    id: t.id,
                    name: `${["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][t.day_index]} · ${t.sched_type} · ${t.time_in}–${t.time_out}`,
                  }))}
                />
                <button
                  className={smallButton}
                  disabled={busy || !templateId}
                  onClick={async () => {
                    const p = await run(
                      "template-preview",
                      { date, templateId },
                      "Pratinjau siap; periksa sebelum menerapkan.",
                    );
                    if (p) setPreview(p as NonNullable<typeof preview>);
                  }}
                >
                  <ActionIcon action="preview" />
                  Tinjau penerapan pola
                </button>
                {preview && (
                  <div className="space-y-3 rounded bg-blue-50 p-4">
                    <p>
                      {preview.date} · {preview.timeIn}–{preview.timeOut};{" "}
                      {preview.participants.length} guru. Jam aktual yang sudah
                      tercatat tetap dipertahankan.
                    </p>
                    <ul>
                      {preview.participants.map((p) => (
                        <li key={p.id}>{p.name}</li>
                      ))}
                    </ul>
                    <Text
                      label="Alasan penerapan"
                      value={reason}
                      set={setReason}
                      required
                    />
                    <button
                      className={buttonClass}
                      disabled={busy || reason.trim().length < 5}
                      onClick={async () => {
                        if (
                          await run("template-apply", {
                            previewId: preview.previewId,
                            reason,
                          })
                        )
                          setPreview(null);
                      }}
                    >
                      <ActionIcon action="submit" />
                      Terapkan pola kehadiran
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
      {mode === "students" && (
        <>
          {(admin || options.canOperate) && (
            <>
              <section className={panel}>
                <h2 className="font-semibold">Kelengkapan tanggal {date}</h2>
                <p>
                  {progress?.completedCount ?? 0} dari{" "}
                  {progress?.requiredCount ?? 0} kelas wajib sudah diisi.
                </p>
                <ul>
                  {progress?.required.map((c) => (
                    <li key={c.id}>
                      {c.name} — {c.complete ? "Lengkap" : "Belum diisi"}
                    </li>
                  ))}
                </ul>
              </section>
              <FormDialog
                title="Rekap absensi siswa"
                onDiscard={() => {
                  setClassId("");
                  setHadir(0);
                  setSakit(0);
                  setIzin(0);
                  setAlpa(0);
                  setReason("");
                }}
                busy={busy}
                success={message}
                error={error}
              >
                <form
                  className={panel}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run("students-save", {
                      classId,
                      date,
                      hadir,
                      sakit,
                      izin,
                      alpa,
                      version: currentStudent?.version ?? "0",
                      reason,
                    });
                  }}
                >
                  <h2 className="font-semibold">
                    Input / perbarui rekap hari ini
                  </h2>
                  <Select
                    label="Kelas"
                    value={classId}
                    set={(v) => {
                      setClassId(v);
                      const r = (rows as StudentRecap[]).find(
                        (x) => x.class_id === v && x.date === date,
                      );
                      setHadir(r?.hadir ?? 0);
                      setSakit(r?.sakit ?? 0);
                      setIzin(r?.izin ?? 0);
                      setAlpa(r?.alpa ?? 0);
                    }}
                    items={options.classes}
                  />
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Count label="Hadir" value={hadir} set={setHadir} />
                    <Count label="Sakit" value={sakit} set={setSakit} />
                    <Count label="Izin" value={izin} set={setIzin} />
                    <Count label="Alpa" value={alpa} set={setAlpa} />
                  </div>
                  <Text
                    label="Alasan pencatatan"
                    value={reason}
                    set={setReason}
                    required
                  />
                  <button
                    className={buttonClass}
                    disabled={busy || loading || !classId}
                  >
                    <ActionIcon action="save" />
                    Simpan rekap siswa
                  </button>
                </form>
              </FormDialog>
            </>
          )}
          <section className={panel}>
            <h2 className="font-semibold">Riwayat rekap siswa</h2>
            {!loading && !rows.length && (
              <p>Belum ada rekap yang dapat ditampilkan.</p>
            )}
            {(rows as StudentRecap[]).map((r) => (
              <article className="rounded border p-3" key={r.id}>
                <h3>
                  {r.className} · {r.date}
                </h3>
                <p>
                  Hadir {r.hadir}; sakit {r.sakit}; izin {r.izin}; alpa {r.alpa}
                </p>
                <p className="text-sm">Dicatat oleh {r.submittedByName}</p>
              </article>
            ))}
          </section>
        </>
      )}
      {mode === "journals" && (
        <>
          <FormDialog
            title="Jurnal pembelajaran"
            onDiscard={() => {
              setEditing(null);
              setMaterial("");
              setNotes("");
              setOccurrenceId("");
              setPresent(0);
              setAbsent(0);
              setReason("");
            }}
            busy={busy}
            success={message}
            error={error}
            revealKey={editing ? editing.id + ":" + journalEditor : undefined}
          >
            <form
              className={panel}
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await run(
                  editing ? "journal-edit" : "journal-create",
                  editing
                    ? {
                        journalId: editing.id,
                        version: editing.version,
                        material,
                        present,
                        absent,
                        notes,
                        reason,
                      }
                    : {
                        occurrenceId,
                        material,
                        present,
                        absent,
                        notes,
                        reason,
                      },
                );
                if (r) {
                  setEditing(null);
                  setMaterial("");
                  setNotes("");
                  setOccurrenceId("");
                }
              }}
            >
              <h2 className="font-semibold">
                {editing
                  ? "Ubah jurnal " + editing.date
                  : "Input jurnal tanggal " + date}
              </h2>
              {!editing && (
                <>
                  <p className="text-sm">
                    H-1:{" "}
                    {options.h1Enabled
                      ? "aktif, bobot 80% dibulatkan satu desimal"
                      : "belum aktif"}
                    . Rekap siswa yang tersedia wajib cocok dengan jurnal.
                  </p>
                  <Select
                    label="Kegiatan"
                    value={occurrenceId}
                    set={(v) => {
                      setOccurrenceId(v);
                      const o = eligible.find((x) => x.id === v);
                      setPresent(o?.expectedStudents ?? 0);
                      setAbsent(0);
                    }}
                    items={eligible
                      .filter((o) => !o.journalId && !o.eligibilityError)
                      .map((o) => ({
                        id: o.id,
                        name: `${o.subjectName} · ${o.className} · ${o.timeStart}–${o.timeEnd}`,
                      }))}
                  />
                  {eligible
                    .filter((o) => o.eligibilityError)
                    .map((o) => (
                      <p className="text-sm text-amber-800" key={o.id}>
                        {o.subjectName} · {o.className}:{" "}
                        {eligibilityText(o.eligibilityError)}
                      </p>
                    ))}
                </>
              )}
              <Field label="Materi pembelajaran">
                <textarea
                  className={inputClass}
                  maxLength={2000}
                  required
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Count label="Siswa hadir" value={present} set={setPresent} />
                <Count label="Siswa absen" value={absent} set={setAbsent} />
              </div>
              <Field label="Catatan">
                <textarea
                  className={inputClass}
                  maxLength={2000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
              <Text
                label="Alasan penyimpanan"
                value={reason}
                set={setReason}
                required
              />
              <div className="flex gap-2">
                <button
                  className={buttonClass}
                  disabled={busy || (!editing && !occurrenceId)}
                >
                  <ActionIcon action="save" />
                  Simpan jurnal
                </button>
                {editing && (
                  <button
                    type="button"
                    className={smallButton}
                    onClick={() => {
                      setEditing(null);
                      setMaterial("");
                      setNotes("");
                    }}
                  >
                    <ActionIcon action="close" />
                    Batal edit
                  </button>
                )}
              </div>
            </form>
          </FormDialog>
          <section className={panel}>
            <h2 className="font-semibold">Riwayat dan detail jurnal</h2>
            <div className="flex gap-4 text-sm">
              <a
                className="ui-action ui-action-secondary"
                href={`/api/activities/export?${exportQuery}&format=csv`}
              >
                <ActionIcon action="download" />
                Unduh CSV
              </a>
              <a
                className="ui-action ui-action-secondary"
                href={`/api/activities/export?${exportQuery}&format=pdf`}
              >
                <ActionIcon action="download" />
                Unduh PDF
              </a>
            </div>
            {!loading && !rows.length && (
              <p>Belum ada jurnal pada rentang ini.</p>
            )}
            {(rows as Journal[]).map((j) => (
              <article key={j.id} className="space-y-2 rounded border p-4">
                <h3 className="font-semibold">
                  {j.date} · {j.teacherName} · {j.subjectName} · {j.className}
                </h3>
                <p className="whitespace-pre-wrap">{j.material}</p>
                <p>
                  Hadir {j.present}; absen {j.absent} · {j.creditedJtm} JTM ·{" "}
                  {j.inputType === "H_MINUS_1" ? "H-1 (80%)" : "Hari H (100%)"}
                </p>
                <p className="whitespace-pre-wrap text-sm">{j.notes}</p>
                <p className="text-sm">
                  {j.recapAvailable
                    ? "Rekap siswa tersedia"
                    : "Belum ada rekap siswa; jumlah diperiksa terhadap standar kelas."}
                </p>
                <div className="flex gap-2">
                  <button
                    className={smallButton}
                    onClick={() => {
                      setEditing(j);
                      setJournalEditor((v) => v + 1);
                      setMaterial(j.material);
                      setPresent(j.present);
                      setAbsent(j.absent);
                      setNotes(j.notes);
                    }}
                  >
                    <ActionIcon action="edit" />
                    Ubah jurnal
                  </button>
                  <button
                    className={smallButton}
                    disabled={busy || reason.trim().length < 5}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Hapus jurnal ini? Kredit JTM akan dibalik dan riwayat penghapusan tetap tersimpan.",
                        )
                      )
                        void run("journal-delete", {
                          journalId: j.id,
                          version: j.version,
                          reason,
                        });
                    }}
                  >
                    <ActionIcon action="delete" />
                    Hapus jurnal dan batalkan JTM
                  </button>
                </div>
              </article>
            ))}
          </section>
          {admin && (
            <section className={panel}>
              <h2 className="font-semibold">
                Kebijakan dan pemblokiran jurnal
              </h2>
              <Text
                label="Alasan perubahan kebijakan"
                value={reason}
                set={setReason}
                required
              />
              <button
                className={smallButton}
                disabled={busy || reason.trim().length < 5}
                onClick={() =>
                  run("h1", { enabled: !options.h1Enabled, reason })
                }
              >
                <ActionIcon action="toggle" />
                {options.h1Enabled ? "Nonaktifkan" : "Aktifkan"} jurnal H-1
              </button>
              <FormDialog
                title="Blok pengisian jurnal"
                onDiscard={() => {
                  setSubjectId("");
                  setBlockMessage("");
                  setReason("");
                }}
                busy={busy}
                success={message}
                error={error}
              >
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run("block", {
                      subjectId,
                      dateStart: blockFrom,
                      dateEnd: blockTo,
                      message: blockMessage,
                      active: true,
                      version: "0",
                      reason,
                    });
                  }}
                >
                  <Select
                    label="Mata pelajaran"
                    value={subjectId}
                    set={setSubjectId}
                    items={options.subjects}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Text
                      label="Blok mulai"
                      value={blockFrom}
                      set={setBlockFrom}
                      type="date"
                      required
                    />
                    <Text
                      label="Blok sampai"
                      value={blockTo}
                      set={setBlockTo}
                      type="date"
                      required
                    />
                  </div>
                  <Text
                    label="Pesan pemblokiran"
                    value={blockMessage}
                    set={setBlockMessage}
                    required
                  />
                  <button
                    className={buttonClass}
                    disabled={busy || !subjectId || reason.trim().length < 5}
                  >
                    <ActionIcon action="save" />
                    Simpan blok jurnal
                  </button>
                </form>
              </FormDialog>
              {blocks.map((b) => (
                <p className="text-sm" key={b.id}>
                  {options.subjects.find((s) => s.id === b.subject_id)?.name} ·{" "}
                  {b.date_start}–{b.date_end}: {b.message} (
                  {b.active ? "Aktif" : "Nonaktif"}){" "}
                  <button
                    className="ui-action ui-action-secondary"
                    disabled={busy || reason.trim().length < 5}
                    onClick={() =>
                      run("block", {
                        id: b.id,
                        subjectId: b.subject_id,
                        dateStart: b.date_start,
                        dateEnd: b.date_end,
                        message: b.message,
                        active: !b.active,
                        version: b.version,
                        reason,
                      })
                    }
                  >
                    <ActionIcon action="toggle" />
                    {b.active
                      ? "Nonaktifkan blok jurnal"
                      : "Aktifkan blok jurnal"}
                  </button>
                </p>
              ))}
            </section>
          )}
        </>
      )}
      {mode !== "occurrences" && (
        <div className="flex items-center justify-between">
          <button
            className={smallButton}
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            <ActionIcon action="previous" />
            Sebelumnya
          </button>
          <span className="text-sm">
            Halaman {page} · {total} catatan
          </span>
          <button
            className={smallButton}
            disabled={page * 25 >= total || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            <ActionIcon action="next" />
            Berikutnya
          </button>
        </div>
      )}
    </div>
  );
}
function eligibilityText(code: string | null | undefined) {
  const labels: Record<string, string> = {
    H1_DISABLED: "Input H-1 belum diaktifkan.",
    H1_NOT_CONFIRMED: "Konfirmasi kemarin belum tersedia.",
    NO_ACTIVE_CONFIRMATION: "Menunggu konfirmasi kegiatan.",
    DATE_EXPIRED: "Batas input sudah berakhir.",
    FUTURE_DATE: "Tanggal kegiatan belum tiba.",
    JOURNAL_BLOCKED: "Input sedang diblokir.",
    FINAL_PERIOD: "Periode sudah final.",
  };
  return labels[code ?? ""] ?? "Kegiatan belum memenuhi syarat input.";
}
