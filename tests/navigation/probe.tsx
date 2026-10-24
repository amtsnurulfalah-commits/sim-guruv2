"use client";
import { ActivityDateProbe } from "./filter-probe";
import Link from "next/link";
import { useEffect, useState } from "react";
export function Probe({ name }: { name: string }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/data/" + name, { signal: controller.signal })
      .then(() => setLoaded(true))
      .catch(() => {});
    return () => controller.abort();
  }, [name]);
  return (
    <section>
      <h1>{name}</h1>
      {name === "jurnal" && <ActivityDateProbe />}
      <p role="status">{loaded ? "Data halaman siap" : "Memuat data tujuan"}</p>
      <Link prefetch={false} href="/jurnal">
        Navigasi isi ke jurnal
      </Link>
    </section>
  );
}
