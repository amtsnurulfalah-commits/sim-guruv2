"use client";
import { validateAccount as validateInput } from "@/lib/accounts/client-validation";
import { applyFieldErrors } from "@/lib/feedback/form-fields";
import { serverFieldErrors } from "@/lib/feedback/api-error";
import { masterListSchema, masterHistorySchema } from "@/lib/masters/contracts";
import { payloadSchemas, mutationSchema } from "@/lib/masters/schemas";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { ActionIcon } from "@/components/ui/action-icon";

import { TableRegion } from "@/components/ui/table-region";
import { EmptyState } from "@/components/feedback/feature-state";
import {
  ManagedDialog,
  requestDialogClose,
} from "@/components/ui/managed-dialog";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  kinds,
  labels,
  type MasterKind,
  type MasterList,
  type MasterRow,
} from "@/lib/masters/schemas";
import { userListSchema } from "@/lib/users/contracts";
import type { UserList } from "@/lib/users/schemas";
import { masterRequest } from "./api";
type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "checkbox" | "select" | "reference";
  options?: [string, string][];
  reference?: MasterKind | "users";
  optional?: boolean;
  min?: number;
  max?: number;
};
const dates: Field[] = [
  { key: "dateStart", label: "Berlaku mulai", type: "date" },
  {
    key: "dateEnd",
    label: "Berlaku sampai (termasuk tanggal ini)",
    type: "date",
  },
];
const level: Field = {
  key: "level",
  label: "Jenjang",
  type: "select",
  options: [
    ["SD", "SD / MI"],
    ["SMP", "SMP / MTs"],
    ["SMA", "SMA / MA"],
    ["SMK", "SMK / MAK"],
  ],
};
const fields: Record<MasterKind, Field[]> = {
  school: [
    { key: "name", label: "Nama sekolah / madrasah" },
    { key: "address", label: "Alamat", optional: true },
    { key: "npsn", label: "NPSN (8 digit, opsional)", optional: true },
    level,
    { key: "useParallel", label: "Gunakan kelas paralel", type: "checkbox" },
    {
      key: "parallelMax",
      label: "Jumlah paralel maksimum",
      type: "number",
      min: 1,
      max: 24,
    },
    {
      key: "minutesPerJtm",
      label: "Durasi satu JTM (menit)",
      type: "number",
      min: 1,
      max: 180,
    },
    {
      key: "headmasterId",
      label: "Kepala madrasah (jabatan Kepala Sekolah pada profil pengguna)",
      type: "reference",
      reference: "users",
      optional: true,
    },
  ],
  "academic-years": [
    { key: "label", label: "Tahun pelajaran (contoh 2026/2027)" },
    ...dates,
  ],
  "academic-periods": [
    {
      key: "academicYearId",
      label: "Tahun pelajaran",
      type: "reference",
      reference: "academic-years",
    },
    {
      key: "semester",
      label: "Semester",
      type: "select",
      options: [
        ["1", "Ganjil (1)"],
        ["2", "Genap (2)"],
      ],
    },
    ...dates,
    {
      key: "isActive",
      label: "Jadikan semester aktif (semester sebelumnya dinonaktifkan)",
      type: "checkbox",
    },
  ],
  classes: [
    {
      key: "academicPeriodId",
      label: "Semester",
      type: "reference",
      reference: "academic-periods",
    },
    { key: "name", label: "Nama kelas (contoh VII A)" },
    level,
    {
      key: "grade",
      label: "Tingkat kelas (1–12)",
      type: "number",
      min: 1,
      max: 12,
    },
    {
      key: "parallel",
      label: "Huruf paralel (kosong jika nonparalel)",
      optional: true,
    },
    {
      key: "expectedStudents",
      label: "Standar jumlah siswa",
      type: "number",
      min: 0,
      max: 36,
    },
  ],
  subjects: [{ key: "name", label: "Nama mata pelajaran" }],
  rates: [
    {
      key: "kind",
      label: "Jenis tarif",
      type: "select",
      options: [
        ["jtm", "Tarif per JTM"],
        ["transport", "Tarif transportasi per km"],
      ],
    },
    { key: "amount", label: "Nominal rupiah bulat (0–999999999)" },
    { key: "enabled", label: "Tarif diaktifkan", type: "checkbox" },
    ...dates,
  ],
  allowances: [
    { key: "userId", label: "Penerima", type: "reference", reference: "users" },
    { key: "dutyName", label: "Nama tugas / tunjangan" },
    { key: "amount", label: "Nominal rupiah bulat (0–999999999)" },
    ...dates,
  ],
};
const defaults: Record<string, unknown> = {
  level: "SMP",
  parallelMax: 1,
  minutesPerJtm: 40,
  semester: 1,
  grade: 7,
  expectedStudents: 0,
  amount: "0",
  kind: "jtm",
  enabled: true,
};
function summary(row: MasterRow) {
  return (
    String(
      row.name ??
        row.label ??
        row.dutyName ??
        (row.kind === "jtm"
          ? "Tarif per JTM"
          : row.kind === "transport"
            ? "Transportasi per km"
            : (row.parentLabel ?? "Semester")),
    ) + (row.semester ? " · Semester " + String(row.semester) : "")
  );
}
function ReferencePicker({
  field,
  row,
}: {
  field: Field;
  row: MasterRow | null;
}) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [items, setItems] = useState<
      { id: string; label: string; disabled: boolean }[]
    >([]),
    [total, setTotal] = useState(0),
    [value, setValue] = useState(String(row?.[field.key] ?? "")),
    [message, setMessage] = useState("Memuat pilihan…"),
    [loading, setLoading] = useState(true),
    [failure, setFailure] = useState(""),
    [retry, setRetry] = useState(0),
    [selectedLabel, setSelectedLabel] = useState(String(row?.parentLabel ?? "Pilihan tersimpan"));
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      pageSize: "20",
      ...(field.reference === "users" ? { status: "active" } : {}),
    });
    async function loadChoices() {
    setLoading(true);
    setFailure("");
    await masterRequest<MasterList | UserList>(
      field.reference === "users"
        ? "/api/users?" + params
        : "/api/settings/" + field.reference + "?" + params,
      "GET",
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (!active) return;
        if (field.reference === "users") userListSchema.parse(data);
        else masterListSchema.parse(data);
        setItems(
          data.items.map((v) => ({
            id: v.id,
            disabled:
              field.key === "headmasterId" &&
              v.additionalRole !== "KEPALA_SEKOLAH",
            label:
              "fullName" in v
                ? String(v.fullName) + " (" + String(v.username) + ")"
                : summary(v as MasterRow),
          })),
        );
        setTotal(data.total);
        setMessage(data.total ? "" : "Belum ada pilihan sesuai pencarian.");
      })
      .catch((error: unknown) => {
        if (active) { setItems([]); setTotal(0); setMessage(""); setFailure(error instanceof Error && error.name !== "ZodError" ? error.message : "Respons pilihan tidak sesuai. Coba lagi atau hubungi admin."); }
      }).finally(() => { if (active) setLoading(false); });
    }
    void loadChoices();
    return () => {
      active = false;
      controller.abort();
    };
  }, [query, page, field.reference, field.key, retry]);
  return (
    <div className="min-w-0 space-y-2 rounded-lg border p-3">
      <label className="block text-sm">
        {field.label}
        <input
          maxLength={100}
          aria-label={"Cari " + field.label}
          className="mt-2 h-10 w-full rounded border bg-background px-3"
          placeholder="Cari nama…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
      </label>
      <label className="block text-sm">
        <span>Pilihan {field.label}</span>
        <select
          name={field.key}
          required={!field.optional}
          value={value}
          onChange={(e) => { setValue(e.target.value); setSelectedLabel(e.target.selectedOptions[0]?.textContent ?? "Pilihan tersimpan"); }}
          className="mt-2 h-11 w-full rounded border bg-background px-3"
        >
          <option value="">
            {field.optional ? "Tidak dipilih" : "Pilih data"}
          </option>
          {value && !items.some((v) => v.id === value) && (
            <option value={value}>
              {selectedLabel}
            </option>
          )}
          {items.map((v) => (
            <option key={v.id} value={v.id} disabled={v.id !== value && (v.disabled || loading || Boolean(failure))}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      {failure && <><ErrorFeedback message={failure} /><Button type="button" variant="outline" onClick={() => setRetry(v => v + 1)}>Coba lagi pilihan</Button></>}
      {loading ? <p role="status">Memuat pilihan…</p> : message && (
        <p className="text-sm" role="status">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading || Boolean(failure) || page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          <ActionIcon action="previous" />
          Pilihan sebelumnya
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading || Boolean(failure) || page * 20 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          <ActionIcon action="next" />
          Pilihan berikutnya
        </Button>
      </div>
    </div>
  );
}
function Editor({
  kind,
  row,
  busy,
  onSubmit,
}: {
  kind: MasterKind;
  row: MasterRow | null;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <fieldset disabled={busy} className="space-y-4">
        {fields[kind].map((f) =>
          f.type === "reference" ? (
            row && ["academicYearId", "academicPeriodId"].includes(f.key) ? <div key={f.key} className="rounded-lg border p-3 text-sm"><p className="font-medium">{f.label}</p><p className="mt-2 break-words">{String(row.parentLabel ?? row[f.key])}</p><p className="mt-2 text-muted-foreground">Relasi data tersimpan tidak dapat dipindahkan.</p><input type="hidden" name={f.key} value={String(row[f.key])} /></div> : <ReferencePicker key={f.key} field={f} row={row} />
          ) : f.type === "checkbox" ? (
            <label key={f.key} className="flex gap-3 text-sm">
              <input
                type="checkbox"
                name={f.key}
                defaultChecked={Boolean(
                  row?.[f.key] ?? defaults[f.key] ?? false,
                )}
              />
              {f.label}
            </label>
          ) : (
            <label key={f.key} className="block space-y-2 text-sm">
              <span>{f.label}</span>
              {f.type === "select" ? (
                <select
                  name={f.key}
                  onChange={(e) => {
                    if (kind === "school" && f.key === "level") {
                      const input = e.currentTarget.form?.elements.namedItem(
                        "parallelMax",
                      ) as HTMLInputElement | null;
                      const max: Record<string, number> = {
                        SD: 4,
                        SMP: 11,
                        SMA: 12,
                        SMK: 24,
                      };
                      const limit = max[e.target.value];
                      if (input && limit && Number(input.value) > limit)
                        input.value = String(limit);
                    }
                  }}
                  defaultValue={String(
                    row?.[f.key] ??
                      defaults[f.key] ??
                      f.options?.[0]?.[0] ??
                      "",
                  )}
                  className="h-11 w-full rounded border bg-background px-3"
                >
                  {f.options?.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={f.key}
                  type={f.type ?? "text"}
                  required={!f.optional}
                  defaultValue={String(row?.[f.key] ?? defaults[f.key] ?? "")}
                  min={f.min}
                  max={f.max}
                  step={f.type === "number" ? 1 : undefined}
                  maxLength={
                    f.key === "address" ? 500 : f.key === "amount" ? 9 : 200
                  }
                  className="h-11 w-full rounded border bg-background px-3"
                />
              )}
            </label>
          ),
        )}
        <label className="block space-y-2 text-sm">
          <span>Alasan perubahan (minimal 5 karakter)</span>
          <input
            name="reason"
            required
            minLength={5}
            maxLength={500}
            className="h-11 w-full rounded border bg-background px-3"
          />
        </label>
        <p className="text-sm leading-6">
          Periksa kembali relasi dan rentang tanggal. Simpan semester aktif akan
          mengganti semester aktif sebelumnya. Tarif dan tunjangan menjadi versi
          tetap; buat rentang baru untuk perubahan nominal.
        </p>
        <Button type="submit">
          <ActionIcon action="save" />
          {busy ? "Menyimpan…" : "Simpan data"}
        </Button>
      </fieldset>
    </form>
  );
}
function HistoryChanges({
  kind,
  before,
  after,
}: {
  kind: MasterKind;
  before: unknown;
  after: unknown;
}) {
  const old = (before ?? {}) as Record<string, unknown>,
    next = (after ?? {}) as Record<string, unknown>;
  const display = (field: Field, value: unknown) =>
    field.type === "reference"
      ? value
        ? "Relasi dipilih"
        : "Tidak dipilih"
      : typeof value === "boolean"
        ? value
          ? "Ya"
          : "Tidak"
        : String(value ?? "—");
  return (
    <dl className="mt-3 space-y-3">
      {fields[kind].map((field) => {
        const key = field.key.replace(/[A-Z]/g, (v) => "_" + v.toLowerCase());
        if (old[key] === next[key]) return null;
        return (
          <div key={key}>
            <dt className="font-medium">{field.label}</dt>
            <dd>
              {display(field, old[key])} → {display(field, next[key])}
            </dd>
          </div>
        );
      })}
      {Boolean(next.archived_at) && (
        <div>
          <dt className="font-medium">Status</dt>
          <dd>Diarsipkan</dd>
        </div>
      )}
    </dl>
  );
}
export function MasterManager() {
  const [kind, setKind] = useState<MasterKind>("school"),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [archived, setArchived] = useState("false"),
    [parentId, setParentId] = useState(""),
    [data, setData] = useState<MasterList | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<MasterRow | null>(null),
    [opened, setOpened] = useState(false),
    [archive, setArchive] = useState<MasterRow | null>(null),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<
      | {
          actor_id: string;
          actor_name?: string | null | undefined;
          reason: string;
          created_at: string;
          old_data: unknown;
          new_data: unknown;
        }[]
      | null
    >(null);
  const pending = useRef(false);
  const historyRequest = useRef<AbortController | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyKind, setHistoryKind] = useState<MasterKind>("school");
  const [schoolExists, setSchoolExists] = useState<boolean | null>(null);
  useEffect(() => {
    if (kind !== "school") return;
    const controller = new AbortController(); let active = true;
    async function checkSchool() {
    setSchoolExists(null);
    await masterRequest<MasterList>("/api/settings/school?pageSize=1&archived=", "GET", undefined, controller.signal)
      .then(d => { if (active) setSchoolExists(masterListSchema.parse(d).total > 0); })
      .catch(() => { /* Keep creation disabled until existence can be verified. */ });
    }
    void checkSchool();
    return () => { active = false; controller.abort(); };
  }, [kind, revision]);
  useEffect(() => () => historyRequest.current?.abort(), []);
  const dialog = useRef<HTMLDialogElement>(null),
    confirmation = useRef<HTMLDialogElement>(null),
    historyDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    const c = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const d = await masterRequest<MasterList>(
          "/api/settings/" +
            kind +
            "?" +
            new URLSearchParams({
              q: query,
              page: String(page),
              pageSize: "20",
              archived,
              parentId,
            }),
          "GET",
          undefined,
          c.signal,
        );
        masterListSchema.parse(d);
        if (active) { const last = Math.max(1, Math.ceil(d.total / 20)); if (page > last) setPage(last); else setData(d); }
      } catch (e) {
        if (active) {
          setData(null);
          setError(e instanceof Error && e.name !== "ZodError" ? e.message : "Respons data tidak sesuai. Muat ulang atau hubungi admin.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      c.abort();
    };
  }, [kind, query, page, archived, parentId, revision]);
  useEffect(() => {
    if (opened) dialog.current?.showModal();
  }, [opened]);
  useEffect(() => {
    if (archive) confirmation.current?.showModal();
  }, [archive]);
  useEffect(() => {
    if (history) historyDialog.current?.showModal();
  }, [history]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const form = event.currentTarget,
      v = new FormData(form);
    const payload = Object.fromEntries(
      fields[kind].map((f) => [
        f.key,
        f.type === "checkbox"
          ? v.has(f.key)
          : f.type === "number" || f.key === "semester"
            ? Number(v.get(f.key))
            : String(v.get(f.key) ?? ""),
      ]),
    );
    try {
      const validatedPayload = validateInput<unknown>(payloadSchemas[kind], payload);
      const input = validateInput(mutationSchema, {
        ...(editing ? { id: editing.id } : {}),
        version: editing?.version ?? "0",
        reason: v.get("reason"),
        data: validatedPayload,
      });
      await masterRequest("/api/settings/" + kind, editing ? "PATCH" : "POST", input);
      dialog.current?.close();
      setNotice("Data tersimpan dan riwayat perubahan dicatat. Jika daftar gagal dimuat, gunakan Muat ulang tanpa menyimpan kembali.");
      setRevision((v) => v + 1);
    } catch (e) {
      applyFieldErrors(form, Object.fromEntries(Object.entries(serverFieldErrors(e)).map(([key, value]) => [key.replace(/^data\./, ""), value])));
      setError(e instanceof Error ? e.message : "Perubahan gagal.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function archiveRow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!archive || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const form = event.currentTarget,
      v = new FormData(form);
    try {
      const input = validateInput(mutationSchema, {
        id: archive.id,
        version: archive.version,
        reason: v.get("reason"),
      });
      await masterRequest("/api/settings/" + kind, "DELETE", input);
      form.reset();
      confirmation.current?.close();
      setNotice("Data diarsipkan. Riwayat tetap tersimpan. Jika daftar gagal dimuat, gunakan Muat ulang tanpa mengarsipkan kembali.");
      setRevision((v) => v + 1);
    } catch (e) {
      applyFieldErrors(form, serverFieldErrors(e));
      setError(e instanceof Error ? e.message : "Pengarsipan gagal.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function showHistory(row: MasterRow) {
    historyRequest.current?.abort();
    const controller = new AbortController(); historyRequest.current = controller;
    setHistory([]); setHistoryKind(kind); setHistoryLoading(true); setHistoryError("");
    try {
      const result = await masterRequest<NonNullable<typeof history>>("/api/settings/" + kind + "/history/" + row.id, "GET", undefined, controller.signal);
      if (!controller.signal.aborted) setHistory(masterHistorySchema.parse(result));
    } catch (e) {
      if (!controller.signal.aborted) setHistoryError(e instanceof Error && e.name !== "ZodError" ? e.message : "Respons riwayat tidak sesuai. Tutup lalu coba kembali.");
    } finally { if (!controller.signal.aborted) setHistoryLoading(false); }
  }
  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Administrasi madrasah
        </p>
        <h1 className="mt-2 text-3xl font-bold">Master sekolah dan akademik</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          Kelola identitas madrasah, struktur akademik, tarif, dan tunjangan.
          Lengkapi identitas sekolah, tahun pelajaran, semester, lalu kelas.
        </p>
      </header>
      <nav aria-label="Kelompok master" className="flex flex-wrap gap-2">
        {kinds.map((k) => (
          <Button
            key={k}
            aria-current={kind === k ? "page" : undefined}
            variant={kind === k ? "default" : "outline"}
            onClick={() => {
              setArchived("false");
              setKind(k);
              setPage(1);
              setQuery("");
              setParentId("");
              setNotice("");
            }}
          >
            <ActionIcon action="section" />
            {labels[k]}
          </Button>
        ))}
      </nav>
      <section className="page-section space-y-4 rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{labels[kind]}</h2>
          <Button
            disabled={loading || busy || (kind === "school" && schoolExists !== false)}
            onClick={() => {
              setEditing(null);
              setError("");
              setOpened(true);
            }}
          >
            <ActionIcon action="add" />
            Tambah {labels[kind].toLowerCase()}
          </Button>
        </div>
        {kind === "school" && schoolExists === null && !loading && <p role="status" className="text-sm text-muted-foreground">Identitas sekolah belum dapat diverifikasi. Gunakan Muat ulang sebelum menambah data.</p>}
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-sm">
            Cari nama / label
            <input
              maxLength={100}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="mt-2 block h-11 w-full min-w-0 rounded border bg-background px-3"
            />
          </label>
          <label className="text-sm">
            Status
            <select
              value={archived}
              onChange={(e) => {
                setArchived(e.target.value);
                setPage(1);
              }}
              className="mt-2 block h-11 w-full min-w-0 rounded border bg-background px-3"
            >
              <option value="false">Belum diarsipkan</option>
              <option value="true">Diarsipkan</option>
              <option value="">Semua</option>
            </select>
          </label>
          <Button variant="outline" onClick={() => setRevision((v) => v + 1)}>
            <ActionIcon action="refresh" />
            Muat ulang
          </Button>
        </div>
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
        {error && !opened && !archive && <ErrorFeedback message={error} />}
        {loading ? (
          <p role="status">Memuat data…</p>
        ) : (
          data && (
            <>
              <p className="text-sm">
                {data.total} data · halaman {data.page}
              </p>
              {data.items.length === 0 ? (
                <EmptyState title="Belum ada data sesuai pencarian." />
              ) : (
                <TableRegion label="Data master">
                  <table className="w-full min-w-[620px] table-fixed text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-3">Nama / relasi</th>
                        <th className="p-3">Rincian</th>
                        <th className="p-3">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((row) => (
                        <tr key={row.id} className="border-b align-top">
                          <td className="p-3">
                            <strong>{summary(row)}</strong>
                            {Boolean(row.parentLabel) && (
                              <p className="mt-1">{String(row.parentLabel)}</p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                              Versi {row.version} ·{" "}
                              {row.archivedAt ? "Diarsipkan" : "Tersedia"}
                              {row.isActive ? " · Semester aktif" : ""}
                            </p>
                          </td>
                          <td className="p-3">
                            <dl className="space-y-1">
                              {fields[kind]
                                .filter(
                                  (f) =>
                                    ![
                                      "name",
                                      "label",
                                      "dutyName",
                                      "academicPeriodId",
                                      "academicYearId",
                                      "userId",
                                      "headmasterId",
                                    ].includes(f.key),
                                )
                                .map((f) => (
                                  <div key={f.key}>
                                    <dt className="inline text-muted-foreground">
                                      {f.label}:{" "}
                                    </dt>
                                    <dd className="inline">
                                      {typeof row[f.key] === "boolean"
                                        ? row[f.key]
                                          ? "Ya"
                                          : "Tidak"
                                        : String(row[f.key] ?? "—")}
                                    </dd>
                                  </div>
                                ))}
                            </dl>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-2">
                              {!row.archivedAt &&
                                !["rates", "allowances"].includes(kind) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditing(row);
                                      setError("");
                                      setOpened(true);
                                    }}
                                  >
                                    <ActionIcon action="edit" />
                                    Ubah data
                                  </Button>
                                )}
                              {!row.archivedAt && kind !== "school" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setError("");
                                    setArchive(row);
                                  }}
                                >
                                  <ActionIcon action="archive" />
                                  Arsipkan
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void showHistory(row)}
                              >
                                <ActionIcon action="history" />
                                Riwayat
                              </Button>
                              {["academic-years", "academic-periods"].includes(
                                kind,
                              ) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setArchived("false");
                                    setNotice("");
                                    setParentId(row.id);
                                    setKind(
                                      kind === "academic-years"
                                        ? "academic-periods"
                                        : "classes",
                                    );
                                    setPage(1);
                                    setQuery("");
                                  }}
                                >
                                  <ActionIcon action="open" />
                                  Buka{" "}
                                  {kind === "academic-years"
                                    ? "semester"
                                    : "kelas"}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableRegion>
              )}
              <div className="flex flex-wrap justify-between gap-3">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((v) => v - 1)}
                >
                  <ActionIcon action="previous" />
                  Sebelumnya
                </Button>
                {parentId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setParentId("");
                      setPage(1);
                    }}
                  >
                    <ActionIcon action="close" />
                    Hapus filter relasi
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={page * 20 >= data.total}
                  onClick={() => setPage((v) => v + 1)}
                >
                  <ActionIcon action="next" />
                  Berikutnya
                </Button>
              </div>
            </>
          )
        )}
      </section>
      <details className="ui-panel text-sm leading-7">
        <summary className="min-h-11 cursor-pointer font-semibold">
          Ketentuan pengisian data master
        </summary>
        <p className="mt-3">
          Kebijakan rombel aplikasi: SD/MI maksimal 28, SMP/MTs 32, SMA/MA dan
          SMK/MAK 36 siswa. Kelas paralel yang terisi minimal 15 siswa; 0
          diperbolehkan. Ini kebijakan aplikasi, bukan pernyataan regulasi
          terbaru. Tanggal tarif/tunjangan baru paling awal hari ini (WIB),
          tanpa rentang tumpang tindih.
        </p>
      </details>
      <ManagedDialog
        ref={dialog}
        aria-labelledby="master-editor-title"
        className="m-auto max-h-[90svh] w-[min(42rem,calc(100%_-_2rem))] overflow-y-auto rounded-2xl border bg-card p-4 sm:p-6 text-foreground [overflow-wrap:anywhere] backdrop:bg-black/45"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        onClose={() => {
          setOpened(false);
          setEditing(null);
        }}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="master-editor-title" className="text-xl font-bold">
            {editing ? "Ubah" : "Tambah"} {labels[kind]}
          </h2>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => requestDialogClose(dialog.current)}
          >
            <ActionIcon action="close" />
            Tutup
          </Button>
        </div>
        {opened && (
          <Editor
            key={editing?.id ?? kind}
            kind={kind}
            row={editing}
            busy={busy}
            onSubmit={(e) => void save(e)}
          />
        )}{" "}
        {error && <ErrorFeedback message={error} />}
      </ManagedDialog>
      <ManagedDialog
        ref={confirmation}
        aria-labelledby="master-archive-title"
        className="m-auto max-h-[90svh] overflow-y-auto w-[min(32rem,calc(100%_-_2rem))] rounded-2xl border bg-card p-4 sm:p-6 text-foreground [overflow-wrap:anywhere] backdrop:bg-black/45"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        onClose={() => setArchive(null)}
      >
        {archive && (
          <form onSubmit={(e) => void archiveRow(e)} className="space-y-4">
            <h2 id="master-archive-title" className="text-xl font-bold">
              Arsipkan {summary(archive)}?
            </h2>
            <p className="text-sm">
              Riwayat tidak dihapus. Data yang masih dirujuk akan ditolak.
              Tarif/tunjangan hanya bisa dibatalkan sebelum tanggal berlakunya.
            </p>
            <fieldset disabled={busy} className="space-y-4">
              <label className="block text-sm">
                Alasan pengarsipan
                <input
                  name="reason"
                  required
                  minLength={5}
                  maxLength={500}
                  className="mt-2 h-11 w-full rounded border bg-background px-3"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => requestDialogClose(confirmation.current)}
                >
                  <ActionIcon action="close" />
                  Batal
                </Button>
                <Button type="submit">
                  <ActionIcon action="archive" />
                  {busy ? "Memproses…" : "Arsipkan data"}
                </Button>
              </div>
            </fieldset>
            {error && <ErrorFeedback message={error} />}
          </form>
        )}
      </ManagedDialog>
      <ManagedDialog
        ref={historyDialog}
        aria-labelledby="master-history-title"
        className="m-auto max-h-[90svh] w-[min(42rem,calc(100%_-_2rem))] overflow-y-auto rounded-2xl border bg-card p-4 sm:p-6 text-foreground [overflow-wrap:anywhere] backdrop:bg-black/45"
        onClose={() => { historyRequest.current?.abort(); setHistory(null); }}
      >
        <div className="mb-5 flex justify-between gap-3">
          <h2 id="master-history-title" className="text-xl font-bold">
            Riwayat perubahan
          </h2>
          <Button
            variant="outline"
            onClick={() => requestDialogClose(historyDialog.current)}
          >
            <ActionIcon action="close" />
            Tutup
          </Button>
        </div>
        {historyLoading ? <p role="status">Memuat riwayat…</p> : historyError ? <ErrorFeedback message={historyError} /> : history?.length === 0 ? (
          <EmptyState title="Belum ada riwayat." />
        ) : (
          history?.map((h, i) => (
            <article key={i} className="mb-4 rounded border p-4">
              <p className="text-sm">
                {new Date(h.created_at).toLocaleString("id-ID", {
                  timeZone: "Asia/Jakarta",
                })}{" "}
                · {h.actor_name ?? "Administrator"} · {h.reason}
              </p>
              <details className="mt-3 text-sm">
                <summary>Lihat nilai sebelum dan sesudah</summary>
                <HistoryChanges
                  kind={historyKind}
                  before={h.old_data}
                  after={h.new_data}
                />
              </details>
            </article>
          ))
        )}
      </ManagedDialog>
    </div>
  );
}
