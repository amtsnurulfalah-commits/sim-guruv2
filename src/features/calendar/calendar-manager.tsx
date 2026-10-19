"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { masterRequest } from "@/features/masters/api";
import {
  wibDate,
  type CalendarList,
  type CalendarRow,
  type DayContext,
  type ChangePreview,
} from "@/lib/calendar/schemas";
import type { MasterList } from "@/lib/masters/schemas";
const reasonLabels: Record<string, string> = {
  NO_ACADEMIC_PERIOD:
    "Tidak ada semester aktif/cakupan semester yang sesuai tanggal.",
  HOLIDAY: "Tanggal ditandai libur; KBM dan ujian reguler dinonaktifkan.",
  SUNDAY_DEFAULT_OFF: "Minggu tidak otomatis menjadi hari kegiatan.",
};
function ContextSummary({ value }: { value: DayContext }) {
  return (
    <div className="space-y-2 text-sm leading-6">
      <p>
        {value.isHoliday ? "Hari libur" : "Bukan hari libur"} · KBM{" "}
        {value.kbmEnabled ? "aktif" : "nonaktif"} · Ujian{" "}
        {value.examEnabled ? "aktif" : "nonaktif"}
      </p>
      <p>
        Semester:{" "}
        {value.activeAcademicPeriod
          ? value.activeAcademicPeriod.label +
            " · " +
            value.activeAcademicPeriod.semester
          : "Belum ada yang sesuai"}
      </p>
      {value.reasons.map((v) => (
        <p key={v}>{reasonLabels[v] ?? v}</p>
      ))}
    </div>
  );
}
function Field({
  name,
  label,
  type = "text",
  value,
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2 text-sm">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={value}
        minLength={name === "reason" ? 5 : undefined}
        maxLength={500}
        className="h-11 w-full rounded-lg border bg-background px-3"
      />
    </label>
  );
}
export function CalendarManager() {
  const [selected, setSelected] = useState(wibDate()),
    [month, setMonth] = useState(wibDate().slice(0, 7)),
    [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [holiday, setHoliday] = useState(""),
    [list, setList] = useState<CalendarList | null>(null),
    [day, setDay] = useState<DayContext | null>(null),
    [periods, setPeriods] = useState<MasterList | null>(null),
    [periodQuery, setPeriodQuery] = useState(""),
    [periodPage, setPeriodPage] = useState(1),
    [periodId, setPeriodId] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<ChangePreview | null>(null),
    [intent, setIntent] = useState<"calendar" | "context">("calendar"),
    [method, setMethod] = useState("POST"),
    [range, setRange] = useState(false),
    [tab, setTab] = useState<"entry" | "range" | "context">("entry"),
    [history, setHistory] = useState<
      | {
          actor_name: string;
          reason: string;
          created_at: string;
          old_data: Record<string, unknown> | null;
          new_data: Record<string, unknown>;
        }[]
      | null
    >(null);
  const dialog = useRef<HTMLDialogElement>(null),
    historyDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    const c = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const last = new Date(
          Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
        )
          .toISOString()
          .slice(0, 10);
        const [rows, context] = await Promise.all([
          masterRequest<CalendarList>(
            "/api/settings/calendar?" +
              new URLSearchParams({
                dateStart: month + "-01",
                dateEnd: last,
                q,
                holiday,
                page: String(page),
                pageSize: "20",
              }),
            "GET",
            undefined,
            c.signal,
          ),
          masterRequest<DayContext>(
            "/api/settings/day-context?date=" + selected,
            "GET",
            undefined,
            c.signal,
          ),
        ]);
        if (active) {
          setList(rows);
          setDay(context);
        }
      } catch (e) {
        if (active) {
          setList(null);
          setDay(null);
          setError(
            e instanceof Error ? e.message : "Kalender belum dapat dimuat.",
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
  }, [month, selected, q, holiday, page, revision]);
  useEffect(() => {
    let active = true;
    const c = new AbortController();
    masterRequest<MasterList>(
      "/api/settings/academic-periods?" +
        new URLSearchParams({
          q: periodQuery,
          page: String(periodPage),
          pageSize: "20",
        }),
      "GET",
      undefined,
      c.signal,
    )
      .then((d) => {
        if (active) setPeriods(d);
      })
      .catch(() => {
        if (active) setPeriods(null);
      });
    return () => {
      active = false;
      c.abort();
    };
  }, [periodQuery, periodPage, revision]);
  useEffect(() => {
    if (preview) dialog.current?.showModal();
  }, [preview]);
  useEffect(() => {
    if (history) historyDialog.current?.showModal();
  }, [history]);
  async function makePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !day) return;
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget),
      action = String(values.get("action"));
    const payload =
      action === "range"
        ? {
            action,
            dateStart: values.get("dateStart"),
            dateEnd: values.get("dateEnd"),
            description: values.get("description"),
            isHoliday: values.has("isHoliday"),
            reason: values.get("reason"),
          }
        : action === "override"
          ? {
              action,
              date: selected,
              version: day.overrideVersion,
              academicPeriodId:
                periodId || day.override?.academicPeriodId || "",
              kbmEnabled: values.has("kbmEnabled"),
              examEnabled: values.has("examEnabled"),
              reason: values.get("reason"),
            }
          : action === "clear"
            ? {
                action,
                date: selected,
                version: day.overrideVersion,
                reason: values.get("reason"),
              }
            : {
                action,
                date: selected,
                version: day.calendarVersion,
                reason: values.get("reason"),
                ...(action === "upsert"
                  ? {
                      description: values.get("description"),
                      isHoliday: values.has("isHoliday"),
                    }
                  : {}),
              };
    const kind =
      action === "override" || action === "clear" ? "context" : "calendar";
    try {
      const p = await masterRequest<ChangePreview>(
        "/api/settings/" +
          (kind === "calendar" ? "calendar" : "day-context") +
          "/preview",
        "POST",
        payload,
      );
      setIntent(kind);
      setRange(action === "range");
      setMethod(
        action === "delete"
          ? "DELETE"
          : day.calendarVersion === "0"
            ? "POST"
            : "PATCH",
      );
      setPreview(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pratinjau gagal.");
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!preview || busy) return;
    setBusy(true);
    setError("");
    try {
      await masterRequest(
        "/api/settings/" +
          (intent === "context"
            ? "day-context/commit"
            : range
              ? "calendar/range"
              : "calendar"),
        intent === "context" || range ? "POST" : method,
        { previewId: preview.previewId },
      );
      dialog.current?.close();
      setRevision((v) => v + 1);
      setMessage(
        "Perubahan disimpan dan riwayat dicatat. Tidak ada jurnal, bonus atau kredit yang dibuat otomatis.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Perubahan belum dapat disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function showHistory(kind: "calendar" | "day-context") {
    setError("");
    try {
      setHistory(
        await masterRequest(
          "/api/settings/calendar/history?" +
            new URLSearchParams({ kind, date: selected }),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Riwayat tidak dapat dimuat.");
    }
  }
  function selectRow(row: CalendarRow) {
    setSelected(row.date);
    setTab("entry");
    setPeriodId("");
  }
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Administrasi · Tahap 2.3
        </p>
        <h1 className="mt-2 text-3xl font-bold">Kalender dan konteks hari</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          Bedakan catatan kalender biasa dan hari libur. Setiap perubahan
          diperiksa melalui pratinjau sebelum disimpan. Hari Minggu tidak
          otomatis memiliki kegiatan.
        </p>
      </header>
      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-bold">Daftar kalender</h2>
        <div className="flex flex-wrap gap-4">
          <label className="text-sm">
            Bulan
            <input
              type="month"
              value={month}
              onChange={(e) => {
                if (e.target.value) {
                  setMonth(e.target.value);
                  setPage(1);
                }
              }}
              className="mt-2 block h-11 rounded border bg-background px-3"
            />
          </label>
          <label className="text-sm">
            Cari keterangan
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="mt-2 block h-11 rounded border bg-background px-3"
            />
          </label>
          <label className="text-sm">
            Jenis
            <select
              value={holiday}
              onChange={(e) => {
                setHoliday(e.target.value);
                setPage(1);
              }}
              className="mt-2 block h-11 rounded border bg-background px-3"
            >
              <option value="">Semua</option>
              <option value="true">Hari libur</option>
              <option value="false">Catatan biasa</option>
            </select>
          </label>
          <Button variant="outline" onClick={() => setRevision((v) => v + 1)}>
            Muat ulang
          </Button>
        </div>
        {loading ? (
          <p role="status">Memuat kalender…</p>
        ) : (
          list && (
            <>
              <p className="text-sm">
                {list.total} entri · halaman {page}
              </p>
              {list.items.length === 0 ? (
                <p>Belum ada entri pada filter ini.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-3">Tanggal</th>
                        <th className="p-3">Keterangan</th>
                        <th className="p-3">Jenis</th>
                        <th className="p-3">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.items.map((row) => (
                        <tr key={row.id} className="border-b">
                          <td className="p-3">{row.date}</td>
                          <td className="p-3">{row.description}</td>
                          <td className="p-3">
                            {row.isHoliday ? "Libur" : "Catatan biasa"}
                          </td>
                          <td className="p-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => selectRow(row)}
                            >
                              Buka tanggal
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
      <section className="space-y-5 rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-bold">Periksa satu tanggal</h2>
        <label className="block max-w-xs space-y-2 text-sm">
          <span>Tanggal kegiatan (WIB)</span>
          <input
            type="date"
            value={selected}
            onChange={(e) => {
              if (e.target.value) {
                setSelected(e.target.value);
                setPeriodId("");
              }
            }}
            className="h-11 w-full rounded border bg-background px-3"
          />
        </label>
        {day && <ContextSummary value={day} />}
        <p className="text-sm leading-7 text-muted-foreground">
          Jadwal KBM sudah terhubung; ujian dan keuangan belum terpasang. Status
          mode tidak membuat penugasan atau hak kredit. Jadwal mingguan
          diperiksa saat penyimpanan; pemeriksaan ujian/keuangan wajib
          dihubungkan saat modulnya ditambahkan.
        </p>
        <nav className="flex flex-wrap gap-2" aria-label="Tindakan kalender">
          {(["entry", "range", "context"] as const).map((v) => (
            <Button
              key={v}
              variant={tab === v ? "default" : "outline"}
              onClick={() => setTab(v)}
            >
              {v === "entry"
                ? "Catatan tanggal"
                : v === "range"
                  ? "Tambah rentang"
                  : "Atur konteks"}
            </Button>
          ))}
        </nav>
        {day && (
          <form
            key={selected + tab + revision}
            onSubmit={(e) => void makePreview(e)}
            className="space-y-4"
          >
            <fieldset disabled={busy || loading} className="space-y-4">
              {tab === "entry" ? (
                <>
                  <input type="hidden" name="action" value="upsert" />
                  <Field
                    name="description"
                    label="Keterangan kalender"
                    value={day.calendarEntry?.description ?? ""}
                  />
                  <label className="flex gap-3 text-sm">
                    <input
                      type="checkbox"
                      name="isHoliday"
                      defaultChecked={day.isHoliday}
                    />
                    Tandai sebagai hari libur (bukan sekadar catatan biasa)
                  </label>
                </>
              ) : tab === "range" ? (
                <>
                  <input type="hidden" name="action" value="range" />
                  <Field
                    name="dateStart"
                    label="Tanggal mulai"
                    type="date"
                    value={selected}
                  />
                  <Field
                    name="dateEnd"
                    label="Tanggal akhir (inklusif, maksimal 366 tanggal)"
                    type="date"
                    value={selected}
                  />
                  <Field
                    name="description"
                    label="Keterangan seluruh tanggal"
                  />
                  <label className="flex gap-3 text-sm">
                    <input type="checkbox" name="isHoliday" />
                    Seluruh tanggal adalah hari libur
                  </label>
                  <p className="text-sm">
                    Rentang hanya menambah tanggal yang belum pernah dicatat.
                    Jika ada satu benturan, seluruh rentang ditolak; ubah entri
                    lama melalui catatan tanggal.
                  </p>
                </>
              ) : (
                <>
                  <input type="hidden" name="action" value="override" />
                  <label className="block space-y-2 text-sm">
                    <span>Cari semester untuk konteks khusus</span>
                    <input
                      value={periodQuery}
                      onChange={(e) => {
                        setPeriodQuery(e.target.value);
                        setPeriodPage(1);
                      }}
                      className="h-11 w-full rounded border bg-background px-3"
                    />
                  </label>
                  <label className="block space-y-2 text-sm">
                    <span>Semester yang mencakup tanggal</span>
                    <select
                      value={periodId || day.override?.academicPeriodId || ""}
                      onChange={(e) => setPeriodId(e.target.value)}
                      required
                      className="h-11 w-full rounded border bg-background px-3"
                    >
                      <option value="">Pilih semester</option>
                      {day.override &&
                        !periods?.items.some(
                          (p) => p.id === day.override?.academicPeriodId,
                        ) && (
                          <option value={day.override.academicPeriodId}>
                            Semester tersimpan
                          </option>
                        )}
                      {periods?.items.map((p) => (
                        <option key={p.id} value={p.id}>
                          {String(p.parentLabel ?? "Tahun pelajaran")} ·
                          Semester {String(p.semester)} ({String(p.dateStart)}–
                          {String(p.dateEnd)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={periodPage === 1}
                      onClick={() => setPeriodPage((v) => v - 1)}
                    >
                      Pilihan sebelumnya
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!periods || periodPage * 20 >= periods.total}
                      onClick={() => setPeriodPage((v) => v + 1)}
                    >
                      Pilihan berikutnya
                    </Button>
                  </div>
                  {!periods && (
                    <p role="status">Pilihan semester belum dapat dimuat.</p>
                  )}
                  <label className="flex gap-3 text-sm">
                    <input
                      name="kbmEnabled"
                      type="checkbox"
                      defaultChecked={
                        day.override?.kbmEnabled ?? day.kbmEnabled
                      }
                    />
                    Mode KBM diminta aktif
                  </label>
                  <label className="flex gap-3 text-sm">
                    <input
                      name="examEnabled"
                      type="checkbox"
                      defaultChecked={
                        day.override?.examEnabled ?? day.examEnabled
                      }
                    />
                    Mode ujian diminta aktif
                  </label>
                  <p className="text-sm">
                    Hari libur tetap menonaktifkan mode reguler. Semester wajib
                    mencakup tanggal; periode ujian aktif tidak dibuat melalui
                    formulir ini.
                  </p>
                </>
              )}
              <Field
                name="reason"
                label="Alasan perubahan (minimal 5 karakter)"
              />
              <Button type="submit">
                {busy ? "Memeriksa…" : "Lihat pratinjau perubahan"}
              </Button>
            </fieldset>
          </form>
        )}
        {day?.calendarEntry && tab === "entry" && (
          <form
            onSubmit={(e) => void makePreview(e)}
            className="space-y-4 rounded border p-4"
          >
            <fieldset disabled={busy}>
              <input type="hidden" name="action" value="delete" />
              <Field name="reason" label="Alasan menghapus entri tanggal" />
              <Button className="mt-3" type="submit" variant="outline">
                Pratinjau penghapusan catatan
              </Button>
            </fieldset>
          </form>
        )}
        {day?.override && tab === "context" && (
          <form
            onSubmit={(e) => void makePreview(e)}
            className="space-y-4 rounded border p-4"
          >
            <fieldset disabled={busy}>
              <input type="hidden" name="action" value="clear" />
              <Field
                name="reason"
                label="Alasan mengembalikan konteks standar"
              />
              <Button className="mt-3" type="submit" variant="outline">
                Pratinjau hapus konteks khusus
              </Button>
            </fieldset>
          </form>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => void showHistory("calendar")}
          >
            Riwayat catatan tanggal
          </Button>
          <Button
            variant="outline"
            onClick={() => void showHistory("day-context")}
          >
            Riwayat konteks khusus
          </Button>
        </div>
      </section>
      {message && <p role="status">{message}</p>}
      {error && !preview && (
        <p role="alert">{error} Muat ulang data sebelum mencoba lagi.</p>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="calendar-preview-title"
        className="m-auto max-h-[90svh] w-[min(56rem,calc(100%_-_2rem))] overflow-y-auto rounded-2xl border bg-card p-6 text-foreground backdrop:bg-black/45"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        onClose={() => setPreview(null)}
      >
        {preview && (
          <div className="space-y-5">
            <h2 id="calendar-preview-title" className="text-xl font-bold">
              Konfirmasi perubahan {preview.count} tanggal
            </h2>
            <p className="text-sm">
              Pratinjau berlaku sampai{" "}
              {new Date(preview.expiresAt).toLocaleTimeString("id-ID", {
                timeZone: "Asia/Jakarta",
              })}{" "}
              WIB. Perubahan lain pada kalender/semester membatalkan pratinjau
              ini. Data tidak diubah sebelum konfirmasi.
            </p>
            <div className="space-y-4">
              {preview.days.map((d) => (
                <article key={d.date} className="rounded border p-4">
                  <h3 className="mb-3 font-semibold">{d.date}</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 font-semibold">Sebelum</p>
                      <ContextSummary value={d.before} />
                    </div>
                    <div>
                      <p className="mb-2 font-semibold">Sesudah</p>
                      <ContextSummary value={d.after} />
                      {d.after.calendarEntry && (
                        <p className="mt-2 text-sm">
                          {d.after.calendarEntry.description}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <p className="text-sm leading-6">
              Jadwal KBM telah terhubung. Tidak ada bonus/jurnal yang dihasilkan
              tahap ini. Jika modul penugasan/keuangan dipasang tanpa integrasi
              pemeriksaan, perubahan ditolak oleh server.
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => dialog.current?.close()}
              >
                Batal
              </Button>
              <Button disabled={busy} onClick={() => void commit()}>
                {busy ? "Menyimpan…" : "Ya, simpan perubahan ini"}
              </Button>
            </div>
          </div>
        )}
      </dialog>
      <dialog
        ref={historyDialog}
        aria-labelledby="calendar-history-title"
        className="m-auto max-h-[90svh] w-[min(42rem,calc(100%_-_2rem))] overflow-y-auto rounded-2xl border bg-card p-6 text-foreground backdrop:bg-black/45"
        onClose={() => setHistory(null)}
      >
        <div className="mb-4 flex justify-between gap-3">
          <h2 id="calendar-history-title" className="text-xl font-bold">
            Riwayat {selected}
          </h2>
          <Button
            variant="outline"
            onClick={() => historyDialog.current?.close()}
          >
            Tutup
          </Button>
        </div>
        {history?.length === 0 ? (
          <p>Belum ada riwayat.</p>
        ) : (
          history?.map((v, i) => (
            <article key={i} className="mb-4 space-y-2 rounded border p-4">
              <p className="text-sm">
                {new Date(v.created_at).toLocaleString("id-ID", {
                  timeZone: "Asia/Jakarta",
                })}{" "}
                · {v.actor_name}
              </p>
              <p>{v.reason}</p>
              <p className="text-sm">
                {v.new_data.deleted_at
                  ? "Dihapus (riwayat dipertahankan)"
                  : String(v.new_data.description ?? "Konteks khusus")}{" "}
                · Versi {String(v.new_data.version)}
              </p>
            </article>
          ))
        )}
      </dialog>
    </div>
  );
}
