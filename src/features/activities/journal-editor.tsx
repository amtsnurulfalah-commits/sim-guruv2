"use client";
import { journalContentFields } from "@/lib/activities/journal-content";
import { DraftStatus, useFormDraft } from "@/features/drafts/form-draft";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { FormDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { Field } from "@/features/auth/account-lifecycle";
import { validateAccount } from "@/lib/accounts/client-validation";
import { ApiRequestError, serverFieldErrors } from "@/lib/feedback/api-error";
import { applyFieldErrors } from "@/lib/feedback/form-fields";
import { commandSchemas } from "@/lib/activities/schemas";
import type { JournalRecord, JournalEligible, JournalBlock, JournalOptions } from "@/lib/activities/journal-contracts";
export type JournalAction = {
    kind: "create";
    date: string;
    eligible: JournalEligible[];
    h1: boolean;
} | {
    kind: "edit";
    journal: JournalRecord;
} | {
    kind: "delete";
    journal: JournalRecord;
} | {
    kind: "h1";
    enabled: boolean;
} | {
    kind: "block-new";
    date: string;
    subjects: JournalOptions["subjects"];
} | {
    kind: "block-toggle";
    block: JournalBlock;
    subject: string;
};
export function JournalEditor({ action, userId, blocked, onSave, onClose, onRecover, onCloseAutoFocus }: {
    action: JournalAction;
    userId: string;
    blocked: boolean;
    onSave: (input: unknown, signal: AbortSignal) => Promise<void>;
    onClose: () => void;
    onRecover: () => void;
    onCloseAutoFocus: (event: Event) => void;
}) {
    const edit = action.kind === "edit" ? action.journal : null;
    const [present, setPresent] = useState(String(edit?.present ?? 0)), [absent, setAbsent] = useState(String(edit?.absent ?? 0));
    const [occurrence, setOccurrence] = useState("");
    const [saving, setSaving] = useState(false), [error, setError] = useState("");
    const mounted = useRef(false), pending = useRef(false), controller = useRef<AbortController | null>(null);
    const prefix = useId(), formId = prefix + "form";
    const selected = action.kind === "create" ? action.eligible.find(row => row.id === occurrence) : null;
    const { formRef: attachDraftForm, ...draft } = useFormDraft(formId, edit || selected ? {
        scope: { account: userId, module: "journal", entity: edit ? "edit:" + edit.id : "create:" + selected!.id,
            basis: JSON.stringify(edit ?? { row: selected, h1: action.kind === "create" && action.h1 }) },
        fields: { ...Object.fromEntries(journalContentFields.map(field => [field.name, 2000])), material: 2000, present: 4, absent: 4, notes: 2000, reason: 500 },
    } : null, true, values => { setPresent(values.present!); setAbsent(values.absent!); });
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
    const isJournal = action.kind === "create" || action.kind === "edit";
    const title = isJournal ? "Jurnal pembelajaran" : action.kind === "delete" ? "Hapus jurnal pembelajaran" : action.kind === "h1" ? "Kebijakan jurnal H-1" : action.kind === "block-new" ? "Blok pengisian jurnal" : "Ubah status blok jurnal";
    const submitLabel = isJournal ? "Simpan jurnal" : action.kind === "delete" ? "Konfirmasi penghapusan jurnal" : action.kind === "h1" ? `${action.enabled ? "Aktifkan" : "Nonaktifkan"} jurnal H-1` : action.kind === "block-new" ? "Simpan blok jurnal" : "Simpan status blok jurnal";
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending.current || blocked)
            return;
        const form = event.currentTarget, data = new FormData(form), request = new AbortController();
        pending.current = true;
        controller.current = request;
        setSaving(true);
        setError("");
        const text = (name: string) => String(data.get(name) ?? "");
        let draftTicket: number | undefined;
        try {
            applyFieldErrors(form, {});
            const reason = text("reason");
            let input: unknown;
            if (action.kind === "create" || action.kind === "edit") {
                const fields = { ...Object.fromEntries(journalContentFields.map(field => [field.name, text(field.name)])), material: text("material"), present: text("present") === "" ? undefined : Number(text("present")), absent: text("absent") === "" ? undefined : Number(text("absent")), notes: text("notes"), reason };
                input = action.kind === "create"
                    ? validateAccount(commandSchemas["journal-create"], { ...fields, occurrenceId: text("occurrenceId") })
                    : validateAccount(commandSchemas["journal-edit"], { ...fields, journalId: action.journal.id, version: action.journal.version });
                const expected = action.kind === "create" ? action.eligible.find(row => row.id === text("occurrenceId"))?.expectedStudents : undefined;
                const total = Number(fields.present) + Number(fields.absent);
                if (total > 1000 || (expected && total !== expected))
                    throw new ApiRequestError("STUDENT_COUNT_MISMATCH", "Jumlah siswa hadir dan absen belum sesuai ketentuan.", 422, { present: [expected ? `Jumlah hadir + absen harus ${expected}.` : "Jumlah hadir + absen maksimal 1000."], absent: ["Periksa jumlah bersama siswa hadir."] });
            }
            else if (action.kind === "delete")
                input = validateAccount(commandSchemas["journal-delete"], { journalId: action.journal.id, version: action.journal.version, reason });
            else if (action.kind === "h1")
                input = validateAccount(commandSchemas.h1, { enabled: action.enabled, reason });
            else
                input = validateAccount(commandSchemas.block, action.kind === "block-new" ? { subjectId: text("subjectId"), dateStart: text("dateStart"), dateEnd: text("dateEnd"), message: text("message"), active: true, version: "0", reason } : { id: action.block.id, subjectId: action.block.subject_id, dateStart: action.block.date_start, dateEnd: action.block.date_end, message: action.block.message, active: !action.block.active, version: action.block.version, reason }, true);
            draftTicket = draft.beforeSubmit();
            await onSave(input, request.signal);
            draft.submitted(draftTicket);
        }
        catch (e) {
            draft.failed(e);
            if (mounted.current && !request.signal.aborted) {
                const fields = serverFieldErrors(e);
                if (e instanceof ApiRequestError && ["STUDENT_COUNT_MISMATCH", "STUDENT_ATTENDANCE_MISMATCH"].includes(e.code)) {
                    fields.present ??= "Cocokkan jumlah siswa dengan standar kelas dan rekap absensi yang tersedia.";
                    fields.absent ??= fields.present;
                }
                applyFieldErrors(form, fields);
                setError(e instanceof Error ? e.message : "Perubahan jurnal belum dapat disimpan.");
            }
        }
        finally {
            pending.current = false;
            controller.current = null;
            if (mounted.current)
                setSaving(false);
        }
    }
    return <FormDialog onCloseAutoFocus={onCloseAutoFocus} title={title} trigger="" open busy={saving} onDiscard={draft.remove} description="Periksa kegiatan dan isian sebelum menyimpan. Alasan dicatat untuk riwayat audit." onOpenChange={open => { if (!open && !pending.current)
        onClose(); }} footer={<Button type="submit" form={formId} variant={action.kind === "delete" ? "destructive" : "default"} disabled={saving || blocked || (action.kind === "create" && !action.eligible.length) || !!draft.candidate}>{saving ? "Menyimpan…" : submitLabel}</Button>}>
    <form ref={attachDraftForm} method="post" id={formId} onSubmit={event => void submit(event)} className="min-w-0 space-y-5 [overflow-wrap:anywhere]" aria-busy={saving}>
      <fieldset disabled={saving || blocked} className="min-w-0 space-y-5">
        {isJournal && <>
          <h2 className="font-semibold">{action.kind === "edit" ? `Ubah jurnal ${action.journal.date}` : action.kind === "create" ? `Input jurnal tanggal ${action.date}` : ""}</h2>
          {action.kind === "create" && <><p className="text-sm">H-1: {action.h1 ? "aktif, bobot 80% dibulatkan satu desimal" : "belum aktif"}. Jumlah siswa wajib cocok dengan rekap yang tersedia.</p><div className="min-w-0 space-y-2 text-sm"><label htmlFor={prefix + "occurrence"} className="block font-medium">Kegiatan</label><select id={prefix + "occurrence"} name="occurrenceId" className="ui-control" defaultValue="" required onChange={event => { const row = action.eligible.find(value => value.id === event.target.value); setOccurrence(event.target.value); for (const name of ["material", "notes", "reason", ...journalContentFields.map(field => field.name)]) { const field = event.target.form?.elements.namedItem(name); if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) field.value = ""; } setPresent(String(row?.expectedStudents ?? 0)); setAbsent("0"); }}><option value="" disabled>Pilih kegiatan…</option>{action.eligible.map(row => <option key={row.id} value={row.id}>{row.subjectName} · {row.className} · {row.timeStart}–{row.timeEnd}</option>)}</select></div></>}
          {edit && <p className="rounded-xl border bg-muted/30 p-3 text-sm">{edit.teacherName} · {edit.subjectName} · {edit.className} · versi {edit.version}. Bobot dan kredit JTM tetap dihitung oleh server.</p>}
          {(edit || selected) && <DraftStatus draft={draft} disabled={saving || blocked}/>}
          <Field name="material" label="Materi pembelajaran" value={edit?.material ?? ""} maxLength={2000} multiline/>
          <section className="min-w-0 space-y-4" aria-label="Tujuan dan evaluasi pembelajaran"><h3 className="font-semibold">Tujuan dan evaluasi pembelajaran</h3><p className="text-sm text-muted-foreground">Lengkapi sesuai pelaksanaan KBM. Isian ini tidak mengubah absensi atau perhitungan JTM.</p>{journalContentFields.map(field => <div key={field.name} className="min-w-0 space-y-2"><Field name={field.name} label={field.label} value={edit?.[field.name] ?? ""} maxLength={2000} required={field.name === "learningObjectives" && !edit} multiline/><p className="text-sm leading-6 text-muted-foreground">{field.help}</p></div>)}</section>
          <p id={prefix + "-count-help"} className="text-sm leading-6 text-muted-foreground">{selected?.expectedStudents ? `Jumlah hadir + absen harus ${selected.expectedStudents} siswa sesuai kegiatan ini.` : "Cocokkan hadir + absen dengan rekap siswa kegiatan ini; total maksimal 1000."} Contoh: 18 hadir dan 2 absen untuk kelas berisi 20 siswa.</p>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">{([['present', 'Siswa hadir', present, setPresent], ['absent', 'Siswa absen', absent, setAbsent]] as const).map(([name, label, value, set]) => <div key={name} className="min-w-0 space-y-2 text-sm"><label className="block font-medium" htmlFor={prefix + name}>{label}</label><input id={prefix + name} className="ui-control" type="number" aria-describedby={prefix + "-count-help"} name={name} min={0} max={1000} step={1} value={value} onChange={e => set(e.target.value)} required/></div>)}</div>
          <Field name="notes" label="Catatan" value={edit?.notes ?? ""} maxLength={2000} required={false} multiline/>
        </>}
        {action.kind === "delete" && <div className="space-y-3 rounded-xl border border-destructive p-4 text-sm"><p className="font-semibold">Hapus jurnal {action.journal.date} · {action.journal.teacherName} · {action.journal.subjectName} · {action.journal.className}?</p><p>Kredit {action.journal.creditedJtm} JTM akan dibalik. Riwayat jurnal, penghapusan, dan ledger tetap disimpan. Periode final tetap dilindungi.</p></div>}
        {action.kind === "h1" && <p className="text-sm leading-6">Anda akan {action.enabled ? "mengaktifkan" : "menonaktifkan"} input jurnal H-1. Input H-1 tetap memerlukan konfirmasi kegiatan kemarin; bobot 80% dan perhitungan JTM mengikuti aturan server.</p>}
        {action.kind === "block-new" && <><div className="min-w-0 space-y-2 text-sm"><label htmlFor={prefix + "subject"} className="block font-medium">Mata pelajaran</label><select id={prefix + "subject"} className="ui-control" name="subjectId" defaultValue="" required><option value="" disabled>Pilih mata pelajaran…</option>{action.subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div><div className="grid min-w-0 gap-4 sm:grid-cols-2"><Field name="dateStart" label="Blok mulai" type="date" value={action.date}/><Field name="dateEnd" label="Blok sampai" type="date" value={action.date}/></div><Field name="message" label="Pesan pemblokiran" minLength={5} maxLength={500} multiline/></>}
        {action.kind === "block-toggle" && <p className="rounded-xl border bg-muted/30 p-3 text-sm">{action.block.active ? "Nonaktifkan" : "Aktifkan"} blok {action.subject} · {action.block.date_start}–{action.block.date_end}: {action.block.message}</p>}
        <Field name="reason" label={action.kind === "delete" ? "Alasan penghapusan jurnal" : action.kind === "h1" ? "Alasan perubahan kebijakan" : action.kind.startsWith("block") ? "Alasan perubahan blok" : "Alasan penyimpanan"} minLength={5} maxLength={500} multiline/>
      </fieldset>
      <ErrorFeedback message={error} autoFocus/>
      {blocked && <div className="space-y-3"><p className="text-sm">Muat ulang dan periksa hasil terbaru sebelum menyimpan kembali. Formulir akan ditutup. Draft lokal dapat ditinjau saat kegiatan yang sama dibuka kembali.</p><Button type="button" variant="outline" onClick={onRecover}>Muat ulang dan periksa jurnal</Button></div>}
    </form>
  </FormDialog>;
}
