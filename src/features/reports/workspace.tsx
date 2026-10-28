"use client";
import { HelpDisclosure } from "@/components/ui/help-disclosure";
import { formatNumber } from "@/lib/format/number";
import Link from "next/link";
import { honorSourceLink } from "@/lib/finance/provenance";
import { ZodError } from "zod";
import { useEffect, useRef, useState } from "react";
import { masterRequest } from "../masters/api";
import {
  reportDefinitions,
  capabilitiesSchema,
  readReportResponse,
  type Report,
  type ReportRow,
} from "@/lib/reports/contracts";
import { wibDate } from "@/lib/calendar/schemas";
import { formatHonorAmount } from "@/lib/finance/contracts";
import { issueLabels } from "@/lib/finance/schemas";
import { downloadFile } from "@/lib/feedback/api-error";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { TableRegion } from "@/components/ui/table-region";
import { FormDialog } from "@/components/ui/dialog";
import { input, panel } from "../programs/forms";
import { useReadResource } from "@/lib/feedback/use-read-resource";
import { FeatureState } from "@/components/feedback/feature-state";
import { ReportAccess } from "./report-access";
const parseCapabilities=(raw:unknown)=>{const parsed=capabilitiesSchema.safeParse(raw);if(!parsed.success)throw Error("Data izin laporan belum sesuai. Coba muat ulang akses.");return parsed.data;};
const endpoint = "/api/reports/";
const errorText = (e: unknown) =>
  e instanceof ZodError
    ? "Respons laporan belum sesuai. Muat ulang atau hubungi admin jika kendala berulang."
    : e instanceof Error
      ? e.message
      : "Laporan belum dapat dimuat. Coba kembali.";
const categoryLabels:Record<string,string>={KBM:"KBM",EXAM_SUPERVISOR:"Pengawasan ujian",ATTENDANCE:"Kehadiran"};
const yes = (v: boolean | undefined) => (v ? "Ya" : "Belum");
export function ReportsWorkspace() {
  const {value:caps,error:capsError,loading:capsLoading,refresh:refreshCaps}=useReadResource(endpoint+"read?kind=capabilities",parseCapabilities);
  const [report, setReport] = useState<Report | null>(null),
    [loadedQuery, setLoadedQuery] = useState(""),
    [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [downloading, setDownloading] = useState(false),
    [downloadError,setDownloadError]=useState("");
  const [kindChoice, setKind] = useState<"academic" | "finance">("academic"),
    [period, setPeriod] = useState(() => wibDate().slice(0, 7)),
    [teacher, setTeacher] = useState(""),
    [mode, setMode] = useState("realized"),
    [page, setPage] = useState(1),
    [detail, setDetail] = useState<ReportRow | null>(null);
  const exportLock = useRef(false), mounted=useRef(false), exportController=useRef<AbortController|null>(null);
  const lastDetailButton=useRef<HTMLButtonElement|null>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;exportController.current?.abort();};},[]);
  const kind=caps?.[kindChoice] ? kindChoice : caps?.academic ? "academic" : "finance";
  const validPeriod=/^20\d{2}-(0[1-9]|1[0-2])$/.test(period);
  const permitted=caps?.[kind] === true;
  const allowed = permitted && validPeriod;
  const query = new URLSearchParams({
    kind,
    period,
    teacher,
    mode,
    page: String(page),
    pageSize: "25",
  }).toString();
  useEffect(() => {
    if (!allowed) {
      let active=true;
      queueMicrotask(()=>{if(active){setDetail(null);setReport(null);setLoadedQuery("");if(!permitted)setTeachers([]);setError("");setLoading(false);}});
      exportController.current?.abort();
      return ()=>{active=false;};
    }
    const c = new AbortController();
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setLoading(true);
        setReport(null);
        setError("");
        setDownloadError("");
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
          const parsed = readReportResponse(v,query);
          const last=Math.max(1,Math.ceil(parsed.total/25));
          if(page>last){setPage(last);return;}
          setReport(parsed);
          setTeachers(parsed.teachers);
          setLoadedQuery(query);

        }
      })
      .catch((e) => {
        if (active) {setReport(null);setError(errorText(e));}
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      c.abort();
    };
  }, [query, allowed, permitted, refresh, page]);
  async function download() {
    if (exportLock.current || loadedQuery !== query || !report || loading || !allowed) return;
    exportLock.current = true;
    setDownloading(true);
    setDownloadError("");
    const c=new AbortController();exportController.current=c;
    try {
      await downloadFile(
        endpoint + "excel?" + query,
        `laporan-${kind}-${period}.xlsx`,
        {signal:AbortSignal.any([c.signal,AbortSignal.timeout(40000)])},
      );
    } catch (e) {
      if(mounted.current&&!c.signal.aborted)setDownloadError(errorText(e));
    } finally {
      exportLock.current = false;exportController.current=null;
      if(mounted.current)setDownloading(false);
    }
  }
  const s = report?.summary;
  const visibleDetail=allowed && report && loadedQuery===query && !loading ? detail : null;
  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <header className="space-y-2 rounded-2xl border bg-accent/40 p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">
          Ringkasan dan sumber data
        </p>
        <h1 className="text-2xl font-bold">Laporan pimpinan</h1>
        <HelpDisclosure><p className="mt-2 text-sm text-muted-foreground">
          Tinjau kelengkapan administrasi dan honorarium sesuai izin yang
          diberikan admin.
        </p></HelpDisclosure>
      </header>
      <ErrorFeedback message={error} />
      <ErrorFeedback message={downloadError}/>
      {!validPeriod&&<p role="alert" className="text-sm text-destructive">Pilih bulan laporan antara Januari 2000 dan Desember 2099 sebelum memuat data.</p>}
      {!caps && <FeatureState headingLevel={2} error={capsError} label="Memverifikasi akses laporan…" retry={refreshCaps}/>}
      {caps && capsLoading && <p role="status" className="text-sm">Memperbarui akses laporan…</p>}
      {caps && !caps.academic && !caps.finance && (
        <section className={panel}>
          <h2 className="font-semibold">Akses laporan belum diberikan</h2>
          <p>
            Hubungi admin untuk meminta izin akademik atau honorarium. Jabatan
            tambahan tidak memberikan akses secara otomatis.
          </p>
          <Button type="button" variant="outline" disabled={capsLoading} onClick={refreshCaps}>Periksa ulang akses</Button>
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
                  disabled={downloading}
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
            <div className={kind==="academic"?"grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3":"grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4"}>
              <label className="min-w-0 text-sm">
                Bulan
                <input
                  className={input}
                  type="month"
                  disabled={downloading}
                  required
                  aria-invalid={!validPeriod}
                  min="2000-01"
                  max="2099-12"
                  value={period}
                  onChange={(e) => {
                    setPeriod(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="min-w-0 text-sm">
                Guru
                <select
                  className={input}
                  disabled={downloading}
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
                    disabled={downloading}
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
            <details className="rounded-xl border p-3 text-sm leading-6">
              <summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-ring">Memahami sumber dan perhitungan</summary>
              <p className="mt-2 text-muted-foreground">{reportDefinitions[kind]}</p>
            </details>
            <p className="text-sm text-muted-foreground">Excel memuat seluruh hasil sesuai filter saat diunduh, bukan hanya halaman yang terlihat.</p>
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
                        {Object.hasOwn(issueLabels,i) ? issueLabels[i] : "Periksa temuan periode pada halaman Honorarium."}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm">
                    Temuan berlaku untuk seluruh periode, termasuk saat filter
                    guru dipilih.
                  </p>
                </aside>
              )}
              <div className={kind==="academic"?"grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5":"grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
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
                        "Pulang / catatan kehadiran",
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
                      ["Total JTM", formatNumber(s?.jtm)],
                      [
                        "Total honorarium",
                        formatHonorAmount(String(s?.total)),
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
                    <table className={kind==="academic"?"w-full min-w-[44rem] table-fixed text-left text-sm":"w-full min-w-[32rem] table-fixed text-left text-sm"}>
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
                                <td className="p-3"><span className="line-clamp-3" title={r.name}>{r.name}</span></td>
                                <td className="p-3">{yes(r.confirmed)}</td>
                                <td className="p-3">{yes(r.documented)}</td>
                              </>
                            ) : (
                              <>
                                <td className="p-3"><span className="line-clamp-3" title={r.name}>{r.name}</span></td>
                                <td className="p-3">{formatNumber(r.jtm)}</td>
                                <td className="p-3">
                                  {formatHonorAmount(r.total!)}
                                </td>
                              </>
                            )}
                            <td className="p-3">
                              <Button
                                variant="outline"
                                onClick={event => {lastDetailButton.current=event.currentTarget;setDetail(r);}}
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
                  disabled={loading||downloading}
                />
              </section>
            </>
          )}
        </>
      )}
      {caps?.admin && (
        <ReportAccess onChange={refreshCaps} />
      )}
      <FormDialog
        title="Rincian catatan laporan"
        trigger=""
        description="Nilai berasal dari sumber dan filter yang sama dengan ringkasan. Isi jurnal dan data pribadi tidak disalin ke laporan ini."
        open={!!visibleDetail}
        onOpenChange={(v) => {
          if (!v) {setDetail(null);requestAnimationFrame(()=>{if(lastDetailButton.current?.isConnected)lastDetailButton.current.focus();});}
        }}
      >
        {visibleDetail && (
          <div className="space-y-4">
          {report?.kind === "academic" && honorSourceLink({ component: visibleDetail.category === "ATTENDANCE" ? "TRANSPORT" : visibleDetail.category ?? "", date: visibleDetail.date }) && <p className="text-sm leading-6"><Link prefetch={false} className="inline-flex min-h-11 items-center text-primary underline" href={honorSourceLink({ component: visibleDetail.category === "ATTENDANCE" ? "TRANSPORT" : visibleDetail.category ?? "", date: visibleDetail.date })!}>Buka sumber pada tanggal {visibleDetail.date}</Link><br/>Halaman sumber menampilkan data sesuai izin akun Anda; izin laporan tidak memperluas akses kegiatan.</p>}
          <dl className="grid min-w-0 gap-3">
            {Object.entries(visibleDetail).map(([k, v]) => (
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
                  {typeof v === "boolean" ? yes(v) : ["teaching","allowances","transport","corrections","total"].includes(k) ? formatHonorAmount(String(v)) : k==="category" ? (Object.hasOwn(categoryLabels,String(v))?categoryLabels[String(v)]:String(v)) : (v ?? "—")}
                </dd>
              </div>
            ))}
          </dl>
          </div>
        )}
      </FormDialog>
    </div>
  );
}
