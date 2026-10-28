"use client";
import type { ReactNode } from "react";
import { useInstallPrompt } from "@/features/release/use-install-prompt";
import { InstallPanel } from "@/features/release/experience";
import { Smartphone, CheckCircle2 } from "lucide-react";
export function InstallRequired({ children, required }: { children: ReactNode; required: boolean }) {
  return required ? <RequiredWindow>{children}</RequiredWindow> : children;
}
function RequiredWindow({ children }: { children: ReactNode }) {
  const install = useInstallPrompt();
  if (!install.checked) return <p role="status" aria-busy="true" className="py-6 text-sm text-muted-foreground">Memeriksa mode aplikasi…</p>;
  if (install.standalone) return children;
  return <section className="mx-auto min-w-0 max-w-2xl space-y-5 py-4" aria-labelledby="pwa-required-title">
    <header className="space-y-3"><span className="inline-flex rounded-2xl bg-accent p-3 text-primary"><Smartphone aria-hidden="true" className="size-7" /></span><h1 id="pwa-required-title">Pasang aplikasi untuk melanjutkan</h1><p className="text-sm leading-6 text-muted-foreground">Akun guru wajib membuka modul kerja melalui aplikasi SiM-Guru di perangkat ini.</p></header>
    <InstallPanel install={install} />
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm"><CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-primary"/><p>Setelah memasang, tutup tab ini dan buka SiM-Guru melalui ikon aplikasi. Masuk kembali bila diminta.</p></div>
    <p className="text-sm text-muted-foreground">Belum tersedia menu pemasangan? Buka alamat aplikasi melalui Chrome atau Edge terbaru, atau Safari pada iPhone/iPad. Hindari browser bawaan aplikasi pesan.</p>
  </section>;
}
