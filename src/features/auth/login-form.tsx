"use client";
import { RecaptchaField } from "./recaptcha-field";
import type { LoginCaptcha } from "@/lib/accounts/recaptcha";
import { resetBrowserDrafts } from "@/lib/drafts/storage";
import { ActionIcon } from "@/components/ui/action-icon";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import {
  ApiRequestError,
  requestJson,
  serverFieldErrors,
} from "@/lib/feedback/api-error";
import { applyFieldErrors } from "@/lib/feedback/form-fields";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { validateAccount as validateInput } from "@/lib/accounts/client-validation";
import {
  loginSchema,
  loginCsrfSchema,
  loginResultSchema,
  loginNotice,
} from "@/lib/accounts/login";

export function LoginForm({ captcha = { enabled: false, siteKey: null } }: { captcha?: LoginCaptcha }) {
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [csrf, setCsrf] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const [focusSummary, setFocusSummary] = useState(true);
  const mounted = useRef(false);
  const pending = useRef(false);
  const csrfRequest = useRef<AbortController | null>(null);
  const loginRequest = useRef<AbortController | null>(null);

  const prepare = useCallback(async (preserveMessage = false) => {
    if (csrfRequest.current || (pending.current && !preserveMessage)) return false;
    const controller = new AbortController();
    csrfRequest.current = controller;
    setCsrf("");
    setPreparing(true);
    if (!preserveMessage) setMessage("");
    try {
      const response = await requestJson<unknown>("/api/auth/csrf", {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      });
      const result = loginCsrfSchema.safeParse(response);
      if (!result.success) throw new ApiRequestError("INVALID_RESPONSE", "Formulir belum dapat disiapkan. Muat ulang formulir atau hubungi administrator.");
      if (!mounted.current || csrfRequest.current !== controller) return false;
      setCsrf(result.data.csrfToken);
      return true;
    } catch (error) {
      if (mounted.current && csrfRequest.current === controller && !controller.signal.aborted) {
        setFocusSummary(true);
        setMessage(error instanceof Error ? error.message : "Formulir belum dapat dimuat. Coba kembali.");
      }
      return false;
    } finally {
      if (csrfRequest.current === controller) {
        csrfRequest.current = null;
        if (mounted.current) setPreparing(false);
      }
    }
  }, []);

  useEffect(() => {
    resetBrowserDrafts();
    mounted.current = true;
    async function init() {
      setNotice(loginNotice(new URLSearchParams(window.location.search).get("status")));
      await prepare();
    }
    void init();
    return () => {
      mounted.current = false;
      csrfRequest.current?.abort();
      csrfRequest.current = null;
      loginRequest.current?.abort();
    };
  }, [prepare]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || csrfRequest.current || !csrf) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    let input;
    try {
      input = validateInput(loginSchema, { username: values.get("username"), password: values.get("password") });
    } catch (error) {
      setFocusSummary(false);
      applyFieldErrors(form, serverFieldErrors(error));
      setMessage(error instanceof Error ? error.message : "Periksa kembali isian formulir.");
      return;
    }
    if (captcha.enabled && !captchaToken) {
      setFocusSummary(true);
      setMessage("Selesaikan verifikasi reCAPTCHA sebelum masuk.");
      return;
    }
    pending.current = true;
    const controller = new AbortController();
    loginRequest.current = controller;
    setBusy(true);
    setMessage("");
    setNotice("");
    let navigating = false;
    try {
      const response = await requestJson<unknown>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify(captcha.enabled ? { ...input, captchaToken } : input),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      });
      const result = loginResultSchema.safeParse(response);
      if (!result.success) throw new ApiRequestError("INVALID_RESPONSE", "Jawaban login tidak sesuai. Muat ulang halaman sebelum mencoba kembali.");
      if (!mounted.current || controller.signal.aborted) return;
      setNotice("Berhasil masuk. Mengalihkan ke ruang kerja…");
      window.location.replace(result.data.redirectTo);
      navigating = true;
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      const fields = serverFieldErrors(error);
      if (error instanceof ApiRequestError && error.code === "INVALID_CREDENTIALS") {
        fields.username = "Periksa pasangan username dan kata sandi Anda.";
        fields.password = "Periksa pasangan username dan kata sandi Anda.";
      }
      applyFieldErrors(form, fields);
      setFocusSummary(Object.keys(fields).length === 0);
      setMessage(error instanceof ApiRequestError && ["TIMEOUT", "NETWORK_ERROR"].includes(error.code)
        ? "Login belum dapat dipastikan karena koneksi terputus atau layanan belum menjawab. Muat ulang halaman sebelum mencoba kembali."
        : error instanceof Error ? error.message : "Tidak dapat menghubungi layanan. Periksa koneksi Anda.");
      if (error instanceof ApiRequestError && error.code === "CSRF_INVALID") {
        if (await prepare(true)) setNotice("Formulir telah diperbarui. Ketik kata sandi lalu tekan Masuk kembali.");
      }
    } finally {
      // Reset also conceals PasswordInput using its existing native reset listener.
      form.reset();
      if (mounted.current && captcha.enabled) { setCaptchaToken(""); setCaptchaAttempt(value => value + 1); }
      const username = form.elements.namedItem("username");
      if (username instanceof HTMLInputElement) username.value = input.username;
      loginRequest.current = null;
      if (!navigating) {
        pending.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  }

  return (
    <form
      method="post"
      action="/api/auth/login"
      onSubmit={submit}
      className="min-w-0 space-y-5 [overflow-wrap:anywhere]"
      aria-busy={busy || preparing}
    >
      {notice && (
        <p role="status" className="rounded-lg border bg-muted p-3 text-sm leading-6">
          {notice}
        </p>
      )}
      {message && <ErrorFeedback message={message} autoFocus={focusSummary} />}
      <noscript>
        <p role="alert" className="text-sm leading-6">
          Aktifkan JavaScript lalu muat ulang halaman untuk masuk dengan aman.
        </p>
      </noscript>
      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-semibold">
          Username
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          minLength={3}
          maxLength={64}
          className="ui-control"
          disabled={busy}
          aria-describedby="login-username-help"
        />
        <p id="login-username-help" className="text-xs leading-6 text-muted-foreground">
          Gunakan username akun madrasah, bukan alamat email.
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-semibold">
          Kata sandi
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          disabled={busy}
        />
      </div>
      {captcha.enabled && <RecaptchaField key={captchaAttempt} siteKey={captcha.siteKey} attempt={captchaAttempt} onToken={setCaptchaToken} busy={busy} />}
      <Button className="w-full" type="submit" disabled={busy || preparing || !csrf || (captcha.enabled && !captchaToken)}>
        <ActionIcon action="access" />
        {busy
          ? "Memeriksa akun…"
          : preparing
            ? "Menyiapkan formulir…"
            : csrf
              ? "Masuk"
              : "Formulir belum siap"}
      </Button>
      {preparing && (
        <p role="status" className="text-sm text-muted-foreground">
          Menyiapkan formulir masuk yang aman…
        </p>
      )}
      {!csrf && !preparing && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => void prepare()}
        >
          <ActionIcon action="refresh" />
          Muat ulang formulir
        </Button>
      )}
      <p className="text-xs leading-6 text-muted-foreground">
        Akun dibuat oleh administrator. Jika belum memiliki akun atau membutuhkan
        pemulihan, hubungi administrator madrasah.
      </p>
      <p className="text-sm">
        <Link
          prefetch={false}
          href="/lupa-password"
          className="ui-text-link rounded-md underline"
        >
          Lupa kata sandi?
        </Link>
      </p>
    </form>
  );
}
