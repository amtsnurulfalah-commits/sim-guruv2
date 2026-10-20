"use client";
import { statusLabel } from "@/lib/ui-status";
import { EmptyState } from "@/components/feedback/feature-state";
import { useCallback, useEffect, useState } from "react";
import { masterRequest } from "@/features/masters/api";
import {
  DataForm,
  panel,
  button,
  secondary,
  type Field,
} from "@/features/programs/forms";
import type { Announcement, Operations } from "@/lib/operations/schemas";
import { RecipientPicker } from "./recipient-picker";
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
export function AnnouncementManager() {
  const [targets, setTargets] = useState<string[]>([]),
    [allow, setAllow] = useState<string[]>([]),
    [deny, setDeny] = useState<string[]>([]);
  function selectEdit(a: Announcement | null) {
    setEdit(a);
    setTargets(a?.target_users ?? []);
    setAllow(a?.allow_dismiss ?? []);
    setDeny(a?.deny_dismiss ?? []);
  }
  const [items, setItems] = useState<Announcement[]>([]),
    [edit, setEdit] = useState<Announcement | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setItems(await masterRequest(api + "manage"));
  }, []);
  useEffect(() => {
    const c = new AbortController();
    masterRequest<Announcement[]>(api + "manage", "GET", undefined, c.signal)
      .then((v) => {
        if (!c.signal.aborted) setItems(v);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  const fields: Field[] = [
    { key: "title", label: "Judul", value: edit?.title },
    {
      key: "body",
      label: "Isi (teks biasa)",
      type: "textarea",
      value: edit?.body,
    },
    {
      key: "severity",
      label: "Prioritas",
      type: "select",
      options: ["info", "success", "warning", "critical"].map((id) => ({
        id,
        name: statusLabel(id),
      })),
      value: edit?.severity ?? "info",
    },
    {
      key: "targetRole",
      label: "Sasaran peran",
      type: "select",
      options: [
        { id: "all", name: "Semua" },
        { id: "guru", name: "Guru" },
        { id: "admin", name: "Admin" },
      ],
      value: edit?.target_role ?? "all",
    },
    {
      key: "from",
      label: "Tanggal mulai inklusif",
      type: "date",
      optional: true,
      value: edit?.date_start ?? undefined,
    },
    {
      key: "to",
      label: "Tanggal akhir inklusif",
      type: "date",
      optional: true,
      value: edit?.date_end ?? undefined,
    },
    bool("active", "Aktif", edit?.active ?? true),
    bool("dismissible", "Dapat ditutup", edit?.dismissible ?? true),
    bool("sendEmail", "Antrekan email", edit?.send_email ?? false),
    {
      key: "reminderOffsets",
      label: "Pengingat sebelum tanggal akhir",
      type: "days",
      options: [
        { id: "3", name: "H-3" },
        { id: "2", name: "H-2" },
        { id: "1", name: "H-1" },
      ],
      value: edit?.reminder_offsets ?? [],
    },
    {
      key: "ctaText",
      label: "Teks tautan",
      optional: true,
      value: edit?.cta_text ?? undefined,
    },
    {
      key: "ctaUrl",
      label: "URL http/https",
      optional: true,
      value: edit?.cta_url ?? undefined,
    },
    { key: "reason", label: "Alasan perubahan (min. 5 karakter)" },
  ];
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Pengumuman</h1>
      <p>
        Email dikirim hanya jika pengiriman dan pekerjaan diaktifkan pada
        pengaturan operasional.
      </p>
      {error && <p role="alert">{error}</p>}
      <section className={panel}>
        <h2>{edit ? "Ubah pengumuman" : "Pengumuman baru"}</h2>
        <p className="text-sm">
          Pilihan pengguna tertentu mengutamakan sasaran peran. Kosongkan
          pilihan untuk mengikuti peran.
        </p>
        <RecipientPicker
          label="Sasaran pengguna tertentu"
          value={targets}
          onChange={setTargets}
          names={edit?.recipientNames ?? {}}
        />
        <RecipientPicker
          label="Pengecualian: boleh menutup"
          value={allow}
          onChange={setAllow}
          names={edit?.recipientNames ?? {}}
        />
        <RecipientPicker
          label="Pengecualian: tidak boleh menutup"
          value={deny}
          onChange={setDeny}
          names={edit?.recipientNames ?? {}}
        />
        <DataForm
          inline
          key={edit ? edit.id + edit.version : "new"}
          fields={fields}
          busy={busy}
          label="Simpan pengumuman"
          onSave={async (d) => {
            setBusy(true);
            try {
              await masterRequest(api + "save", "POST", {
                ...d,
                id: edit?.id ?? null,
                version: edit ? String(edit.version) : null,
                active: d.active === "true",
                dismissible: d.dismissible === "true",
                sendEmail: d.sendEmail === "true",
                targetUsers: targets,
                allowDismiss: allow,
                denyDismiss: deny,
              });
              selectEdit(null);
              await load();
            } finally {
              setBusy(false);
            }
          }}
        />
        {edit && (
          <button className={secondary} onClick={() => selectEdit(null)}>
            Batal mengubah
          </button>
        )}
      </section>
      {items.map((a) => (
        <section key={a.id} className={panel}>
          <h2 className="font-bold">{a.title}</h2>
          <p>
            {a.severity} · versi {a.version} · {a.active ? "Aktif" : "Nonaktif"}
          </p>
          <p className="whitespace-pre-wrap">{a.body}</p>
          <button className={button} onClick={() => selectEdit(a)}>
            Ubah pengumuman
          </button>
        </section>
      ))}
    </div>
  );
}
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
      {error && <p role="alert">{error}</p>}
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
          <a className="underline" href="/admin/jurnal">
            Blok jurnal mata pelajaran
          </a>{" "}
          ·{" "}
          <a className="underline" href="/admin/acara">
            Blok jurnal acara
          </a>{" "}
          ·{" "}
          <a className="underline" href="/admin/honorarium/operasi">
            Blok transport dan libur
          </a>
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
