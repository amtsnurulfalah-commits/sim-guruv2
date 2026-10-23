"use client";
import { requestJson } from "@/lib/feedback/api-error";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import {
  financeVerifySchema,
  readFinanceResponse,
} from "../../lib/finance/contracts";
import { useEffect, useRef, useState } from "react";

export function VerifyDocument() {
  const [result, setResult] = useState<{
      status: string;
      documentType?: string;
      period?: string;
      school?: string;
      recipient?: string;
    } | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const savedToken = useRef<string | null>(null);
  useEffect(() => {
    const token = savedToken.current ?? location.hash.slice(1);
    savedToken.current = token;
    history.replaceState(null, "", location.pathname);
    if (!/^[a-f0-9]{96}$/.test(token)) {
      queueMicrotask(() =>
        setError(
          "Tautan verifikasi tidak lengkap. Gunakan tautan dari pemilik slip.",
        ),
      );
      return;
    }
    const c = new AbortController();
    requestJson<NonNullable<typeof result>>("/api/honorarium/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
      signal: AbortSignal.any([c.signal, AbortSignal.timeout(15000)]),
    })
      .then((value) => {
        if (!c.signal.aborted)
          setResult(readFinanceResponse(financeVerifySchema, value));
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [revision]);
  return (
    <main
      id="konten-utama"
      className="ui-panel mx-auto my-8 min-w-0 max-w-xl space-y-5 p-6 [overflow-wrap:anywhere]"
    >
      <h1 className="text-2xl font-bold">Verifikasi Dokumen SiM-Guru</h1>
      {error ? (
        <div className="space-y-3">
          <ErrorFeedback message={error} />
          <button
            className="ui-action ui-action-secondary"
            onClick={() => {
              setError("");
              setResult(null);
              setRevision((v) => v + 1);
            }}
          >
            Coba periksa kembali
          </button>
        </div>
      ) : !result ? (
        <p role="status">Memeriksa dokumen…</p>
      ) : (
        <>
          <p className="font-semibold">
            {result.status === "valid"
              ? "Dokumen valid"
              : result.status === "corrected"
                ? "Dokumen valid dengan koreksi terkait"
                : "Dokumen tidak ditemukan"}
          </p>
          {result.status !== "not_found" && (
            <dl className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 rounded-xl border bg-muted/40 p-4 text-sm">
              <dt>Jenis dokumen</dt>
              <dd>{result.documentType}</dd>
              <dt>Madrasah</dt>
              <dd>{result.school}</dd>
              <dt>Periode</dt>
              <dd>{result.period}</dd>
              <dt>Penerima</dt>
              <dd>{result.recipient}</dd>
            </dl>
          )}
        </>
      )}
    </main>
  );
}
