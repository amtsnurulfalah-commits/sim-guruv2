"use client";
import { useEffect, useState } from "react";
import { masterRequest } from "../masters/api";
import { wibDate } from "../../lib/calendar/schemas";
import type {
  DutyBoard,
  DutyOccurrence,
  DutyPreview,
  DutySchedule,
} from "../../lib/duties/schemas";
const input =
    "w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900",
  button =
    "rounded-md bg-blue-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50",
  secondary = "rounded border px-3 py-2 text-sm disabled:opacity-50",
  panel = "space-y-4 rounded-xl border bg-white p-5 shadow-sm";
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
    <label className="grid gap-1 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
function Choice({
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
    void masterRequest<DutyBoard>(
      `/api/duties/board?date=${date}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((v) => {
        if (live) {
          setBoard(v);
          setError("");
        }
      })
      .catch((e) => {
        if (live)
          setError(
            e instanceof Error ? e.message : "Gagal memuat panel tugas.",
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [date, revision]);
  async function submit(path: string, data: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      return await masterRequest<unknown>("/api/duties/" + path, "POST", data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan tugas.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  const occurrence = board?.occurrences.find((o) => o.id === selected),
    canOperate = admin || board?.canOperate;
  function edit(s: DutySchedule) {
    setEditing(s);
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
    setSelected(o.id);
    setOperation(o.confirmed ? "revoke" : "confirm");
    setTarget("");
    setAllocationId("");
    setPreview(null);
  }
  const operations =
    occurrence?.kind === "UPACARA"
      ? ["confirm", "revoke", "substitute", "replace", "cancel-substitute"]
      : [
          "confirm",
          "revoke",
          "substitute",
          "replace",
          "cancel-substitute",
          "adjust",
          "allocate",
          "remove-allocation",
          "reset",
        ];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Piket, upacara dan pengganti</h1>
        <p className="mt-2 text-sm text-slate-600">
          Konfirmasi piket memberi 4 JTM; upacara memberi 5 JTM. Pengganti wajib
          dikonfirmasi kembali. Klaim pribadi tidak memberi kredit.
        </p>
      </header>
      <nav className="flex flex-wrap gap-3 text-sm">
        <a className="underline" href="/kehadiran">
          Kehadiran dan izin
        </a>
        <a className="underline" href="/absensi-siswa/input">
          Rekap siswa
        </a>
        <a className="underline" href="/kegiatan">
          Konfirmasi KBM
        </a>
        <a className="underline" href="/jurnal">
          Jurnal KBM
        </a>
      </nav>
      <div role="alert" aria-live="polite">
        {error && <p className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
        {message && (
          <p className="rounded bg-green-50 p-3 text-green-800">{message}</p>
        )}
      </div>
      <section className={panel}>
        <Field label="Tanggal kegiatan (WIB)">
          <input
            className={input}
            type="date"
            value={date}
            onChange={(e) => {
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
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setRevision((v) => v + 1);
          }}
        >
          Muat ulang
        </button>
        {loading && <p role="status">Memuat penugasan…</p>}
      </section>
      <section className={panel}>
        <h2 className="font-semibold">Kegiatan tanggal {date}</h2>
        {!loading && !board?.occurrences.length && (
          <p>
            Belum ada penugasan pada tanggal ini. Pastikan jadwal dan konteks
            KBM aktif.
          </p>
        )}
        {board?.occurrences.map((o) => (
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
                Menggantikan {o.originalTeacherName}. Identitas guru asli tetap
                disimpan.
              </p>
            )}
            <p className="text-sm">
              Terjadwal {o.scheduledJtm} · basis pemilik {o.adjustedJtm} · sisa
              belum dialokasikan {o.remainingJtm} JTM
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
            {(canOperate || (o.kind === "UPACARA" && o.userId === userId)) && (
              <button
                className={secondary}
                disabled={busy || loading}
                onClick={() => choose(o)}
              >
                Kelola kegiatan
              </button>
            )}
          </article>
        ))}
      </section>
      {occurrence && (
        <form
          className={panel}
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
              ...(operation === "allocate" ? { allocatedJtm: allocated } : {}),
              ...(operation === "remove-allocation" ? { allocationId } : {}),
            };
            const result = await submit("preview", data);
            if (result) setPreview(result as DutyPreview);
          }}
        >
          <h2 className="font-semibold">
            Kelola {labels[occurrence.kind]} — {occurrence.teacherName}
          </h2>
          <Choice
            label="Tindakan"
            value={operation}
            set={(v) => {
              setOperation(v);
              setPreview(null);
            }}
            items={(canOperate
              ? (operations ?? [])
              : ["confirm", "revoke"]
            ).map((id) => ({ id, name: labels[id]! }))}
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
          <button className={button} disabled={busy || loading}>
            Periksa dampak
          </button>
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
                kegiatan ini. Riwayat tetap disimpan; kehadiran harian dan tugas
                lain tetap ada. Penunjukan pengganti akan diperiksa ulang
                terhadap bentrok.
              </p>
              <p className="text-sm">Alasan: {preview.request.reason}</p>
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={async () => {
                  if (
                    await submit("commit", { previewId: preview.previewId })
                  ) {
                    setPreview(null);
                    setSelected("");
                    setLoading(true);
                    setRevision((v) => v + 1);
                    setMessage(
                      "Tindakan berhasil disimpan beserta perubahan kredit terkait.",
                    );
                  }
                }}
              >
                Konfirmasi tindakan
              </button>
              <button
                type="button"
                className={secondary}
                disabled={busy}
                onClick={() => setPreview(null)}
              >
                Batal
              </button>
            </section>
          )}
        </form>
      )}
      {admin && (
        <>
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
                setEditing(null);
                setLoading(true);
                setRevision((v) => v + 1);
                setMessage("Jadwal tugas tersimpan.");
              }
            }}
          >
            <h2 className="font-semibold">
              {editing
                ? "Edit jadwal tugas"
                : "Tambah jadwal piket / pembina upacara"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice
                label="Jenis tugas"
                value={kind}
                set={(v) => {
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
                label="Periode akademik"
                value={period}
                set={setPeriod}
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
                label={kind === "UPACARA" ? "Tanggal Senin" : "Berlaku mulai"}
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
            <p className="text-sm">
              Piket merupakan pengawasan umum dan tidak otomatis melarang jadwal
              mengajar pada jam yang sama. Upacara dan kegiatan KBM diperiksa
              bentroknya.
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
                Simpan jadwal tugas
              </button>
              {editing && (
                <button
                  type="button"
                  className={secondary}
                  onClick={() => setEditing(null)}
                >
                  Batal edit
                </button>
              )}
            </div>
          </form>
          <section className={panel}>
            <h2 className="font-semibold">
              Jadwal dalam rentang tanggal yang dipilih
            </h2>
            {board?.schedules.map((s) => (
              <article
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
              >
                <div>
                  <h3>
                    {labels[s.kind]} · {s.teacherName}
                  </h3>
                  <p className="text-sm">
                    {days[s.day_index]} · {s.valid_from}–{s.valid_to} ·{" "}
                    {s.time_start.slice(0, 5)}–{s.time_end.slice(0, 5)} ·{" "}
                    {s.active ? "Aktif" : "Nonaktif"}
                  </p>
                </div>
                <button className={secondary} onClick={() => edit(s)}>
                  Edit / nonaktifkan
                </button>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
