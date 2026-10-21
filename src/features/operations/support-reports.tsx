"use client";
import { useState } from "react";
import { Search, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { masterRequest } from "@/features/masters/api";
import { guidance } from "@/lib/feedback/catalog";
import type { SupportEvent } from "@/lib/feedback/support";
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
  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSearched(false); setResult(null);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference.trim())) {
      setError("Kode referensi harus berupa UUID lengkap. Salin kode dari pesan bantuan pengguna."); return;
    }
    setBusy(true);
    try {
      const value = await masterRequest<SupportEvent | null>("/api/operations/support?reference=" + encodeURIComponent(reference.trim()));
      setResult(value); setSearched(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Laporan belum dapat dimuat. Coba kembali."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-6">
    <header><h1 className="text-2xl font-bold">Laporan Kendala</h1><p className="mt-2 text-muted-foreground">Telusuri permintaan yang ditolak menggunakan kode referensi bantuan dari pengguna.</p></header>
    <form onSubmit={search} className="rounded-xl border bg-card p-5 space-y-4">
      <label htmlFor="support-reference" className="block font-semibold">Kode referensi bantuan</label>
      <input id="support-reference" required maxLength={36} value={reference} onChange={e=>setReference(e.target.value)} className="min-h-11 w-full rounded-lg border bg-background px-3" placeholder="48bfc3a0-adb3-45d0-a97f-eb27186062b0" aria-describedby="support-help" />
      <p id="support-help" className="text-sm text-muted-foreground">Minta juga waktu kejadian, halaman, tindakan, dan pesan lengkap. Jangan meminta kata sandi, OTP, atau tautan aktivasi.</p>
      <Button disabled={busy} type="submit">{busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Search aria-hidden="true" />}{busy ? "Mencari laporan…" : "Cari laporan"}</Button>
    </form>
    <ErrorFeedback message={error} autoFocus />
    <div aria-live="polite" aria-busy={busy}>
      {searched && !result && <div className="rounded-xl border p-5 space-y-2"><h2 className="font-semibold">Referensi belum ditemukan</h2><p>Pastikan kode lengkap. Pencatatan dapat memerlukan beberapa saat; coba cari kembali. Laporan sebelum fitur ini aktif, berusia lebih dari 30 hari, atau gagal disimpan mungkin hanya tersedia di log server. Gangguan koneksi sebelum permintaan mencapai server tidak tercatat di sini.</p><p>Admin teknis dapat mencari kode referensi di log runtime Vercel berdasarkan waktu kejadian. Hasil kosong tidak berarti laporan pengguna keliru.</p></div>}
      {result && <article className="rounded-xl border bg-card p-5 space-y-4"><h2 className="text-lg font-semibold">Rincian kendala</h2><dl className="grid gap-3 sm:grid-cols-2">
        {Object.entries({"Referensi":result.requestId,"Waktu (WIB)":new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"medium",timeZone:"Asia/Jakarta"}).format(new Date(result.occurredAt)),"Modul":moduleLabels[result.module] ?? result.module,"Kode kesalahan":result.code,"Status HTTP":String(result.status)}).map(([label,value])=><div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="break-words font-medium">{value}</dd></div>)}
        </dl><h3 className="font-semibold">Langkah penanganan</h3><p>{Object.hasOwn(adminGuidance,result.code) ? adminGuidance[result.code] : Object.hasOwn(guidance,result.code) ? guidance[result.code] : "Periksa pesan lengkap pengguna, hak akses, dan kondisi data pada modul terkait. Eskalasi ke admin teknis dengan kode referensi jika penyebab belum jelas."}</p><p className="text-sm text-muted-foreground">Laporan merekam kegagalan permintaan, bukan bukti masalah sudah diselesaikan. Setelah perbaikan, verifikasi kembali bersama pengguna; periksa riwayat sebelum mengulangi penyimpanan.</p></article>}
    </div>
  </section>;
}
