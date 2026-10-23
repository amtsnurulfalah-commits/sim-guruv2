"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/dialog";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { Field } from "@/features/auth/account-lifecycle";
import { validateAccount } from "@/lib/accounts/client-validation";
import { applyFieldErrors } from "@/lib/feedback/form-fields";
import { serverFieldErrors } from "@/lib/feedback/api-error";
import { gates, gateSchema, resolveSchema } from "@/lib/migration/contracts";
import { gateLabels, type MigrationBatch, type MigrationReport } from "@/lib/migration/ui-contracts";
export type MigrationAction = {
    kind: "gate";
    batch: MigrationBatch;
} | {
    kind: "resolve";
    batch: MigrationBatch;
    issue: MigrationReport["issues"][number];
};
export function MigrationEditor({ action, blocked, onSave, onClose, onRecover }: {
    action: MigrationAction;
    blocked: boolean;
    onSave: (input: unknown, signal: AbortSignal) => Promise<void>;
    onClose: () => void;
    onRecover: () => void;
}) {
    const [saving, setSaving] = useState(false), [error, setError] = useState("");
    const pending = useRef(false), mounted = useRef(false), request = useRef<AbortController | null>(null);
    const prefix = useId(), formId = prefix + "form";
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending.current || blocked)
            return;
        const form = event.currentTarget, values = new FormData(form), controller = new AbortController();
        pending.current = true;
        request.current = controller;
        setSaving(true);
        setError("");
        try {
            applyFieldErrors(form, {});
            const common = { batchId: action.batch.id, version: action.batch.version, evidence: String(values.get("evidence") ?? ""), reason: String(values.get("reason") ?? "") };
            const input = action.kind === "gate"
                ? validateAccount(gateSchema, { ...common, gate: values.get("gate"), passed: values.get("passed") === "true" ? true : values.get("passed") === "false" ? false : undefined })
                : validateAccount(resolveSchema, { ...common, sequence: action.issue.sequence });
            await onSave(input, controller.signal);
        }
        catch (e) {
            if (mounted.current && !controller.signal.aborted) {
                applyFieldErrors(form, serverFieldErrors(e));
                setError(e instanceof Error ? e.message : "Keputusan belum dapat disimpan.");
            }
        }
        finally {
            pending.current = false;
            request.current = null;
            if (mounted.current)
                setSaving(false);
        }
    }
    return <FormDialog open trigger="" title={action.kind === "gate" ? "Tinjau bukti migrasi" : "Tinjau data migrasi"} description="Catat hasil pemeriksaan dan rujukan bukti privat. Jangan masukkan kata sandi, OTP, token, atau kredensial ke dalam bukti." busy={saving} onOpenChange={open => { if (!open && !pending.current)
        onClose(); }} footer={<Button type="submit" form={formId} disabled={saving || blocked}>{saving ? "Menyimpan…" : action.kind === "gate" ? "Simpan keputusan bukti" : "Simpan hasil peninjauan"}</Button>}>
    <form method="post" id={formId} onSubmit={event => void submit(event)} className="min-w-0 space-y-5 [overflow-wrap:anywhere]" aria-busy={saving}>
      <fieldset disabled={saving || blocked} className="min-w-0 space-y-5">
        <p className="rounded-xl border bg-muted/30 p-3 text-sm">Batch: {action.batch.source} · versi {action.batch.version}</p>
        {action.kind === "gate" ? <>
          <div className="min-w-0 space-y-2 text-sm"><label htmlFor={prefix + "gate"} className="block font-medium">Pemeriksaan</label><select className="ui-control" id={prefix + "gate"} name="gate" defaultValue="" required><option value="" disabled>Pilih pemeriksaan…</option>{gates.map(gate => <option key={gate} value={gate}>{gateLabels[gate]}</option>)}</select></div>
          <div className="min-w-0 space-y-2 text-sm"><label htmlFor={prefix + "passed"} className="block font-medium">Keputusan</label><select className="ui-control" id={prefix + "passed"} name="passed" defaultValue="" required><option value="" disabled>Pilih keputusan…</option><option value="false">Belum memenuhi</option><option value="true">Memenuhi berdasarkan bukti</option></select></div>
          <p className="text-sm leading-6 text-muted-foreground">Kesalahan dan tinjauan yang belum selesai memblokir persetujuan. Rekonsiliasi, pencocokan perubahan terakhir, dan persetujuan pemindahan layanan memerlukan impor terlebih dahulu. Mengubah bukti pendukung mencabut persetujuan pemindahan layanan sebelumnya.</p>
        </> : <><p className="text-sm">{action.issue.source_table} · baris {action.issue.row_number ?? "—"} · {action.issue.code}</p><p className="text-sm leading-6 text-muted-foreground">Tinjauan ini tidak memperbaiki nilai sumber secara otomatis. Menyimpan hasil tinjauan mencabut seluruh persetujuan bukti pada batch ini.</p></>}
        <Field name="evidence" label={action.kind === "gate" ? "Hasil pemeriksaan dan rujukan bukti" : "Hasil peninjauan dan lokasi bukti"} minLength={10} maxLength={1000} multiline/>
        <Field name="reason" label={action.kind === "gate" ? "Alasan keputusan" : "Alasan"} minLength={5} maxLength={500} multiline/>
      </fieldset>
      <ErrorFeedback message={error} autoFocus/>
      {blocked && <div className="space-y-3"><p className="text-sm">Status penyimpanan atau versi data perlu diperiksa. Muat ulang sebelum menyimpan kembali; formulir akan ditutup dan isian yang belum tersimpan dikosongkan.</p><Button type="button" variant="outline" onClick={onRecover}>Muat ulang dan periksa data</Button></div>}
    </form>
  </FormDialog>;
}
