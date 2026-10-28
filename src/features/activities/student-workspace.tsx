"use client";
import { HelpDisclosure } from "@/components/ui/help-disclosure";
import { useActivityDate } from "@/lib/navigation/use-activity-date";
import { useCallback, useEffect, useRef, useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ActionIcon } from "@/components/ui/action-icon";
import { EmptyState } from "@/components/feedback/feature-state";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { masterRequest } from "@/features/masters/api";
import { ApiRequestError } from "@/lib/feedback/api-error";
import { wibDate } from "@/lib/calendar/schemas";
import { dayFilter, historyFilter } from "@/lib/activities/schemas";
import {
  studentOptionsSchema,
  studentDaySchema,
  studentProgressSchema,
  studentSavedSchema,
  readStudentResponse,
  verifyStudentList,
  studentTotal,
  type StudentRecap,
  type StudentClass,
  type StudentProgress,
} from "@/lib/activities/student-contracts";
import { StudentEditor, type StudentSelection } from "./student-editor";
type Daily = {
  classes: StudentClass[];
  rows: StudentRecap[];
  progress: StudentProgress | null;
  canOperate: boolean;
  periodId: string | null;
};
type History = ReturnType<typeof verifyStudentList>;
const api = "/api/activities/";
const uncertain = (e: unknown) =>
  e instanceof ApiRequestError &&
  (["NETWORK_ERROR", "TIMEOUT", "INVALID_RESPONSE"].includes(e.code) ||
    e.status >= 500 ||
    [404, 409].includes(e.status));
export function StudentWorkspace({
  admin,
  userId,
  initialView = "input",
}: {
  admin: boolean;
  userId: string;
  initialView?: "input" | "history";
}) {
  const [tab, setTab] = useState(initialView),
    [date, setDate] = useActivityDate(),
    [today, setToday] = useState(wibDate);
  const [from, setFrom] = useState(wibDate().slice(0, 7) + "-01"),
    [to, setTo] = useState(wibDate),
    [page, setPage] = useState(1);
  const [requiredPage, setRequiredPage] = useState(1);
  const [daily, setDaily] = useState<Daily | null>(null),
    [history, setHistory] = useState<History | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true),
    [historyLoading, setHistoryLoading] = useState(true),
    [dailyError, setDailyError] = useState(""),
    [historyError, setHistoryError] = useState("");
  const [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState(false),
    [notice, setNotice] = useState(""),
    [selection, setSelection] = useState<StudentSelection | null>(null);
  const mounted = useRef(false),
    pending = useRef(false),
    dailyRead = useRef<AbortController | null>(null),
    historyRead = useRef<AbortController | null>(null),
    opener = useRef<HTMLButtonElement | null>(null);
  const loadDaily = useCallback(async () => {
    dailyRead.current?.abort();
    const controller = new AbortController();
    dailyRead.current = controller;
    setDaily(null);
    setDailyLoading(true);
    setDailyError("");
    try {
      if (!dayFilter.safeParse({ date }).success)
        throw new ApiRequestError(
          "VALIDATION_ERROR",
          "Pilih tanggal input yang valid.",
        );
      const [options, day] = await Promise.all([
        masterRequest<unknown>(
          api + "options",
          "GET",
          undefined,
          controller.signal,
        ).then((raw) => readStudentResponse(studentOptionsSchema, raw)),
        masterRequest<unknown>(
          "/api/day-context?" + new URLSearchParams({ date }),
          "GET",
          undefined,
          controller.signal,
        ).then((raw) => readStudentResponse(studentDaySchema, raw)),
      ]);
      if (day.date !== date)
        throw new ApiRequestError(
          "INVALID_RESPONSE",
          "Konteks kelas tidak sesuai tanggal input. Muat ulang absensi.",
        );
      const canOperate = admin || options.canOperate,
        rows: StudentRecap[] = [];
      let progress: StudentProgress | null = null;
      if (canOperate && (admin || date === wibDate())) {
        // Input versions never come from the independently paginated history view.
        const progressRequest = masterRequest<unknown>(
          api + "students-progress?" + new URLSearchParams({ date }),
          "GET",
          undefined,
          controller.signal,
        ).then((raw) => readStudentResponse(studentProgressSchema, raw));
        const recordsRequest = (async () => {
          let total: number | undefined;
          for (let current = 1; ; current++) {
            const filter = {
              from: date,
              to: date,
              page: current,
              pageSize: 100,
              admin,
              userId,
            };
            const value = verifyStudentList(
              await masterRequest<unknown>(
                api +
                  "students?" +
                  new URLSearchParams({
                    from: date,
                    to: date,
                    page: String(current),
                    pageSize: "100",
                  }),
                "GET",
                undefined,
                controller.signal,
              ),
              filter,
            );
            if (total !== undefined && total !== value.total)
              throw new ApiRequestError(
                "INVALID_RESPONSE",
                "Rekap harian berubah saat dimuat. Muat ulang sebelum mengisi.",
              );
            total = value.total;
            rows.push(...value.items);
            if (rows.length >= total) break;
            if (!value.items.length || rows.length >= 10000)
              throw new ApiRequestError(
                "INVALID_RESPONSE",
                "Daftar rekap harian belum lengkap. Hubungi administrator untuk memeriksa data.",
              );
          }
        })();
        const [loadedProgress] = await Promise.all([
          progressRequest,
          recordsRequest,
        ]);
        progress = loadedProgress;
        if (new Set(rows.map((r) => r.class_id)).size !== rows.length)
          throw new ApiRequestError(
            "INVALID_RESPONSE",
            "Rekap harian memuat kelas ganda. Muat ulang dan periksa data.",
          );
      }
      if (
        !mounted.current ||
        dailyRead.current !== controller ||
        controller.signal.aborted
      )
        return;
      setDaily({
        classes: options.classes.filter(
          (c) => c.periodId === day.academicPeriodId,
        ),
        rows,
        progress,
        canOperate,
        periodId: day.academicPeriodId,
      });
      setBlocked(false);
      setToday(wibDate());
    } catch (e) {
      if (
        mounted.current &&
        dailyRead.current === controller &&
        !controller.signal.aborted
      ) {
        setDailyError(
          e instanceof Error
            ? e.message
            : "Data input absensi belum dapat dimuat.",
        );
        controller.abort();
      }
    } finally {
      if (mounted.current && dailyRead.current === controller)
        setDailyLoading(false);
    }
  }, [admin, date, userId]);
  const loadHistory = useCallback(async () => {
    historyRead.current?.abort();
    const controller = new AbortController();
    historyRead.current = controller;
    setHistory(null);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      if (!historyFilter.safeParse({ from, to, page, pageSize: 25 }).success)
        throw new ApiRequestError(
          "VALIDATION_ERROR",
          "Periksa tanggal riwayat. Tanggal akhir harus setelah atau sama dengan tanggal mulai, maksimal 366 tanggal.",
        );
      const value = verifyStudentList(
        await masterRequest<unknown>(
          api +
            "students?" +
            new URLSearchParams({
              from,
              to,
              page: String(page),
              pageSize: "25",
            }),
          "GET",
          undefined,
          controller.signal,
        ),
        { from, to, page, pageSize: 25, admin, userId },
      );
      if (
        !mounted.current ||
        historyRead.current !== controller ||
        controller.signal.aborted
      )
        return;
      const last = Math.max(1, Math.ceil(value.total / 25));
      if (page > last) {
        setPage(last);
        return;
      }
      setHistory(value);
    } catch (e) {
      if (
        mounted.current &&
        historyRead.current === controller &&
        !controller.signal.aborted
      )
        setHistoryError(
          e instanceof Error
            ? e.message
            : "Riwayat absensi belum dapat dimuat.",
        );
    } finally {
      if (
        mounted.current &&
        historyRead.current === controller &&
        !controller.signal.aborted
      )
        setHistoryLoading(false);
    }
  }, [admin, userId, from, to, page]);
  useEffect(() => {
    mounted.current = true;
    const update = () => setToday(wibDate());
    const timer = setInterval(update, 30000);
    window.addEventListener("focus", update);
    return () => {
      mounted.current = false;
      dailyRead.current?.abort();
      historyRead.current?.abort();
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadDaily();
    });
    return () => {
      active = false;
      dailyRead.current?.abort();
    };
  }, [loadDaily]);
  useEffect(() => {
    const timer = setTimeout(() => void loadHistory(), 150);
    return () => {
      clearTimeout(timer);
      historyRead.current?.abort();
    };
  }, [loadHistory]);
  const requiredLast = Math.max(
    1,
    Math.ceil((daily?.progress?.required.length ?? 0) / 12),
  );
  const shownRequiredPage = Math.min(requiredPage, requiredLast);
  const editable =
    !!daily?.canOperate &&
    date === today &&
    !!daily.periodId &&
    !!daily.progress;
  const disabled = busy || blocked || dailyLoading || !editable;
  function openEditor(target: HTMLButtonElement, initialClass = "") {
    if (disabled || !daily?.progress) return;
    opener.current = target;
    setSelection({
      date,
      classes: daily.classes,
      rows: daily.rows,
      progress: daily.progress,
      initialClass,
    });
  }
  async function save(
    input: unknown,
    signal: AbortSignal,
    previous: StudentRecap | undefined,
  ) {
    if (
      pending.current ||
      blocked ||
      !selection ||
      selection.date !== wibDate()
    )
      throw new ApiRequestError(
        "TODAY_ONLY",
        "Rekap hanya dapat disimpan untuk hari berjalan (WIB). Muat ulang tanggal input.",
      );
    pending.current = true;
    setBusy(true);
    setNotice("");
    try {
      const result = readStudentResponse(
        studentSavedSchema,
        await masterRequest<unknown>(
          api + "students-save",
          "POST",
          input,
          signal,
        ),
      );
      if (
        (previous && result.id !== previous.id) ||
        (!previous && selection.rows.some((r) => r.id === result.id))
      )
        throw new ApiRequestError(
          "INVALID_RESPONSE",
          "Identitas hasil penyimpanan tidak sesuai rekap yang dipilih. Periksa data sebelum mengirim ulang.",
        );
      if (!mounted.current || signal.aborted) return;
      setSelection(null);
      setBlocked(true);
      setNotice(
        "Rekap absensi siswa berhasil disimpan. Kelengkapan harian dan riwayat sedang diperbarui.",
      );
      void loadDaily();
      void loadHistory();
    } catch (e) {
      if (mounted.current && !signal.aborted && uncertain(e)) setBlocked(true);
      throw e;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function historyChange(update: () => void) {
    historyRead.current?.abort();
    setHistory(null);
    setHistoryLoading(true);
    update();
    setPage(1);
  }
  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere] lg:[&_[role=tablist]]:grid-cols-2">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Kehadiran peserta didik
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          Rekap absensi siswa
        </h1>
        <HelpDisclosure><p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          Catat jumlah hadir, sakit, izin, dan alpa per kelas. Rekap harus
          sesuai standar kelas dan jurnal aktif. Tanggal operasional memakai
          WIB.
        </p></HelpDisclosure>
      </header>
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm leading-6"
        >
          {notice}
        </p>
      )}
      {blocked && !selection && (
        <p role="status" className="text-sm">
          Periksa data input terbaru melalui Muat ulang input sebelum
          melanjutkan perubahan. Penyimpanan yang berhasil tetap tersimpan
          meskipun pemuatan berikutnya gagal.
        </p>
      )}
      <Tabs
        label="Absensi siswa"
        defaultValue={initialView}
        value={tab}
        onValueChange={(v) => setTab(v as "input" | "history")}
        items={[
          {
            value: "input",
            label: "Input dan Kelengkapan",
            icon: <ActionIcon action="add" />,
            content: (
              <section className="ui-panel min-w-0 space-y-5">
                <h2 className="text-xl font-semibold">Input absensi harian</h2>
                <fieldset
                  disabled={busy || selection !== null}
                  className="min-w-0"
                >
                  <label className="block min-w-0 max-w-sm text-sm font-medium">
                    Tanggal kegiatan / input
                    <input
                      className="ui-control mt-2"
                      type="date"
                      value={date}
                      onChange={(e) => {
                        dailyRead.current?.abort();
                        dailyRead.current = null;
                        setDaily(null);
                        setDailyLoading(true);
                        setNotice("");
                        setDate(e.target.value);
                        setRequiredPage(1);
                      }}
                    />
                  </label>
                </fieldset>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    disabled={busy || dailyLoading || selection !== null}
                    onClick={() => void loadDaily()}
                  >
                    <ActionIcon action="refresh" />
                    Muat ulang input
                  </Button>
                  {daily?.canOperate && (
                    <Button
                      disabled={disabled || !daily.classes.length}
                      onClick={(e) => openEditor(e.currentTarget)}
                    >
                      Rekap absensi siswa
                    </Button>
                  )}
                </div>
                {dailyLoading && (
                  <p role="status" aria-busy="true">
                    Memuat kelas, rekap harian, dan kelengkapan…
                  </p>
                )}
                <ErrorFeedback message={dailyError} autoFocus />
                {date && date !== today && (
                  <p className="rounded-xl border bg-muted/30 p-4 text-sm">
                    Tanggal ini hanya dapat ditinjau. Input dan pembaruan rekap
                    hanya tersedia pada hari berjalan (WIB).
                  </p>
                )}
                {daily && (
                  <>
                    {!daily.canOperate && (
                      <p className="text-sm leading-6">
                        Input dikelola admin, guru piket yang memenuhi syarat,
                        atau panitia ujian sesuai penugasan. Riwayat akun Anda
                        tetap tersedia pada tab berikutnya.
                      </p>
                    )}
                    {!daily.periodId && (
                      <EmptyState
                        title="Belum ada periode akademik pada tanggal ini."
                        description="Minta admin memeriksa kalender dan periode akademik sebelum mengisi absensi."
                      />
                    )}
                    {daily.progress && (
                      <>
                        <h3 className="font-semibold">
                          Kelengkapan tanggal {date}
                        </h3>
                        <p className="text-sm">
                          {daily.progress.completedCount} dari{" "}
                          {daily.progress.requiredCount} kelas wajib sudah
                          diisi. Rekap kelas tambahan tidak menggantikan kelas
                          wajib.
                        </p>
                        {!daily.progress.required.length && (
                          <EmptyState
                            title="Tidak ada kelas wajib pada tanggal ini."
                            description="Admin tetap dapat mencatat kelas tambahan yang sesuai periode. Hak pengisian diperiksa oleh server."
                          />
                        )}
                        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                          {daily.progress.required
                            .slice(
                              (shownRequiredPage - 1) * 12,
                              shownRequiredPage * 12,
                            )
                            .map((c) => (
                              <article
                                className="min-w-0 space-y-3 rounded-xl border p-4"
                                key={c.id}
                              >
                                <h4 className="font-semibold">{c.name}</h4>
                                <p className="text-sm">
                                  {c.complete ? "Lengkap" : "Belum diisi"} ·
                                  standar{" "}
                                  {c.expectedStudents || "belum ditetapkan"}
                                </p>
                                {daily.classes.some((k) => k.id === c.id) && (
                                  <Button
                                    variant="outline"
                                    disabled={disabled}
                                    onClick={(e) =>
                                      openEditor(e.currentTarget, c.id)
                                    }
                                  >
                                    {c.complete ? "Periksa rekap" : "Isi rekap"}{" "}
                                    {c.name}
                                  </Button>
                                )}
                              </article>
                            ))}
                        </div>
                        {requiredLast > 1 && (
                          <nav
                            aria-label="Halaman kelengkapan kelas"
                            className="flex min-w-0 flex-wrap items-center justify-between gap-3"
                          >
                            <Button
                              variant="outline"
                              disabled={shownRequiredPage <= 1 || busy}
                              onClick={() =>
                                setRequiredPage(shownRequiredPage - 1)
                              }
                            >
                              Kelas sebelumnya
                            </Button>
                            <span className="text-sm">
                              Kelengkapan halaman {shownRequiredPage} dari{" "}
                              {requiredLast}
                            </span>
                            <Button
                              variant="outline"
                              disabled={
                                shownRequiredPage >= requiredLast || busy
                              }
                              onClick={() =>
                                setRequiredPage(shownRequiredPage + 1)
                              }
                            >
                              Kelas berikutnya
                            </Button>
                          </nav>
                        )}
                      </>
                    )}
                  </>
                )}
              </section>
            ),
          },
          {
            value: "history",
            label: "Riwayat Absensi",
            icon: <ActionIcon action="history" />,
            content: (
              <section className="ui-panel min-w-0 space-y-5">
                <h2 className="text-xl font-semibold">Riwayat rekap siswa</h2>
                <p className="text-sm text-muted-foreground">
                  {admin
                    ? "Riwayat seluruh penginput sesuai hak admin."
                    : "Riwayat menampilkan rekap yang dicatat oleh akun Anda."}{" "}
                  Filter riwayat tidak mengubah tanggal atau versi formulir
                  input.
                </p>
                <fieldset
                  disabled={busy || selection !== null}
                  className="grid min-w-0 gap-4 sm:grid-cols-2"
                >
                  <label className="min-w-0 text-sm font-medium">
                    Riwayat mulai
                    <input
                      className="ui-control mt-2"
                      type="date"
                      value={from}
                      onChange={(e) =>
                        historyChange(() => setFrom(e.target.value))
                      }
                    />
                  </label>
                  <label className="min-w-0 text-sm font-medium">
                    Riwayat sampai
                    <input
                      className="ui-control mt-2"
                      type="date"
                      value={to}
                      onChange={(e) =>
                        historyChange(() => setTo(e.target.value))
                      }
                    />
                  </label>
                </fieldset>
                <Button
                  variant="outline"
                  disabled={busy || historyLoading || selection !== null}
                  onClick={() => void loadHistory()}
                >
                  Muat ulang riwayat
                </Button>
                {historyLoading && (
                  <p role="status" aria-busy="true">
                    Memuat riwayat absensi…
                  </p>
                )}
                <ErrorFeedback message={historyError} autoFocus />
                {history && (
                  <>
                    {!history.items.length && (
                      <EmptyState
                        title="Belum ada rekap yang dapat ditampilkan."
                        description="Periksa rentang tanggal dan hak akses akun Anda."
                      />
                    )}
                    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                      {history.items.map((row) => (
                        <article
                          key={row.id}
                          className="min-w-0 space-y-3 rounded-xl border p-4"
                        >
                          <h3 className="font-semibold">
                            {row.className} · {row.date}
                          </h3>
                          <p className="text-sm leading-6">
                            Hadir {row.hadir} · sakit {row.sakit} · izin{" "}
                            {row.izin} · alpa {row.alpa} · total{" "}
                            {studentTotal(row)} siswa
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Dicatat oleh {row.submittedByName} · versi{" "}
                            {row.version}
                          </p>
                          {date === row.date &&
                            daily?.rows.some((r) => r.id === row.id) && (
                              <Button
                                variant="outline"
                                disabled={disabled}
                                onClick={(e) =>
                                  openEditor(e.currentTarget, row.class_id)
                                }
                              >
                                Perbarui rekap {row.className}
                              </Button>
                            )}
                        </article>
                      ))}
                    </div>
                    <nav
                      aria-label="Halaman riwayat absensi"
                      className="flex min-w-0 flex-wrap items-center justify-between gap-3"
                    >
                      <Button
                        variant="outline"
                        disabled={busy || page <= 1}
                        onClick={() => {
                          setHistory(null);
                          setHistoryLoading(true);
                          setPage((v) => v - 1);
                        }}
                      >
                        Sebelumnya
                      </Button>
                      <span className="text-sm">
                        Halaman {page} dari{" "}
                        {Math.max(1, Math.ceil(history.total / 25))} ·{" "}
                        {history.total} catatan
                      </span>
                      <Button
                        variant="outline"
                        disabled={busy || page * 25 >= history.total}
                        onClick={() => {
                          setHistory(null);
                          setHistoryLoading(true);
                          setPage((v) => v + 1);
                        }}
                      >
                        Berikutnya
                      </Button>
                    </nav>
                  </>
                )}
              </section>
            ),
          },
        ]}
      />
      {selection && (
        <StudentEditor
          selection={selection}
          blocked={blocked}
          onSave={save}
          onClose={() => {
            setSelection(null);
            requestAnimationFrame(() => opener.current?.focus());
          }}
          onRecover={() => {
            setSelection(null);
            void loadDaily();
            void loadHistory();
          }}
        />
      )}
    </div>
  );
}
