"use client";
import { CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";
export function notifySuccess(message = "Perubahan berhasil disimpan.") {
  window.dispatchEvent(
    new CustomEvent("sim-guru:feedback", { detail: message }),
  );
}
export function ToastRegion() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function receive(event: Event) {
      if (!(event instanceof CustomEvent) || typeof event.detail !== "string")
        return;
      setMessage(event.detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(""), 6000);
    }
    window.addEventListener("sim-guru:feedback", receive);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("sim-guru:feedback", receive);
    };
  }, []);
  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 left-4 z-[100] sm:left-auto sm:w-96"
      aria-live="polite"
      aria-atomic="true"
    >
      {message && (
        <div
          role="status"
          className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-emerald-200 bg-card p-4 text-sm shadow-xl"
        >
          <CheckCircle2
            className="size-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <p className="flex-1 leading-6">{message}</p>
          <button
            type="button"
            className="min-h-11 min-w-11 rounded-lg hover:bg-muted"
            aria-label="Tutup notifikasi"
            onClick={() => setMessage("")}
          >
            <X className="mx-auto size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
