"use client";
import { useEffect, useState } from "react";

/** Network-only worker. No private page/API caching or background transaction queue. */
export function PwaRuntime() {
  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    let active = true;
    const cleanups: (() => void)[] = [];
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(registration => {
      const check = () => { if (active && registration.waiting && navigator.serviceWorker.controller) setUpdated(true); };
      const found = () => { const worker = registration.installing; if (!worker) return; worker.addEventListener("statechange", check); cleanups.push(() => worker.removeEventListener("statechange", check)); };
      if (!active) return;
      check(); found(); registration.addEventListener("updatefound", found);
      cleanups.push(() => registration.removeEventListener("updatefound", found));
    }).catch(() => { /* Online app stays available; installation also has a browser-menu path. */ });
    return () => { active = false; cleanups.forEach(cleanup => cleanup()); };
  }, []);
  return updated ? <p role="status" className="mx-auto max-w-7xl px-4 py-2 text-sm text-muted-foreground">Pembaruan siap. Setelah pekerjaan tersimpan, tutup semua jendela SiM-Guru lalu buka kembali.</p> : null;
}
