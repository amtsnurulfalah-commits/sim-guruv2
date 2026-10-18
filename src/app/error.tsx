"use client";
import { Button } from "@/components/ui/button";
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="konten-utama" className="mx-auto max-w-lg px-5 py-24"><h1 className="text-3xl font-bold">Halaman belum dapat dimuat</h1><p className="mt-4 leading-7 text-muted-foreground">Silakan coba lagi. Jika masih terjadi, hubungi pengelola aplikasi.</p><Button onClick={reset} className="mt-6">Coba lagi</Button></main>;
}
