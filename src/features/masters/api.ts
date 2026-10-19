"use client";
import type { ApiResult } from "@/types/api";
export async function masterRequest<T>(
  path: string,
  method = "GET",
  data?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== "GET") {
    const r = await fetch("/api/auth/csrf?intent=session", {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const v: ApiResult<{ csrfToken: string }> = await r.json();
    if (!v.ok) throw new Error(v.error.message);
    headers["Content-Type"] = "application/json";
    headers["X-CSRF-Token"] = v.data.csrfToken;
  }
  const r = await fetch(path, {
    method,
    headers,
    cache: "no-store",
    signal: signal ?? AbortSignal.timeout(20000),
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const v: ApiResult<T> = await r.json();
  if (!v.ok) throw new Error(v.error.message);
  return v.data;
}
