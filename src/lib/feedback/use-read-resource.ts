"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { masterRequest } from "@/features/masters/api";

/** A single in-flight read per widget; refresh preserves a valid snapshot. */
export function useReadResource<T>(url: string, parse: (raw: unknown) => T) {
  const [state, setState] = useState<{url: string; value: T | null; error: string; loading: boolean; updatedAt: string | null}>(
    {url, value: null, error: "", loading: true, updatedAt: null},
  );
  const read = useRef<() => void>(() => {});
  const refresh = useCallback(() => read.current(), []);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const load = async () => {
      if (pending || controller.signal.aborted) return;
      pending = true;
      setState(previous => ({url, value: previous.url === url ? previous.value : null, error: "", loading: true, updatedAt: previous.url === url ? previous.updatedAt : null}));
      try {
        const value = parse(await masterRequest<unknown>(url, "GET", undefined, controller.signal));
        if (!controller.signal.aborted) setState({url, value, error: "", loading: false, updatedAt: new Date().toISOString()});
      } catch (error) {
        if (!controller.signal.aborted) setState({url, value: null, error: error instanceof Error ? error.message : "Data belum dapat dimuat. Coba kembali.", loading: false, updatedAt: null});
      } finally { pending = false; }
    };
    read.current = () => { void load(); };
    const wake = () => { if (document.visibilityState !== "hidden") void load(); };
    queueMicrotask(() => { void load(); });
    const timer = window.setInterval(wake, 60000);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      controller.abort(); read.current = () => {};
      window.clearInterval(timer);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [url, parse]);
  return {...(state.url === url ? state : {value: null, error: "", loading: true, updatedAt: null}), refresh};
}
