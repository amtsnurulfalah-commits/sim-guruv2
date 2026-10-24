"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { masterRequest } from "../masters/api";
import { DataForm, panel } from "../programs/forms";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { TableRegion } from "@/components/ui/table-region";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { ApiRequestError } from "@/lib/feedback/api-error";
import {
  choicesSchema,
  previewSchema,
  readPreparationReceipt,
  issueLabels,
  type PreparationPreview,
  type PreparationReceipt,
  type PreparationChoices,
} from "@/lib/semester-preparation/contracts";
const api = "/api/semester-preparation/";
const message = (e: unknown) =>
  e instanceof z.ZodError
    ? "Respons persiapan semester tidak sesuai. Muat ulang atau hubungi admin."
    : e instanceof Error
      ? e.message
      : "Permintaan belum dapat diproses.";
export function SemesterPreparationWorkspace() {
  const [choices, setChoices] = useState<PreparationChoices>({
      periods: [],
      history: [],
    }),
    [loading, setLoading] = useState(true),
    [choicesReady, setChoicesReady] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [preview, setPreview] = useState<PreparationPreview | null>(null),
    [receipt, setReceipt] = useState<PreparationReceipt | null>(null),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [confirm, setConfirm] = useState(false),
    [accepted, setAccepted] = useState(false),
    [page, setPage] = useState(1);
  const lock = useRef(false);
  useEffect(() => {
    const c = new AbortController();
    masterRequest<PreparationChoices>(api + "read", "GET", undefined, c.signal)
      .then((v) => {
        if (!c.signal.aborted) {
          setChoices(choicesSchema.parse(v));
          setChoicesReady(true);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [refresh]);
  const plan = preview?.plan;
  const entries = plan
    ? [
        ...plan.classes.map((c) => ({
          id: c.id,
          source: c.sourceId,
          label: "Kelas " + c.name,
          detail: `Tingkat ${c.grade}${c.parallel} · Jumlah siswa baru: 0`,
        })),
        ...plan.schedules.map((s) => ({
          id: s.id,
          source: s.sourceId,
          label: `KBM · ${s.teacher ?? "Guru tidak aktif"} · ${s.className ?? "Kelas tidak tersedia"}`,
          detail: `${s.subject} · ${["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][s.dayIndex]} ${s.timeStart}–${s.timeEnd} · ${s.scheduledJtm} JTM · ID kelas baru: ${s.classId ?? "Tidak tersedia"}`,
        })),
      ]
    : [];
  const periodName = (id: string | null | undefined) =>
    choices.periods.find((p) => p.id === id)?.name ?? id ?? "Tidak tersedia";
  async function commit() {
    if (lock.current || !preview || !accepted || uncertain) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = readPreparationReceipt(
        preview,
        await masterRequest(api + "commit", "POST", {
          previewId: preview.previewId,
        }),
      );
      setReceipt(result);
      setConfirm(false);
      setLoading(true);
      setRefresh((v) => v + 1);
    } catch (e) {
      setError(message(e));
      if (!(e instanceof ApiRequestError) || e.status >= 500 || e.status === 0)
        setUncertain(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function check() {
    if (lock.current || !preview) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const v = previewSchema.parse(
        await masterRequest(api + "read?previewId=" + preview.previewId),
      );
      if (v.previewId !== preview.previewId)
        throw new Error("Identitas pratinjau tidak sesuai.");
      setPreview(v);
      setUncertain(false);
      if (v.result) {
        setReceipt(readPreparationReceipt(preview, v.result));
        setConfirm(false);
        setLoading(true);
        setRefresh((x) => x + 1);
      } else
        setError(
          "Belum ada hasil penerapan untuk ID ini. Jika perlu, coba terapkan kembali pratinjau yang sama; server mencegah duplikasi.",
        );
    } catch (e) {
      setError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <header>
        <p className="text-sm text-muted-foreground">
          Konfigurasi semester berikutnya
        </p>
        <h1 className="text-2xl font-bold">Persiapan semester baru</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Tinjau salinan konfigurasi sebelum diterapkan. Semester tujuan tidak
          diaktifkan otomatis.
        </p>
      </header>
      <ErrorFeedback message={error} />
      <section className={panel}>
        <h2 className="text-lg font-semibold">Batas penyalinan</h2>
        <p className="text-sm leading-6">
          Hanya kelas dan jadwal KBM yang dipilih. Jadwal memakai konfigurasi
          aktif pada hari terakhir semester sumber dan rentang penuh semester
          tujuan. Jumlah siswa kelas baru direset ke 0; lengkapi di Data Master
          sebelum digunakan. Guru, mata pelajaran, menit per JP dan kebijakan
          kelas harus tetap sesuai.
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          Kehadiran, jurnal, konfirmasi, BAP, ledger, slip, hak libur dan
          koreksi tidak disalin. Piket, upacara, ujian, acara, kalender, tarif
          serta tunjangan disiapkan melalui modul masing-masing. Target yang
          sudah berisi kelas, jadwal, tugas, ujian atau kegiatan ditolak.
        </p>
      </section>
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Pilih konfigurasi</h2>
          <Button
            variant="outline"
            disabled={loading || busy}
            onClick={() => {
              setLoading(true);
              setError("");
              setRefresh((x) => x + 1);
            }}
          >
            Muat ulang pilihan
          </Button>
        </div>
        {loading && <p role="status">Memuat semester…</p>}
        {!loading && !error && choices.periods.length < 2 && (
          <p role="status">
            Siapkan minimal dua semester di Data Master. Tujuan harus semester
            berikutnya yang belum aktif dan mulai setelah hari ini WIB.
          </p>
        )}
        <DataForm
          label="Buat pratinjau"
          submitLabel="Periksa rencana"
          busy={loading || busy || uncertain}
          locked={!choicesReady}
          fields={[
            {
              key: "sourceId",
              label: "Semester sumber",
              type: "select",
              options: choices.periods.map((p) => ({
                id: p.id,
                name: `${p.name} (${p.start}–${p.end})`,
              })),
            },
            {
              key: "targetId",
              label: "Semester tujuan",
              type: "select",
              options: choices.periods
                .filter((p) => !p.active)
                .map((p) => ({
                  id: p.id,
                  name: `${p.name} (${p.start}–${p.end})`,
                })),
            },
            {
              key: "configuration",
              label: "Konfigurasi yang disalin",
              type: "select",
              options: [
                { id: "classes", name: "Kelas saja" },
                { id: "classes_and_schedules", name: "Kelas dan jadwal KBM" },
              ],
            },
            {
              key: "reason",
              label: "Alasan persiapan (5–500 karakter)",
              type: "textarea",
            },
          ]}
          onSave={async (d) => {
            setReceipt(null);
            setError("");
            setPreview(null);
            const v = previewSchema.parse(
              await masterRequest(api + "preview", "POST", d),
            );
            if (
              v.plan.sourceId !== d.sourceId ||
              v.plan.targetId !== d.targetId
            )
              throw new Error("Respons tidak sesuai semester yang dipilih.");
            setPreview(v);
            setPage(1);
            setAccepted(false);
          }}
        />
      </section>
      {preview && plan && (
        <section className={panel}>
          <h2 className="text-lg font-semibold">Pratinjau konfigurasi</h2>
          <p className="text-sm">
            {periodName(plan.sourceId)} → {periodName(plan.targetId)}
          </p>
          <p className="text-sm">
            Konfigurasi sumber per {plan.sourceDate ?? "—"} · Berlaku baru{" "}
            {plan.validFrom ?? "—"}–{plan.validTo ?? "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            ID pratinjau: {preview.previewId} · Kedaluwarsa{" "}
            {new Date(preview.expiresAt).toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
            })}{" "}
            WIB
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="rounded-xl border p-4">
              <strong>{plan.classes.length}</strong> kelas baru
            </p>
            <p className="rounded-xl border p-4">
              <strong>{plan.schedules.length}</strong> jadwal KBM baru
            </p>
          </div>
          {plan.issues.length > 0 ? (
            <div role="alert" className="form-feedback-error">
              <p className="font-semibold">Rencana belum dapat diterapkan</p>
              <ul className="list-inside list-disc space-y-2 text-sm">
                {plan.issues.map((i) => (
                  <li key={i}>
                    {issueLabels[i] ?? "Periksa sumber dan tujuan."}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm">
              Pemeriksaan awal lulus. Server akan memeriksa ulang perubahan
              sumber dan seluruh constraint saat penerapan.
            </p>
          )}
          <TableRegion label="Pemetaan konfigurasi semester">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {["Konfigurasi", "ID sumber", "ID tujuan baru"].map((t) => (
                    <th key={t} className="p-3">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.slice((page - 1) * 25, page * 25).map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="min-w-48 p-3">
                      <strong>{r.label}</strong>
                      <p className="mt-1 text-muted-foreground">{r.detail}</p>
                    </td>
                    <td className="p-3">{r.source}</td>
                    <td className="p-3">{r.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRegion>
          <Pagination
            page={page}
            pageSize={25}
            total={entries.length}
            onPageChange={setPage}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={
                busy || uncertain || !!receipt || plan.issues.length > 0
              }
              onClick={() => {
                setAccepted(false);
                setConfirm(true);
              }}
            >
              Terapkan konfigurasi
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void check()}
            >
              Periksa hasil pratinjau
            </Button>
          </div>
        </section>
      )}
      {receipt && (
        <section className={panel} role="status">
          <h2 className="font-semibold">Konfigurasi berhasil diterapkan</h2>
          <p>
            {receipt.classes} kelas dan {receipt.schedules} jadwal KBM dibuat.
            ID hasil: {receipt.previewId}.
          </p>
          <p className="text-sm">
            Semester tujuan tetap belum aktif. Lengkapi jumlah siswa, periksa
            jadwal serta konfigurasi lain sebelum mengaktifkannya di Data
            Master.
          </p>
        </section>
      )}
      <section className={panel}>
        <h2 className="text-lg font-semibold">Riwayat penerapan terbaru</h2>
        {!choicesReady ? (
          <p className="text-sm text-muted-foreground">Riwayat belum dimuat.</p>
        ) : !choices.history.length ? (
          <p className="text-sm text-muted-foreground">
            Belum ada penerapan konfigurasi semester.
          </p>
        ) : (
          <ul className="space-y-3">
            {choices.history.map((h) => (
              <li key={h.id} className="rounded-xl border p-3 text-sm">
                <strong>{h.actor}</strong> ·{" "}
                {new Date(h.at).toLocaleString("id-ID", {
                  timeZone: "Asia/Jakarta",
                })}{" "}
                WIB
                <p>
                  {h.result.classes} kelas · {h.result.schedules} jadwal ·
                  Tujuan: {periodName(h.result.targetId)}
                </p>
                <p>{h.reason}</p>
                <p className="text-muted-foreground">Bukti penerapan: {h.id}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <FormDialog
        title="Terapkan persiapan semester?"
        description="Penerapan membuat konfigurasi baru dalam satu transaksi. Periksa sumber, tujuan, jumlah, serta rentang sebelum menyetujui."
        open={confirm}
        onOpenChange={setConfirm}
        busy={busy}
        error={error}
      >
        <p>
          {periodName(plan?.sourceId)} → {periodName(plan?.targetId)}
        </p>
        <p>
          {plan?.classes.length} kelas · {plan?.schedules.length} jadwal KBM ·{" "}
          {plan?.validFrom}–{plan?.validTo}
        </p>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0"
            checked={accepted}
            disabled={busy || uncertain}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          Saya telah memeriksa pratinjau dan memahami bahwa jumlah siswa perlu
          dilengkapi serta semester tidak diaktifkan otomatis.
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={busy || uncertain || !accepted}
            onClick={() => void commit()}
          >
            {busy ? "Memproses…" : "Ya, terapkan konfigurasi"}
          </Button>
          {uncertain && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void check()}
            >
              Periksa hasil pratinjau
            </Button>
          )}
        </div>
      </FormDialog>
    </div>
  );
}
