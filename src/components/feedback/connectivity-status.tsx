"use client";

import { SignalLow, WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

type Connection = EventTarget & { effectiveType?: string; rtt?: number };

function connection() {
  return (navigator as Navigator & { connection?: Connection }).connection;
}

function subscribe(notify: () => void) {
  const network = connection();
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  network?.addEventListener("change", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
    network?.removeEventListener("change", notify);
  };
}

function getStatus() {
  if (!navigator.onLine) return "offline";
  const network = connection();
  if (network?.effectiveType?.endsWith("2g") || (network?.rtt ?? 0) >= 1000)
    return "slow";
  return "online";
}

export function ConnectivityStatus() {
  const status = useSyncExternalStore(subscribe, getStatus, () => "online");
  const offline = status === "offline";
  const Icon = offline ? WifiOff : SignalLow;
  return (
    <div role="status" aria-atomic="true">
      {status !== "online" && (
        <div className="mb-4 flex min-w-0 items-start gap-3 rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">{offline ? "Tidak ada koneksi internet" : "Koneksi internet lambat"}</p>
            <p>{offline
              ? "Data yang tampil mungkin belum terbaru. Draf di tab ini belum terkirim. Sambungkan internet, lalu muat ulang data atau simpan secara manual."
              : "Memuat atau menyimpan data mungkin perlu waktu lebih lama. Tunggu konfirmasi sebelum mengirim ulang."}</p>
          </div>
        </div>
      )}
    </div>
  );
}
