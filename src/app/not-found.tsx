import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return <main id="konten-utama" className="mx-auto max-w-lg px-5 py-24"><p className="text-sm font-semibold text-primary">404</p><h1 className="mt-3 text-3xl font-bold">Halaman tidak ditemukan</h1><p className="mt-4 leading-7 text-muted-foreground">Alamat ini belum tersedia atau tidak ditemukan.</p><Button asChild className="mt-6"><Link href="/">Kembali ke beranda</Link></Button></main>;
}
