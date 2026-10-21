"use client";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import Link from "next/link";
import { ActionIcon } from "@/components/ui/action-icon";

import { useCallback, useEffect, useState } from "react";
import { masterRequest } from "@/features/masters/api";
import type { Announcement } from "@/lib/operations/schemas";
export function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]),
    [error, setError] = useState("");
  const load = useCallback(
    async () => setItems(await masterRequest("/api/operations/announcements")),
    [],
  );
  useEffect(() => {
    const c = new AbortController();
    masterRequest<Announcement[]>(
      "/api/operations/announcements",
      "GET",
      undefined,
      c.signal,
    )
      .then((v) => {
        if (!c.signal.aborted) setItems(v);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  return (
    <section aria-label="Pengumuman" className="space-y-3">
      {error && <ErrorFeedback message={error} />}
      {items.map((a) => (
        <article key={a.id} className="space-y-3 rounded-xl border bg-card p-5">
          <p className="text-sm font-semibold uppercase">{a.severity}</p>
          <h2 className="text-lg font-bold">{a.title}</h2>
          <p className="whitespace-pre-wrap">{a.body}</p>
          {a.cta_url && (
            <Link
              prefetch={false}
              href={a.cta_url}
              rel="noopener noreferrer"
              className="underline"
            >
              {a.cta_text}
            </Link>
          )}
          {a.canDismiss && (
            <button
              className="ml-4 rounded border px-3 py-2"
              onClick={async () => {
                try {
                  await masterRequest("/api/operations/dismiss", "POST", {
                    id: a.id,
                    version: String(a.version),
                  });
                  await load();
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Gagal menutup pengumuman.",
                  );
                }
              }}
            >
              <ActionIcon action="close" />
              Tutup pengumuman
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
