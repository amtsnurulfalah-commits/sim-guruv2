"use client";
import { ActionIcon } from "@/components/ui/action-icon";

import { TableRegion } from "@/components/ui/table-region";
import { EmptyState } from "@/components/feedback/feature-state";
import Link from "next/link";
import { TeacherPicker, type TeacherChoice } from "./teacher-picker";
import { useEffect, useRef, useState } from "react";
import { masterRequest } from "../masters/api";
import { wibDate } from "../../lib/calendar/schemas";
import {
  DataForm,
  button,
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
    <div className="space-y-3">
      <h3 className="font-semibold">
        {s.recipient.name} — {s.period}
      </h3>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {[
          ["Total JTM", s.totalJtm],
          ["Tarif per JTM", hidden ? "••••" : s.rate],
          ["Honor mengajar", hidden ? "••••" : s.teachingSettled],
          ["Tunjangan", hidden ? "••••" : s.allowances],
          ["Transport bulanan", hidden ? "••••" : s.transportSettled],
          ["Koreksi", hidden ? "••••" : s.corrections],
          ["Total pembayaran", hidden ? "••••" : s.total],
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
                  key={String(l.ledgerId ?? l.sourceRef ?? l.sourceKey ?? i)}
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
    [verifyLink, setVerifyLink] = useState("");
  const [blockTeacher, setBlockTeacher] = useState<TeacherChoice | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const c = new AbortController();
    const params = new URLSearchParams(
      view === "history"
        ? { kind: "history", period, q, page: String(page) }
        : view === "operations"
          ? { kind: "operations", period }
          : { kind: admin ? "recap" : "estimate", period, mode },
    );
    masterRequest<HonorBundle | HonorHistory | Operations>(
      "/api/honorarium/read?" + params,
      "GET",
      undefined,
      c.signal,
    )
      .then((r) => {
        if (c.signal.aborted) return;
        if (view === "history") setHistory(r as HonorHistory);
        else if (view === "operations") setOperations(r as Operations);
        else setBundle(r as HonorBundle);
        setError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [view, admin, period, mode, q, page, revision]);
  useEffect(() => {
    if (preview) {
      const modal = dialog.current;
      modal?.showModal();
      return () => modal?.close();
    }
  }, [preview]);
  async function run(
    work: () => Promise<unknown>,
    refresh = true,
    propagate = false,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      if (refresh) {
        setRevision((v) => v + 1);
        setMessage("Tindakan berhasil disimpan.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Permintaan gagal.");
      if (propagate) throw e;
    } finally {
      setBusy(false);
    }
  }
  const formRun = (work: () => Promise<unknown>, refresh = true) =>
    run(work, refresh, true);
  const post = <T,>(action: string, data: unknown) =>
    masterRequest<T>("/api/honorarium/" + action, "POST", data);
  async function downloadPdf(id: string) {
    await run(async () => {
      const security = await masterRequest<{ csrfToken: string }>(
        "/api/auth/csrf?intent=session",
      );
      const response = await fetch("/api/honorarium/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": security.csrfToken,
        },
        body: JSON.stringify({ statementId: id }),
        cache: "no-store",
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error.message);
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "slip-honor.pdf";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, false);
  }
  async function showSlip(id: string) {
    await run(async () => {
      const r = await masterRequest<HonorStatement>(
        "/api/honorarium/read?kind=statement&id=" + id,
      );
      setSlip(r);
      setVerifyLink("");
    }, false);
  }
  const root = admin ? "/admin/honorarium" : "/honorarium";
  return (
    <div className="space-y-5">
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
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link prefetch={false} href={root}>
            Estimasi / rekap
          </Link>
          <Link prefetch={false} href={root + "/riwayat"}>
            Riwayat dan slip
          </Link>
          {admin && (
            <Link prefetch={false} href={root + "/operasi"}>
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
            className={input}
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setPage(1);
              setBundle(null);
              setHistory(null);
              setOperations(null);
            }}
          />
        </label>
        {view === "estimate" && (
          <label className="text-sm">
            Basis perhitungan
            <select
              className={input}
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setBundle(null);
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
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
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
      {error && (
        <p
          role="alert"
          className="rounded border border-red-300 p-3 text-red-800"
        >
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {view === "estimate" && (
        <>
          <p className="text-sm text-slate-600">
            Tarif per JTM dan tunjangan memakai versi yang berlaku pada akhir
            bulan; tunjangan tidak diprorata. Proyeksi mencakup hak libur
            mendatang, sedangkan transport hanya memakai bukti kehadiran aktual.
            Nilai final mengikuti rincian saat honorarium diterbitkan.
          </p>
          {!bundle ? (
            <p role="status">Memuat perhitungan…</p>
          ) : (
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
                  {bundle.issues.map((x, i) => (
                    <li key={i}>{issueLabels[x.split(":")[0]!] ?? x}</li>
                  ))}
                </ul>
              )}
              {bundle.statements.length === 0 && (
                <p>Tidak ada penerima pada periode ini.</p>
              )}
              {bundle.statements.map((s) => (
                <section className={panel} key={s.recipient.id}>
                  <Breakdown s={s} hidden={hidden} />
                </section>
              ))}
            </>
          )}
          {admin && bundle?.mode !== "final" && (
            <section className={panel}>
              <h2 className="font-semibold">Finalisasi periode</h2>
              <p className="text-sm">
                Seluruh slip diterbitkan dalam satu transaksi. Finalisasi hanya
                tersedia setelah bulan berakhir dan semua hak libur
                diselesaikan. Snapshot final tidak dapat diedit.
              </p>
              <DataForm
                fields={[reason]}
                label="Tinjau finalisasi honorarium"
                submitLabel="Buat pratinjau finalisasi"
                busy={busy}
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
      {view === "history" && (
        <section className={panel}>
          <div className="flex justify-between">
            <h2 className="font-semibold">
              Slip diterbitkan ({history?.total ?? 0})
            </h2>
            <a
              className={secondary}
              href={
                "/api/honorarium/excel?" + new URLSearchParams({ period, q })
              }
            >
              <ActionIcon action="download" />
              Ekspor Excel (semua hasil filter)
            </a>
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
                    <td>{hidden ? "••••" : r.total}</td>
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
          <div className="flex items-center gap-3">
            <button
              className={secondary}
              disabled={page === 1 || busy}
              onClick={() => setPage((v) => v - 1)}
            >
              <ActionIcon action="previous" />
              Sebelumnya
            </button>
            <span>Halaman {page}</span>
            <button
              className={secondary}
              disabled={
                !history || page * history.pageSize >= history.total || busy
              }
              onClick={() => setPage((v) => v + 1)}
            >
              <ActionIcon action="next" />
              Berikutnya
            </button>
          </div>
        </section>
      )}
      {slip && (
        <section className={panel + " honor-print"}>
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
            <button className={secondary} onClick={() => setSlip(null)}>
              <ActionIcon action="close" />
              Tutup slip
            </button>
          </div>
          <DataForm
            fields={[reason]}
            label="Ajukan koreksi honorarium"
            submitLabel="Kirim permintaan koreksi"
            description={
              "Slip " + slip.trxId + ". Jelaskan alasan permintaan koreksi."
            }
            busy={busy}
            onSave={(data) =>
              formRun(() => post("request", { ...data, statementId: slip.id }))
            }
          />
          {admin && (
            <details className="print:hidden">
              <summary>Koreksi administratif ke periode berikutnya</summary>
              <p className="my-2 text-sm">
                Isi seluruh basis yang benar. Sistem memakai tarif saat
                penerbitan dan menghitung selisih terhadap koreksi terakhir.
              </p>
              <DataForm
                key={slip.id}
                fields={[
                  { key: "targetPeriod", label: "Periode tujuan (YYYY-MM)" },
                  {
                    key: "correctedJtm",
                    label: "Total JTM yang benar",
                    value: slip.snapshot.totalJtm,
                  },
                  {
                    key: "correctedAllowances",
                    label: "Total tunjangan yang benar (rupiah)",
                    value: slip.snapshot.allowances,
                  },
                  {
                    key: "correctedTransportRaw",
                    label: "Transport mentah yang benar",
                    value: slip.snapshot.transportRaw,
                  },
                  {
                    key: "evidence",
                    label: "Referensi bukti koreksi",
                    type: "textarea",
                  },
                  reason,
                ]}
                label="Tinjau koreksi honorarium"
                submitLabel="Buat pratinjau koreksi"
                busy={busy}
                onSave={(data) =>
                  formRun(
                    async () =>
                      setPreview(
                        await post<FinancePreview>("preview", {
                          ...data,
                          operation: "correction",
                          statementId: slip.id,
                        }),
                      ),
                    false,
                  )
                }
              />
            </details>
          )}
        </section>
      )}
      {view === "operations" && admin && (
        <>
          <section className={panel}>
            <h2 className="font-semibold">
              Hak libur ({operations?.holidays.length ?? 0})
            </h2>
            <p className="text-sm">
              Posting hari ini mulai 16.00 WIB. Pengecualian beralasan hanya
              untuk hak belum diposting; pembatalan penerbitan mengembalikannya
              menjadi tertunda. Posting langsung mencatat hak yang memenuhi
              syarat. Pengecualian menampilkan pratinjau untuk dikonfirmasi.
            </p>
            <DataForm
              fields={[
                { key: "date", label: "Tanggal libur", type: "date" },
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
              label="Atur honorarium hari libur"
              submitLabel="Jalankan tindakan hari libur"
              busy={busy}
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
            {operations?.runs
              .filter((r) => r.state === "completed")
              .map((r) => (
                <details key={r.id}>
                  <summary>
                    Run {r.date} — generasi {r.generation}
                  </summary>
                  <DataForm
                    fields={[reason]}
                    label="Tinjau pembatalan penerbitan"
                    submitLabel="Buat pratinjau pembatalan"
                    busy={busy}
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
            <TeacherPicker value={blockTeacher} onChange={setBlockTeacher} />
            <DataForm
              fields={[
                { key: "from", label: "Dari tanggal", type: "date" },
                { key: "to", label: "Sampai tanggal", type: "date" },
                reason,
              ]}
              label="Tambah blok transportasi"
              submitLabel="Simpan blok transportasi"
              description={
                "Sasaran: " +
                (blockTeacher?.name ?? "semua guru") +
                ". Periksa penerima dan rentang tanggal sebelum menyimpan."
              }
              busy={busy}
              onSave={(data) =>
                formRun(() =>
                  post("block", { ...data, userId: blockTeacher?.id ?? null }),
                )
              }
            />
            {operations?.blocks
              .filter((b) => b.active)
              .map((b) => (
                <details key={b.id}>
                  <summary>
                    {b.date_start}–{b.date_end}: {b.reason}
                  </summary>
                  <DataForm
                    fields={[reason]}
                    label="Nonaktifkan blok transportasi"
                    submitLabel="Konfirmasi penonaktifan blok"
                    busy={busy}
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
          <section className={panel}>
            <h2 className="font-semibold">Permintaan koreksi</h2>
            {operations?.requests.map((r) => (
              <div className="border-t p-2" key={r.id}>
                <p>{r.reason}</p>
                <button
                  className={secondary}
                  onClick={() => void showSlip(r.statement_id)}
                >
                  <ActionIcon action="preview" />
                  Tinjau slip sumber
                </button>
              </div>
            ))}
          </section>
        </>
      )}
      <dialog
        ref={dialog}
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setPreview(null);
        }}
        className="m-auto max-h-[85vh] w-[min(95vw,720px)] space-y-4 overflow-y-auto rounded-xl border bg-white p-6 shadow-xl backdrop:bg-black/40"
        aria-labelledby="finance-preview-title"
      >
        <h2 id="finance-preview-title" className="text-lg font-bold">
          Konfirmasi pratinjau
        </h2>
        {preview &&
          ("statements" in preview.result ? (
            <>
              <p>
                Periode {preview.result.period}:{" "}
                {preview.result.statements.length} penerima.
              </p>
              {preview.result.statements.map((s) => (
                <p key={s.recipient.id}>
                  {s.recipient.name} — {s.totalJtm} JTM; total{" "}
                  {hidden ? "••••" : s.total} rupiah
                </p>
              ))}
              {preview.result.issues.map((x, i) => (
                <p key={i} className="text-red-800">
                  {issueLabels[x.split(":")[0]!] ?? x}
                </p>
              ))}
            </>
          ) : "delta" in preview.result ? (
            <p>
              Basis sebelumnya: {preview.result.baseline}; basis baru:{" "}
              {preview.result.correctedTotal}; selisih: {preview.result.delta}{" "}
              rupiah.
            </p>
          ) : (
            <p>
              Hak terdampak:{" "}
              {String((preview.result as Record<string, unknown>).count)}; JTM:{" "}
              {String((preview.result as Record<string, unknown>).jtm)}. Hak
              kembali tertunda.
            </p>
          ))}
        <p className="text-sm">
          Pratinjau berlaku 10 menit. Perubahan data mengharuskan pratinjau
          ulang.
        </p>
        <div className="flex gap-3">
          <button
            className={button}
            disabled={
              busy ||
              !!(
                preview &&
                "issues" in preview.result &&
                preview.result.issues.length
              )
            }
            onClick={() =>
              void run(async () => {
                await post("commit", { previewId: preview!.previewId });
                setPreview(null);
              })
            }
          >
            <ActionIcon action="confirm" />
            Konfirmasi perubahan honorarium
          </button>
          <button
            className={secondary}
            disabled={busy}
            onClick={() => setPreview(null)}
          >
            <ActionIcon action="close" />
            Batal
          </button>
        </div>
      </dialog>
    </div>
  );
}
