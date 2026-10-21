"use client";
import { ActionIcon } from "@/components/ui/action-icon";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import {
  ApiRequestError,
  requestJson,
  serverFieldErrors,
} from "@/lib/feedback/api-error";
import { applyFieldErrors } from "@/lib/feedback/form-fields";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
export function LoginForm() {
  const [csrf, setCsrf] = useState(""),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  async function load(preserveMessage = false) {
    setReady(false);
    if (!preserveMessage) {
      setMessage("");
      setFailed(false);
    }
    try {
      const data = await requestJson<{ csrfToken: string }>("/api/auth/csrf", {
        signal: AbortSignal.timeout(15000),
      });
      setCsrf(data.csrfToken);
      setReady(true);
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "Formulir belum dapat dimuat. Silakan coba kembali.",
      );
    }
  }
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const data = await requestJson<{ csrfToken: string }>(
          "/api/auth/csrf",
          { signal: AbortSignal.timeout(15000) },
        );
        if (active) {
          setCsrf(data.csrfToken);
          setReady(true);
          const status = new URLSearchParams(window.location.search).get(
            "status",
          );
          if (status === "updated")
            setMessage("Pengamanan akun diperbarui. Silakan masuk kembali.");
          else if (status === "activated")
            setMessage(
              "Akun berhasil diaktifkan. Silakan masuk dan selesaikan pengamanan akun.",
            );
          else if (status === "logout") setMessage("Anda berhasil keluar.");
          else if (status === "expired")
            setMessage("Sesi berakhir. Silakan masuk kembali.");
        }
      } catch (error) {
        if (active) {
          setFailed(true);
          setMessage(
            error instanceof Error
              ? error.message
              : "Formulir belum dapat dimuat. Coba kembali.",
          );
        }
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setMessage("");
    const form = event.currentTarget,
      values = new FormData(form);
    try {
      const data = await requestJson<{ redirectTo: string }>(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          body: JSON.stringify({
            username: values.get("username"),
            password: values.get("password"),
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      window.location.replace(
        data.redirectTo === "/dashboard" ? "/dashboard" : "/akun",
      );
    } catch (error) {
      setFailed(true);
      applyFieldErrors(form, serverFieldErrors(error));
      setMessage(
        error instanceof Error
          ? error.message
          : "Tidak dapat menghubungi layanan. Periksa koneksi Anda.",
      );
      if (error instanceof ApiRequestError && error.code === "CSRF_INVALID")
        await load(true);
    } finally {
      const input = form.elements.namedItem("password");
      if (input instanceof HTMLInputElement) input.value = "";
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
      {message &&
        (failed ? (
          <ErrorFeedback message={message} autoFocus />
        ) : (
          <p
            role="status"
            className="rounded-lg border bg-muted p-3 text-sm leading-6"
          >
            {message}
          </p>
        ))}
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
          className="h-11 w-full rounded-lg border bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring"
          disabled={busy}
        />
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
          className="h-11 w-full rounded-lg border bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring"
          disabled={busy}
        />
      </div>
      <Button className="w-full" type="submit" disabled={busy || !ready}>
        <ActionIcon action="access" />
        {busy ? "Memeriksa akun…" : ready ? "Masuk" : "Menyiapkan formulir…"}
      </Button>
      {!ready && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => void load()}
        >
          <ActionIcon action="refresh" />
          Muat ulang formulir
        </Button>
      )}
      <p className="text-xs leading-6 text-muted-foreground">
        Akun dibuat oleh administrator. Jika belum memiliki akun atau
        membutuhkan pemulihan, hubungi administrator madrasah.
      </p>
      <p className="text-sm">
        <Link prefetch={false} href="/lupa-password" className="underline">
          Lupa kata sandi?
        </Link>
      </p>
    </form>
  );
}
