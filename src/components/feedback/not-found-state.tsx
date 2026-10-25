import Link from "next/link";
import { BookOpen, FileQuestion } from "lucide-react";
import { Brand } from "@/components/brand";
import { ActionIcon } from "@/components/ui/action-icon";
import { Button } from "@/components/ui/button";

/** Static recovery destinations: no session reads, mutations or history guesses. */
export function NotFoundState({ embedded = false }: { embedded?: boolean }) {
  return (
    <section
      aria-labelledby="not-found-heading"
      className="ui-panel mx-auto w-full max-w-2xl min-w-0 space-y-6 [overflow-wrap:anywhere] sm:p-8"
    >
      {!embedded && (
        <div className="border-b pb-5">
          <Brand />
        </div>
      )}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
            <FileQuestion className="size-6" aria-hidden="true" />
          </span>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">
            404 · HALAMAN TIDAK DITEMUKAN
          </p>
        </div>
        <h1 id="not-found-heading">Halaman tidak ditemukan</h1>
        <p className="text-sm leading-7 text-muted-foreground">
          Alamat yang Anda buka mungkin salah, sudah berubah, atau tidak lagi
          tersedia. Periksa kembali ejaan alamat, atau pilih tujuan di bawah
          untuk melanjutkan.
        </p>
      </header>
      <nav
        aria-label="Navigasi pemulihan halaman"
        className="grid min-w-0 gap-3 sm:grid-cols-2"
      >
        <Button asChild className="w-full">
          <Link prefetch={false} href="/">
            <ActionIcon action="open" />
            Kembali ke beranda
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link prefetch={false} href="/dashboard">
            <ActionIcon action="section" />
            Buka Dashboard
          </Link>
        </Button>
      </nav>
      <aside className="min-w-0 space-y-3 rounded-xl border bg-muted/50 p-4">
        <h2 className="text-sm">Perlu bantuan menemukan halaman?</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Lihat panduan untuk mengenali menu aplikasi. Jika tautan dari aplikasi
          tetap tidak dapat dibuka, sampaikan nama menu dan waktu kejadian
          kepada administrator madrasah.
        </p>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link prefetch={false} href="/kesiapan">
            <BookOpen className="size-4 shrink-0" aria-hidden="true" />
            Buka panduan aplikasi
          </Link>
        </Button>
      </aside>
    </section>
  );
}
