"use client";
import { useSyncExternalStore } from "react";
const subscribe = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};
/** Browser connectivity is a hint, never proof of server availability or receipt. */
export function ConnectivityStatus() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  return <div role="status" aria-live="polite" className="min-w-0 [overflow-wrap:anywhere]">
    {!online && <p className="mb-4 rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm leading-6 text-amber-950">Perangkat sedang offline. Data yang terlihat mungkin belum terbaru. Draft lokal yang berhasil disimpan hanya tersedia di tab ini dan belum terkirim ke server. Sambungkan internet lalu muat ulang atau simpan secara manual. Tidak ada pengiriman otomatis.</p>}
  </div>;
}
