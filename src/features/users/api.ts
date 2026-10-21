"use client";
import { masterRequest } from "@/features/masters/api";
export async function usersRequest<T>(
  path: string,
  method = "GET",
  data?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return masterRequest<T>("/api/users" + path, method, data, signal);
}
