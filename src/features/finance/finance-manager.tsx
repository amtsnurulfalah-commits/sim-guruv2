"use client";
import { ApiRequestError, downloadFile } from "@/lib/feedback/api-error";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { ActionIcon } from "@/components/ui/action-icon";

import { TableRegion } from "@/components/ui/table-region";
import { EmptyState, FeatureState } from "@/components/feedback/feature-state";
import Link from "next/link";
import { TeacherPicker, type TeacherChoice } from "./teacher-picker";
import { useEffect, useRef, useState } from "react";
import { masterRequest } from "../masters/api";
import { wibDate } from "../../lib/calendar/schemas";
import {
  DataForm,
  input,
  panel,
  secondary,
  type Field,
} from "../programs/forms";
import {
  issueLabels,
  type HonorBundle,
  type HonorHistory,
  type HonorStatement,
  type FinancePreview,
  type Operations,
  type HonorSnapshot,
} from "../../lib/finance/schemas";
import { z } from "zod";
import { CorrectionWorkflow, HonorReadiness } from "./honor-readiness";
import { FinancePreviewDialog } from "./finance-preview-dialog";
import {
  commandSchemas,
  previewSchema,
  type FinanceAction,
} from "../../lib/finance/schemas";
import {
  honorBundleSchema,
  honorHistorySchema,
  honorStatementSchema,
  financeOperationsSchema,
  financeTokenSchema,
  financeIdSchema,
  holidayCommandResultSchema,
  readFinanceResponse,
  validateFinanceCommand,
  validateFinancePreview,
  verifyFinancePreview,
  verifyFinanceCommit,
  formatHonorAmount,
} from "../../lib/finance/contracts";
const reason: Field = { key: "reason", label: "Alasan (5–500 karakter)" };
const labels: Record<string, string> = {
  KBM: "KBM",
  PIKET: "Piket",
  UPACARA: "Upacara",
  EXAM_SUPERVISOR: "Pengawas ujian",
  EXAM_COMMITTEE: "Panitia ujian",
  PARTIAL_SUB_KBM: "Relokasi KBM",
  PARTIAL_SUB_PIKET: "Relokasi piket",
  PARTIAL_SUB_EXAM: "Relokasi ujian",
  EVENT: "Jurnal acara",
  HOLIDAY_BONUS: "Bonus libur",
  HOLIDAY_PENDING: "Proyeksi libur",
  REVERSAL: "Pembalikan",
  ALLOWANCE: "Tunjangan",
  TRANSPORT: "Transportasi",
  CORRECTION: "Koreksi",
};
function Breakdown({ s, hidden }: { s: HonorSnapshot; hidden: boolean }) {
  return (
    <div className="min-w-0 space-y-3 [overflow-wrap:anywhere]">
      <h3 className="font-semibold">
        {s.recipient.name} — {s.period}
      </h3>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {[
          ["Total JTM", s.totalJtm],
          ["Tarif per JTM", hidden ? "••••" : formatHonorAmount(s.rate)],
          [
            "Honor mengajar",
            hidden ? "••••" : formatHonorAmount(s.teachingSettled),
          ],
          ["Tunjangan", hidden ? "••••" : formatHonorAmount(s.allowances)],
          [
            "Transport bulanan",
            hidden ? "••••" : formatHonorAmount(s.transportSettled),
          ],
          ["Koreksi", hidden ? "••••" : formatHonorAmount(s.corrections)],
          ["Total pembayaran", hidden ? "••••" : formatHonorAmount(s.total)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <details>
        <summary className="cursor-pointer">
          Rincian sumber ({s.lines.length})
        </summary>
        <TableRegion label="Rincian honorarium">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Sumber</th>
                <th>JTM</th>
                <th>Rupiah mentah</th>
              </tr>
            </thead>
            <tbody>
              {s.lines.map((l, i) => (
                <tr
                  key={
                    l.component +
                    ":" +
                    String(l.ledgerId ?? l.sourceRef ?? l.sourceKey ?? i) +
                    ":" +
                    i
                  }
                  className="border-t"
                >
                  <td className="p-2">{l.date ?? "—"}</td>
                  <td>
                    {labels[l.component] ?? l.component}
                    {l.name ? " / " + l.name : ""}
                  </td>
                  <td>{l.jtm ?? "—"}</td>
                  <td>
                    {hidden ? "••••" : (l.amount ?? l.raw ?? l.delta ?? "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      </details>
      {s.pendingHolidays.length > 0 && (
        <p className="text-sm text-amber-800">
          {s.pendingHolidays.length} hak libur belum diposting. Dalam proyeksi,
          hak ini dihitung satu kali.
        </p>
      )}
    </div>
  );
}
export function FinanceManager({
  admin,
  view = "estimate",
}: {
  admin: boolean;
  view?: "estimate" | "history" | "operations";
}) {
  const [period, setPeriod] = useState(wibDate().slice(0, 7)),
    [mode, setMode] = useState("realized"),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [bundle, setBundle] = useState<HonorBundle | null>(null),
    [history, setHistory] = useState<HonorHistory | null>(null),
    [operations, setOperations] = useState<Operations | null>(null),
    [slip, setSlip] = useState<HonorStatement | null>(null),
    [preview, setPreview] = useState<FinancePreview | null>(null),
    [hidden, setHidden] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [verifyLink, setVerifyLink] = useState(""),
    [loading, setLoading] = useState(true),
    [activeForm, setActiveForm] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [now, setNow] = useState(() => Date.now()),
    [previewRequest, setPreviewRequest] = useState<z.infer<
      typeof previewSchema
    > | null>(null),
    [recapQuery, setRecapQuery] = useState(""),
    [recapPage, setRecapPage] = useState(1);
  const pending = useRef(false),
    mounted = useRef(true),
    writes = useRef<AbortController | null>(null),
    opener = useRef<HTMLElement | null>(null);
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
  const visibility = (v: boolean) => {
    if (v && document.activeElement instanceof HTMLElement)
      opener.current = document.activeElement;
    setActiveForm(v);
  };
  const restoreFocus = () =>
    requestAnimationFrame(() => {
      if (opener.current?.isConnected) opener.current.focus();
    });
  const locked = busy || loading || uncertain;
  function resetContext() {
    setLoading(true);
    setBundle(null);
    setHistory(null);
    setOperations(null);
    setSlip(null);
    setVerifyLink("");
    setPreview(null);
    setPreviewRequest(null);
    setMessage("");
    setRecapPage(1);
  }

  const [blockTeacher, setBlockTeacher] = useState<TeacherChoice | null>(null);

  useEffect(() => {
    const c = new AbortController();
    queueMicrotask(() => {
      if (!c.signal.aborted) {
        setLoading(true);
        setError("");
      }
    });
    const params = new URLSearchParams(
      view === "history"
        ? { kind: "history", period, q, page: String(page) }
        : view === "operations"
          ? { kind: "operations", period }
          : { kind: admin ? "recap" : "estimate", period, mode },
    );
    masterRequest<unknown>(
      "/api/honorarium/read?" + params,
      "GET",
      undefined,
      c.signal,
    )
      .then((r) => {
        if (c.signal.aborted) return;
        if (view === "history") {
          const h = readFinanceResponse(honorHistorySchema, r);
          if (h.page !== page || h.items.some((s) => s.period !== period))
            throw new ApiRequestError(
              "INVALID_RESPONSE",
              "Riwayat tidak sesuai filter. Muat ulang honorarium.",
            );
          setHistory(h);
        } else if (view === "operations") {
          const ops = readFinanceResponse(financeOperationsSchema, r);
          if (
            [...ops.holidays, ...ops.runs].some(
              (v) => v.date.slice(0, 7) !== period,
            )
          )
            throw new ApiRequestError(
              "INVALID_RESPONSE",
              "Operasi tidak sesuai periode yang dipilih. Muat ulang honorarium.",
            );
          setOperations(ops);
        } else {
          const b = readFinanceResponse(honorBundleSchema, r);
          if (b.period !== period || (b.mode !== "final" && b.mode !== mode))
            throw new ApiRequestError(
              "INVALID_RESPONSE",
              "Perhitungan tidak sesuai periode/basis yang dipilih. Muat ulang honorarium.",
            );
          setBundle(b);
        }
        setError("");
        setLoading(false);
        setUncertain(false);
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setError(e instanceof Error ? e.message : "Gagal memuat honorarium.");
          setLoading(false);
          setBundle(null);
          setHistory(null);
          setOperations(null);
          setSlip(null);
          setVerifyLink("");
        }
      });
    return () => c.abort();
  }, [view, admin, period, mode, q, page, revision]);
  async function run(
    work: () => Promise<unknown>,
    refresh = true,
    propagate = false,
  ) {
    if (pending.current || loading || uncertain) {
      if (propagate) throw Error("Muat ulang status sebelum melanjutkan.");
      return;
    }
    pending.current = true;
    if (
      !activeForm &&
      !preview &&
      document.activeElement instanceof HTMLElement
    )
      opener.current = document.activeElement;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      if (!mounted.current) return;
      if (refresh) {
        if (slip) {
          const updated = readFinanceResponse(
            honorStatementSchema,
            await masterRequest<unknown>(
              "/api/honorarium/read?kind=statement&id=" + slip.id,
              "GET",
              undefined,
              writes.current?.signal,
            ),
          );
          if (updated.id !== slip.id)
            throw new ApiRequestError(
              "INVALID_RESPONSE",
              "Slip sumber berubah. Muat ulang honorarium.",
            );
          setSlip(updated);
        }
        setLoading(true);
        setRevision((v) => v + 1);
        setMessage("Tindakan berhasil disimpan.");
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
  async function post<T>(action: FinanceAction, data: unknown): Promise<T> {
    const v =
      action === "preview"
        ? validateFinancePreview(data, slip, wibDate())
        : action === "commit"
          ? commandSchemas.commit.parse(data)
          : validateFinanceCommand(action, data, wibDate());
    const raw = await masterRequest<unknown>(
      "/api/honorarium/" + action,
      "POST",
      v,
      writes.current?.signal,
    );
    if (!mounted.current) throw new DOMException("Aborted", "AbortError");
    if (action === "preview") {
      const request = previewSchema.parse(v),
        result = verifyFinancePreview(raw, request);
      setPreviewRequest(request);
      return result as T;
    }
    if (action === "commit") {
      if (!previewRequest)
        throw new ApiRequestError(
          "INVALID_RESPONSE",
          "Konteks pratinjau tidak tersedia. Muat ulang status honorarium.",
        );
      verifyFinanceCommit(raw, previewRequest);
      return raw as T;
    }
    const schema =
      action === "token"
        ? financeTokenSchema
        : action === "holiday"
          ? holidayCommandResultSchema
          : financeIdSchema;
    const result = readFinanceResponse<unknown>(schema, raw);
    if (
      action === "block" &&
      "id" in v &&
      (result as { id: string }).id !== v.id
    )
      throw new ApiRequestError(
        "INVALID_RESPONSE",
        "Blok transportasi tidak sesuai pilihan. Muat ulang honorarium.",
      );
    if (
      action === "holiday" &&
      (result as { operation?: string }).operation !== "generate"
    )
      throw new ApiRequestError(
        "INVALID_RESPONSE",
        "Hasil posting libur tidak sesuai tindakan. Muat ulang honorarium.",
      );
    return result as T;
  }
  async function downloadPdf(id: string) {
    await run(async () => {
      const security = await masterRequest<{ csrfToken: string }>(
        "/api/auth/csrf?intent=session",
        "GET",
        undefined,
        writes.current?.signal,
      );
      await downloadFile("/api/honorarium/pdf", "slip-honor.pdf", {
        method: "POST",
        signal: AbortSignal.any([
          writes.current?.signal ?? new AbortController().signal,
          AbortSignal.timeout(40000),
        ]),
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": security.csrfToken,
        },
        body: JSON.stringify({ statementId: id }),
      });
    }, false);
  }
  async function showSlip(id: string) {
    await run(async () => {
      const r = await masterRequest<HonorStatement>(
        "/api/honorarium/read?kind=statement&id=" + id,
        "GET",
        undefined,
        writes.current?.signal,
      );
      const result = readFinanceResponse(honorStatementSchema, r);
      if (result.id !== id)
        throw new ApiRequestError(
          "INVALID_RESPONSE",
          "Slip yang diterima tidak sesuai pilihan. Muat ulang riwayat.",
        );
      setSlip(result);
      setVerifyLink("");
      requestAnimationFrame(() =>
        document.getElementById("honor-slip")?.focus(),
      );
    }, false);
  }
  const records =
    bundle?.statements.filter((s) =>
      (s.recipient.name + " " + s.recipient.username)
        .toLocaleLowerCase("id")
        .includes(recapQuery.toLocaleLowerCase("id")),
    ) ?? [];
  const recapPages = Math.max(1, Math.ceil(records.length / 12)),
    currentRecapPage = Math.min(recapPage, recapPages);
  const formProps = { busy, locked, onVisibilityChange: visibility };
  const root = admin ? "/admin/honorarium" : "/honorarium";
  return (
    <div
      className="min-w-0 space-y-5 [overflow-wrap:anywhere]"
      aria-busy={busy || loading}
    >
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">
          {view === "history"
            ? "Riwayat dan slip honorarium"
            : view === "operations"
              ? "Bonus libur dan transportasi"
              : admin
                ? "Rekap honorarium"
                : "Honorarium saya"}
        </h1>
        <nav
          aria-label="Navigasi honorarium"
          className="flex flex-wrap gap-3 text-sm"
        >
          <Link
            prefetch={false}
            href={root}
            aria-current={view === "estimate" ? "page" : undefined}
            className={secondary}
          >
            Estimasi / rekap
          </Link>
          <Link
            prefetch={false}
            href={root + "/riwayat"}
            aria-current={view === "history" ? "page" : undefined}
            className={secondary}
          >
            Riwayat dan slip
          </Link>
          {admin && (
            <Link
              prefetch={false}
              href={root + "/operasi"}
              aria-current={view === "operations" ? "page" : undefined}
              className={secondary}
            >
              Libur / transport
            </Link>
          )}
        </nav>
      </header>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Periode
          <input
            type="month"
            min="2000-01"
            max="2199-12"
            disabled={busy || activeForm || Boolean(preview)}
            className={input}
            value={period}
            onChange={(e) => {
              if (!/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value))
                return;
              setPeriod(e.target.value);
              setPage(1);
              resetContext();
            }}
          />
        </label>
        {view === "estimate" && (
          <label className="text-sm">
            Basis perhitungan
            <select
              className={input}
              value={mode}
              disabled={busy || activeForm || Boolean(preview)}
              onChange={(e) => {
                setMode(e.target.value);
                resetContext();
              }}
            >
              <option value="realized">Realisasi sampai hari ini</option>
              <option value="projection">Estimasi seluruh periode</option>
            </select>
          </label>
        )}
        {view === "history" && (
          <label className="text-sm">
            Cari penerima / transaksi
            <input
              className={input}
              value={q}
              maxLength={100}
              type="search"
              disabled={busy || activeForm || Boolean(preview)}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
                resetContext();
              }}
            />
          </label>
        )}
        <button
          type="button"
          className={secondary}
          onClick={() => setHidden((v) => !v)}
        >
          <ActionIcon action="visibility" />
          {hidden ? "Tampilkan nominal" : "Sembunyikan nominal"}
        </button>
      </div>
      {error && !preview && <ErrorFeedback message={error} />}
      {view === "estimate" && (
        <HonorReadiness admin={admin} period={period} revision={revision} />
      )}
      {view === "operations" && admin && (
        <CorrectionWorkflow
          key={period}
          admin={admin}
          period={period}
          onLockChange={setActiveForm}
        />
      )}
      {message && <p role="status">{message}</p>}
      {hidden && (
        <p className="text-sm text-muted-foreground">
          Nominal disembunyikan di layar. Berkas PDF dan Excel tetap memuat
          nominal lengkap.
        </p>
      )}
      {uncertain && (
        <p role="alert" className="rounded-xl border border-amber-500 p-4">
          Status tindakan belum pasti atau data telah berubah. Tutup
          formulir/pratinjau, muat ulang, dan periksa hasil sebelum mengirim
          ulang.
        </p>
      )}
      <button
        className={secondary}
        disabled={busy || activeForm || Boolean(preview)}
        onClick={() => {
          resetContext();
          setRevision((v) => v + 1);
        }}
      >
        Muat ulang honorarium
      </button>
      {loading && (
        <FeatureState
          error=""
          label="Memuat honorarium…"
          retry={() => setRevision((v) => v + 1)}
        />
      )}
      {!loading && error && !bundle && !history && !operations && (
        <p>Gunakan tombol muat ulang untuk mencoba kembali.</p>
      )}
      {view === "estimate" && (!loading || activeForm) && (
        <>
          <p className="text-sm text-slate-600">
            Tarif per JTM dan tunjangan memakai versi yang berlaku pada akhir
            bulan; tunjangan tidak diprorata. Proyeksi mencakup hak libur
            mendatang, sedangkan transport hanya memakai bukti kehadiran aktual.
            Nilai final mengikuti rincian saat honorarium diterbitkan.
          </p>
          {!bundle ? null : (
            <>
              <p className="font-medium">
                {bundle.mode === "final"
                  ? "Periode final"
                  : mode === "projection"
                    ? "Estimasi seluruh periode"
                    : "Realisasi sampai hari ini"}
              </p>
              {admin && bundle.issues.length > 0 && (
                <ul className="list-disc rounded border border-amber-300 p-5 text-sm text-amber-900">
                  {Array.from(new Set(bundle.issues)).map((x, i) => (
                    <li key={i}>{issueLabels[x.split(":")[0]!] ?? x}</li>
                  ))}
                </ul>
              )}
              {bundle.statements.length === 0 && (
                <p>Tidak ada penerima pada periode ini.</p>
              )}
              {admin && bundle.statements.length > 0 && (
                <label className="block text-sm">
                  Cari penerima rekap
                  <input
                    className={input}
                    type="search"
                    value={recapQuery}
                    maxLength={100}
                    disabled={busy || activeForm}
                    onChange={(e) => {
                      setRecapQuery(e.target.value);
                      setRecapPage(1);
                    }}
                  />
                </label>
              )}
              {bundle.statements.length > 0 && records.length === 0 && (
                <EmptyState title="Tidak ada penerima yang cocok." />
              )}
              {records
                .slice((currentRecapPage - 1) * 12, currentRecapPage * 12)
                .map((s) => (
                  <section className={panel} key={s.recipient.id}>
                    <Breakdown s={s} hidden={hidden} />
                  </section>
                ))}
              {records.length > 12 && (
                <nav
                  aria-label="Halaman rekap honorarium"
                  className="flex flex-wrap items-center gap-3"
                >
                  <button
                    className={secondary}
                    disabled={currentRecapPage === 1 || busy || activeForm}
                    onClick={() => setRecapPage(currentRecapPage - 1)}
                  >
                    Penerima sebelumnya
                  </button>
                  <span>
                    Halaman {currentRecapPage} dari {recapPages} ·{" "}
                    {records.length} penerima
                  </span>
                  <button
                    className={secondary}
                    disabled={
                      currentRecapPage === recapPages || busy || activeForm
                    }
                    onClick={() => setRecapPage(currentRecapPage + 1)}
                  >
                    Penerima berikutnya
                  </button>
                </nav>
              )}
            </>
          )}
          {admin && bundle && bundle.mode !== "final" && (
            <section className={panel}>
              <h2 className="font-semibold">Finalisasi periode</h2>
              <p className="text-sm">
                Seluruh slip diterbitkan dalam satu transaksi. Finalisasi hanya
                tersedia setelah bulan berakhir dan semua hak libur
                diselesaikan. Snapshot final tidak dapat diedit.
              </p>
              <DataForm
                successMessage={false}
                fields={[reason]}
                label="Tinjau finalisasi honorarium"
                submitLabel="Buat pratinjau finalisasi"
                {...formProps}
                onSave={(data) =>
                  formRun(
                    async () =>
                      setPreview(
                        await post<FinancePreview>("preview", {
                          ...data,
                          operation: "finalize",
                          period,
                        }),
                      ),
                    false,
                  )
                }
              />
            </section>
          )}
        </>
      )}
      {view === "history" && (!loading || activeForm) && history && (
        <section className={panel}>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">
              Slip diterbitkan ({history?.total ?? 0})
            </h2>
            <button
              type="button"
              className={secondary}
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    downloadFile(
                      "/api/honorarium/excel?" +
                        new URLSearchParams({ period, q }),
                      "honorarium.xlsx",
                      {
                        signal: AbortSignal.any([
                          writes.current?.signal ??
                            new AbortController().signal,
                          AbortSignal.timeout(40000),
                        ]),
                      },
                    ),
                  false,
                )
              }
            >
              <ActionIcon action="download" />
              Ekspor Excel (semua hasil filter)
            </button>
          </div>
          <TableRegion label="Riwayat honorarium">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Periode</th>
                  <th>Penerima</th>
                  <th>JTM</th>
                  <th>Total rupiah</th>
                  <th>Dokumen</th>
                </tr>
              </thead>
              <tbody>
                {history?.items.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.period}</td>
                    <td>{r.name}</td>
                    <td>{r.jtm}</td>
                    <td>{hidden ? "••••" : formatHonorAmount(r.total)}</td>
                    <td>
                      <button
                        className={secondary}
                        disabled={busy}
                        onClick={() => void showSlip(r.id)}
                      >
                        <ActionIcon action="open" />
                        Buka slip
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRegion>
          {history?.total === 0 && <EmptyState title="Belum ada slip final." />}
          <div className="flex flex-wrap items-center gap-3">
            <button
              className={secondary}
              disabled={page === 1 || locked || activeForm}
              onClick={() => {
                setPage((v) => v - 1);
                resetContext();
              }}
            >
              <ActionIcon action="previous" />
              Sebelumnya
            </button>
            <span>
              Halaman {page} dari{" "}
              {Math.max(1, Math.ceil(history.total / history.pageSize))} ·{" "}
              {history.total} slip
            </span>
            <button
              className={secondary}
              disabled={
                !history ||
                page * history.pageSize >= history.total ||
                locked ||
                activeForm
              }
              onClick={() => {
                setPage((v) => v + 1);
                resetContext();
              }}
            >
              <ActionIcon action="next" />
              Berikutnya
            </button>
          </div>
        </section>
      )}
      {slip && (
        <section
          id="honor-slip"
          tabIndex={-1}
          aria-label="Slip honorarium terpilih"
          className={panel + " honor-print min-w-0 [overflow-wrap:anywhere]"}
        >
          <h2 className="text-lg font-bold">
            Slip Honorarium — {slip.snapshot.school?.name}
          </h2>
          <p className="text-sm">{slip.trxId}</p>
          {slip.corrected && (
            <p className="text-amber-800">
              Dokumen ini memiliki koreksi terkait; rincian dokumen asli tetap
              tersimpan.
            </p>
          )}
          <Breakdown s={slip.snapshot} hidden={hidden} />
          <p className="text-sm">
            Kepala madrasah: {slip.snapshot.school?.headmaster ?? "—"}
          </p>
          <p className="break-all text-xs">Checksum: {slip.checksum}</p>
          {verifyLink && (
            <p className="break-all text-sm">
              Verifikasi:{" "}
              <Link prefetch={false} href={verifyLink}>
                {verifyLink}
              </Link>
            </p>
          )}
          <div className="flex flex-wrap gap-3 print:hidden">
            <button
              className={secondary}
              disabled={busy}
              onClick={() => void downloadPdf(slip.id)}
            >
              <ActionIcon action="download" />
              Unduh PDF terverifikasi
            </button>
            <button className={secondary} onClick={() => window.print()}>
              <ActionIcon action="print" />
              Cetak slip honorarium
            </button>
            <button
              className={secondary}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const r = await post<{ token: string }>("token", {
                    statementId: slip.id,
                  });
                  setVerifyLink(
                    location.origin + "/verifikasi-dokumen#" + r.token,
                  );
                }, false)
              }
            >
              <ActionIcon action="link" />
              Buat tautan verifikasi
            </button>
            <button
              className={secondary}
              disabled={busy || activeForm}
              onClick={() => {
                setSlip(null);
                setVerifyLink("");
              }}
            >
              <ActionIcon action="close" />
              Tutup slip
            </button>
          </div>
          <CorrectionWorkflow
            key={slip.id}
            admin={admin}
            period={slip.snapshot.period}
            statement={slip}
            hidden={hidden}
            onLockChange={setActiveForm}
          />
        </section>
      )}
      {view === "operations" &&
        admin &&
        operations &&
        (!loading || activeForm) && (
          <>
            <section className={panel}>
              <h2 className="font-semibold">
                Hak libur ({operations?.holidays.length ?? 0})
              </h2>
              <p className="text-sm">
                Posting hari ini mulai 16.00 WIB. Pengecualian beralasan hanya
                untuk hak belum diposting; pembatalan penerbitan
                mengembalikannya menjadi tertunda. Posting langsung mencatat hak
                yang memenuhi syarat. Pengecualian menampilkan pratinjau untuk
                dikonfirmasi.
              </p>
              <DataForm
                fields={[
                  {
                    key: "date",
                    label: "Tanggal libur",
                    type: "date",
                    value: period + "-01",
                  },
                  {
                    key: "operation",
                    label: "Tindakan",
                    type: "select",
                    options: [
                      { id: "generate", name: "Posting hak libur" },
                      {
                        id: "waive",
                        name: "Kecualikan hak tertunda dengan alasan",
                      },
                    ],
                  },
                  reason,
                ]}
                successMessage={false}
                label="Atur honorarium hari libur"
                submitLabel="Jalankan tindakan hari libur"
                {...formProps}
                onSave={(data) =>
                  data.operation === "waive"
                    ? formRun(
                        async () =>
                          setPreview(
                            await post<FinancePreview>("preview", {
                              ...data,
                              operation: "holiday-waive",
                            }),
                          ),
                        false,
                      )
                    : formRun(() => post("holiday", data))
                }
              />
              <TableRegion label="Operasi honorarium">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Guru</th>
                      <th>Sumber</th>
                      <th>JTM</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations?.holidays.map((h) => (
                      <tr key={h.sourceKey} className="border-t">
                        <td>{h.date}</td>
                        <td>{h.name}</td>
                        <td>{labels[h.kind] ?? h.kind}</td>
                        <td>{h.jtm}</td>
                        <td>
                          {{
                            projected: "Proyeksi",
                            pending: "Tertunda",
                            posted: "Diposting",
                            waived: "Dikecualikan",
                          }[h.state] ?? h.state}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableRegion>
              {operations.holidays.length === 0 && (
                <EmptyState title="Tidak ada hak libur pada periode ini." />
              )}
              {operations?.runs
                .filter((r) => r.state === "completed")
                .map((r) => (
                  <details key={r.id}>
                    <summary>
                      Run {r.date} — generasi {r.generation}
                    </summary>
                    <DataForm
                      fields={[reason]}
                      successMessage={false}
                      label="Tinjau pembatalan penerbitan"
                      submitLabel="Buat pratinjau pembatalan"
                      {...formProps}
                      onSave={(data) =>
                        formRun(
                          async () =>
                            setPreview(
                              await post<FinancePreview>("preview", {
                                ...data,
                                operation: "holiday-cancel",
                                date: r.date,
                                runId: r.id,
                              }),
                            ),
                          false,
                        )
                      }
                    />
                  </details>
                ))}
              <p className="text-sm text-slate-600">
                Penjadwalan dan pengiriman mengikuti pengaturan administrator.
                Tindakan di bagian ini dijalankan secara manual.
              </p>
            </section>
            <section className={panel}>
              <h2 className="font-semibold">Blok transportasi</h2>
              <TeacherPicker
                value={blockTeacher}
                onChange={setBlockTeacher}
                disabled={locked || activeForm}
              />
              <DataForm
                fields={[
                  {
                    key: "from",
                    label: "Dari tanggal",
                    type: "date",
                    value: period + "-01",
                  },
                  {
                    key: "to",
                    label: "Sampai tanggal",
                    type: "date",
                    value: period + "-01",
                  },
                  reason,
                ]}
                label="Tambah blok transportasi"
                submitLabel="Simpan blok transportasi"
                description={
                  "Sasaran: " +
                  (blockTeacher?.name ?? "semua guru") +
                  ". Periksa penerima dan rentang tanggal sebelum menyimpan."
                }
                {...formProps}
                onSave={(data) =>
                  formRun(() =>
                    post("block", {
                      ...data,
                      userId: blockTeacher?.id ?? null,
                    }),
                  )
                }
              />
              {!operations.blocks.some((b) => b.active) && (
                <EmptyState title="Tidak ada blok transportasi aktif." />
              )}
              {operations?.blocks
                .filter((b) => b.active)
                .map((b) => (
                  <details key={b.id}>
                    <summary>
                      {b.user_id ? "Guru terpilih" : "Semua guru"} ·{" "}
                      {b.date_start}–{b.date_end}: {b.reason}
                    </summary>
                    <DataForm
                      fields={[reason]}
                      label="Nonaktifkan blok transportasi"
                      submitLabel="Konfirmasi penonaktifan blok"
                      {...formProps}
                      onSave={(data) =>
                        formRun(() =>
                          post("block", {
                            ...data,
                            id: b.id,
                            version: String(b.version),
                          }),
                        )
                      }
                    />
                  </details>
                ))}
            </section>
          </>
        )}
      {preview && previewRequest && !activeForm && (
        <FinancePreviewDialog
          preview={preview}
          request={previewRequest}
          hidden={hidden}
          busy={busy}
          locked={uncertain || loading}
          error={error}
          now={now}
          onCancel={() => {
            setPreview(null);
            setPreviewRequest(null);
            restoreFocus();
          }}
          onConfirm={() =>
            void run(async () => {
              if (Date.parse(preview.expiresAt) <= Date.now())
                throw Error("Pratinjau kedaluwarsa. Buat pratinjau baru.");
              await post("commit", { previewId: preview.previewId });
              setPreview(null);
              setPreviewRequest(null);
              restoreFocus();
            })
          }
        />
      )}
    </div>
  );
}
