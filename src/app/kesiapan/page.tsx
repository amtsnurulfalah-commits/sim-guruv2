import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export const metadata: Metadata = { title: "Status Pengembangan" };
const items = [
  ["Fondasi proyek", "Struktur aplikasi dan komponen dasar tersedia pada tahap ini."],
  ["Akun dan autentikasi", "Login, sesi dan logout internal tersedia. Onboarding lengkap dan pemulihan menyusul; koneksi runtime Supabase menunggu host pooler."],
  ["Database dan hak akses", "Fondasi database tersedia di Supabase. Koneksi runtime Vercel dan penerimaan alur akun produksi belum selesai."],
  ["Kegiatan dan honorarium", "Belum tersedia. Seluruh pencatatan bisnis menunggu modul terkait selesai."],
  ["Pengiriman email", "Belum diaktifkan. Tidak ada pesan yang dikirim dari halaman ini."],
];
export default function ReadinessPage() {
  return <main id="konten-utama" className="mx-auto max-w-3xl px-5 py-12"><Button asChild variant="outline"><Link href="/"><ArrowLeft aria-hidden="true" /> Kembali ke beranda</Link></Button><h1 className="mt-8 text-3xl font-bold tracking-tight">Status pengembangan</h1><p className="mt-3 leading-7 text-muted-foreground">Halaman ini menjelaskan cakupan tahap saat ini. Kesiapan setiap layanan dicatat terpisah dari ketersediaan halaman.</p><div className="mt-8 space-y-4">{items.map(([title, description]) => <Card key={title}><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-7 text-muted-foreground">{description}</p></CardContent></Card>)}</div></main>;
}
