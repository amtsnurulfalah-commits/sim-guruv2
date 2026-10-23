"use client";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import Link from "next/link";

import { statusLabel } from "@/lib/ui-status";
import { EmptyState } from "@/components/feedback/feature-state";
import { useCallback, useEffect, useState } from "react";
import { masterRequest } from "@/features/masters/api";
import {
  DataForm,
  panel,
  type Field,
} from "@/features/programs/forms";
import type { Operations } from "@/lib/operations/schemas";
const api = "/api/operations/";
const yesNo = [
  { id: "true", name: "Ya" },
  { id: "false", name: "Tidak" },
];
const bool = (key: string, label: string, value = true): Field => ({
  key,
  label,
  type: "select",
  options: yesNo,
  value: String(value),
});
export { AnnouncementManager } from "./announcement-manager";
export function OperationsManager() {
  const [data, setData] = useState<Operations | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(
    async () => setData(await masterRequest(api + "operations")),
    [],
  );
  useEffect(() => {
    const c = new AbortController();
    masterRequest<Operations>(api + "operations", "GET", undefined, c.signal)
      .then((v) => {
        if (!c.signal.aborted) setData(v);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  if (!data) return <p role="status">{error || "Memuat pengaturan…"}</p>;
  const c = data.config.value;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Pengaturan operasional</h1>
      {error && <ErrorFeedback message={error} />}
      <section className={panel}>
        <h2>
          Pemeliharaan aplikasi{" "}
          {data.maintenanceActive ? "aktif" : "tidak aktif"}
        </h2>
        <p>
          Admin dan pemulihan akun tetap tersedia. Waktu terjadwal memakai ISO
          8601 dengan zona, contoh 2026-11-01T20:00:00+07:00.
        </p>
        <dl className="grid gap-3 rounded-xl border bg-muted/40 p-4 sm:grid-cols-3">
          {(
            [
              ["Email pengumuman dan kegiatan", c.mailEnabled],
              ["Email aktivasi dan pengamanan akun", c.securityMailEnabled],
              ["Pekerjaan otomatis", c.jobsEnabled],
            ] as const
          ).map(([name, enabled]) => (
            <div key={String(name)}>
              <dt className="text-sm text-muted-foreground">{name}</dt>
              <dd className="font-semibold">
                {enabled ? "Aktif" : "Nonaktif"}
              </dd>
            </div>
          ))}
        </dl>
        <DataForm
          key={data.config.version}
          busy={busy}
          label="Atur operasional aplikasi"
          submitLabel="Simpan pengaturan operasional"
          fields={[
            bool("mailEnabled", "Email pengumuman dan kegiatan", c.mailEnabled),
            bool("jobsEnabled", "Pekerjaan otomatis", c.jobsEnabled),
            bool(
              "securityMailEnabled",
              "Email aktivasi dan pengamanan akun",
              c.securityMailEnabled,
            ),
            bool("maintenance", "Aktifkan pemeliharaan", c.maintenance),
            {
              key: "maintenanceStart",
              label: "Mulai pemeliharaan",
              optional: true,
              value: c.maintenanceStart ?? undefined,
            },
            {
              key: "maintenanceEnd",
              label: "Selesai pemeliharaan",
              optional: true,
              value: c.maintenanceEnd ?? undefined,
            },
            { key: "reason", label: "Alasan perubahan (min. 5 karakter)" },
          ]}
          onSave={async (d) => {
            setBusy(true);
            try {
              await masterRequest(api + "settings", "POST", {
                version: data.config.version,
                reason: d.reason,
                config: {
                  mailEnabled: d.mailEnabled === "true",
                  securityMailEnabled: d.securityMailEnabled === "true",
                  jobsEnabled: d.jobsEnabled === "true",
                  maintenance: d.maintenance === "true",
                  maintenanceStart: d.maintenanceStart,
                  maintenanceEnd: d.maintenanceEnd,
                },
              });
              await load();
            } finally {
              setBusy(false);
            }
          }}
        />
      </section>
      <section className={panel}>
        <h2 className="font-bold">Pembatasan kegiatan</h2>
        <p>
          <Link prefetch={false} className="underline" href="/admin/jurnal">
            Blok jurnal mata pelajaran
          </Link>{" "}
          ·{" "}
          <Link prefetch={false} className="underline" href="/admin/acara">
            Blok jurnal acara
          </Link>{" "}
          ·{" "}
          <Link
            prefetch={false}
            className="underline"
            href="/admin/honorarium/operasi"
          >
            Blok transport dan libur
          </Link>
        </p>
      </section>
      <section className={panel}>
        <h2 className="font-bold">Antrean email (100 terbaru)</h2>
        <p>
          Status pengiriman tidak pasti memerlukan pemeriksaan penerimaan; tidak
          dikirim ulang otomatis.
        </p>
        {data.outbox.length === 0 && <EmptyState title="Belum ada antrean." />}
        {data.outbox.map((o) => (
          <div className="space-y-2 border-b py-3" key={o.id}>
            <p>
              {o.id} · {statusLabel(o.state)} · {o.attempts} percobaan
            </p>
            {["failed", "unknown"].includes(o.state) && (
              <DataForm
                busy={busy}
                label={
                  o.state === "failed"
                    ? "Tinjau pengiriman ulang"
                    : "Tinjau status pengiriman"
                }
                submitLabel={
                  o.state === "failed"
                    ? "Jadwalkan pengiriman ulang"
                    : "Simpan hasil pemeriksaan"
                }
                fields={[
                  { key: "reason", label: "Alasan / bukti pemeriksaan" },
                  ...(o.state === "unknown"
                    ? [bool("sent", "Email terbukti diterima")]
                    : []),
                ]}
                onSave={async (d) => {
                  setBusy(true);
                  try {
                    await masterRequest(
                      api + (o.state === "failed" ? "retry" : "reconcile"),
                      "POST",
                      {
                        id: o.id,
                        reason: d.reason,
                        ...(o.state === "unknown"
                          ? { sent: d.sent === "true" }
                          : {}),
                      },
                    );
                    await load();
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
          </div>
        ))}
      </section>
      <section className={panel}>
        <h2 className="font-bold">Pekerjaan terjadwal (100 terbaru)</h2>
        <p>
          Pemrosesan otomatis terakhir:{" "}
          {data.lastWorkerAt ?? "Belum ada eksekusi"}
        </p>
        {data.jobs.map((j) => (
          <div key={j.business_key}>
            <p>
              {j.business_key} · {statusLabel(j.state)} · {j.attempts} eksekusi
            </p>
            {j.state === "failed" && (
              <DataForm
                busy={busy}
                label="Tinjau pengulangan pekerjaan"
                submitLabel="Jadwalkan ulang pekerjaan"
                fields={[{ key: "reason", label: "Alasan percobaan ulang" }]}
                onSave={async (d) => {
                  setBusy(true);
                  try {
                    await masterRequest(api + "job-retry", "POST", {
                      key: j.business_key,
                      reason: d.reason,
                    });
                    await load();
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
          </div>
        ))}
        {data.jobs.length === 0 && <EmptyState title="Belum ada eksekusi." />}
      </section>
    </div>
  );
}
