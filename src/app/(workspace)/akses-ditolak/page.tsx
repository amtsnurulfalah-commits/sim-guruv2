import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AccessDeniedPage() {
  return (
    <section aria-labelledby="access-denied-title" className="ui-panel mx-auto max-w-lg space-y-4">
      <ShieldAlert aria-hidden="true" className="size-8 text-muted-foreground" />
      <h1 id="access-denied-title" className="text-2xl font-bold">Akses ditolak</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Peran akun Anda belum memiliki izin untuk membuka halaman ini.
        Hubungi administrator jika halaman ini diperlukan untuk tugas Anda.
      </p>
      <Button asChild>
        <Link href="/dashboard">Kembali ke dashboard</Link>
      </Button>
    </section>
  );
}
