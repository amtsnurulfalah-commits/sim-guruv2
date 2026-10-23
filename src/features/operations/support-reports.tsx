"use client";
import { useEffect, useRef, useState } from "react";
import { Search, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { masterRequest } from "@/features/masters/api";
import { guidance } from "@/lib/feedback/catalog";
import { supportLookupSchema, supportReferenceSchema, type SupportEvent } from "@/lib/feedback/support";
const moduleLabels: Record<string,string> = { auth:"Autentikasi", accounts:"Akun dan Profil", activities:"Kegiatan dan Jurnal", users:"Pengguna", schedules:"Jadwal Mengajar", calendar:"Kalender", masters:"Data Master", duties:"Piket dan Upacara", finance:"Honorarium", programs:"Ujian dan Acara", operations:"Operasional", migration:"Migrasi", dashboard:"Dashboard" };
const adminGuidance: Record<string,string> = {
 JOURNAL_BLOCKED:"Periksa Kebijakan dan Pemblokiran Jurnal untuk guru, mata pelajaran, dan tanggal yang dilaporkan. Cocokkan alasan pemblokiran; ubah hanya jika sesuai kebijakan madrasah.",
 FORBIDDEN:"Periksa peran akun dan kewenangan atas data yang dituju. Jangan memberikan akses tambahan sebelum kewenangan pengguna dipastikan.",
 VALIDATION_ERROR:"Minta pesan lengkap atau tangkapan layar agar nama isian yang bermasalah terlihat. Bantu pengguna memperbaiki isian tersebut; nilai formulir tidak disimpan dalam laporan ini.",
 INTERNAL_ERROR:"Minta waktu dan tindakan yang dilakukan. Admin teknis perlu menelusuri log runtime Vercel memakai referensi ini; periksa status penyimpanan sebelum mencoba ulang.",
 UNAVAILABLE:"Periksa kesehatan deployment dan koneksi database melalui pemantauan layanan. Minta admin teknis menelusuri referensi ini; jangan membagikan konfigurasi rahasia kepada pengguna.",
 RATE_LIMITED:"Minta pengguna menunggu sesuai pesan batas percobaan, lalu mencoba kembali. Periksa percobaan berulang sebelum mengubah kebijakan pembatasan.",
};
export function SupportReports() {
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<SupportEvent | null>(null);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => { pending.current?.abort(); pending.current = null; }, []);
  function changeReference(value: string) {
    pending.current?.abort();
    pending.current = null;
    setBusy(false); setReference(value); setResult(null); setSearched(false); setError("");
  }
  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError(""); setSearched(false); setResult(null);
    const parsed = supportReferenceSchema.safeParse(reference.trim());
    if (!parsed.success) {
      setError("Kode referensi harus berupa UUID lengkap. Salin kode dari pesan bantuan pengguna."); return;
    }
    const submitted = parsed.data.toLowerCase();
    setReference(submitted);
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      const response = await masterRequest<unknown>("/api/operations/support?reference=" + encodeURIComponent(submitted), "GET", undefined, controller.signal);
      if (pending.current !== controller) return;
      const parsedResult = supportLookupSchema.safeParse(response);
      if (!parsedResult.success || (parsedResult.data && parsedResult.data.requestId.toLowerCase() !== submitted))
        throw new Error("Jawaban layanan laporan tidak sesuai. Cari kembali; jika tetap terjadi, hubungi admin teknis dengan kode referensi yang Anda cari.");
      setResult(parsedResult.data); setSearched(true);
    } catch (e) {
      if (pending.current === controller) setError(e instanceof Error ? e.message : "Laporan belum dapat dimuat. Coba kembali.");
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }
  return <section className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
    <header><h1 className="text-2xl font-bold">Laporan Kendala</h1><p className="mt-2 text-muted-foreground">Telusuri permintaan yang ditolak menggunakan kode referensi bantuan dari pengguna.</p></header>
    <form onSubmit={search} className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
      <label htmlFor="support-reference" className="block font-semibold">Kode referensi bantuan</label>
      <input id="support-reference" required maxLength={80} autoComplete="off" autoCapitalize="none" spellCheck={false} value={reference} onChange={e=>changeReference(e.target.value)} className="min-h-11 min-w-0 w-full rounded-lg border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" placeholder="Tempel kode referensi lengkap" aria-describedby="support-help" />
      <p id="support-help" className="text-sm text-muted-foreground">Minta juga waktu kejadian, halaman, tindakan, dan pesan lengkap. Jangan meminta kata sandi, OTP, atau tautan aktivasi.</p>
      <Button className="w-full sm:w-auto" disabled={busy} type="submit">{busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Search aria-hidden="true" />}{busy ? "Mencari laporan…" : "Cari laporan"}</Button>
    </form>
    <ErrorFeedback message={error} autoFocus />
    <div aria-live="polite" aria-atomic="true" aria-busy={busy} className="min-w-0">
      {busy && <p role="status" className="rounded-xl border bg-muted/30 p-4 text-sm">Sedang mencari kode referensi. Mengubah kode akan membatalkan pencarian ini.</p>}
      {!busy && !searched && !error && <div className="rounded-xl border border-dashed p-4 sm:p-6 space-y-2"><h2 className="font-semibold">Mulai penelusuran kendala</h2><p className="text-sm text-muted-foreground">Tempel kode referensi bantuan dari pengguna, lalu pilih Cari laporan. Rincian berisi waktu, modul, kode kesalahan, dan langkah penanganan.</p></div>}
      {searched && !result && <div className="rounded-xl border p-5 space-y-2"><h2 className="font-semibold">Referensi belum ditemukan</h2><p>Pastikan kode lengkap. Pencatatan dapat memerlukan beberapa saat; coba cari kembali. Laporan sebelum fitur ini aktif, berusia lebih dari 30 hari, atau gagal disimpan mungkin hanya tersedia di log server. Gangguan koneksi sebelum permintaan mencapai server tidak tercatat di sini.</p><p>Admin teknis dapat mencari kode referensi di log runtime Vercel berdasarkan waktu kejadian. Hasil kosong tidak berarti laporan pengguna keliru.</p></div>}
      {result && <article className="rounded-xl border bg-card p-4 sm:p-6 space-y-4"><h2 className="text-lg font-semibold">Rincian kendala</h2><dl className="grid gap-3 sm:grid-cols-2">
        {Object.entries({"Referensi":result.requestId,"Waktu (WIB)":new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"medium",timeZone:"Asia/Jakarta"}).format(new Date(result.occurredAt)),"Modul":Object.hasOwn(moduleLabels,result.module) ? moduleLabels[result.module] : result.module,"Kode kesalahan":result.code,"Status HTTP":String(result.status)}).map(([label,value])=><div key={label} className="min-w-0 rounded-lg bg-muted/30 p-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 font-medium [overflow-wrap:anywhere]">{value}</dd></div>)}
        </dl><h3 className="font-semibold">Langkah penanganan</h3><p>{Object.hasOwn(adminGuidance,result.code) ? adminGuidance[result.code] : Object.hasOwn(guidance,result.code) ? guidance[result.code] : "Periksa pesan lengkap pengguna, hak akses, dan kondisi data pada modul terkait. Eskalasi ke admin teknis dengan kode referensi jika penyebab belum jelas."}</p><p className="text-sm text-muted-foreground">Laporan merekam kegagalan permintaan, bukan bukti masalah sudah diselesaikan. Setelah perbaikan, verifikasi kembali bersama pengguna; periksa riwayat sebelum mengulangi penyimpanan.</p></article>}
    </div>
  </section>;
}
