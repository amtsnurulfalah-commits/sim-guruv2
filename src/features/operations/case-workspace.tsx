"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { z } from "zod";
import { masterRequest } from "../masters/api";
import { DataForm, input, panel, secondary } from "../programs/forms";
import { Pagination } from "@/components/ui/pagination";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { EmptyState } from "@/components/feedback/feature-state";
import { ApiRequestError } from "@/lib/feedback/api-error";
import {
  caseStatuses,
  caseCommand,
  caseListSchema,
  caseDetailSchema,
  caseResultSchema,
  monitorSchema,
  type SupportCase,
} from "@/lib/operations/support-cases";
function parse<T>(schema: z.ZodType<T>, raw: unknown) {
  const p = schema.safeParse(raw);
  if (!p.success)
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Jawaban layanan penanganan kendala belum dapat diverifikasi. Muat ulang sebelum mengirim lagi.",
    );
  return p.data;
}
const reason = {
  key: "reason",
  label: "Alasan / catatan internal (5–2000 karakter)",
  type: "textarea" as const,
};
const time = (v: string) =>
  new Date(v).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
const transitions: Record<SupportCase["status"], SupportCase["status"][]> = {
  new: ["new", "reviewed"],
  reviewed: ["reviewed", "processing", "waiting"],
  processing: ["processing", "waiting", "resolved"],
  waiting: ["waiting", "processing", "resolved"],
  resolved: ["new"],
};
export function CaseWorkspace({
  reference,
  searchedReference,
}: {
  reference: string | null;
  searchedReference: string | null;
}) {
  const [revision, setRevision] = useState(0),
    [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const [list, setList] = useState<z.infer<typeof caseListSchema> | null>(null),
    [detail, setDetail] = useState<SupportCase | null>(null),
    [monitor, setMonitor] = useState<z.infer<typeof monitorSchema> | null>(
      null,
    );
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState(false);
  const pending = useRef(false),
    alive = useRef(true),
    write = useRef<AbortController | null>(null),
    key = useRef<string | null>(null);
  useEffect(() => {
    alive.current = true;
    write.current = new AbortController();
    return () => {
      alive.current = false;
      write.current?.abort();
    };
  }, []);
  useEffect(() => {
    const c = new AbortController();
    queueMicrotask(() => {
      if (!c.signal.aborted) {
        setLoading(true);
        setError("");
        setDetail(null);
      }
    });
    const get = (path: string) =>
      masterRequest<unknown>(
        "/api/operations/" + path,
        "GET",
        undefined,
        c.signal,
      );
    Promise.all([
      get(
        "support-cases?" +
          new URLSearchParams({ kind: "list", page: String(page), q, status }),
      ),
      get("support-monitor"),
      selected
        ? get("support-cases?kind=detail&id=" + selected)
        : Promise.resolve(null),
    ])
      .then(([l, m, d]) => {
        if (c.signal.aborted) return;
        const rows = parse(caseListSchema, l),
          metrics = parse(monitorSchema, m),
          item = d ? parse(caseDetailSchema, d) : null;
        if (rows.page !== page || (item && item.id !== selected))
          throw new ApiRequestError(
            "INVALID_RESPONSE",
            "Hasil tidak sesuai laporan yang dipilih.",
          );
        setList(rows);
        setMonitor(metrics);
        setDetail(item);
        setUncertain(false);
        setLoading(false);
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setList(null);
          setMonitor(null);
          setDetail(null);
          setLoading(false);
          setError(
            e instanceof Error ? e.message : "Gagal memuat penanganan kendala.",
          );
        }
      });
    return () => c.abort();
  }, [revision, page, q, status, selected]);
  const locked = loading || busy || uncertain || !list || !monitor;
  async function save(raw: Record<string, unknown>) {
    if (pending.current || locked)
      throw Error("Muat ulang status laporan sebelum melanjutkan.");
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      key.current ??= crypto.randomUUID();
      const data = caseCommand.parse({ ...raw, operationKey: key.current });
      const result = parse(
        caseResultSchema,
        await masterRequest(
          "/api/operations/support-case",
          "POST",
          data,
          write.current?.signal,
        ),
      );
      if (!alive.current) return;
      if ("id" in result) {
        if ("id" in data && result.id !== data.id)
          throw new ApiRequestError(
            "INVALID_RESPONSE",
            "Hasil penyimpanan tidak sesuai laporan.",
          );
        setSelected(result.id);
      }
      setMessage("Penanganan kendala berhasil disimpan.");
      key.current = null;
      setRevision((n) => n + 1);
    } catch (e) {
      if (!alive.current) return;
      setError(
        e instanceof Error && e.name !== "ZodError"
          ? e.message
          : "Periksa kembali isian formulir.",
      );
      if (
        e instanceof ApiRequestError &&
        (e.status >= 500 ||
          [
            "NETWORK_ERROR",
            "TIMEOUT",
            "INVALID_RESPONSE",
            "VERSION_CONFLICT",
          ].includes(e.code))
      )
        setUncertain(true);
      throw e;
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const props = { busy, locked, onVisibilityChange: setOpen };
  return (
    <section
      className="min-w-0 space-y-5 [overflow-wrap:anywhere]"
      aria-label="Penanganan dan pemantauan kendala"
      aria-busy={loading || busy}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Penanganan dan pemantauan kendala</h2>
        <button
          className={secondary}
          disabled={busy || open}
          onClick={() => {
            key.current = null;
            setRevision((n) => n + 1);
          }}
        >
          Muat ulang penanganan
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        Catatan internal hanya untuk admin. Identitas pelapor harus dikonfirmasi
        terpisah; kode referensi sendiri tidak membuktikan pemilik akun. Jangan
        memasukkan password, OTP, token, atau kredensial.
      </p>
      {(error || uncertain) && (
        <ErrorFeedback
          message={
            error ||
            (uncertain
              ? "Hasil penyimpanan belum pasti. Muat ulang dan periksa riwayat sebelum mengirim lagi."
              : "")
          }
        />
      )}
      {message && (
        <p role="status" className="text-sm text-emerald-800">
          {message}
        </p>
      )}
      {loading && <p role="status">Memuat penanganan dan pemantauan…</p>}
      {searchedReference && (
        <button
          className={secondary}
          disabled={busy || open}
          onClick={() => {
            setQ(searchedReference);
            setPage(1);
            setSelected(null);
          }}
        >
          Cari penanganan dengan referensi ini
        </button>
      )}
      {reference && list && (
        <DataForm
          key={reference}
          label="Buat laporan penanganan"
          submitLabel="Simpan laporan penanganan"
          description={
            "Referensi " +
            reference +
            ". Hubungkan pelapor hanya setelah identitasnya dipastikan; referensi yang sama mengarah ke laporan yang sudah ada."
          }
          fields={[
            { key: "title", label: "Judul kendala (5–160 karakter)" },
            {
              key: "summary",
              label: "Konteks halaman, tindakan, dan waktu dari pengguna",
              type: "textarea",
            },
            {
              key: "reporterId",
              label: "Pelapor (opsional)",
              type: "select",
              optional: true,
              options: [{ id: "", name: "Belum diketahui" }, ...list.reporters],
            },
            {
              key: "reporterVerified",
              label: "Identitas pelapor",
              type: "select",
              value: "false",
              options: [
                { id: "false", name: "Belum diverifikasi" },
                { id: "true", name: "Sudah dikonfirmasi oleh admin" },
              ],
            },
            reason,
          ]}
          {...props}
          onSave={(data) =>
            save({
              ...data,
              operation: "create",
              reference,
              reporterId: data.reporterId || null,
              reporterVerified: data.reporterVerified === "true",
            })
          }
        />
      )}
      <section
        className={panel + " min-w-0 space-y-4"}
        aria-label="Daftar laporan penanganan"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Cari judul/modul/kode/referensi
            <input
              className={input}
              disabled={busy || open}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
                setSelected(null);
              }}
              maxLength={100}
            />
          </label>
          <label className="text-sm">
            Status penanganan
            <select
              className={input}
              disabled={busy || open}
              value={status}
              aria-label="Status penanganan"
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
                setSelected(null);
              }}
            >
              <option value="">Semua status</option>
              {Object.entries(caseStatuses).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        {list && !list.items.length && (
          <EmptyState title="Belum ada laporan penanganan yang sesuai." />
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          {list?.items.map((c) => (
            <article key={c.id} className="min-w-0 rounded-xl border p-4">
              <h3 className="font-semibold">{c.title}</h3>
              <p className="text-sm">
                {caseStatuses[c.status]} · {c.module} / {c.code}
              </p>
              <p className="text-sm">
                Penanggung jawab: {c.owner ?? "Belum ditetapkan"} ·{" "}
                {c.reference_count} referensi
              </p>
              <button
                className={secondary + " mt-3"}
                disabled={busy || open}
                onClick={() => setSelected(c.id)}
              >
                Buka penanganan
              </button>
            </article>
          ))}
        </div>
        <Pagination
          page={page}
          pageSize={20}
          total={list?.total ?? 0}
          onPageChange={(p) => {
            setPage(p);
            setSelected(null);
          }}
          disabled={busy || open || loading}
        />
      </section>
      {detail && list && (
        <article
          className={panel + " min-w-0 space-y-4"}
          aria-label="Detail penanganan"
        >
          <h2 className="text-lg font-bold">
            {detail.title} · {caseStatuses[detail.status]}
          </h2>
          <p className="whitespace-pre-wrap text-sm">{detail.summary}</p>
          <p className="text-sm">
            Pelapor: {detail.reporter ?? "Belum diketahui"} (
            {detail.reporter_verified
              ? "dikonfirmasi admin"
              : "belum diverifikasi"}
            )
          </p>
          <p className="text-sm">
            Penanggung jawab: {detail.owner ?? "Belum ditetapkan"}
          </p>
          {detail.resolution && (
            <p className="whitespace-pre-wrap text-sm">
              Perbaikan terakhir: {detail.resolution}
            </p>
          )}
          {detail.verification && (
            <p className="whitespace-pre-wrap text-sm">
              Verifikasi terakhir: {detail.verification}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <DataForm
              key={detail.id + detail.version + "update"}
              label={
                detail.status === "resolved"
                  ? "Buka kembali laporan"
                  : "Ubah status / penanggung jawab"
              }
              submitLabel="Simpan status penanganan"
              description="Selesai memerlukan hasil perbaikan dan bukti verifikasi. Catatan lama tetap tersimpan setelah laporan dibuka kembali."
              fields={[
                {
                  key: "status",
                  label: "Status tujuan",
                  type: "select",
                  value: detail.status === "resolved" ? "new" : detail.status,
                  options: transitions[detail.status].map((s) => ({
                    id: s,
                    name: caseStatuses[s],
                  })),
                },
                {
                  key: "ownerId",
                  label: "Penanggung jawab admin",
                  type: "select",
                  optional: true,
                  value: detail.owner_id ?? "",
                  options: [
                    { id: "", name: "Belum ditetapkan" },
                    ...list.owners,
                  ],
                },
                {
                  key: "resolution",
                  label: "Hasil perbaikan (wajib untuk Selesai)",
                  type: "textarea",
                  optional: true,
                },
                {
                  key: "verification",
                  label:
                    "Bukti verifikasi bersama pengguna (wajib untuk Selesai)",
                  type: "textarea",
                  optional: true,
                },
                reason,
              ]}
              {...props}
              onSave={(data) =>
                save({
                  ...data,
                  operation: "update",
                  id: detail.id,
                  version: detail.version,
                  ownerId: data.ownerId || null,
                  resolution: data.resolution ?? "",
                  verification: data.verification ?? "",
                })
              }
            />
            {detail.status !== "resolved" && (
              <>
                <DataForm
                  label="Perbarui konteks pelapor"
                  submitLabel="Simpan konteks pelapor"
                  fields={[
                    {
                      key: "reporterId",
                      label: "Pelapor",
                      type: "select",
                      optional: true,
                      options: list.reporters,
                    },
                    {
                      key: "reporterVerified",
                      label: "Identitas pelapor",
                      type: "select",
                      value: "false",
                      options: [
                        { id: "false", name: "Belum diverifikasi" },
                        { id: "true", name: "Sudah dikonfirmasi admin" },
                      ],
                    },
                    reason,
                  ]}
                  {...props}
                  onSave={(data) =>
                    save({
                      ...data,
                      operation: "context",
                      id: detail.id,
                      version: detail.version,
                      reporterId: data.reporterId || null,
                      reporterVerified: data.reporterVerified === "true",
                    })
                  }
                />
                <DataForm
                  label="Tambah catatan internal"
                  submitLabel="Simpan catatan internal"
                  fields={[reason]}
                  {...props}
                  onSave={(data) =>
                    save({
                      ...data,
                      operation: "note",
                      id: detail.id,
                      version: detail.version,
                    })
                  }
                />
                <DataForm
                  label="Hubungkan kejadian berulang"
                  submitLabel="Hubungkan referensi"
                  description="Hanya modul/kode yang sama; referensi asal tetap tersimpan. Kesamaan kode belum membuktikan akar penyebab yang sama."
                  fields={[
                    { key: "reference", label: "Referensi kejadian lain" },
                    reason,
                  ]}
                  {...props}
                  onSave={(data) =>
                    save({
                      ...data,
                      operation: "link",
                      id: detail.id,
                      version: detail.version,
                    })
                  }
                />
              </>
            )}
          </div>
          <details>
            <summary className="cursor-pointer font-semibold">
              Referensi asal ({detail.references.length})
            </summary>
            <ul className="space-y-2 text-sm">
              {detail.references.map((r) => (
                <li key={r.request_id}>
                  {r.request_id} · {time(r.occurred_at)} WIB · {r.module}/
                  {r.code} ({r.status})
                </li>
              ))}
            </ul>
          </details>
          <details>
            <summary className="cursor-pointer font-semibold">
              Riwayat dan catatan internal ({detail.history.length})
            </summary>
            <ul className="space-y-3 text-sm">
              {detail.history.map((h) => (
                <li key={h.id} className="border-t py-2">
                  <p>
                    {h.actor} · {time(h.at)} WIB ·{" "}
                    {h.from ? caseStatuses[h.from] : "—"} →{" "}
                    {h.to ? caseStatuses[h.to] : "—"}
                  </p>
                  <p className="whitespace-pre-wrap">{h.note}</p>
                  <p>
                    Penanggung jawab: {h.changes.before?.owner ?? "—"} →{" "}
                    {h.changes.after.owner ?? "—"}; pelapor:{" "}
                    {h.changes.after.reporter ?? "belum diketahui"} (
                    {h.changes.after.verified
                      ? "dikonfirmasi admin"
                      : "belum diverifikasi"}
                    )
                  </p>
                  {h.changes.after.resolution && (
                    <p className="whitespace-pre-wrap">
                      Hasil saat keputusan: {h.changes.after.resolution}
                    </p>
                  )}
                  {h.changes.after.verification && (
                    <p className="whitespace-pre-wrap">
                      Verifikasi saat keputusan: {h.changes.after.verification}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </article>
      )}
      {monitor && (
        <section
          className={panel + " min-w-0 space-y-4"}
          aria-label="Pemantauan layanan"
        >
          <h2 className="text-lg font-semibold">Pemantauan layanan</h2>
          <p className="text-sm">
            Diperbarui {time(monitor.generatedAt)} WIB. Heartbeat:{" "}
            {monitor.lastWorkerAt
              ? time(monitor.lastWorkerAt) + " WIB"
              : "belum ada"}
            ; fitur worker {monitor.workerEnabled ? "aktif" : "nonaktif"}.
            Heartbeat menunjukkan tiket dipakai, bukan bukti seluruh
            job/pengiriman sukses.
          </p>
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              ["Job gagal", monitor.failedJobs],
              ["Pengiriman gagal/tidak pasti", monitor.failedMessages],
              ["Antrean siap kirim", monitor.readyQueue],
              ["Sampel API modul / 1 jam", monitor.samples],
              [
                "Rata-rata API / ms",
                monitor.samples ? monitor.averageMs : "Belum ada sampel",
              ],
              [
                "Maksimum API / ms",
                monitor.samples ? monitor.maxMs : "Belum ada sampel",
              ],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-lg bg-muted/30 p-3">
                <dt className="text-sm">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            Waktu API adalah durasi server untuk endpoint modul yang
            terinstrumentasi; bukan waktu jaringan/browser atau durasi job. Data
            timing sebelum rilis ini belum tersedia.
          </p>
          {!monitor.alerts.length && (
            <p className="text-sm">
              Tidak ada ambang peringatan terlampaui pada pemeriksaan ini.
            </p>
          )}
          {monitor.alerts.map((a) => (
            <div
              key={a.code}
              className="rounded-lg border border-amber-500 p-3 text-sm"
            >
              <p>{a.message}</p>
              <Link prefetch={false} href={a.href} className="underline">
                Buka pemeriksaan terkait
              </Link>
            </div>
          ))}
          <details>
            <summary className="cursor-pointer">
              Respons per modul (1 jam)
            </summary>
            <ul className="space-y-2 text-sm">
              {monitor.modules.map((m) => (
                <li key={m.module}>
                  {m.module}: {m.samples} sampel · rata-rata {m.average_ms} ms ·
                  maksimum {m.max_ms} ms
                </li>
              ))}
            </ul>
          </details>
          <h3 className="font-semibold">
            Kelompok kejadian (30 hari, maksimal 20 kelompok)
          </h3>
          <p className="text-xs">
            Pengelompokan berdasarkan modul/kode; setiap UUID asal tetap
            dipertahankan pada laporan yang ditautkan.
          </p>
          <ul className="space-y-2 text-sm">
            {monitor.groups.map((g) => (
              <li key={g.module + g.code}>
                {g.module}/{g.code}: {g.count} referensi unik
              </li>
            ))}
          </ul>
          <div className="rounded-lg bg-muted/30 p-3 text-sm">
            <h3 className="font-semibold">Retensi data</h3>
            <p>
              Metadata error dan metrik: 30 hari. Laporan selesai beserta
              referensi/catatan: 365 hari setelah penyelesaian; laporan terbuka
              tetap disimpan. Data kedaluwarsa disembunyikan dan dibersihkan
              bertahap saat pencatatan berlangsung atau melalui tindakan admin
              berikut.
            </p>
          </div>
          <DataForm
            label="Bersihkan data kendala kedaluwarsa"
            submitLabel="Konfirmasi pembersihan sesuai retensi"
            fields={[reason]}
            description="Menghapus metadata error/metrik di luar 30 hari dan maksimal 100 laporan selesai di luar 365 hari beserta riwayatnya. Periksa kebijakan retensi sebelum melanjutkan."
            {...props}
            onSave={(data) => save({ ...data, operation: "purge" })}
          />
        </section>
      )}
    </section>
  );
}
