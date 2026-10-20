"use client";
import { TableRegion } from "@/components/ui/table-region";
import {
  ManagedDialog,
  requestDialogClose,
} from "@/components/ui/managed-dialog";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { masterRequest } from "@/features/masters/api";
import {
  days,
  endTime,
  type ScheduleRow,
  type ScheduleList,
} from "@/lib/schedules/schemas";
import { wibDate, type DayContext } from "@/lib/calendar/schemas";
import type { MasterList } from "@/lib/masters/schemas";
import type { UserList } from "@/lib/users/schemas";
type Choice = { id: string; label: string; raw: Record<string, unknown> };
function Picker({
  target,
  label,
  value,
  onChange,
  parentId = "",
  optional = false,
  disabled = false,
}: {
  target: string;
  label: string;
  value: string;
  onChange: (id: string, item?: Choice) => void;
  parentId?: string;
  optional?: boolean;
  disabled?: boolean;
}) {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [items, setItems] = useState<Choice[]>([]),
    [total, setTotal] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const c = new AbortController(),
      url = target === "users" ? "/api/users" : "/api/settings/" + target;
    masterRequest<MasterList | UserList>(
      url +
        "?" +
        new URLSearchParams({
          q,
          page: String(page),
          pageSize: "20",
          ...(target === "users" ? { status: "active" } : { parentId }),
        }),
      "GET",
      undefined,
      c.signal,
    )
      .then((v) => {
        if (active) {
          setItems(
            v.items.map((row) => ({
              id: row.id,
              label:
                String(
                  "fullName" in row
                    ? row.fullName
                    : (row.name ?? row.label ?? row.parentLabel ?? "Data"),
                ) +
                ("semester" in row
                  ? " · Semester " + String(row.semester)
                  : ""),
              raw: row,
            })),
          );
          setTotal(v.total);
          setError("");
        }
      })
      .catch(() => {
        if (active) {
          setItems([]);
          setError(
            "Pilihan belum dapat dimuat. Ubah pencarian untuk mencoba lagi.",
          );
        }
      });
    return () => {
      active = false;
      c.abort();
    };
  }, [target, q, page, parentId]);
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <label className="block text-sm">
        Cari {label.toLowerCase()}
        <input
          disabled={disabled}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="mt-2 h-10 w-full rounded border bg-background px-3"
        />
      </label>
      <label className="block text-sm">
        {label}
        <select
          disabled={disabled}
          value={value}
          required={!optional}
          onChange={(e) =>
            onChange(
              e.target.value,
              items.find((v) => v.id === e.target.value),
            )
          }
          className="mt-2 h-11 w-full rounded border bg-background px-3"
        >
          <option value="">
            {optional ? "Semua / tidak dipilih" : "Pilih data"}
          </option>
          {value && !items.some((v) => v.id === value) && (
            <option value={value}>Pilihan tersimpan</option>
          )}
          {items.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="status" className="text-sm">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Sebelumnya
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || page * 20 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}
function Editor({
  row,
  onSaved,
  onBusy,
}: {
  row: ScheduleRow | null;
  onSaved: () => void;
  onBusy: (v: boolean) => void;
}) {
  const [period, setPeriod] = useState(row?.academicPeriodId ?? ""),
    [user, setUser] = useState(row?.userId ?? ""),
    [subject, setSubject] = useState(row?.subjectId ?? ""),
    [klass, setKlass] = useState(row?.classId ?? ""),
    [from, setFrom] = useState(
      row && row.validFrom > wibDate() ? row.validFrom : wibDate(),
    ),
    [to, setTo] = useState(row?.validTo ?? ""),
    [start, setStart] = useState(row?.timeStart ?? "07:30"),
    [jtm, setJtm] = useState(row?.scheduledJtm ?? "1"),
    [rest, setRest] = useState(row?.restMinutes ?? 0),
    [minutes, setMinutes] = useState(row?.minutesPerJtm ?? 40),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [collision, setCollision] = useState<{
      conflicts: {
        id: string;
        teacher: boolean;
        class: boolean;
        dayIndex: number;
        timeStart: string;
        timeEnd: string;
        validFrom: string;
        validTo: string;
      }[];
      timeEnd: string;
      minutesPerJtm: number;
    } | null>(null);
  useEffect(() => {
    let active = true;
    masterRequest<MasterList>("/api/settings/school")
      .then((v) => {
        if (active && v.items[0]) setMinutes(Number(v.items[0].minutesPerJtm));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      values = new FormData(form),
      intent =
        (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ??
        "save",
      data = {
        academicPeriodId: period,
        userId: user,
        subjectId: subject,
        classId: klass,
        dayIndex: Number(values.get("dayIndex")),
        timeStart: start,
        scheduledJtm: jtm,
        restMinutes: rest,
        validFrom: from,
        validTo: to,
      };
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      if (intent === "check") {
        const v = await masterRequest<typeof collision>(
          "/api/schedules/conflicts",
          "POST",
          { ...(row ? { id: row.id } : {}), data },
        );
        setCollision(v);
        if (v) setMinutes(v.minutesPerJtm);
      } else {
        await masterRequest(
          "/api/schedules" + (row ? "/" + row.id : ""),
          row ? "PATCH" : "POST",
          {
            data,
            reason: values.get("reason"),
            ...(row ? { version: row.version } : {}),
          },
        );
        onSaved();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Jadwal belum dapat disimpan.");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <Picker
          target="academic-periods"
          label="Semester"
          value={period}
          disabled={Boolean(row)}
          onChange={(id, item) => {
            setPeriod(id);
            setKlass("");
            if (item) {
              setFrom(
                String(item.raw.dateStart) > wibDate()
                  ? String(item.raw.dateStart)
                  : wibDate(),
              );
              setTo(String(item.raw.dateEnd));
            }
          }}
        />
        <Picker
          target="users"
          label="Guru / pengajar aktif"
          value={user}
          onChange={(id) => setUser(id)}
        />
        <Picker
          target="subjects"
          label="Mata pelajaran"
          value={subject}
          onChange={(id) => setSubject(id)}
        />
        <Picker
          target="classes"
          label="Kelas pada semester terpilih"
          value={klass}
          parentId={period}
          onChange={(id) => setKlass(id)}
        />
        <label className="block space-y-2 text-sm">
          <span>Hari</span>
          <select
            name="dayIndex"
            defaultValue={row?.dayIndex ?? 1}
            className="h-11 w-full rounded border bg-background px-3"
          >
            {days.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm">
            <span>Jam mulai (WIB)</span>
            <input
              type="time"
              required
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setCollision(null);
              }}
              className="h-11 w-full rounded border bg-background px-3"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>JTM (titik desimal, maksimal 4 tempat)</span>
            <input
              required
              inputMode="decimal"
              value={jtm}
              maxLength={13}
              onChange={(e) => {
                setJtm(e.target.value);
                setCollision(null);
              }}
              className="h-11 w-full rounded border bg-background px-3"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Istirahat (menit)</span>
            <input
              type="number"
              min={0}
              max={600}
              step={1}
              required
              value={rest}
              onChange={(e) => {
                setRest(Number(e.target.value));
                setCollision(null);
              }}
              className="h-11 w-full rounded border bg-background px-3"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Mulai berlaku</span>
            <input
              type="date"
              min={wibDate()}
              required
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setCollision(null);
              }}
              className="h-11 w-full rounded border bg-background px-3"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Akhir berlaku (inklusif)</span>
            <input
              type="date"
              required
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setCollision(null);
              }}
              className="h-11 w-full rounded border bg-background px-3"
            />
          </label>
        </div>
        <p className="text-sm leading-7">
          Pratinjau akhir:{" "}
          <strong>
            {endTime(start, jtm, minutes, rest) ??
              "Durasi belum valid / melewati tengah malam"}
          </strong>{" "}
          WIB · {minutes} menit per JTM. Server memakai konfigurasi sekolah saat
          penyimpanan. JTM bisnis disimpan terpisah dari menit/jam.
        </p>
        {row && row.validFrom < wibDate() && (
          <p className="text-sm leading-7">
            Jadwal sudah berjalan. Tanggal mulai baru menjadi batas revisi:
            versi lama ditutup sehari sebelumnya dan versi pengganti dibuat
            tanpa menulis ulang riwayat.
          </p>
        )}
        <label className="block space-y-2 text-sm">
          <span>Alasan perubahan</span>
          <input
            name="reason"
            required
            minLength={5}
            maxLength={500}
            className="h-11 w-full rounded border bg-background px-3"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            name="intent"
            value="check"
            variant="outline"
            formNoValidate
          >
            Periksa bentrok jadwal
          </Button>
          <Button type="submit" name="intent" value="save">
            {busy ? "Memproses…" : "Simpan jadwal"}
          </Button>
        </div>
      </fieldset>
      {collision && (
        <div role="status" className="space-y-2 rounded border p-4 text-sm">
          <p>
            {collision.conflicts.length
              ? collision.conflicts.length + " bentrok ditemukan."
              : "Tidak ada bentrok pada pemeriksaan ini."}{" "}
            Hasil pemeriksaan ini belum menyimpan jadwal. Kelayakan diperiksa
            ulang saat simpan.
          </p>
          {collision.conflicts.map((v) => (
            <p key={v.id}>
              {days[v.dayIndex]} {v.timeStart}–{v.timeEnd}, {v.validFrom}–
              {v.validTo}: {v.teacher ? "guru " : ""}
              {v.class ? "kelas" : ""}
            </p>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm">
          {error} Jika terjadi konflik versi, tutup formulir dan muat ulang
          data.
        </p>
      )}
    </form>
  );
}
const initial = {
  academicYearId: "",
  q: "",
  academicPeriodId: "",
  userId: "",
  subjectId: "",
  classId: "",
  dayIndex: "",
  validFrom: "",
  validTo: "",
  state: "active",
};
type BulkPreview = {
  previewId: string;
  expiresAt: string;
  count: number;
  items: {
    id: string;
    teacherName: string;
    className: string;
    validFrom: string;
    validTo: string;
    stopFrom: string;
    operation: string;
  }[];
};
export function ScheduleManager({ admin }: { admin: boolean }) {
  const [filters, setFilters] = useState(initial),
    [page, setPage] = useState(1),
    [list, setList] = useState<ScheduleList | null>(null),
    [recap, setRecap] = useState<{
      rowCount: number;
      totalScheduledJtm: string;
    } | null>(null),
    [selected, setSelected] = useState<Record<string, ScheduleRow>>({}),
    [date, setDate] = useState(wibDate()),
    [daily, setDaily] = useState<{
      items: ScheduleRow[];
      scheduledCount: number;
      dayContext: DayContext;
    } | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<ScheduleRow | null>(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [targets, setTargets] = useState<ScheduleRow[] | null>(null),
    [preview, setPreview] = useState<BulkPreview | null>(null),
    [history, setHistory] = useState<
      | {
          actor_name: string;
          reason: string;
          created_at: string;
          new_data: unknown;
        }[]
      | null
    >(null);
  const [printRows, setPrintRows] = useState<ScheduleRow[] | null>(null);
  useEffect(() => {
    if (!printRows) return;
    const frame = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(frame);
  }, [printRows]);
  async function printAll() {
    if (busy || loading) return;
    setBusy(true);
    setError("");
    setPrintRows(null);
    try {
      const rows: ScheduleRow[] = [];
      let total = -1;
      for (let page = 1; total < 0 || rows.length < total; page++) {
        const result = await masterRequest<ScheduleList>(
          (admin ? "/api/schedules" : "/api/schedules/mine") +
            "?" +
            new URLSearchParams({
              ...filters,
              page: String(page),
              pageSize: "100",
            }),
        );
        if (
          (total >= 0 && total !== result.total) ||
          (!result.items.length && rows.length < result.total)
        )
          throw new Error(
            "Data berubah saat menyiapkan cetak. Muat ulang dan coba lagi.",
          );
        total = result.total;
        rows.push(...result.items);
      }
      if (new Set(rows.map((r) => r.id)).size !== total)
        throw new Error(
          "Data berubah saat menyiapkan cetak. Muat ulang dan coba lagi.",
        );
      setPrintRows(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cetak belum tersedia.");
    } finally {
      setBusy(false);
    }
  }
  const editor = useRef<HTMLDialogElement>(null),
    stop = useRef<HTMLDialogElement>(null),
    historyDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    const c = new AbortController(),
      params = new URLSearchParams({
        ...filters,
        page: String(page),
        pageSize: "20",
      });
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [rows, summary] = await Promise.all([
          masterRequest<ScheduleList>(
            "/api/schedules" + (admin ? "" : "/mine") + "?" + params,
            "GET",
            undefined,
            c.signal,
          ),
          admin
            ? masterRequest<{ rowCount: number; totalScheduledJtm: string }>(
                "/api/schedules/recaps?" + params,
                "GET",
                undefined,
                c.signal,
              )
            : Promise.resolve(null),
        ]);
        if (active) {
          setList(rows);
          setRecap(summary);
        }
      } catch (e) {
        if (active) {
          setList(null);
          setError(
            e instanceof Error ? e.message : "Jadwal belum dapat dimuat.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      c.abort();
    };
  }, [filters, page, revision, admin]);
  useEffect(() => {
    let active = true;
    const c = new AbortController();
    masterRequest<typeof daily>(
      "/api/schedules/today?date=" + date,
      "GET",
      undefined,
      c.signal,
    )
      .then((v) => {
        if (active) setDaily(v);
      })
      .catch(() => {
        if (active) setDaily(null);
      });
    return () => {
      active = false;
      c.abort();
    };
  }, [date, revision]);
  useEffect(() => {
    if (open) editor.current?.showModal();
  }, [open]);
  useEffect(() => {
    if (targets) stop.current?.showModal();
  }, [targets]);
  useEffect(() => {
    if (history) historyDialog.current?.showModal();
  }, [history]);
  function filter(key: string, value: string) {
    setFilters((v) => ({ ...v, [key]: value }));
    setPage(1);
    setSelected({});
  }
  function saved() {
    editor.current?.close();
    setRevision((v) => v + 1);
    setSelected({});
    setMessage("Jadwal tersimpan dan riwayat perubahan telah dicatat.");
  }
  async function stopPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targets || busy) return;
    setBusy(true);
    setError("");
    const v = new FormData(event.currentTarget);
    try {
      setPreview(
        await masterRequest<BulkPreview>(
          "/api/schedules/bulk-delete/preview",
          "POST",
          {
            items: targets.map((r) => ({ id: r.id, version: r.version })),
            stopFrom: v.get("stopFrom"),
            reason: v.get("reason"),
          },
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pratinjau belum tersedia.");
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!preview || busy) return;
    setBusy(true);
    setError("");
    try {
      await masterRequest("/api/schedules/bulk-delete", "POST", {
        previewId: preview.previewId,
      });
      stop.current?.close();
      setSelected({});
      setRevision((v) => v + 1);
      setMessage(
        "Jadwal dihentikan sesuai batas tanggal. Riwayat tidak dihapus.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Perubahan gagal.");
    } finally {
      setBusy(false);
    }
  }
  async function showHistory(id: string) {
    setError("");
    try {
      setHistory(await masterRequest("/api/schedules/" + id + "/history"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Riwayat belum dapat dimuat.");
    }
  }
  function rowLabel(r: ScheduleRow) {
    return r.teacherName + " · " + r.className + " · " + r.subjectName;
  }
  return (
    <div className="space-y-6">
      {printRows && (
        <>
          <style>{`@media screen { #schedule-print { display:none; } } @media print { body * { visibility:hidden; } #schedule-print, #schedule-print * { visibility:visible; } #schedule-print { position:absolute; left:0; top:0; width:100%; background:white; color:black; padding:12mm; } #schedule-print table { width:100%; border-collapse:collapse; font-size:10pt; } #schedule-print td, #schedule-print th { border:1px solid #999; padding:5px; } #schedule-print tr { break-inside:avoid; } }`}</style>
          <section id="schedule-print">
            <h1>Rekap jadwal KBM</h1>
            <p>
              Seluruh {printRows.length} baris sesuai filter saat laporan
              dibuat. Jadwal, bukan realisasi presensi atau honorarium.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Guru / periode</th>
                  <th>Kelas / mapel</th>
                  <th>Hari / jam WIB</th>
                  <th>Masa berlaku / JTM</th>
                </tr>
              </thead>
              <tbody>
                {printRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.teacherName}
                      <br />
                      {r.periodLabel}
                    </td>
                    <td>
                      {r.className}
                      <br />
                      {r.subjectName}
                    </td>
                    <td>
                      {days[r.dayIndex]}
                      <br />
                      {r.timeStart}–{r.timeEnd}
                    </td>
                    <td>
                      {r.validFrom}–{r.validTo}
                      <br />
                      {r.scheduledJtm} JTM · {r.state}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {admin ? "Administrasi" : "Ruang guru"}
        </p>
        <h1 className="mt-2 text-3xl font-bold">Jadwal KBM</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          Kelola jadwal mingguan, rentang berlaku, dan penugasan sesuai
          kalender. Jadwal bukan konfirmasi, jurnal, realisasi JTM atau hak
          honorarium.
        </p>
      </header>
      <section className="page-section space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-bold">Jadwal pribadi pada tanggal</h2>
        <label className="block max-w-xs space-y-2 text-sm">
          <span>Tanggal (WIB)</span>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
            className="h-11 w-full rounded border bg-background px-3"
          />
        </label>
        {daily ? (
          <>
            <p className="text-sm">
              {daily.dayContext.isHoliday ? "Hari libur" : "Bukan hari libur"} ·
              KBM {daily.dayContext.kbmEnabled ? "aktif" : "nonaktif"} ·{" "}
              {daily.scheduledCount} baris jadwal pribadi sesuai hari/semester.
            </p>
            {daily.items.length ? (
              daily.items.map((r) => (
                <article key={r.id} className="rounded border p-4">
                  <strong>
                    {r.className} · {r.subjectName}
                  </strong>
                  <p className="mt-2 text-sm">
                    {r.timeStart}–{r.timeEnd} WIB · {r.scheduledJtm} JTM
                  </p>
                </article>
              ))
            ) : (
              <p>
                Tidak ada kegiatan KBM pribadi yang aktif pada konteks tanggal
                ini.
              </p>
            )}
          </>
        ) : (
          <p role="status">Jadwal harian belum tersedia atau sedang dimuat.</p>
        )}
        <p className="text-sm leading-6 text-muted-foreground">
          Konfirmasi tersedia pada halaman Kegiatan KBM dan pengisian jurnal
          tersedia pada halaman Jurnal. Jadwal sendiri tidak otomatis memberikan
          kredit. Substitusi menyusul pada modul piket.
        </p>
      </section>
      <section className="page-section space-y-5 rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">
            {admin ? "Pengelolaan jadwal mingguan" : "Jadwal mingguan saya"}
          </h2>
          <div className="flex gap-3">
            <Button
              variant="outline"
              disabled={busy || loading}
              onClick={printAll}
            >
              Cetak seluruh hasil filter
            </Button>
            <Button variant="outline" onClick={() => setRevision((v) => v + 1)}>
              Muat ulang
            </Button>
            {admin && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setError("");
                  setOpen(true);
                }}
              >
                Tambah jadwal
              </Button>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm">
            <span>Cari guru / kelas / mata pelajaran / periode</span>
            <input
              value={filters.q}
              onChange={(e) => filter("q", e.target.value)}
              className="h-11 w-full rounded border bg-background px-3"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Hari</span>
            <select
              value={filters.dayIndex}
              onChange={(e) => filter("dayIndex", e.target.value)}
              className="h-11 w-full rounded border bg-background px-3"
            >
              <option value="">Semua hari</option>
              {days.map((v, i) => (
                <option key={v} value={String(i)}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 text-sm">
            <span>Status jadwal</span>
            <select
              value={filters.state}
              onChange={(e) => filter("state", e.target.value)}
              className="h-11 w-full rounded border bg-background px-3"
            >
              <option value="active">Aktif</option>
              <option value="closed">Ditutup pada batas tanggal</option>
              <option value="archived">Diarsipkan</option>
              <option value="">Semua termasuk riwayat</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm">
            <span>Rentang mulai filter</span>
            <input
              type="date"
              value={filters.validFrom}
              onChange={(e) => filter("validFrom", e.target.value)}
              className="h-11 w-full rounded border bg-background px-3"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Rentang akhir filter</span>
            <input
              type="date"
              value={filters.validTo}
              onChange={(e) => filter("validTo", e.target.value)}
              className="h-11 w-full rounded border bg-background px-3"
            />
          </label>
        </div>
        {admin && (
          <details className="space-y-4">
            <summary className="cursor-pointer text-sm">
              Filter relasi guru, semester, mapel dan kelas
            </summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Picker
                target="academic-years"
                label="Tahun ajaran"
                optional
                value={filters.academicYearId}
                onChange={(id) => {
                  filter("academicYearId", id);
                  filter("academicPeriodId", "");
                  filter("classId", "");
                }}
              />
              <Picker
                target="academic-periods"
                label="Semester"
                parentId={filters.academicYearId}
                optional
                value={filters.academicPeriodId}
                onChange={(id) => {
                  filter("academicPeriodId", id);
                  filter("classId", "");
                }}
              />
              <Picker
                target="users"
                label="Guru"
                optional
                value={filters.userId}
                onChange={(id) => filter("userId", id)}
              />
              <Picker
                target="subjects"
                label="Mata pelajaran"
                optional
                value={filters.subjectId}
                onChange={(id) => filter("subjectId", id)}
              />
              <Picker
                target="classes"
                label="Kelas"
                optional
                parentId={filters.academicPeriodId}
                value={filters.classId}
                onChange={(id) => filter("classId", id)}
              />
            </div>
          </details>
        )}
        {recap && (
          <p className="text-sm">
            Rekap seluruh filter: {recap.rowCount} baris ·{" "}
            {recap.totalScheduledJtm} JTM pada baris terfilter. Ini bukan jumlah
            kehadiran, realisasi mingguan/bulanan atau honor.
          </p>
        )}
        {admin && Object.keys(selected).length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              {Object.keys(selected).length} dipilih, termasuk pilihan halaman
              lain.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setError("");
                setTargets(Object.values(selected));
              }}
            >
              Tinjau penghentian jadwal terpilih
            </Button>
            <Button variant="outline" onClick={() => setSelected({})}>
              Kosongkan pilihan
            </Button>
          </div>
        )}
        {loading ? (
          <p role="status">Memuat jadwal…</p>
        ) : (
          list && (
            <>
              <p className="text-sm">
                {list.total} baris · halaman {page}
              </p>
              {list.items.length === 0 ? (
                <p>Belum ada jadwal sesuai filter.</p>
              ) : (
                <TableRegion label="Jadwal mengajar">
                  <table className="w-full min-w-[800px] text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        {admin && <th className="p-3">Pilih</th>}
                        <th className="p-3">Guru / kelas / mapel</th>
                        <th className="p-3">Hari dan jam</th>
                        <th className="p-3">Masa berlaku / JTM</th>
                        {admin && <th className="p-3">Tindakan</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {list.items.map((r) => (
                        <tr key={r.id} className="border-b align-top">
                          {admin && (
                            <td className="p-3">
                              <input
                                type="checkbox"
                                aria-label={"Pilih " + rowLabel(r)}
                                checked={Boolean(selected[r.id])}
                                disabled={
                                  r.state !== "active" ||
                                  (!selected[r.id] &&
                                    Object.keys(selected).length >= 100)
                                }
                                onChange={(e) =>
                                  setSelected((v) => {
                                    const next = { ...v };
                                    if (e.target.checked) next[r.id] = r;
                                    else delete next[r.id];
                                    return next;
                                  })
                                }
                              />
                            </td>
                          )}
                          <td className="p-3">
                            <strong>{r.teacherName}</strong>
                            <p>
                              {r.className} · {r.subjectName}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {r.periodLabel} ·{" "}
                              {r.state === "active"
                                ? "Aktif"
                                : r.state === "closed"
                                  ? "Ditutup"
                                  : "Diarsipkan"}
                            </p>
                          </td>
                          <td className="p-3">
                            {days[r.dayIndex]}
                            <p>
                              {r.timeStart}–{r.timeEnd} WIB
                            </p>
                            <p className="mt-1 text-xs">
                              Istirahat {r.restMinutes} menit
                            </p>
                          </td>
                          <td className="p-3">
                            {r.validFrom}–{r.validTo}
                            <p>
                              {r.scheduledJtm} JTM · {r.minutesPerJtm} menit/JTM
                            </p>
                          </td>
                          {admin && (
                            <td className="p-3">
                              <div className="flex flex-wrap gap-2">
                                {r.state === "active" && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditing(r);
                                        setError("");
                                        setOpen(true);
                                      }}
                                    >
                                      Ubah jadwal
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setError("");
                                        setTargets([r]);
                                      }}
                                    >
                                      Hentikan jadwal
                                    </Button>
                                  </>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void showHistory(r.id)}
                                >
                                  Riwayat
                                </Button>
                                {r.replacesId && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      void showHistory(r.replacesId!)
                                    }
                                  >
                                    Riwayat sebelumnya
                                  </Button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableRegion>
              )}
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((v) => v - 1)}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  disabled={page * 20 >= list.total}
                  onClick={() => setPage((v) => v + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            </>
          )
        )}
      </section>
      {message && <p role="status">{message}</p>}
      {error && !open && !targets && <p role="alert">{error}</p>}
      <ManagedDialog
        ref={editor}
        aria-labelledby="schedule-editor-title"
        className="m-auto max-h-[90svh] w-[min(48rem,calc(100%_-_2rem))] overflow-y-auto rounded-2xl border bg-card p-6 text-foreground backdrop:bg-black/45"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      >
        <div className="mb-5 flex justify-between gap-3">
          <h2 id="schedule-editor-title" className="text-xl font-bold">
            {editing ? "Ubah jadwal jadwal" : "Tambah jadwal"}
          </h2>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => requestDialogClose(editor.current)}
          >
            Tutup
          </Button>
        </div>
        {open && (
          <Editor
            key={editing?.id ?? "create"}
            row={editing}
            onSaved={saved}
            onBusy={setBusy}
          />
        )}
      </ManagedDialog>
      <ManagedDialog
        ref={stop}
        aria-labelledby="schedule-stop-title"
        className="m-auto max-h-[90svh] w-[min(42rem,calc(100%_-_2rem))] overflow-y-auto rounded-2xl border bg-card p-6 text-foreground backdrop:bg-black/45"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        onClose={() => {
          setTargets(null);
          setPreview(null);
        }}
      >
        <div className="mb-5 flex justify-between gap-3">
          <h2 id="schedule-stop-title" className="text-xl font-bold">
            Hentikan {targets?.length ?? 0} jadwal
          </h2>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => requestDialogClose(stop.current)}
          >
            Tutup
          </Button>
        </div>
        {preview ? (
          <div className="space-y-4">
            <p className="text-sm">
              Pratinjau berlaku sampai{" "}
              {new Date(preview.expiresAt).toLocaleTimeString("id-ID", {
                timeZone: "Asia/Jakarta",
              })}{" "}
              WIB. Semua perubahan disimpan bersama atau ditolak seluruhnya.
            </p>
            {preview.items.map((v) => (
              <article key={v.id} className="rounded border p-3 text-sm">
                <strong>
                  {v.teacherName} · {v.className}
                </strong>
                <p>
                  {v.validFrom}–{v.validTo}:{" "}
                  {v.operation === "archive"
                    ? "arsip jadwal yang belum dimulai"
                    : "tutup bagian berlaku mulai " + v.stopFrom}
                </p>
              </article>
            ))}
            <Button disabled={busy} onClick={() => void commit()}>
              {busy ? "Memproses…" : "Konfirmasi penghentian jadwal"}
            </Button>
          </div>
        ) : (
          <form onSubmit={(e) => void stopPreview(e)} className="space-y-4">
            <p className="text-sm leading-6">
              Riwayat tidak dihapus. Jadwal yang belum dimulai dapat diarsipkan;
              jadwal berjalan ditutup sebelum tanggal batas. Perubahan yang
              sudah digunakan atau difinalisasi dilindungi. Jika perubahan
              ditolak, hubungi administrator untuk meninjau data terkait.
            </p>
            <fieldset disabled={busy} className="space-y-4">
              <label className="block text-sm">
                Hentikan mulai tanggal
                <input
                  type="date"
                  name="stopFrom"
                  required
                  min={wibDate()}
                  defaultValue={wibDate()}
                  className="mt-2 h-11 w-full rounded border bg-background px-3"
                />
              </label>
              <label className="block text-sm">
                Alasan
                <input
                  name="reason"
                  required
                  minLength={5}
                  maxLength={500}
                  className="mt-2 h-11 w-full rounded border bg-background px-3"
                />
              </label>
              <Button type="submit">
                {busy ? "Memeriksa…" : "Lihat pratinjau dampak"}
              </Button>
            </fieldset>
          </form>
        )}
        {error && (
          <p className="mt-4 text-sm" role="alert">
            {error} Tutup dan muat ulang bila versi telah berubah.
          </p>
        )}
      </ManagedDialog>
      <ManagedDialog
        ref={historyDialog}
        aria-labelledby="schedule-history-title"
        className="m-auto max-h-[90svh] w-[min(42rem,calc(100%_-_2rem))] overflow-y-auto rounded-2xl border bg-card p-6 text-foreground backdrop:bg-black/45"
        onClose={() => setHistory(null)}
      >
        <div className="mb-4 flex justify-between gap-3">
          <h2 id="schedule-history-title" className="text-xl font-bold">
            Riwayat jadwal
          </h2>
          <Button
            variant="outline"
            onClick={() => requestDialogClose(historyDialog.current)}
          >
            Tutup
          </Button>
        </div>
        {history?.length === 0 ? (
          <p>Belum ada riwayat.</p>
        ) : (
          history?.map((h, i) => {
            const v = h.new_data as Record<string, unknown>,
              snap = v.snapshot as Record<string, unknown> | undefined;
            return (
              <article
                key={i}
                className="mb-4 space-y-2 rounded border p-4 text-sm"
              >
                <p>
                  {new Date(h.created_at).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })}{" "}
                  · {h.actor_name}
                </p>
                <p>{h.reason}</p>
                <p>
                  {String(snap?.teacherName ?? "")} ·{" "}
                  {String(snap?.className ?? "")} ·{" "}
                  {String(snap?.subjectName ?? "")}
                </p>
                <p>
                  {String(v.valid_from)}–{String(v.valid_to)} ·{" "}
                  {String(v.time_start)}–{String(v.time_end)} ·{" "}
                  {String(v.scheduled_jtm)} JTM
                </p>
              </article>
            );
          })
        )}
      </ManagedDialog>
    </div>
  );
}
