"use client";
import { Check, CircleAlert, Clock3, LoaderCircle, RotateCw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import { loadRecaptcha, type RecaptchaApi } from "./recaptcha-loader";

export function RecaptchaField({ siteKey, attempt, onToken, busy }: {
  siteKey: string | null;
  attempt: number;
  onToken: (token: string) => void;
  busy: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const descriptionId = useId();
  const tokenCallback = useRef(onToken);
  const currentWidget = useRef<{ api: RecaptchaApi; id: number } | null>(null);
  useEffect(() => { tokenCallback.current = onToken; }, [onToken]);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("Memuat verifikasi keamanan…");
  const [phase, setPhase] = useState<"loading" | "ready" | "verified" | "expired" | "error">("loading");
  const failed = phase === "error" || !siteKey;
  const verified = phase === "verified";
  useEffect(() => {
    tokenCallback.current("");
    if (!siteKey || !host.current) return;
    let active = true;
    let api: RecaptchaApi | undefined;
    let widget: number | undefined;
    // A new container avoids duplicate renders during Strict Mode and navigation.
    const node = document.createElement("div");
    host.current.appendChild(node);
    void loadRecaptcha().then(value => {
      if (!active) return;
      api = value;
      widget = api.render(node, {
        sitekey: siteKey,
        size: "compact",
        callback: token => {
          if (!active) return;
          tokenCallback.current(token);
          setPhase("verified");
          setStatus("Verifikasi selesai. Anda dapat menekan Masuk.");
        },
        "expired-callback": () => {
          if (!active) return;
          tokenCallback.current("");
          setPhase("expired");
          setStatus("Verifikasi kedaluwarsa. Centang reCAPTCHA kembali.");
        },
        "error-callback": () => {
          if (!active) return;
          tokenCallback.current("");
          setPhase("error");
          setStatus("reCAPTCHA tidak dapat terhubung. Periksa koneksi lalu muat ulang verifikasi.");
        },
      });
      currentWidget.current = { api, id: widget };
      setStatus("Centang reCAPTCHA untuk melanjutkan.");
      setPhase("ready");
    }).catch(() => {
      if (!active) return;
      tokenCallback.current("");
      setPhase("error");
      setStatus("reCAPTCHA gagal dimuat. Periksa koneksi atau pemblokir konten lalu coba kembali.");
    });
    return () => {
      active = false;
      currentWidget.current = null;
      tokenCallback.current("");
      if (api && widget !== undefined) { try { api.reset(widget); } catch { /* detached iframe */ } }
      node.remove();
    };
  }, [siteKey, revision]);
  useEffect(() => {
    tokenCallback.current("");
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const widget = currentWidget.current;
      if (!widget) return;
      widget.api.reset(widget.id);
      if (!active) return;
      setPhase("ready");
      setStatus("Centang reCAPTCHA untuk melanjutkan.");
    }).catch(() => {
      if (!active) return;
      setPhase("error");
      setStatus("reCAPTCHA gagal direset. Muat ulang verifikasi lalu coba kembali.");
    });
    return () => { active = false; };
  }, [attempt]);
  const StatusIcon = failed ? CircleAlert : verified ? Check : phase === "expired" ? Clock3 : phase === "loading" ? LoaderCircle : ShieldCheck;
  const badge = failed ? "Perlu perhatian" : verified ? "Terverifikasi" : phase === "expired" ? "Kedaluwarsa" : phase === "loading" ? "Menyiapkan" : "Belum diverifikasi";
  return (
    <section
      aria-label="Verifikasi keamanan"
      aria-describedby={descriptionId}
      className={cn(
        "@container/captcha min-w-0 rounded-2xl border bg-card shadow-sm transition-colors motion-reduce:transition-none",
        failed ? "border-[var(--error-border)]" : verified ? "border-[var(--success-border)]" : "border-border",
      )}
    >
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b px-4 py-3 @[22rem]/captcha:grid-cols-[auto_minmax(0,1fr)_auto]">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          <ShieldCheck className="size-4" aria-hidden="true" />
        </span>
        <h2 className="min-w-0 flex-1 text-sm font-semibold">Verifikasi keamanan</h2>
        <span aria-hidden="true" className={cn(
          "col-span-2 inline-flex max-w-full items-center justify-self-start gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium @[22rem]/captcha:col-span-1",
          failed ? "bg-[var(--error-surface)] text-destructive" : verified ? "bg-[var(--success-surface)] text-[var(--success)]" : phase === "expired" ? "bg-[var(--warning-surface)] text-[var(--warning)]" : "bg-muted text-muted-foreground",
        )}>
          <StatusIcon className={cn("size-3.5 shrink-0", phase === "loading" && !failed && "animate-spin motion-reduce:animate-none")} />
          {badge}
        </span>
      </div>
      <div className="grid min-w-0 items-center gap-4 p-4 @[22rem]/captcha:grid-cols-[auto_minmax(0,1fr)]">
        <div className={cn("relative min-h-[144px] w-[164px] justify-self-center", !siteKey && "hidden")}>
          <div ref={host} inert={busy} />
          {phase === "loading" && siteKey && <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-muted/70">
            <LoaderCircle className="size-6 animate-spin text-primary motion-reduce:animate-none" />
          </div>}
        </div>
        <div className={cn("min-w-0 space-y-2 text-center @[22rem]/captcha:text-left", !siteKey && "@[22rem]/captcha:col-span-2")}>
          <p className="text-sm font-semibold">
            {failed ? "Verifikasi belum tersedia" : verified ? "Anda siap masuk" : phase === "expired" ? "Ulangi verifikasi" : "Satu langkah lagi"}
          </p>
          <p id={descriptionId} role={failed ? "alert" : "status"} className="text-xs leading-6 text-muted-foreground">
            {siteKey ? status : "Verifikasi keamanan belum dikonfigurasi. Hubungi administrator madrasah."}
          </p>
          {phase === "error" && siteKey && <Button type="button" variant="outline" className="w-full text-xs @[22rem]/captcha:w-auto" disabled={busy} onClick={() => {
            tokenCallback.current(""); setStatus("Memuat verifikasi keamanan…"); setPhase("loading"); setRevision(value => value + 1);
          }}>
            <RotateCw aria-hidden="true" />Muat ulang verifikasi
          </Button>}
        </div>
      </div>
      <div className="border-t bg-muted/30 px-4 py-3 text-xs leading-6 text-muted-foreground">
        Dilindungi reCAPTCHA. <a className="rounded-sm underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privasi</a> dan <a className="rounded-sm underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Persyaratan Layanan</a> Google berlaku.
      </div>
    </section>
  );
}
