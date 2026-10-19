"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import type { ApiResult } from "@/types/api";
export function LoginForm() {
  const [csrf, setCsrf] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  async function load() {
    setReady(false);
    try {
      const res = await fetch("/api/auth/csrf", {
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        }),
        data: ApiResult<{
          csrfToken: string;
        }> = await res.json();
      if (!data.ok) throw new Error(data.error.message);
      setCsrf(data.data.csrfToken);
      setReady(true);
    } catch (error) {
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
        const res = await fetch("/api/auth/csrf", {
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
          }),
          data: ApiResult<{
            csrfToken: string;
          }> = await res.json();
        if (!data.ok) throw new Error(data.error.message);
        if (active) {
          setCsrf(data.data.csrfToken);
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
      } catch {
        if (active)
          setMessage("Formulir belum dapat dimuat. Silakan coba kembali.");
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
      const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          body: JSON.stringify({
            username: values.get("username"),
            password: values.get("password"),
          }),
          signal: AbortSignal.timeout(15000),
        }),
        data: ApiResult<{
          redirectTo: string;
        }> = await res.json();
      if (data.ok) {
        window.location.replace("/akun");
        return;
      }
      const retry = res.headers.get("retry-after");
      setMessage(
        data.error.message +
          (retry
            ? ` Coba kembali sekitar ${Math.ceil(Number(retry) / 60)} menit lagi.`
            : ""),
      );
      if (data.error.code === "CSRF_INVALID") await load();
    } catch {
      setMessage(
        "Tidak dapat menghubungi layanan. Periksa koneksi lalu coba kembali.",
      );
    } finally {
      const input = form.elements.namedItem("password");
      if (input instanceof HTMLInputElement) input.value = "";
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
      {message && (
        <p
          role="alert"
          className="rounded-lg border bg-muted p-3 text-sm leading-6"
        >
          {message}
        </p>
      )}
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
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 w-full rounded-lg border bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring"
          disabled={busy}
        />
      </div>
      <Button className="w-full" type="submit" disabled={busy || !ready}>
        {busy ? "Memeriksa akun…" : ready ? "Masuk" : "Menyiapkan formulir…"}
      </Button>
      {!ready && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => void load()}
        >
          Muat ulang formulir
        </Button>
      )}
      <p className="text-xs leading-6 text-muted-foreground">
        Akun dibuat oleh administrator. Jika belum memiliki akun atau
        membutuhkan pemulihan, hubungi administrator madrasah.
      </p>
      <p className="text-sm">
        <Link href="/lupa-password" className="underline">
          Lupa kata sandi?
        </Link>
      </p>
    </form>
  );
}
