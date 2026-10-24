"use client";
import { ZodError } from "zod";
import { useEffect, useRef, useState } from "react";
import { masterRequest } from "../masters/api";
import {
  reportDefinitions,
  capabilitiesSchema,
  reportResponseSchema,
  type Capabilities,
  type Reader,
  type Report,
  type ReportRow,
} from "@/lib/reports/contracts";
import { wibDate } from "@/lib/calendar/schemas";
import { formatHonorAmount } from "@/lib/finance/contracts";
import { issueLabels } from "@/lib/finance/schemas";
import { ApiRequestError, downloadFile } from "@/lib/feedback/api-error";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { TableRegion } from "@/components/ui/table-region";
import { FormDialog } from "@/components/ui/dialog";
import { DataForm, input, panel } from "../programs/forms";
const endpoint = "/api/reports/";
const errorText = (e: unknown) =>
  e instanceof ZodError
    ? "Respons laporan belum sesuai. Muat ulang atau hubungi admin jika kendala berulang."
    : e instanceof Error
      ? e.message
      : "Laporan belum dapat dimuat. Coba kembali.";
const yes = (v: boolean | undefined) => (v ? "Ya" : "Belum");
export function ReportsWorkspace() {
  const [caps, setCaps] = useState<Capabilities | null>(null),
    [report, setReport] = useState<Report | null>(null),
    [loadedQuery, setLoadedQuery] = useState(""),
    [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [downloading, setDownloading] = useState(false);
  const [kind, setKind] = useState<"academic" | "finance">("academic"),
    [period, setPeriod] = useState(() => wibDate().slice(0, 7)),
    [teacher, setTeacher] = useState(""),
    [mode, setMode] = useState("realized"),
    [page, setPage] = useState(1),
    [detail, setDetail] = useState<ReportRow | null>(null);
  const exportLock = useRef(false);
  useEffect(() => {
    const c = new AbortController();
    masterRequest<Capabilities>(
      endpoint + "read?kind=capabilities",
      "GET",
      undefined,
      c.signal,
    )
      .then((v) => {
        setCaps(capabilitiesSchema.parse(v));
        if (!v.academic && v.finance) setKind("finance");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(errorText(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [refresh]);
  const allowed = caps?.[kind] === true;
  const query = new URLSearchParams({
    kind,
    period,
    teacher,
    mode,
    page: String(page),
    pageSize: "25",
  }).toString();
  useEffect(() => {
    if (!allowed) return;
    const c = new AbortController();
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setLoading(true);
        setReport(null);
        setError("");
        setDetail(null);
      }
    });
    masterRequest<Report>(
      endpoint + "read?" + query,
      "GET",
      undefined,
      c.signal,
    )
      .then((v) => {
        if (active) {
          const parsed = reportResponseSchema.parse(v);
          if (
            parsed.kind !== new URLSearchParams(query).get("kind") ||
            parsed.period !== new URLSearchParams(query).get("period") ||
            parsed.teacher !==
              (new URLSearchParams(query).get("teacher") || null) ||
            parsed.page !== page
          )
            throw new Error(
              "Respons laporan tidak sesuai filter. Muat ulang untuk mencoba kembali.",
            );
          setReport(parsed);
          setTeachers(v.teachers);
          setLoadedQuery(query);
          if (v.total > 0 && page > Math.ceil(v.total / 25))
            setPage(Math.ceil(v.total / 25));
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      c.abort();
    };
  }, [query, allowed, refresh, page]);
  async function download() {
    if (exportLock.current || loadedQuery !== query) return;
    exportLock.current = true;
    setDownloading(true);
    setError("");
    try {
      await downloadFile(
        endpoint + "excel?" + query,
        `laporan-${kind}-${period}.xlsx`,
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      exportLock.current = false;
      setDownloading(false);
    }
  }
  const s = report?.summary;
  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <header>
        <p className="text-sm text-muted-foreground">
          Ringkasan dan sumber data
        </p>
        <h1 className="text-2xl font-bold">Laporan pimpinan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tinjau kelengkapan administrasi dan honorarium sesuai izin yang
          diberikan admin.
        </p>
      </header>
      <ErrorFeedback message={error} />
      {!caps && !loading && (
        <Button onClick={() => setRefresh((x) => x + 1)}>Coba kembali</Button>
      )}
      {caps && !caps.academic && !caps.finance && (
        <section className={panel}>
          <h2 className="font-semibold">Akses laporan belum diberikan</h2>
          <p>
            Hubungi admin untuk meminta izin akademik atau honorarium. Jabatan
            tambahan tidak memberikan akses secara otomatis.
          </p>
        </section>
      )}
      {caps && (caps.academic || caps.finance) && (
        <>
          <div
            role="group"
            aria-label="Jenis laporan"
            className="flex flex-wrap gap-2"
          >
            {(["academic", "finance"] as const)
              .filter((k) => caps[k])
              .map((k) => (
                <Button
                  key={k}
                  variant={kind === k ? "default" : "outline"}
                  aria-pressed={kind === k}
                  onClick={() => {
                    setKind(k);
                    setPage(1);
                    setTeacher("");
                  }}
                >
                  {k === "academic" ? "Akademik" : "Honorarium"}
                </Button>
              ))}
          </div>
          <section className={panel} aria-label="Filter laporan">
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="min-w-0 text-sm">
                Bulan
                <input
                  className={input}
                  type="month"
                  min="2000-01"
                  max="2099-12"
                  value={period}
                  onChange={(e) => {
                    if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value)) {
                      setPeriod(e.target.value);
                      setPage(1);
                    }
                  }}
                />
              </label>
              <label className="min-w-0 text-sm">
                Guru
                <select
                  className={input}
                  value={teacher}
                  onChange={(e) => {
                    setTeacher(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Semua guru</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              {kind === "finance" && (
                <label className="min-w-0 text-sm">
                  Dasar perhitungan
                  <select
                    className={input}
                    value={mode}
                    onChange={(e) => {
                      setMode(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="realized">Realisasi</option>
                    <option value="projection">Proyeksi hak libur</option>
                  </select>
                </label>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  variant="outline"
                  disabled={loading || downloading}
                  onClick={() => setRefresh((x) => x + 1)}
                >
                  Muat ulang
                </Button>
                <Button
                  disabled={
                    !report || loadedQuery !== query || loading || downloading
                  }
                  onClick={() => void download()}
                >
                  {downloading ? "Menyiapkan…" : "Unduh Excel"}
                </Button>
              </div>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {reportDefinitions[kind]}
            </p>
          </section>
          {loading && <p role="status">Memuat laporan…</p>}
          {report && loadedQuery === query && !loading && (
            <>
              <p className="text-sm text-muted-foreground">
                Periode {report.period} · Status{" "}
                {report.mode === "final"
                  ? "Final — snapshot asli"
                  : report.mode === "projection"
                    ? "Proyeksi"
                    : report.mode === "recorded"
                      ? "Catatan terbentuk"
                      : "Realisasi"}{" "}
                · Batas sumber {report.cutoff} WIB · Dibaca{" "}
                {new Date(report.updatedAt).toLocaleString("id-ID", {
                  timeZone: "Asia/Jakarta",
                })}{" "}
                WIB
              </p>
              {report.issues.length > 0 && (
                <aside className={panel}>
                  <h2 className="font-semibold">
                    Perlu diperiksa pada periode ini
                  </h2>
                  <ul className="list-inside list-disc text-sm">
                    {report.issues.map((i) => (
                      <li key={i}>
                        {issueLabels[i] ??
                          "Periksa temuan periode pada halaman Honorarium."}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm">
                    Temuan berlaku untuk seluruh periode, termasuk saat filter
                    guru dipilih.
                  </p>
                </aside>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {kind === "academic"
                  ? [
                      ["Konfirmasi KBM", `${s?.confirmed} / ${s?.kbm}`],
                      ["Jurnal / KBM terbentuk", `${s?.journals} / ${s?.kbm}`],
                      [
                        "BAP / pengawasan terbentuk",
                        `${s?.baps} / ${s?.exams}`,
                      ],
                      [
                        "Masuk / catatan kehadiran",
                        `${s?.present} / ${s?.attendance}`,
                      ],
                      [
                        "Masuk-pulang / catatan",
                        `${s?.complete} / ${s?.attendance}`,
                      ],
                    ].map(([k, v]) => (
                      <article key={k} className={panel}>
                        <h2 className="text-sm text-muted-foreground">{k}</h2>
                        <p className="text-2xl font-bold">{v}</p>
                      </article>
                    ))
                  : [
                      ["Penerima", String(s?.beneficiaries)],
                      ["Total JTM", String(s?.jtm)],
                      [
                        "Total honorarium",
                        "Rp " + formatHonorAmount(String(s?.total)),
                      ],
                    ].map(([k, v]) => (
                      <article key={k} className={panel}>
                        <h2 className="text-sm text-muted-foreground">{k}</h2>
                        <p className="text-2xl font-bold">{v}</p>
                      </article>
                    ))}
              </div>
              <section className={panel}>
                <h2 className="text-lg font-semibold">Rincian sumber</h2>
                {!report.total ? (
                  <p role="status">
                    Belum ada catatan sesuai filter. Periksa periode dan guru;
                    data kosong tidak berarti tidak ada jadwal.
                  </p>
                ) : (
                  <TableRegion label="Rincian laporan">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr>
                          {(kind === "academic"
                            ? [
                                "Tanggal",
                                "Jenis",
                                "Guru",
                                "Konfirmasi / masuk",
                                "Dokumen / pulang",
                                "Tindakan",
                              ]
                            : ["Guru", "JTM", "Total rupiah", "Tindakan"]
                          ).map((x) => (
                            <th key={x} className="p-3">
                              {x}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.items.map((r) => (
                          <tr key={r.id} className="border-t">
                            {kind === "academic" ? (
                              <>
                                <td className="p-3 whitespace-nowrap">
                                  {r.date}
                                </td>
                                <td className="p-3">
                                  {r.category === "ATTENDANCE"
                                    ? "Kehadiran"
                                    : r.category === "KBM"
                                      ? "KBM"
                                      : "Pengawasan ujian"}
                                </td>
                                <td className="p-3">{r.name}</td>
                                <td className="p-3">{yes(r.confirmed)}</td>
                                <td className="p-3">{yes(r.documented)}</td>
                              </>
                            ) : (
                              <>
                                <td className="p-3">{r.name}</td>
                                <td className="p-3">{r.jtm}</td>
                                <td className="p-3">
                                  {formatHonorAmount(r.total!)}
                                </td>
                              </>
                            )}
                            <td className="p-3">
                              <Button
                                variant="outline"
                                onClick={() => setDetail(r)}
                                aria-label={"Lihat rincian " + r.name}
                              >
                                Rincian
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableRegion>
                )}
                <Pagination
                  page={page}
                  pageSize={25}
                  total={report.total}
                  onPageChange={setPage}
                  disabled={loading}
                />
              </section>
            </>
          )}
        </>
      )}
      {caps?.admin && (
        <ReportAccess onChange={() => setRefresh((x) => x + 1)} />
      )}
      <FormDialog
        title="Rincian catatan laporan"
        description="Nilai berasal dari sumber dan filter yang sama dengan ringkasan. Isi jurnal dan data pribadi tidak disalin ke laporan ini."
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
      >
        {detail && (
          <dl className="grid min-w-0 gap-3">
            {Object.entries(detail).map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm text-muted-foreground">
                  {(
                    {
                      id: "ID sumber",
                      name: "Guru",
                      category: "Jenis",
                      date: "Tanggal",
                      user_id: "ID guru",
                      class_name: "Kelas",
                      subject: "Mapel",
                      confirmed: "Konfirmasi / masuk",
                      documented: "Dokumen / pulang",
                      time_in: "Jam masuk",
                      time_out: "Jam pulang",
                      jtm: "JTM",
                      teaching: "Mengajar (Rp)",
                      allowances: "Tunjangan (Rp)",
                      transport: "Transport (Rp)",
                      corrections: "Koreksi (Rp)",
                      total: "Total (Rp)",
                      cutoff: "Batas sumber",
                    } as Record<string, string>
                  )[k] ?? k}
                </dt>
                <dd className="min-w-0 [overflow-wrap:anywhere]">
                  {typeof v === "boolean" ? yes(v) : (v ?? "—")}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </FormDialog>
    </div>
  );
}
function ReportAccess({ onChange }: { onChange: () => void }) {
  const [readers, setReaders] = useState<Reader[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [locked, setLocked] = useState(false);
  useEffect(() => {
    let active = true;
    const c = new AbortController();
    masterRequest<{ items: Reader[] }>(
      endpoint + "read?kind=access",
      "GET",
      undefined,
      c.signal,
    )
      .then((r) => {
        if (active) {
          setReaders(r.items);
          setLocked(false);
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      c.abort();
    };
  }, [refresh]);
  return (
    <section className={panel}>
      <h2 className="text-lg font-semibold">Izin pembaca laporan</h2>
      <p className="text-sm">
        Admin memiliki akses penuh. Berikan hanya lingkup yang diperlukan;
        pencabutan berlaku pada pembacaan dan ekspor berikutnya. Alasan dicatat
        pada audit.
      </p>
      <ErrorFeedback message={error} />
      <Button
        variant="outline"
        onClick={() => {
          setLoading(true);
          setError("");
          setRefresh((x) => x + 1);
        }}
      >
        Muat ulang izin
      </Button>
      <DataForm
        key={refresh}
        label="Atur izin laporan"
        busy={loading}
        locked={locked}
        fields={[
          {
            key: "userId",
            label: "Pengguna",
            type: "select",
            options: readers.map((r) => ({ id: r.id, name: r.name })),
          },
          {
            key: "academic",
            label: "Laporan akademik",
            type: "select",
            options: [
              { id: "true", name: "Izinkan" },
              { id: "false", name: "Cabut / tidak diizinkan" },
            ],
          },
          {
            key: "finance",
            label: "Laporan honorarium",
            type: "select",
            options: [
              { id: "false", name: "Cabut / tidak diizinkan" },
              { id: "true", name: "Izinkan" },
            ],
          },
          { key: "reason", label: "Alasan (5–500 karakter)", type: "textarea" },
        ]}
        onSave={async (d) => {
          const r = readers.find((x) => x.id === d.userId);
          if (!r) throw new Error("Muat ulang daftar pengguna.");
          try {
            await masterRequest(endpoint + "access", "POST", {
              ...d,
              academic: d.academic === "true",
              finance: d.finance === "true",
              version: r.version,
            });
            setLoading(true);
            setRefresh((x) => x + 1);
            onChange();
          } catch (e) {
            if (
              !(e instanceof ApiRequestError) ||
              e.status >= 500 ||
              e.status === 409
            )
              setLocked(true);
            throw e;
          }
        }}
      />
      <ul className="space-y-2 text-sm">
        {readers
          .filter((r) => r.academic || r.finance)
          .map((r) => (
            <li key={r.id} className="rounded-lg border p-3">
              {r.name} ·{" "}
              {[r.academic ? "Akademik" : "", r.finance ? "Honorarium" : ""]
                .filter(Boolean)
                .join(", ")}
            </li>
          ))}
      </ul>
      {!loading && !readers.some((r) => r.academic || r.finance) && (
        <p className="text-sm text-muted-foreground">
          Belum ada guru yang diberi izin.
        </p>
      )}
    </section>
  );
}
