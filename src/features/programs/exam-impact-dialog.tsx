"use client";
import { FormDialog } from "@/components/ui/dialog";
import { primaryAction } from "@/components/ui/styles";
import type { Impact } from "../../lib/programs/schemas";
const labels: Record<string, string> = {
  assignments: "Penugasan terdampak",
  baps: "BAP tersimpan",
  sessions: "Sesi terdampak",
  rooms: "Ruang terdampak",
  netJtm: "JTM bersih yang akan dibalik",
  activeNetJtm: "JTM bersih saat ini",
  activeBaps: "BAP aktif",
};
export function ExamImpactDialog({
  impact,
  subject,
  busy,
  error,
  blocked,
  blockedReason,
  now,
  onCancel,
  onConfirm,
}: {
  impact: Impact;
  subject: string;
  busy: boolean;
  error: string;
  blocked: boolean;
  blockedReason: string;
  now: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const expired = Date.parse(impact.expiresAt) <= now;
  return (
    <FormDialog
      trigger=""
      open
      title="Konfirmasi dampak perubahan"
      description={subject}
      busy={busy}
      error={error}
      onOpenChange={(v) => {
        if (!v) onCancel();
      }}
      footer={
        <button
          className={primaryAction}
          disabled={busy || blocked || expired}
          onClick={onConfirm}
        >
          Konfirmasi perubahan
        </button>
      }
    >
      <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
        <p>
          Periksa dampak sebelum melanjutkan. Pencabutan, penggantian dan
          penghapusan akan membalik kredit terkait serta mengunci BAP aktif.
          Riwayat tetap disimpan. Pengganti harus dikonfirmasi kembali dan
          mengisi BAP sendiri.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          {Object.entries(impact)
            .filter(([key]) => Object.hasOwn(labels, key))
            .map(([key, value]) => (
              <div key={key} className="rounded-lg border bg-muted/30 p-3">
                <dt className="text-sm text-muted-foreground">{labels[key]}</dt>
                <dd className="font-semibold">{String(value)}</dd>
              </div>
            ))}
        </dl>
        <p className="text-sm">
          Berlaku sampai{" "}
          {new Date(impact.expiresAt).toLocaleTimeString("id-ID", {
            timeZone: "Asia/Jakarta",
          })}{" "}
          WIB.
        </p>
        {expired && (
          <p role="alert">
            Pratinjau kedaluwarsa. Batalkan dan buat pratinjau baru.
          </p>
        )}
        {blocked && <p role="alert">{blockedReason}</p>}
      </div>
    </FormDialog>
  );
}
