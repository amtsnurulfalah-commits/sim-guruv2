"use client";
import { requestJson } from "@/lib/feedback/api-error";
export async function masterRequest<T>(
  path: string,
  method = "GET",
  data?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== "GET") {
    const csrf = await requestJson<{ csrfToken: string }>(
      "/api/auth/csrf?intent=session",
      {
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      },
    );
    headers["Content-Type"] = "application/json";
    headers["X-CSRF-Token"] = csrf.csrfToken;
  }
  return requestJson<T>(path, {
    method,
    headers,
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
