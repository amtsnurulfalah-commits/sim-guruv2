import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main
      id="konten-utama"
      className="ui-panel mx-4 my-12 max-w-lg space-y-5 sm:mx-auto sm:p-8"
    >
      <Brand />
      <FileQuestion className="mt-7 size-10 text-primary" aria-hidden="true" />
      <p className="text-xs font-semibold tracking-widest text-muted-foreground">
        404 · HALAMAN TIDAK TERSEDIA
      </p>
      <h1>Halaman tidak ditemukan</h1>
      <p className="text-sm leading-7 text-muted-foreground">
        Alamat yang Anda buka tidak ditemukan. Kembali ke beranda untuk
        melanjutkan pekerjaan.
      </p>
      <Button asChild>
        <Link href="/">Kembali ke beranda</Link>
      </Button>
    </main>
  );
}
