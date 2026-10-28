import { formatNumber } from "@/lib/format/number";
import type { HonorSnapshot, SourceLine } from "@/lib/finance/schemas";
import { formatHonorAmount } from "@/lib/finance/contracts";
import { honorLineContext, honorTransportFacts, honorExplanation, honorLineReferences, honorModeText, honorSourceLink } from "@/lib/finance/provenance";
import Link from "next/link";
export function HonorProvenance({ snapshot: s, hidden }: { snapshot: HonorSnapshot; hidden: boolean }) {
  const amount = (value: string) => hidden ? "••••" : formatHonorAmount(value);
  return <details className="rounded-xl border bg-muted/20 p-3 text-sm leading-6 print:break-inside-avoid">
    <summary className="min-h-11 cursor-pointer py-2 font-semibold">Asal perhitungan</summary>
    <p className="mt-2 font-medium">{honorModeText(s)}</p>
    <p>{honorExplanation}</p>
    <dl className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 [overflow-wrap:anywhere]">
      {[["Periode / batas tanggal perhitungan", `${s.period} / ${s.cutoff}`],
        ["Versi rumus / kebijakan", `${s.formulaVersion} / ${s.policyVersion}`],
        ["Honor mengajar sebelum pembulatan", `${formatNumber(s.totalJtm)} JTM × ${amount(s.rate)} = ${amount(s.teachingRaw)}`],
        ["Honor mengajar setelah pembulatan", amount(s.teachingSettled)],
        ["Transport sebelum / setelah pembulatan", `${amount(s.transportRaw)} / ${amount(s.transportSettled)}`],
        ["Referensi versi tarif JTM", s.rateId ?? "Tidak tercantum pada rincian lama; gunakan tarif yang ditampilkan."],
      ].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}
    </dl>
    {s.policyVersion === "finance-v1" && <p className="mt-3">Tarif JTM dan tunjangan mengikuti versi yang berlaku pada akhir bulan, tanpa prorata tunjangan. Transport hanya dari bukti kehadiran aktual; pembulatan mengikuti versi kebijakan yang tercantum.</p>}
    {s.rateMissing && <p className="mt-3 text-amber-900">Tarif JTM belum tersedia pada hasil ini. Minta administrator memeriksa versi tarif untuk periode terkait sebelum finalisasi.</p>}
    <p className="mt-3 text-muted-foreground">Buka Rincian sumber untuk tanggal, JTM, pembalikan dan referensi koreksi. Halaman sumber menampilkan data terkini sesuai izin; perbedaan setelah penerbitan tidak mengubah rincian slip saat diterbitkan.</p>
  </details>;
}
export function HonorLineOrigin({ line, hidden }: { line: SourceLine; hidden: boolean }) {
  const href = honorSourceLink(line), refs = [...honorLineContext(line), ...honorTransportFacts(line), ...honorLineReferences(line)];
  return <details className="min-w-40 max-w-sm p-2 text-sm [overflow-wrap:anywhere]">
    <summary className="min-h-11 cursor-pointer py-2">Telusuri sumber</summary>
    {refs.length ? <dl className="space-y-2">{refs.map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}</dl> : <p>Referensi terperinci tidak tercantum pada rincian ini.</p>}
    {line.component === "TRANSPORT" && typeof line.rate === "string" && /^-?\d+(\.\d+)?$/.test(line.rate) && <p>Tarif transport pada sumber: {hidden ? "••••" : formatHonorAmount(line.rate)}. Rasio tampilan bukan dasar untuk menghitung ulang nilai mentah.</p>}
    {line.component === "HOLIDAY_PENDING" && <p>Hak libur masih berupa proyeksi; bukan bukti posting atau pembayaran.</p>}
    {href ? <Link prefetch={false} className="mt-2 inline-flex min-h-11 items-center font-medium text-primary underline" href={href}>Buka sumber tanggal {line.date}</Link> : <p className="mt-2">Gunakan referensi ini saat mengajukan koreksi pada slip atau menghubungi administrator.</p>}
  </details>;
}
