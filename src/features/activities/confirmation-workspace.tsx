"use client";
import { HelpDisclosure } from "@/components/ui/help-disclosure";
import { formatNumber } from "@/lib/format/number";
import { useActivityDate } from "@/lib/navigation/use-activity-date";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/dialog";
import { ActionIcon } from "@/components/ui/action-icon";
import { EmptyState } from "@/components/feedback/feature-state";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { Field } from "@/features/auth/account-lifecycle";
import { masterRequest } from "@/features/masters/api";
import { wibDate } from "@/lib/calendar/schemas";
import { commandSchemas, dayFilter } from "@/lib/activities/schemas";
import { validateAccount } from "@/lib/accounts/client-validation";
import { ApiRequestError, serverFieldErrors } from "@/lib/feedback/api-error";
import { applyFieldErrors } from "@/lib/feedback/form-fields";
import {
  confirmationListSchema,
  confirmationOptionsSchema,
  confirmationPermissions,
  readConfirmationResponse,
  verifyConfirmationResult,
  type ConfirmationAction,
  type ConfirmationOccurrence,
} from "@/lib/activities/confirmation-contracts";

type Selection = { row: ConfirmationOccurrence; action: ConfirmationAction };
const actionLabels = {
  claim: "Ajukan klaim kehadiran",
  confirm: "Konfirmasi KBM",
  revoke: "Cabut konfirmasi",
};
const uncertain = (error: unknown) =>
  error instanceof ApiRequestError &&
  (["NETWORK_ERROR", "TIMEOUT", "INVALID_RESPONSE"].includes(error.code) ||
    error.status >= 500 ||
    [404, 409].includes(error.status));

export function ConfirmationWorkspace({
  admin,
  userId,
}: {
  admin: boolean;
  userId: string;
}) {
  const prefix = useId();
  const opener = useRef<HTMLButtonElement | null>(null);
  const [date, setDate] = useActivityDate(),
    [today, setToday] = useState(wibDate);
  const [rows, setRows] = useState<ConfirmationOccurrence[] | null>(null);
  const [canOperate, setCanOperate] = useState(false),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [q, setQ] = useState(""),
    [status, setStatus] = useState("all"),
    [page, setPage] = useState(1);
  const mounted = useRef(false),
    pending = useRef(false),
    read = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    read.current?.abort();
    const controller = new AbortController();
    read.current = controller;
    setLoading(true);
    setError("");
    setRows(null);
    setCanOperate(false);
    try {
      if (!dayFilter.safeParse({ date }).success)
        throw new ApiRequestError(
          "VALIDATION_ERROR",
          "Pilih tanggal kegiatan yang valid sebelum memuat penugasan.",
        );
      const [value, capability] = await Promise.all([
        masterRequest<unknown>(
          "/api/activities/occurrences?" + new URLSearchParams({ date }),
          "GET",
          undefined,
          controller.signal,
        ).then((raw) => readConfirmationResponse(confirmationListSchema, raw)),
        admin
          ? Promise.resolve({ canOperate: false })
          : masterRequest<unknown>(
              "/api/activities/options",
              "GET",
              undefined,
              controller.signal,
            ).then((raw) =>
              readConfirmationResponse(confirmationOptionsSchema, raw),
            ),
      ]);
      if (
        !mounted.current ||
        read.current !== controller ||
        controller.signal.aborted
      )
        return;
      if (value.date !== date) {
        throw new ApiRequestError(
          "INVALID_RESPONSE",
          "Penugasan yang diterima tidak sesuai tanggal. Muat ulang kegiatan.",
        );
      }
      setRows(value.items);
      setCanOperate(capability.canOperate);
      setBlocked(false);
      setToday(wibDate());
    } catch (e) {
      if (
        mounted.current &&
        read.current === controller &&
        !controller.signal.aborted
      )
        setError(
          e instanceof Error ? e.message : "Penugasan belum dapat dimuat.",
        );
    } finally {
      if (
        mounted.current &&
        read.current === controller &&
        !controller.signal.aborted
      )
        setLoading(false);
    }
  }, [admin, date]);
  useEffect(() => {
    mounted.current = true;
    // Refresh the display at WIB midnight and when returning to the tab; SQL remains authoritative.
    const updateDate = () => setToday(wibDate());
    const timer = setInterval(updateDate, 30000);
    window.addEventListener("focus", updateDate);
    return () => {
      mounted.current = false;
      read.current?.abort();
      read.current = null;
      clearInterval(timer);
      window.removeEventListener("focus", updateDate);
    };
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
      read.current?.abort();
    };
  }, [load, userId]);

  async function save(input: unknown, signal: AbortSignal) {
    if (!selection || pending.current || blocked)
      throw new ApiRequestError(
        "VALIDATION_ERROR",
        "Muat ulang dan periksa kegiatan sebelum melanjutkan.",
      );
    const current = selection;
    if (
      !confirmationPermissions(current.row, {
        admin,
        userId,
        canOperate,
        today: wibDate(),
      })[current.action]
    ) {
      throw new ApiRequestError(
        "FORBIDDEN",
        "Tindakan ini tidak tersedia untuk kegiatan, akun, atau tanggal yang dipilih. Muat ulang dan periksa statusnya.",
      );
    }
    pending.current = true;
    setBusy(true);
    setNotice("");
    try {
      const raw = await masterRequest<unknown>(
        "/api/activities/" + current.action,
        "POST",
        input,
        signal,
      );
      verifyConfirmationResult(raw, current.row, current.action);
      if (!mounted.current || signal.aborted) return;
      setSelection(null);
      setBlocked(true);
      setNotice(
        current.action === "claim"
          ? "Klaim kehadiran berhasil dicatat. Klaim belum mengonfirmasi KBM dan tidak menambah kredit JTM."
          : current.action === "confirm"
            ? "Konfirmasi KBM berhasil disimpan. Kredit KBM mengikuti jurnal dan aturan server."
            : "Konfirmasi KBM berhasil dicabut. Periksa penugasan terbaru sebelum melanjutkan.",
      );
      void load();
    } catch (e) {
      if (mounted.current && !signal.aborted && uncertain(e)) setBlocked(true);
      throw e;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const filtered = (rows ?? []).filter(
    (row) =>
      (status === "all" || row.confirmed === (status === "confirmed")) &&
      `${row.teacherName} ${row.subjectName} ${row.className}`
        .toLocaleLowerCase("id")
        .includes(q.trim().toLocaleLowerCase("id")),
  );
  const last = Math.max(1, Math.ceil(filtered.length / 25)),
    shownPage = Math.min(page, last);
  const disabled = busy || loading || blocked || rows === null;
  const confirmed = rows?.filter((row) => row.confirmed).length ?? 0;
  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Kegiatan pembelajaran
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          Kegiatan dan konfirmasi KBM
        </h1>
        <HelpDisclosure><p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          Periksa penugasan dan status setiap kegiatan. Klaim pribadi,
          konfirmasi KBM, serta jam hadir harian merupakan bukti yang berbeda.
          Tanggal operasional memakai WIB.
        </p></HelpDisclosure>
      </header>
      <section
        className="ui-panel min-w-0 space-y-4"
        aria-label="Filter konfirmasi KBM"
      >
        <h2 className="text-lg font-semibold">Tanggal dan filter kegiatan</h2>
        <fieldset
          disabled={busy || selection !== null}
          className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="min-w-0 text-sm font-medium">
            Tanggal kegiatan / input
            <input
              className="ui-control mt-2"
              type="date"
              value={date}
              onChange={(e) => {
                read.current?.abort();
                setRows(null);
                setLoading(true);
                setError("");
                setNotice("");
                setDate(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="min-w-0 text-sm font-medium">
            Cari guru, mata pelajaran, atau kelas
            <input
              className="ui-control mt-2"
              maxLength={200}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <div className="min-w-0 text-sm font-medium">
            <label htmlFor={prefix + "status"}>Status konfirmasi</label>
            <select
              id={prefix + "status"}
              className="ui-control mt-2"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Semua status</option>
              <option value="confirmed">Terkonfirmasi</option>
              <option value="pending">Belum dikonfirmasi</option>
            </select>
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={busy || loading || selection !== null}
            onClick={() => void load()}
          >
            <ActionIcon action="refresh" />
            Muat ulang
          </Button>
          <Button
            variant="ghost"
            disabled={busy || selection !== null || (!q && status === "all")}
            onClick={() => {
              setQ("");
              setStatus("all");
              setPage(1);
            }}
          >
            Hapus filter
          </Button>
        </div>
      </section>
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm leading-6"
        >
          {notice}
        </p>
      )}
      <ErrorFeedback message={error} autoFocus />
      {blocked && !selection && (
        <p role="status" className="text-sm">
          Tindakan sebelumnya sudah diproses atau hasilnya belum dapat
          dipastikan. Gunakan Muat ulang dan periksa status terbaru sebelum
          mengirim perubahan lagi.
        </p>
      )}
      {loading && (
        <p role="status" aria-busy="true">
          Memuat penugasan dan hak konfirmasi…
        </p>
      )}
      {date && date !== today && (
        <p className="rounded-xl border bg-muted/30 p-4 text-sm">
          Tanggal ini hanya dapat ditinjau. Klaim dan perubahan konfirmasi
          tersedia pada hari berjalan (WIB); server tetap memeriksa tanggal dan
          periode final.
        </p>
      )}
      {rows !== null && (
        <section
          className="min-w-0 space-y-4"
          aria-label="Daftar penugasan KBM"
        >
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                Penugasan tanggal {date}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {rows.length} kegiatan · {confirmed} terkonfirmasi ·{" "}
                {rows.length - confirmed} belum dikonfirmasi
              </p>
            </div>
            <p className="max-w-lg text-sm leading-6 text-muted-foreground">
              {admin || canOperate
                ? "Anda dapat mengelola konfirmasi kegiatan guru lain. Kegiatan sendiri tidak dapat disahkan sendiri."
                : "Anda dapat mengajukan klaim penugasan sendiri. Konfirmasi dikelola admin atau guru piket yang telah memenuhi persyaratan."}
            </p>
          </div>
          {!filtered.length && (
            <EmptyState
              title={
                rows.length
                  ? "Tidak ada kegiatan sesuai filter."
                  : "Tidak ada penugasan pada tanggal ini."
              }
              description="Periksa tanggal, jadwal mengajar, pencarian, dan status konfirmasi. Membuka tanggal mendatang tidak membuat penugasan baru di luar ketentuan server."
            />
          )}
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            {filtered.slice((shownPage - 1) * 25, shownPage * 25).map((row) => {
              const permissions = confirmationPermissions(row, {
                admin,
                canOperate,
                userId,
                today,
              });
              return (
                <article key={row.id} className="ui-panel min-w-0 space-y-4">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold leading-6">
                        {row.teacherName}
                      </h3>
                      <p className="mt-1 text-sm leading-6">
                        {row.subjectName} · {row.className}
                      </p>
                    </div>
                    <span className="max-w-full rounded-full border bg-muted/30 px-3 py-1 text-xs font-semibold">
                      {row.confirmed ? "Terkonfirmasi" : "Belum dikonfirmasi"}
                    </span>
                  </div>
                  <p className="text-sm">
                    {row.timeStart}–{row.timeEnd} WIB · {formatNumber(row.scheduledJtm)} JTM
                    terjadwal · {formatNumber(row.adjustedJtm)} JTM dasar efektif
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {row.claimed
                      ? "Klaim kehadiran sudah dicatat."
                      : "Belum ada klaim kehadiran."}{" "}
                    Versi {row.version}.
                    {row.journalId
                      ? " Jurnal aktif tersedia; konfirmasi tidak dapat dicabut sebelum jurnal ditangani."
                      : ""}
                  </p>
                  <div className="flex min-w-0 flex-wrap gap-3">
                    {permissions.claim && (
                      <Button
                        variant="outline"
                        disabled={disabled}
                        onClick={(event) => {
                          opener.current = event.currentTarget;
                          setSelection({ row, action: "claim" });
                        }}
                      >
                        <ActionIcon action="submit" />
                        {actionLabels.claim}
                      </Button>
                    )}
                    {(permissions.confirm || permissions.revoke) && (
                      <Button
                        variant="outline"
                        disabled={disabled}
                        onClick={(event) => {
                          opener.current = event.currentTarget;
                          setSelection({
                            row,
                            action: row.confirmed ? "revoke" : "confirm",
                          });
                        }}
                      >
                        <ActionIcon action="confirm" />
                        {row.confirmed
                          ? actionLabels.revoke
                          : actionLabels.confirm}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {filtered.length > 0 && (
            <nav
              aria-label="Halaman penugasan KBM"
              className="flex min-w-0 flex-wrap items-center justify-between gap-3"
            >
              <Button
                variant="outline"
                disabled={loading || busy || shownPage <= 1}
                onClick={() => setPage(shownPage - 1)}
              >
                Sebelumnya
              </Button>
              <span className="text-sm">
                Halaman {shownPage} dari {last} · {filtered.length} hasil
              </span>
              <Button
                variant="outline"
                disabled={loading || busy || shownPage >= last}
                onClick={() => setPage(shownPage + 1)}
              >
                Berikutnya
              </Button>
            </nav>
          )}
        </section>
      )}
      {selection && (
        <ConfirmationEditor
          selection={selection}
          blocked={blocked}
          onSave={save}
          onClose={() => {
            setSelection(null);
            requestAnimationFrame(() => opener.current?.focus());
          }}
          onRecover={() => {
            setSelection(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ConfirmationEditor({
  selection,
  blocked,
  onSave,
  onClose,
  onRecover,
}: {
  selection: Selection;
  blocked: boolean;
  onSave: (input: unknown, signal: AbortSignal) => Promise<void>;
  onClose: () => void;
  onRecover: () => void;
}) {
  const formId = useId(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const mounted = useRef(false),
    pending = useRef(false),
    request = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || blocked) return;
    const form = event.currentTarget,
      controller = new AbortController();
    request.current = controller;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      applyFieldErrors(form, {});
      const input = validateAccount(commandSchemas[selection.action], {
        occurrenceId: selection.row.id,
        version: selection.row.version,
        reason: new FormData(form).get("reason"),
      });
      await onSave(input, controller.signal);
    } catch (e) {
      if (mounted.current && !controller.signal.aborted) {
        applyFieldErrors(form, serverFieldErrors(e));
        setError(
          e instanceof Error ? e.message : "Tindakan belum berhasil diproses.",
        );
      }
    } finally {
      pending.current = false;
      request.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  const { row, action } = selection;
  return (
    <FormDialog
      open
      trigger=""
      title={actionLabels[action]}
      description="Periksa identitas kegiatan dan jelaskan alasan tindakan. Perubahan tetap mengikuti validasi server."
      busy={busy}
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
      footer={
        <Button
          type="submit"
          form={formId}
          variant={action === "revoke" ? "destructive" : "default"}
          disabled={busy || blocked}
        >
          {busy ? "Memproses…" : actionLabels[action]}
        </Button>
      }
    >
      <form
        id={formId}
        method="post"
        onSubmit={(event) => void submit(event)}
        className="min-w-0 space-y-5 [overflow-wrap:anywhere]"
        aria-busy={busy}
      >
        <div className="space-y-2 rounded-xl border bg-muted/30 p-4 text-sm leading-6">
          <p className="font-semibold">
            {row.teacherName} · {row.subjectName} · {row.className}
          </p>
          <p>
            {row.date} · {row.timeStart}–{row.timeEnd} WIB · versi {row.version}
          </p>
          <p>
            {action === "claim"
              ? "Klaim pribadi tidak mengonfirmasi KBM dan tidak memberikan kredit JTM."
              : action === "confirm"
                ? "Konfirmasi merupakan prasyarat jurnal. Kredit KBM tetap dihitung melalui jurnal oleh server."
                : "Pencabutan memerlukan tidak adanya jurnal aktif. Penugasan pengganti dan alokasi yang terkait akan ditangani sesuai ketentuan aplikasi; periksa kembali kegiatan setelah pencabutan."}
          </p>
        </div>
        <fieldset disabled={busy || blocked} className="min-w-0">
          <Field
            name="reason"
            label="Alasan tindakan"
            minLength={5}
            maxLength={500}
            multiline
          />
        </fieldset>
        <ErrorFeedback message={error} autoFocus />
        {blocked && (
          <div className="space-y-3 text-sm leading-6">
            <p>
              Periksa status terbaru sebelum mencoba lagi. Muat ulang akan
              menutup formulir dan mengosongkan alasan yang belum tersimpan.
            </p>
            <Button variant="outline" type="button" onClick={onRecover}>
              Muat ulang dan periksa kegiatan
            </Button>
          </div>
        )}
      </form>
    </FormDialog>
  );
}
