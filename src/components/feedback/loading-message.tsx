"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

export function LoadingMessage({ label }: { label: string }) {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setDelayed(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div role="status" aria-atomic="true" className="flex items-start gap-3 text-sm text-muted-foreground">
      <LoaderCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 motion-safe:animate-spin" />
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {delayed && <p className="mt-1">Masih memuat. Koneksi atau respons layanan mungkin sedang lambat.</p>}
      </div>
    </div>
  );
}
