"use client";
import type { ApiResult } from "@/types/api";
export async function usersRequest<T>(
  path: string,
  method = "GET",
  data?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let headers: Record<string, string> = {};
  if (method !== "GET") {
    const r = await fetch("/api/auth/csrf?intent=session", {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }),
      csrf: ApiResult<{ csrfToken: string }> = await r.json();
    if (!csrf.ok) throw new Error(csrf.error.message);
    headers = {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf.data.csrfToken,
    };
  }
  const response = await fetch("/api/users" + path, {
      method,
      headers,
      cache: "no-store",
      signal: signal ?? AbortSignal.timeout(20000),
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
    result: ApiResult<T> = await response.json();
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}
