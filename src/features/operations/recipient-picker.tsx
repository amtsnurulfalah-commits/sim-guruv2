"use client";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { ActionIcon } from "@/components/ui/action-icon";

import { useEffect, useState } from "react";
import { masterRequest } from "@/features/masters/api";
import type { UserList } from "@/lib/users/schemas";
import { input, secondary } from "@/features/programs/forms";
export function RecipientPicker({
  label,
  value,
  onChange,
  names,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  names: Record<string, string>;
}) {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [users, setUsers] = useState<UserList | null>(null),
    [known, setKnown] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    masterRequest<UserList>(
      "/api/users?" +
        new URLSearchParams({
          q,
          page: String(page),
          pageSize: "20",
          status: "active",
        }),
      "GET",
      undefined,
      c.signal,
    )
      .then((v) => {
        if (c.signal.aborted) return;
        setUsers(v);
        setKnown((old) => ({
          ...old,
          ...Object.fromEntries(
            v.items.map((u) => [u.id, u.fullName + " (" + u.username + ")"]),
          ),
        }));
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [q, page]);
  return (
    <fieldset className="space-y-2 rounded border p-3">
      <legend className="px-1 font-semibold">{label}</legend>
      <label className="block text-sm">
        Cari nama atau username
        <input
          className={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </label>
      {error && <ErrorFeedback message={error} />}
      <div className="flex flex-wrap gap-2">
        {value.map((id, i) => (
          <button
            className={secondary}
            key={id}
            onClick={() => onChange(value.filter((x) => x !== id))}
          >
            <ActionIcon action="close" />
            {names[id] ?? known[id] ?? `Pengguna terpilih ${i + 1}`} · Hapus
          </button>
        ))}
      </div>
      <select
        className={input}
        value=""
        aria-label={"Tambah " + label}
        onChange={(e) => {
          const id = e.target.value;
          if (id && !value.includes(id)) onChange([...value, id]);
        }}
      >
        <option value="">Pilih pengguna…</option>
        {users?.items
          .filter((u) => !value.includes(u.id))
          .map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName} ({u.username})
            </option>
          ))}
      </select>
      <div className="flex gap-3">
        <button
          className={secondary}
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          <ActionIcon action="previous" />
          Sebelumnya
        </button>
        <span>Halaman {page}</span>
        <button
          className={secondary}
          disabled={!users || page * 20 >= users.total}
          onClick={() => setPage((p) => p + 1)}
        >
          <ActionIcon action="next" />
          Berikutnya
        </button>
      </div>
    </fieldset>
  );
}
