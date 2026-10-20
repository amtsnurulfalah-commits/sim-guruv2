"use client";
import { useCallback, useEffect, useState } from "react";
import { masterRequest } from "@/features/masters/api";
import { DataForm, button, input, panel } from "@/features/programs/forms";
import { gates, type MigrationBoard } from "@/lib/migration/contracts";
const labels: Record<string, string> = {
  source_backup: "Backup sumber",
  restore_drill: "Uji pemulihan",
  reconciliation: "Rekonsiliasi",
  parallel_run: "Parallel run",
  uat_admin: "UAT admin",
  uat_guru: "UAT guru",
  legacy_freeze: "Penghentian write/trigger lama",
  delta_reconciliation: "Rekonsiliasi delta",
  rollback_plan: "Rencana rollback",
  cutover_approval: "Persetujuan cutover",
};
type Report = {
  issues: {
    sequence: number;
    code: string;
    source_table: string;
    row_number: number | null;
    field: string | null;
    severity: string;
    resolution: string | null;
  }[];
  counts: Record<string, number>;
  mappedRows: number;
};
export function MigrationManager() {
  const [board, setBoard] = useState<MigrationBoard | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [report, setReport] = useState<Report | null>(null);
  const load = useCallback(
    async () => setBoard(await masterRequest("/api/migration/board")),
    [],
  );
  useEffect(() => {
    const c = new AbortController();
    masterRequest<MigrationBoard>(
      "/api/migration/board",
      "GET",
      undefined,
      c.signal,
    )
      .then((v) => {
        if (!c.signal.aborted) setBoard(v);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operasi gagal.");
    } finally {
      setBusy(false);
    }
  }
  async function save(action: string, data: unknown, id: string) {
    setBusy(true);
    try {
      await masterRequest("/api/migration/" + action, "POST", data);
      await load();
      setReport(await masterRequest("/api/migration/board?id=" + id));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
      <h1 className="text-2xl font-bold">Migrasi dan kesiapan peluncuran</h1>
      <p>
        Unggahan masuk ke staging privat. Pengisian staging tidak memindahkan
        transaksi ke aplikasi dan tidak mengaktifkan email atau cutover.
      </p>
      {error && <p role="alert">{error}</p>}
      <section className={panel}>
        <h2 className="font-semibold">Periksa ekspor legacy</h2>
        <label className="block">
          File JSON ekspor (maksimum 2 MiB)
          <input
            className={input}
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 2 * 1024 * 1024) {
                setError("Ukuran ekspor melebihi 2 MiB.");
                return;
              }
              await run(async () =>
                masterRequest(
                  "/api/migration/stage",
                  "POST",
                  JSON.parse(await f.text()),
                ),
              );
              e.target.value = "";
            }}
          />
        </label>
        <p className="text-sm">
          Data login lama tidak dibawa. Ikuti kontrak ekspor dan runbook
          operator sebelum menyiapkan rencana impor.
        </p>
      </section>
      {!board && <p role="status">Memuat daftar batch…</p>}
      {board?.batches.length === 0 && <p>Belum ada ekspor yang diperiksa.</p>}
      {board?.batches.map((b) => (
        <section className={panel} key={b.id}>
          <h2 className="font-bold break-words">{b.source}</h2>
          <p>
            {b.state} · {b.summary.rows} baris · {b.summary.errors} kesalahan ·{" "}
            {b.summary.review} temuan peninjauan awal ·{" "}
            {b.summary.redactedFields} kolom/nilai rahasia dikeluarkan
          </p>
          <button
            className={button}
            disabled={busy}
            onClick={() =>
              run(async () => {
                setSelected(b.id);
                setReport(
                  await masterRequest("/api/migration/board?id=" + b.id),
                );
              })
            }
          >
            Periksa temuan dan bukti
          </button>
          {selected === b.id && report && (
            <>
              <p>{report.mappedRows} pemetaan hasil impor tercatat.</p>
              {report.issues.map((i) => (
                <div className="border-t pt-3" key={i.sequence}>
                  <p>
                    {i.source_table} · baris {i.row_number ?? "—"} ·{" "}
                    {i.field ?? "—"} · {i.code} ·{" "}
                    {i.resolution ? "Ditinjau" : "Belum selesai"}
                  </p>
                  {i.severity === "review" && !i.resolution && (
                    <DataForm
                      busy={busy}
                      label="Catat hasil peninjauan"
                      fields={[
                        {
                          key: "evidence",
                          label: "Hasil peninjauan dan lokasi bukti",
                        },
                        { key: "reason", label: "Alasan" },
                      ]}
                      onSave={async (d) => {
                        await save(
                          "resolve",
                          {
                            ...d,
                            batchId: b.id,
                            version: b.version,
                            sequence: i.sequence,
                          },
                          b.id,
                        );
                      }}
                    />
                  )}
                </div>
              ))}
              <h3 className="font-semibold">Bukti kesiapan</h3>
              {gates.map((g) => (
                <p key={g}>
                  {labels[g]}:{" "}
                  {b.gates.find((x) => x.gate === g)?.passed
                    ? "Disetujui dengan bukti"
                    : "Belum disetujui"}
                </p>
              ))}
              <DataForm
                busy={busy}
                label="Simpan keputusan bukti"
                fields={[
                  {
                    key: "gate",
                    label: "Pemeriksaan",
                    type: "select",
                    options: gates.map((id) => ({ id, name: labels[id]! })),
                  },
                  {
                    key: "passed",
                    label: "Keputusan",
                    type: "select",
                    options: [
                      { id: "false", name: "Belum memenuhi" },
                      { id: "true", name: "Memenuhi berdasarkan bukti" },
                    ],
                  },
                  {
                    key: "evidence",
                    label: "Hasil pemeriksaan dan rujukan bukti",
                    type: "textarea",
                  },
                  { key: "reason", label: "Alasan keputusan" },
                ]}
                onSave={async (d) => {
                  await save(
                    "gate",
                    {
                      ...d,
                      passed: d.passed === "true",
                      batchId: b.id,
                      version: b.version,
                    },
                    b.id,
                  );
                }}
              />
              <p className="text-sm">
                Kesalahan data tidak dapat diabaikan. Unggah ekspor yang
                diperbaiki. Persetujuan cutover memerlukan seluruh pemeriksaan
                sebelumnya dan tidak menjalankan pemindahan layanan secara
                otomatis.
              </p>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
