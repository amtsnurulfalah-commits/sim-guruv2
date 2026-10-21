"use client";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { ActionIcon } from "@/components/ui/action-icon";

import { useEffect, useState } from "react";
import { masterRequest } from "../masters/api";
import type { UserList } from "../../lib/users/schemas";
import { input, secondary } from "../programs/forms";
export type TeacherChoice = { id: string; name: string };
export function TeacherPicker({
  value,
  onChange,
}: {
  value: TeacherChoice | null;
  onChange: (value: TeacherChoice | null) => void;
}) {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [items, setItems] = useState<TeacherChoice[]>([]),
    [total, setTotal] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    masterRequest<UserList>(
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
        setItems(
          r.items.map((u) => ({
            id: u.id,
            name: u.fullName + " (" + u.username + ")",
          })),
        );
        setTotal(r.total);
        setError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [q, page]);
  const choices =
    value && !items.some((u) => u.id === value.id) ? [value, ...items] : items;
  return (
    <div className="space-y-2">
      <label className="block text-sm">
        Cari guru
        <input
          className={input}
          value={q}
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
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          className={secondary}
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          <ActionIcon action="previous" />
          Pilihan sebelumnya
        </button>
        <span>Halaman {page}</span>
        <button
          type="button"
          className={secondary}
          disabled={page * 20 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          <ActionIcon action="next" />
          Pilihan berikutnya
        </button>
      </div>
      {error && <ErrorFeedback message={error} />}
    </div>
  );
}
