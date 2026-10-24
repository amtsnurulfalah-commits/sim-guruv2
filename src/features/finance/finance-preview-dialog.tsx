"use client";
import { FormDialog } from "@/components/ui/dialog";
import { primaryAction } from "@/components/ui/styles";
import { formatHonorAmount } from "../../lib/finance/contracts";
import {
  issueLabels,
  type FinancePreview,
  type previewSchema,
} from "../../lib/finance/schemas";
import type { z } from "zod";
export function FinancePreviewDialog({
  preview,
  recipientName,
  request,
  hidden,
  busy,
  error,
  locked,
  now,
  onCancel,
  onConfirm,
}: {
  preview: FinancePreview;
  recipientName?: string | undefined;
  request: z.infer<typeof previewSchema>;
  hidden: boolean;
  busy: boolean;
  error: string;
  locked: boolean;
  now: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const result = preview.result,
    expired = Date.parse(preview.expiresAt) <= now;
  const money = (s: string) => (hidden ? "••••" : formatHonorAmount(s));
  const issues = "issues" in result ? Array.from(new Set(result.issues)) : [];
  const title = {
    finalize: "Finalisasi honorarium",
    correction: "Koreksi honorarium",
    "holiday-waive": "Pengecualian hak libur",
    "holiday-cancel": "Pembatalan penerbitan hak libur",
  }[request.operation];
  const context =
    "period" in request
      ? request.period
      : "targetPeriod" in request
        ? "Slip sumber → " + request.targetPeriod
        : request.date;
  return (
    <FormDialog
      trigger=""
      open
      title="Konfirmasi pratinjau"
      description={title + " · " + context}
      busy={busy}
      error={error}
      onOpenChange={(v) => {
        if (!v) onCancel();
      }}
      footer={
        <button
          className={primaryAction}
          disabled={busy || locked || expired || issues.length > 0}
          onClick={onConfirm}
        >
          Konfirmasi perubahan honorarium
        </button>
      }
    >
      <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
        {request.operation === "correction" && (
          <section className="space-y-2 rounded-xl border p-3 text-sm">
            <h3 className="font-semibold">
              Persetujuan koreksi{recipientName ? " · " + recipientName : ""}
            </h3>
            <p>
              Periode tujuan: {request.targetPeriod}. Slip asli tetap utuh;
              hanya selisih yang diposting.
            </p>
            <p className="whitespace-pre-wrap">
              Alasan keputusan: {request.reason}
            </p>
            <p className="whitespace-pre-wrap">
              Bukti keputusan: {request.evidence}
            </p>
            <p className="text-xs text-muted-foreground">
              Referensi pengajuan: {request.requestId}
            </p>
          </section>
        )}

        {"statements" in result ? (
          <>
            <p>
              Periode {result.period}: {result.statements.length} penerima.
              Seluruh slip akan diterbitkan dan periode dikunci. Snapshot final
              tidak dapat diedit.
            </p>
            <ul className="space-y-2">
              {result.statements.map((s) => (
                <li key={s.recipient.id} className="rounded-lg border p-3">
                  {s.recipient.name} · {s.totalJtm} JTM · {money(s.total)}
                </li>
              ))}
            </ul>
          </>
        ) : "delta" in result ? (
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              ["Basis sebelumnya", result.baseline],
              ["Basis baru", result.correctedTotal],
              ["Selisih", result.delta],
            ].map(([label, value]) => (
              <div className="min-w-0 rounded-lg border p-3" key={label}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="font-semibold">{money(value!)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>
            Hak terdampak: {result.count} · {result.jtm} JTM.{" "}
            {request.operation === "holiday-waive"
              ? "Hak yang dikecualikan tidak dihitung dalam proyeksi atau pembayaran."
              : "Kredit penerbitan dibalik dan hak kembali tertunda. Riwayat tetap disimpan."}
          </p>
        )}
        {issues.length > 0 && (
          <div
            role="alert"
            className="space-y-2 rounded-xl border border-amber-500 p-4"
          >
            <p className="font-semibold">
              Selesaikan kendala berikut sebelum finalisasi:
            </p>
            <ul className="list-inside list-disc">
              {issues.map((x) => (
                <li key={x}>{issueLabels[x.split(":")[0]!] ?? x}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-sm">
          Berlaku sampai{" "}
          {new Date(preview.expiresAt).toLocaleTimeString("id-ID", {
            timeZone: "Asia/Jakarta",
          })}{" "}
          WIB. Perubahan sumber data memerlukan pratinjau baru.
        </p>
        {expired && (
          <p role="alert">
            Pratinjau kedaluwarsa. Batalkan dan buat pratinjau baru.
          </p>
        )}
        {locked && (
          <p role="alert">
            Status tindakan belum pasti atau data berubah. Tutup pratinjau dan
            muat ulang untuk memeriksa hasilnya.
          </p>
        )}
      </div>
    </FormDialog>
  );
}
