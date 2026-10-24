"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { z } from "zod";
import { masterRequest } from "../masters/api";
import { DataForm, input, panel, secondary } from "../programs/forms";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/feedback/feature-state";
import {
  commandSchemas,
  issueLabels,
  type HonorStatement,
  type previewSchema,
} from "@/lib/finance/schemas";
import {
  financeIdSchema,
  honorStatementSchema,
  readFinanceResponse,
  verifyFinancePreview,
  verifyFinanceCommit,
} from "@/lib/finance/contracts";
import {
  readinessSchema,
  requestsSchema,
  correctionStatus,
  type CorrectionRequest,
} from "@/lib/finance/readiness";
import { FinancePreviewDialog } from "./finance-preview-dialog";
import { ApiRequestError } from "@/lib/feedback/api-error";

function useFinanceRead<T>(
  query: string,
  schema: z.ZodType<T>,
  revision: number,
) {
  const [result, setResult] = useState<{
    data?: T;
    error?: string;
    loading: boolean;
  }>({ loading: true });
  useEffect(() => {
    const c = new AbortController();
    queueMicrotask(() => {
      if (!c.signal.aborted) setResult({ loading: true });
    });
    masterRequest<unknown>(
      "/api/honorarium/read?" + query,
      "GET",
      undefined,
      c.signal,
    )
      .then((raw) => {
        if (!c.signal.aborted)
          setResult({ data: readFinanceResponse(schema, raw), loading: false });
      })
      .catch((e: unknown) => {
        if (!c.signal.aborted)
          setResult({
            error: e instanceof Error ? e.message : "Gagal memuat data.",
            loading: false,
          });
      });
    return () => c.abort();
  }, [query, schema, revision]);
  return result;
}
const issueActions: Record<string, { href: string; label: string }> = {
  RATE_MISSING: { href: "/admin/master", label: "Periksa Data Master → Tarif" },
  SCHOOL_SIGNATORY_MISSING: {
    href: "/admin/master",
    label: "Periksa Data Master → Identitas madrasah / kepala madrasah",
  },
  HOLIDAY_PENDING: {
    href: "/admin/honorarium/operasi",
    label: "Periksa hak libur pada periode yang sama",
  },
  HOLIDAY_INCONSISTENT: {
    href: "/admin/honorarium/operasi",
    label: "Periksa posting libur dan sumber jadwal/kalender",
  },
  NEGATIVE_PAYABLE: {
    href: "/admin/honorarium/riwayat",
    label: "Tinjau koreksi penerima dan periode tujuan",
  },
  LEDGER_INCONSISTENT: {
    href: "/admin/honorarium",
    label: "Periksa rincian sumber JTM dan hubungi administrator",
  },
};
const issueText = (value: string) => issueLabels[value.split(":")[0]!] ?? value;
export function HonorReadiness({
  admin,
  period,
  revision,
}: {
  admin: boolean;
  period: string;
  revision: number;
}) {
  const [reload, setReload] = useState(0),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const result = useFinanceRead(
    "kind=readiness&period=" + period,
    readinessSchema,
    revision + reload,
  );
  const data = result.data?.period === period ? result.data : undefined;
  const recipients =
    data?.recipients.filter((r) =>
      r.name.toLocaleLowerCase("id").includes(query.toLocaleLowerCase("id")),
    ) ?? [];
  const safePage = Math.min(
    page,
    Math.max(1, Math.ceil(recipients.length / 20)),
  );
  return (
    <section
      aria-label="Kesiapan honorarium"
      className={
        panel + " min-w-0 space-y-4 [overflow-wrap:anywhere] print:hidden"
      }
      aria-busy={result.loading}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Kesiapan honorarium · {period}
        </h2>
        <button
          className={secondary}
          disabled={result.loading}
          onClick={() => setReload((n) => n + 1)}
        >
          Periksa ulang kesiapan
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        Pemeriksaan memakai basis realisasi dari engine honorarium. Kelengkapan
        administrasi ditampilkan terpisah dari penghalang finalisasi.
      </p>
      {result.loading && <p role="status">Memeriksa kesiapan…</p>}
      {result.error && <ErrorFeedback message={result.error} />}
      {!result.loading && !result.error && !data && (
        <ErrorFeedback message="Periode hasil pemeriksaan tidak sesuai. Periksa ulang kesiapan." />
      )}
      {data && (
        <>
          <p role="status" className="font-medium">
            {data.mode === "final"
              ? "Periode sudah final; snapshot asli dipertahankan."
              : !admin
                ? "Informasi pribadi; kesiapan seluruh periode diperiksa oleh admin."
                : data.issues.length
                  ? "Finalisasi masih memiliki kendala periode."
                  : "Tidak ada blocker finalisasi yang teridentifikasi saat pemeriksaan."}
          </p>
          {admin && data.issues.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {Array.from(new Set(data.issues)).map((i) => (
                <li key={i}>
                  {issueText(i)}
                  {issueActions[i.split(":")[0]!] && (
                    <Link
                      prefetch={false}
                      className="ml-2 underline"
                      href={issueActions[i.split(":")[0]!]!.href}
                    >
                      {issueActions[i.split(":")[0]!]!.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm">{data.note}</p>
          <label className="block text-sm">
            Cari penerima
            <input
              className={input}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          {!recipients.length && (
            <EmptyState title="Tidak ada penerima yang sesuai." />
          )}
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            {recipients.slice((safePage - 1) * 20, safePage * 20).map((r) => (
              <article key={r.userId} className="min-w-0 rounded-xl border p-4">
                <h3 className="font-semibold">{r.name}</h3>
                {r.issues.length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-amber-900">
                    {r.issues.map((i) => (
                      <li key={i}>{issueText(i)}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-sm">
                  {r.administrative.length} catatan administrasi pada sumber
                  yang sudah terbentuk.
                </p>
                {r.administrative.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer">
                      Lihat sumber dan tindakan
                    </summary>
                    <ul className="mt-2 space-y-3 text-sm">
                      {r.administrative.map((a) => (
                        <li key={a.kind + a.source_id}>
                          <p>
                            {a.date} · {a.title}
                          </p>
                          <p>
                            {a.kind === "confirmation"
                              ? "Belum dikonfirmasi petugas"
                              : a.kind === "journal"
                                ? "Jurnal belum tersedia"
                                : a.kind === "bap"
                                  ? "BAP belum tersedia"
                                  : a.kind === "event"
                                    ? "Jurnal acara belum tersedia"
                                    : "Waktu pulang belum tercatat; transport belum terbentuk"}
                          </p>
                          <Link
                            prefetch={false}
                            className="underline underline-offset-4"
                            href={a.href}
                          >
                            Periksa sumber dan syarat perbaikan
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Tanggal lama/final dan kewenangan tetap mengikuti validasi
                      halaman sumber; catatan ini tidak membuka kembali
                      pengisian yang ditutup.
                    </p>
                  </details>
                )}
              </article>
            ))}
          </div>
          <Pagination
            page={safePage}
            pageSize={20}
            total={recipients.length}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}

export function CorrectionWorkflow({
  admin,
  period,
  statement,
  hidden = false,
  onLockChange,
}: {
  admin: boolean;
  period: string;
  statement?: HonorStatement;
  hidden?: boolean;
  onLockChange?: (locked: boolean) => void;
}) {
  const [revision, setRevision] = useState(0),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [formOpen, setFormOpen] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState(false);
  const [selection, setSelection] = useState<{
    req: CorrectionRequest;
    slip: HonorStatement;
  } | null>(null);
  const [proposal, setProposal] = useState<{
    request: z.infer<typeof previewSchema>;
    preview: ReturnType<typeof verifyFinancePreview>;
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pending = useRef(false),
    alive = useRef(true),
    requestKey = useRef<string | null>(null),
    controller = useRef<AbortController | null>(null);
  const result = useFinanceRead(
    "kind=requests&period=" +
      period +
      "&page=" +
      page +
      (statement ? "&statementId=" + statement.id : ""),
    requestsSchema,
    revision,
  );
  useEffect(() => {
    alive.current = true;
    controller.current = new AbortController();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive.current = false;
      controller.current?.abort();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    onLockChange?.(busy || formOpen || Boolean(selection) || Boolean(proposal));
    return () => onLockChange?.(false);
  }, [busy, formOpen, selection, proposal, onLockChange]);
  const locked = busy || uncertain || result.loading || Boolean(result.error);
  async function command(
    action: "request" | "review" | "preview" | "commit",
    data: unknown,
  ) {
    return masterRequest<unknown>(
      "/api/honorarium/" + action,
      "POST",
      commandSchemas[action].parse(data),
      controller.current?.signal,
    );
  }
  async function run(work: () => Promise<void>) {
    if (pending.current || locked)
      throw Error("Periksa ulang status pengajuan sebelum melanjutkan.");
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      if (alive.current) {
        setMessage("Status koreksi berhasil diperbarui.");
        setRevision((n) => n + 1);
      }
    } catch (e) {
      if (!alive.current) return;
      const text =
        e instanceof Error && e.name === "ZodError"
          ? "Periksa kembali isian formulir."
          : e instanceof Error
            ? e.message
            : "Permintaan gagal.";
      setError(text);
      if (
        e instanceof ApiRequestError &&
        (e.status >= 500 ||
          [
            "NETWORK_ERROR",
            "TIMEOUT",
            "INVALID_RESPONSE",
            "PREVIEW_STALE",
            "VERSION_CONFLICT",
            "CORRECTION_PENDING",
          ].includes(e.code))
      )
        setUncertain(true);
      throw e;
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const refresh = () => {
    requestKey.current = null;
    setSelection(null);
    setProposal(null);
    setError("");
    setRevision((n) => n + 1);
  };
  useEffect(() => {
    if (result.data && !result.loading && !result.error)
      queueMicrotask(() => {
        if (alive.current) setUncertain(false);
      });
  }, [result]);
  const list =
    result.data?.page === page
      ? result.data.items.filter(
          (r) => !statement || r.statement_id === statement.id,
        )
      : [];
  const reasonField = {
    key: "reason",
    label: "Alasan (5–500 karakter)",
    type: "textarea" as const,
  };
  return (
    <section
      aria-label="Pengajuan dan pemeriksaan koreksi"
      className={
        panel + " min-w-0 space-y-4 [overflow-wrap:anywhere] print:hidden"
      }
      aria-busy={busy || result.loading}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Pengajuan dan pemeriksaan koreksi · {period}
        </h2>
        <button
          className={secondary}
          disabled={busy || formOpen}
          onClick={refresh}
        >
          Muat ulang pengajuan
        </button>
      </div>
      <p className="text-sm">
        Pengaju dan penerima honor tidak boleh menjadi pemeriksa. Persetujuan
        memposting selisih ke periode tujuan terbuka; slip sumber tetap utuh.
        Daftar mengikuti periode slip sumber.
      </p>
      {(error || result.error) && (
        <ErrorFeedback message={error || result.error!} />
      )}
      {message && (
        <p role="status" className="text-sm text-emerald-800">
          {message}
        </p>
      )}
      {uncertain && (
        <p role="alert">
          Hasil belum pasti atau data berubah. Muat ulang pengajuan sebelum
          mengirim lagi.
        </p>
      )}
      {statement && (
        <DataForm
          label="Ajukan koreksi honorarium"
          submitLabel="Kirim permintaan koreksi"
          fields={[
            reasonField,
            {
              key: "evidence",
              label: "Referensi bukti (5–1000 karakter)",
              type: "textarea",
            },
          ]}
          busy={busy}
          locked={locked}
          onVisibilityChange={setFormOpen}
          description={
            "Slip " +
            statement.trxId +
            ". Cantumkan sumber atau referensi bukti; jangan menuliskan password/token."
          }
          onSave={async (data) => {
            await run(async () => {
              requestKey.current ??= crypto.randomUUID();
              readFinanceResponse(
                financeIdSchema,
                await command("request", {
                  ...data,
                  statementId: statement.id,
                  requestKey: requestKey.current,
                }),
              );
              requestKey.current = null;
            });
          }}
        />
      )}
      {result.loading && <p role="status">Memuat pengajuan…</p>}
      {!result.loading && !result.error && !list.length && (
        <EmptyState title="Belum ada pengajuan pada halaman ini." />
      )}
      {list.map((r) => (
        <article key={r.id} className="min-w-0 space-y-2 rounded-xl border p-4">
          <h3 className="font-semibold">
            {r.recipient} · {correctionStatus[r.status]}
          </h3>
          <p className="text-xs text-muted-foreground">Slip {r.trx_id}</p>
          <p className="whitespace-pre-wrap text-sm">{r.reason}</p>
          <p className="whitespace-pre-wrap text-sm">
            Bukti:{" "}
            {r.evidence ||
              "Belum dicantumkan pada pengajuan lama; pemeriksa wajib melengkapi referensi bukti saat pratinjau."}
          </p>
          <p className="text-sm">
            Pemeriksa: {r.reviewer ?? "Belum ditetapkan"}
          </p>
          {r.decision_reason && (
            <p className="text-sm">Keputusan: {r.decision_reason}</p>
          )}
          {r.history.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm">
                Riwayat keputusan
              </summary>
              <ul className="space-y-2 text-sm">
                {r.history.map((h, i) => (
                  <li key={i}>
                    {h.actor} ·{" "}
                    {h.action === "claim"
                      ? "Mulai pemeriksaan"
                      : h.action === "submitted"
                        ? "Diajukan"
                        : h.action === "approved"
                          ? "Disetujui"
                          : "Ditolak"}{" "}
                    ·{" "}
                    {new Date(h.at).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}{" "}
                    WIB<p className="whitespace-pre-wrap">{h.reason}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {admin && r.can_review && r.status === "submitted" && (
            <button
              className={secondary}
              disabled={locked || formOpen}
              onClick={() =>
                void run(async () => {
                  readFinanceResponse(
                    financeIdSchema,
                    await command("review", {
                      requestId: r.id,
                      version: r.version,
                      decision: "claim",
                      reason: "Mulai pemeriksaan bukti koreksi honorarium",
                    }),
                  );
                }).catch(() => {})
              }
            >
              Mulai pemeriksaan
            </button>
          )}
          {admin && r.can_review && r.status === "reviewing" && (
            <div className="flex flex-wrap gap-3">
              <button
                className={secondary}
                disabled={locked || formOpen}
                onClick={() =>
                  void run(async () => {
                    const slip = readFinanceResponse(
                      honorStatementSchema,
                      await masterRequest(
                        "/api/honorarium/read?kind=statement&id=" +
                          r.statement_id,
                        "GET",
                        undefined,
                        controller.current?.signal,
                      ),
                    );
                    if (slip.id !== r.statement_id)
                      throw new ApiRequestError(
                        "INVALID_RESPONSE",
                        "Slip tidak sesuai pengajuan.",
                      );
                    setSelection({ req: r, slip });
                  }).catch(() => {})
                }
              >
                Siapkan persetujuan koreksi
              </button>
              <DataForm
                label="Tolak pengajuan"
                submitLabel="Konfirmasi penolakan"
                fields={[reasonField]}
                busy={busy}
                locked={locked}
                onVisibilityChange={setFormOpen}
                onSave={async (data) => {
                  await run(async () => {
                    readFinanceResponse(
                      financeIdSchema,
                      await command("review", {
                        ...data,
                        requestId: r.id,
                        version: r.version,
                        decision: "reject",
                      }),
                    );
                  });
                }}
              />
            </div>
          )}
          {admin &&
            !r.can_review &&
            ["submitted", "reviewing"].includes(r.status) && (
              <p className="text-xs text-muted-foreground">
                Memerlukan admin pemeriksa yang berbeda dari pengaju/penerima
                dan sesuai penugasan pemeriksa.
              </p>
            )}
        </article>
      ))}
      <Pagination
        page={page}
        pageSize={20}
        total={result.data?.total ?? 0}
        onPageChange={setPage}
        disabled={busy || formOpen || Boolean(selection) || Boolean(proposal)}
      />
      {selection && !proposal && (
        <DataForm
          key={selection.req.id}
          openOnMount
          label="Tinjau koreksi honorarium"
          submitLabel="Buat pratinjau persetujuan"
          description={
            selection.slip.snapshot.recipient.name +
            " · Slip " +
            selection.slip.trxId +
            ". Isi basis yang benar dan alasan keputusan. Tarif asli dan basis koreksi terakhir dihitung server."
          }
          busy={busy}
          locked={locked}
          onDismiss={() => setSelection(null)}
          onVisibilityChange={setFormOpen}
          successMessage={false}
          fields={[
            { key: "targetPeriod", label: "Periode tujuan (YYYY-MM)" },
            {
              key: "correctedJtm",
              label: "Total JTM yang benar",
              value: selection.slip.snapshot.totalJtm,
            },
            {
              key: "correctedAllowances",
              label: "Total tunjangan yang benar (rupiah)",
              value: selection.slip.snapshot.allowances,
            },
            {
              key: "correctedTransportRaw",
              label: "Transport mentah yang benar",
              value: selection.slip.snapshot.transportRaw,
            },
            {
              key: "evidence",
              label: "Referensi bukti keputusan",
              type: "textarea",
              value: selection.req.evidence,
            },
            reasonField,
          ]}
          onSave={async (data) => {
            await run(async () => {
              const request = commandSchemas.preview.parse({
                ...data,
                operation: "correction",
                statementId: selection.slip.id,
                requestId: selection.req.id,
                requestVersion: selection.req.version,
              });
              const preview = verifyFinancePreview(
                await command("preview", request),
                request,
              );
              setProposal({ request, preview });
            });
          }}
        />
      )}
      {proposal && (
        <FinancePreviewDialog
          preview={proposal.preview}
          recipientName={selection?.slip.snapshot.recipient.name}
          request={proposal.request}
          hidden={hidden}
          busy={busy}
          locked={uncertain}
          error={error}
          now={now}
          onCancel={() => {
            setProposal(null);
            setSelection(null);
          }}
          onConfirm={() =>
            void run(async () => {
              verifyFinanceCommit(
                await command("commit", {
                  previewId: proposal.preview.previewId,
                }),
                proposal.request,
              );
              setProposal(null);
              setSelection(null);
            }).catch(() => {})
          }
        />
      )}
    </section>
  );
}
