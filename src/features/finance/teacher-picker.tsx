"use client";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { ActionIcon } from "@/components/ui/action-icon";

import { useEffect, useState } from "react";
import { masterRequest } from "../masters/api";
import { z } from "zod";
import { readFinanceResponse } from "../../lib/finance/contracts";
import { input, secondary } from "../programs/forms";
export type TeacherChoice = { id: string; name: string };
export function TeacherPicker({
  value,
  onChange,
  disabled = false,
}: {
  disabled?: boolean;
  value: TeacherChoice | null;
  onChange: (value: TeacherChoice | null) => void;
}) {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [items, setItems] = useState<TeacherChoice[]>([]),
    [total, setTotal] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    queueMicrotask(() => {
      if (!c.signal.aborted) {
        setLoading(true);
        setError("");
        setItems([]);
      }
    });
    masterRequest<unknown>(
      "/api/users?" +
        new URLSearchParams({
          q,
          page: String(page),
          pageSize: "20",
          role: "guru",
          status: "active",
        }),
      "GET",
      undefined,
      c.signal,
    )
      .then((r) => {
        if (c.signal.aborted) return;
        const result = readFinanceResponse(
          z.object({
            items: z.array(
              z.object({
                id: z.uuid(),
                fullName: z.string(),
                username: z.string(),
              }),
            ),
            total: z.number().int().nonnegative(),
            page: z.number().int().positive(),
          }),
          r,
        );
        if (result.page !== page)
          throw Error("Halaman pilihan guru tidak sesuai. Coba muat ulang.");
        setItems(
          result.items.map((u) => ({
            id: u.id,
            name: u.fullName + " (" + u.username + ")",
          })),
        );
        setTotal(result.total);
        setLoading(false);
        setError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setError(
            e instanceof Error ? e.message : "Gagal memuat pilihan guru.",
          );
          setItems([]);
          setTotal(0);
          setLoading(false);
        }
      });
    return () => c.abort();
  }, [q, page, revision]);
  const choices =
    value && !items.some((u) => u.id === value.id) ? [value, ...items] : items;
  return (
    <div className="min-w-0 space-y-2" aria-busy={loading}>
      <label className="block text-sm">
        Cari guru
        <input
          className={input}
          value={q}
          disabled={disabled}
          type="search"
          maxLength={100}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </label>
      <label className="block text-sm">
        Sasaran blok transportasi
        <select
          className={input}
          value={value?.id ?? ""}
          disabled={disabled || loading || Boolean(error)}
          onChange={(e) =>
            onChange(choices.find((u) => u.id === e.target.value) ?? null)
          }
        >
          <option value="">Semua guru</option>
          {choices.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          className={secondary}
          disabled={disabled || loading || page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          <ActionIcon action="previous" />
          Pilihan sebelumnya
        </button>
        <span>Halaman {page}</span>
        <button
          type="button"
          className={secondary}
          disabled={disabled || loading || page * 20 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          <ActionIcon action="next" />
          Pilihan berikutnya
        </button>
      </div>
      {loading && (
        <p role="status" className="text-sm">
          Memuat pilihan guru…
        </p>
      )}
      {error && (
        <>
          <ErrorFeedback message={error} />
          <button
            className={secondary}
            disabled={disabled || loading}
            onClick={() => setRevision((v) => v + 1)}
          >
            Muat ulang pilihan guru
          </button>
        </>
      )}
    </div>
  );
}
