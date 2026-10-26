"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type RecaptchaApi = {
  render: (node: HTMLElement, options: {
    sitekey: string;
    size: "compact";
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }) => number;
  reset: (id: number) => void;
};
declare global {
  interface Window {
    grecaptcha?: RecaptchaApi;
    simGuruRecaptchaReady?: () => void;
  }
}
let loading: Promise<RecaptchaApi> | null = null;
function loadRecaptcha(): Promise<RecaptchaApi> {
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
  if (loading) return loading;
  loading = new Promise<RecaptchaApi>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      delete window.simGuruRecaptchaReady;
      reject(new Error("CAPTCHA_SCRIPT_UNAVAILABLE"));
    };
    const timer = window.setTimeout(fail, 15000);
    window.simGuruRecaptchaReady = () => {
      clearTimeout(timer);
      delete window.simGuruRecaptchaReady;
      if (window.grecaptcha?.render) resolve(window.grecaptcha);
      else fail();
    };
    script.src = "https://www.google.com/recaptcha/api.js?onload=simGuruRecaptchaReady&render=explicit&hl=id";
    script.async = true;
    script.defer = true;
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch(error => { loading = null; throw error; });
  return loading;
}

export function RecaptchaField({ siteKey, attempt, onToken, busy }: {
  siteKey: string | null;
  attempt: number;
  onToken: (token: string) => void;
  busy: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("Memuat verifikasi keamanan…");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
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
          onToken(token);
          setFailed(false);
          setStatus("Verifikasi selesai. Anda dapat menekan Masuk.");
        },
        "expired-callback": () => {
          if (!active) return;
          onToken("");
          setStatus("Verifikasi kedaluwarsa. Centang reCAPTCHA kembali.");
        },
        "error-callback": () => {
          if (!active) return;
          onToken("");
          setFailed(true);
          setStatus("reCAPTCHA tidak dapat terhubung. Periksa koneksi lalu muat ulang verifikasi.");
        },
      });
      setStatus("Centang reCAPTCHA untuk melanjutkan.");
      setFailed(false);
    }).catch(() => {
      if (!active) return;
      onToken("");
      setFailed(true);
      setStatus("reCAPTCHA gagal dimuat. Periksa koneksi atau pemblokir konten lalu coba kembali.");
    });
    return () => {
      active = false;
      if (api && widget !== undefined) { try { api.reset(widget); } catch { /* detached iframe */ } }
      node.remove();
    };
  }, [siteKey, attempt, revision, onToken]);
  return (
    <section aria-label="Verifikasi keamanan" className="min-w-0 space-y-3 rounded-xl border bg-muted/30 p-3">
      <h2 className="text-sm font-semibold">Verifikasi keamanan</h2>
      <div ref={host} className="min-w-0" inert={busy} />
      <p role={failed || !siteKey ? "alert" : "status"} className="text-xs leading-6">
        {siteKey ? status : "Verifikasi keamanan belum dikonfigurasi. Hubungi administrator madrasah."}
      </p>
      {failed && siteKey && <Button type="button" variant="outline" disabled={busy} onClick={() => {
        onToken(""); setStatus("Memuat verifikasi keamanan…"); setFailed(false); setRevision(value => value + 1);
      }}>Muat ulang verifikasi</Button>}
      <p className="text-xs leading-6 text-muted-foreground">
        reCAPTCHA menggunakan layanan Google. <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privasi</a> dan <a className="underline" href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Persyaratan Layanan</a> Google berlaku.
      </p>
    </section>
  );
}
