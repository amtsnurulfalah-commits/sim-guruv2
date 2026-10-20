"use client";
import {
  ManagedDialog,
  requestDialogClose,
} from "@/components/ui/managed-dialog";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";
import { Button } from "@/components/ui/button";
import {
  userStatusLabels,
  type UserDto,
  type UserList,
  type UserProfileInput,
} from "@/lib/users/schemas";
import { usersRequest } from "./api";
import { endLocalSession } from "@/features/auth/account-lifecycle";
const empty: UserProfileInput = {
  username: "",
  fullName: "",
  nip: "",
  role: "guru",
  email: "",
  phone: "",
  address: "",
  photoUrl: "",
  employmentStatus: "",
  rank: "",
  kmDistance: "0.00",
  additionalRole: "",
};
function Input({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block space-y-2 text-sm">
      <span>{label}</span>
      <input
        {...props}
        className="h-11 w-full rounded-lg border bg-background px-3 read-only:bg-muted"
      />
    </label>
  );
}
function ProfileFields({
  user,
}: {
  user: UserProfileInput & { emailVerified?: boolean };
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input
        label="Username"
        name="username"
        defaultValue={user.username}
        required
        minLength={3}
        maxLength={64}
        autoComplete="off"
      />
      <Input
        label="Nama lengkap"
        name="fullName"
        defaultValue={user.fullName}
        required
        maxLength={200}
      />
      <Input
        label="NIP (teks, opsional)"
        name="nip"
        defaultValue={user.nip}
        maxLength={64}
      />
      <label className="block space-y-2 text-sm">
        <span>Peran aplikasi</span>
        <select
          name="role"
          defaultValue={user.role}
          className="h-11 w-full rounded-lg border bg-background px-3"
        >
          <option value="guru">Guru</option>
          <option value="admin">Administrator</option>
        </select>
      </label>
      <Input
        label="Email kandidat / terverifikasi"
        name="email"
        type="email"
        defaultValue={user.email}
        maxLength={254}
        readOnly={user.emailVerified}
      />
      <Input
        label="Nomor telepon"
        name="phone"
        type="tel"
        defaultValue={user.phone}
        maxLength={25}
      />
      <Input
        label="Alamat"
        name="address"
        defaultValue={user.address}
        maxLength={500}
      />
      <Input
        label="URL foto HTTPS"
        name="photoUrl"
        type="url"
        defaultValue={user.photoUrl}
        maxLength={2048}
      />
      <Input
        label="Status kepegawaian"
        name="employmentStatus"
        defaultValue={user.employmentStatus}
        maxLength={100}
      />
      <Input
        label="Pangkat / golongan"
        name="rank"
        defaultValue={user.rank}
        maxLength={100}
      />
      <Input
        label="Jarak rumah (km, maksimal 2 desimal)"
        name="kmDistance"
        inputMode="decimal"
        defaultValue={user.kmDistance}
        required
        maxLength={6}
      />
      <label className="block space-y-2 text-sm">
        <span>Jabatan tambahan</span>
        <select
          name="additionalRole"
          defaultValue={user.additionalRole}
          className="h-11 w-full rounded-lg border bg-background px-3"
        >
          <option value="">Tidak ada</option>
          <option value="KEPALA_SEKOLAH">Kepala Sekolah</option>
        </select>
      </label>
    </div>
  );
}
function UserEditor({
  user,
  onSuccess,
  onBusy,
}: {
  user: UserDto | null;
  onSuccess: (r: MutationResult) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [delivery, setDelivery] = useState("activation"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      data = Object.fromEntries(new FormData(form));
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const result = await usersRequest<MutationResult>(
        user ? "/" + user.id : "",
        user ? "PATCH" : "POST",
        { ...data, ...(user ? { version: user.version } : { delivery }) },
      );
      form.reset();
      onSuccess(result);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Perubahan belum dapat disimpan.",
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <form className="space-y-5" onSubmit={(e) => void submit(e)}>
      <fieldset disabled={busy} className="space-y-5">
        <ProfileFields user={user ?? empty} />
        {user?.emailVerified && (
          <p className="text-sm leading-7">
            Email terverifikasi tidak dapat diganti dari formulir ini. Gunakan
            permintaan pemulihan dengan pemeriksaan identitas bila pemilik
            kehilangan akses.
          </p>
        )}
        {!user && (
          <>
            <label className="block space-y-2 text-sm">
              <span>Metode penyerahan akun</span>
              <select
                value={delivery}
                onChange={(e) => setDelivery(e.target.value)}
                className="h-11 w-full rounded-lg border bg-background px-3"
              >
                <option value="activation">
                  Tautan aktivasi melalui email
                </option>
                <option value="handover">
                  Serah terima setelah verifikasi identitas
                </option>
              </select>
            </label>
            {delivery === "handover" ? (
              <IdentityFields />
            ) : (
              <p className="text-sm leading-7">
                Alamat email kandidat wajib diisi. Tautan sekali pakai masuk
                antrean; pengiriman memerlukan layanan email aktif.
              </p>
            )}
          </>
        )}
        <Input
          label="Alasan tindakan (minimal 5 karakter)"
          name="reason"
          required
          minLength={5}
          maxLength={500}
        />
        <Input
          label="Konfirmasi kata sandi administrator"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
        />
        <p className="text-sm leading-7">
          Perubahan profil/peran mencabut sesi dan challenge lama pengguna. Akun
          yang diarsipkan tidak dapat diubah; riwayat tetap disimpan.
        </p>
        <Button type="submit" disabled={busy}>
          {busy ? "Menyimpan…" : user ? "Simpan perubahan" : "Buat akun"}
        </Button>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm leading-7">
          {error} Untuk konflik versi, tutup formulir, muat ulang daftar, lalu
          periksa data terbaru.
        </p>
      )}
    </form>
  );
}
export function IdentityFields() {
  return (
    <>
      <label className="block space-y-2 text-sm">
        <span>Metode verifikasi identitas</span>
        <select
          name="method"
          className="h-11 w-full rounded-lg border bg-background px-3"
        >
          <option value="tatap_muka">Tatap muka</option>
          <option value="dokumen_dan_panggilan">
            Dokumen dan panggilan terverifikasi
          </option>
        </select>
      </label>
      <Input
        label="Referensi bukti (tanpa kata sandi, OTP atau dokumen rahasia)"
        name="evidence"
        required
        minLength={5}
        maxLength={300}
      />
    </>
  );
}
type MutationResult = {
  user?: UserDto;
  selfAffected?: boolean;
  delivery?: string;
  temporaryPassword?: string;
  expiresInHours?: number;
};
type Confirmation = {
  user: UserDto;
  action: "active" | "disabled" | "archived" | "activation";
};
export function UserManager() {
  const [query, setQuery] = useState({
      q: "",
      role: "",
      status: "",
      page: 1,
      pageSize: 20,
    }),
    [data, setData] = useState<UserList | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<UserDto | null>(null),
    [editorOpen, setEditorOpen] = useState(false),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null),
    [busy, setBusy] = useState(false),
    [secret, setSecret] = useState("");
  const editor = useRef<HTMLDialogElement>(null),
    confirm = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const value = await usersRequest<UserList>(
          "?" +
            new URLSearchParams({
              ...query,
              page: String(query.page),
              pageSize: String(query.pageSize),
            }),
          "GET",
          undefined,
          controller.signal,
        );
        if (active) setData(value);
      } catch (e) {
        if (active) {
          setData(null);
          setError(
            e instanceof Error ? e.message : "Daftar belum dapat dimuat.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [query, revision]);
  useEffect(() => {
    if (editorOpen) editor.current?.showModal();
  }, [editorOpen]);
  useEffect(() => {
    if (confirmation) confirm.current?.showModal();
  }, [confirmation]);
  function success(result: MutationResult) {
    if (result.selfAffected) {
      endLocalSession();
      return;
    }
    if (result.temporaryPassword) setSecret(result.temporaryPassword);
    setMessage(
      result.delivery === "queued"
        ? "Akun tersimpan dan aktivasi masuk antrean pengiriman. Belum berarti email telah terkirim."
        : "Perubahan pengguna berhasil disimpan.",
    );
    editor.current?.close();
    confirm.current?.close();
    setRevision((v) => v + 1);
  }
  async function confirmAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmation || busy) return;
    setBusy(true);
    setError("");
    const form = event.currentTarget,
      values = Object.fromEntries(new FormData(form)),
      { user, action } = confirmation;
    try {
      const result = await usersRequest<MutationResult>(
        "/" + user.id + (action === "activation" ? "/activation" : "/status"),
        "POST",
        {
          ...values,
          version: user.version,
          ...(action === "activation" ? {} : { status: action }),
        },
      );
      form.reset();
      success(result);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Tindakan belum dapat dijalankan.",
      );
    } finally {
      setBusy(false);
    }
  }
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setQuery({
      q: String(values.get("q") ?? ""),
      role: String(values.get("role") ?? ""),
      status: String(values.get("status") ?? ""),
      page: 1,
      pageSize: Number(values.get("pageSize")),
    });
  }
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            Administrasi madrasah
          </p>
          <h1 className="mt-2 text-3xl font-bold">Manajemen pengguna</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Kelola profil, peran dan status akses. Aktivasi akun memerlukan
            email yang dapat dibuktikan pemiliknya. Tidak ada kata sandi default
            bersama.
          </p>
        </div>
        <Button
          disabled={Boolean(secret)}
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          Tambah pengguna
        </Button>
      </header>
      {message && (
        <p role="status" className="rounded-xl border bg-accent p-4 text-sm">
          {message}
        </p>
      )}
      {secret && (
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">Serah terima kata sandi sementara</h2>
          <p className="text-sm leading-7">
            Berlaku 24 jam, ditampilkan satu kali untuk diserahkan secara aman
            kepada pemilik yang sudah diverifikasi. Pemilik wajib mengganti kata
            sandi dan menyelesaikan onboarding.
          </p>
          <output className="block break-all rounded-lg border p-3 font-mono">
            {secret}
          </output>
          <Button variant="outline" onClick={() => setSecret("")}>
            Sudah diserahkan, sembunyikan
          </Button>
        </section>
      )}
      <form
        onSubmit={filter}
        className="grid items-end gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2 xl:grid-cols-5"
      >
        <Input
          name="q"
          label="Cari nama, username atau NIP"
          maxLength={100}
          defaultValue={query.q}
        />
        <label className="space-y-2 text-sm">
          <span>Peran</span>
          <select
            name="role"
            defaultValue={query.role}
            className="h-11 w-full rounded-lg border bg-background px-3"
          >
            <option value="">Semua peran</option>
            <option value="admin">Administrator</option>
            <option value="guru">Guru</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span>Status</span>
          <select
            name="status"
            defaultValue={query.status}
            className="h-11 w-full rounded-lg border bg-background px-3"
          >
            <option value="">Semua status</option>
            {Object.entries(userStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span>Baris per halaman</span>
          <select
            name="pageSize"
            defaultValue={query.pageSize}
            className="h-11 w-full rounded-lg border bg-background px-3"
          >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
        <Button type="submit" disabled={loading}>
          Terapkan filter
        </Button>
      </form>
      {loading ? (
        <p role="status" aria-busy="true">
          Memuat pengguna…
        </p>
      ) : error ? (
        <div role="alert" className="space-y-3 rounded-xl border p-5">
          <p>{error}</p>
          <Button variant="outline" onClick={() => setRevision((v) => v + 1)}>
            Muat ulang daftar
          </Button>
        </div>
      ) : (
        data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <p>
                {data.total} pengguna sesuai filter · Halaman {data.page}
              </p>
              <Button
                variant="outline"
                onClick={() => setRevision((v) => v + 1)}
              >
                Muat ulang
              </Button>
            </div>
            {data.items.length === 0 ? (
              <p className="rounded-2xl border bg-card p-6 text-sm">
                Tidak ada pengguna yang sesuai filter. Ubah filter atau
                tambahkan pengguna baru.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border bg-card">
                <table className="w-full min-w-200 text-left text-sm">
                  <caption className="sr-only">
                    Daftar pengguna sesuai filter
                  </caption>
                  <thead className="border-b bg-muted">
                    <tr>
                      {[
                        "Nama dan username",
                        "Peran / status",
                        "Email dan pengamanan",
                        "Jarak",
                        "Tindakan",
                      ].map((title) => (
                        <th
                          key={title}
                          scope="col"
                          className="p-4 font-semibold"
                        >
                          {title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((user) => (
                      <tr key={user.id} className="border-b last:border-0">
                        <td className="p-4">
                          <p className="font-semibold">{user.fullName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {user.username} · NIP {user.nip || "—"}
                          </p>
                        </td>
                        <td className="p-4">
                          {user.role === "admin" ? "Administrator" : "Guru"}
                          <p className="mt-1 text-xs">
                            {userStatusLabels[user.status]}
                          </p>
                        </td>
                        <td className="p-4">
                          <p>{user.email || "Belum ada email"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {user.emailVerified
                              ? "Email terverifikasi"
                              : "Email belum terverifikasi"}{" "}
                            ·{" "}
                            {user.mustChangePassword
                              ? "Wajib ganti kata sandi"
                              : "Kata sandi permanen"}
                          </p>
                        </td>
                        <td className="p-4">{user.kmDistance} km</td>
                        <td className="p-4">
                          <div className="flex max-w-80 flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                user.status === "archived" || Boolean(secret)
                              }
                              onClick={() => {
                                setEditing(user);
                                setEditorOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            {user.status === "pending_activation" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setError("");
                                  setConfirmation({
                                    user,
                                    action: "activation",
                                  });
                                }}
                              >
                                Antrekan ulang aktivasi
                              </Button>
                            )}
                            {(user.status === "active" ||
                              user.status === "disabled") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setError("");
                                  setConfirmation({
                                    user,
                                    action:
                                      user.status === "active"
                                        ? "disabled"
                                        : "active",
                                  });
                                }}
                              >
                                {user.status === "active"
                                  ? "Nonaktifkan"
                                  : "Aktifkan"}
                              </Button>
                            )}
                            {user.status !== "archived" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setError("");
                                  setConfirmation({ user, action: "archived" });
                                }}
                              >
                                Arsipkan
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <Button
                variant="outline"
                disabled={query.page === 1}
                onClick={() => setQuery((v) => ({ ...v, page: v.page - 1 }))}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                disabled={data.page * data.pageSize >= data.total}
                onClick={() => setQuery((v) => ({ ...v, page: v.page + 1 }))}
              >
                Berikutnya
              </Button>
            </div>
          </>
        )
      )}
      <p className="text-sm">
        <Link href="/admin/pemulihan" className="underline">
          Tinjau permintaan pemulihan akun
        </Link>
      </p>
      <ManagedDialog
        ref={editor}
        aria-labelledby="user-editor-title"
        className="m-auto max-h-[90svh] w-[min(48rem,calc(100%_-_2rem))] overflow-y-auto rounded-2xl border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/45"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 id="user-editor-title" className="text-xl font-bold">
            {editing ? "Edit pengguna" : "Tambah pengguna"}
          </h2>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => requestDialogClose(editor.current)}
          >
            Tutup
          </Button>
        </div>
        {editorOpen && (
          <UserEditor
            key={editing?.id ?? "create"}
            user={editing}
            onSuccess={success}
            onBusy={setBusy}
          />
        )}
      </ManagedDialog>
      <ManagedDialog
        ref={confirm}
        aria-labelledby="user-confirm-title"
        className="m-auto w-[min(32rem,calc(100%_-_2rem))] rounded-2xl border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/45"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        onClose={() => {
          setConfirmation(null);
          setError("");
        }}
      >
        {confirmation && (
          <form onSubmit={(e) => void confirmAction(e)} className="space-y-5">
            <h2 id="user-confirm-title" className="text-xl font-bold">
              {confirmation.action === "activation"
                ? "Antrekan ulang aktivasi"
                : confirmation.action === "archived"
                  ? "Arsipkan pengguna"
                  : confirmation.action === "disabled"
                    ? "Nonaktifkan pengguna"
                    : "Aktifkan pengguna"}
              ?
            </h2>
            <p className="text-sm leading-7">
              Target:{" "}
              <strong>
                {confirmation.user.fullName} ({confirmation.user.username})
              </strong>
              .{" "}
              {confirmation.action === "activation"
                ? "Tautan lama dibatalkan dan tautan baru masuk antrean. Status antrean tidak berarti terkirim."
                : "Sesi dan challenge lama akan dicabut. Pengarsipan mempertahankan riwayat dan tidak dapat dibatalkan melalui halaman ini."}{" "}
              Harus tetap ada admin aktif yang telah menyelesaikan pengamanan
              akun.
            </p>
            <fieldset disabled={busy} className="space-y-4">
              <Input
                label="Alasan tindakan"
                name="reason"
                required
                minLength={5}
                maxLength={500}
              />
              <Input
                label="Konfirmasi kata sandi administrator"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                maxLength={256}
              />
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => requestDialogClose(confirm.current)}
                >
                  Batal
                </Button>
                <Button type="submit">
                  {busy ? "Memproses…" : "Ya, lanjutkan"}
                </Button>
              </div>
            </fieldset>
            {error && (
              <p role="alert" className="text-sm leading-7">
                {error}
              </p>
            )}
          </form>
        )}
      </ManagedDialog>
    </div>
  );
}
