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
      className="pointer-events-none fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-[100] sm:left-auto sm:w-96"
      aria-live="polite"
      aria-atomic="true"
    >
      {message && (
        <div
          className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-emerald-200 bg-card p-4 text-sm shadow-xl"
        >
          <CheckCircle2
            className="size-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <p className="font-semibold">Berhasil</p>
            <p className="leading-6">{message}</p>
          </div>
          <button
            type="button"
            className="ui-action ui-action-solid min-h-11 min-w-11 p-0"
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
