"use client";
import { ApiRequestError, serverFieldErrors } from "@/lib/feedback/api-error";
import { applyFieldErrors } from "@/lib/feedback/form-fields";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { ActionIcon } from "@/components/ui/action-icon";

import { TableRegion } from "@/components/ui/table-region";
import {
  ManagedDialog,
  requestDialogClose,
} from "@/components/ui/managed-dialog";
import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";
import { Button } from "@/components/ui/button";
import {
  userStatusLabels, createUserSchema, editUserSchema, statusSchema, activationRequestSchema, resetEmailRequestSchema, listUsersSchema,
  type UserDto,
  type UserList,
  type UserProfileInput,
} from "@/lib/users/schemas";
import { usersRequest } from "./api";
import { endLocalSession } from "@/features/auth/account-lifecycle";
import { userListSchema, userMutationSchema } from "@/lib/users/contracts";
import { validateAccount as validateInput } from "@/lib/accounts/client-validation";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/features/auth/account-lifecycle";
import { EmptyState } from "@/components/feedback/feature-state";
function fieldError(form:HTMLFormElement,error:unknown){
 const fields=serverFieldErrors(error);
 if(error instanceof ApiRequestError && error.code==="INVALID_CREDENTIALS") fields.currentPassword="Kata sandi administrator tidak sesuai. Periksa kembali isian ini.";
 applyFieldErrors(form,fields);
}
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
  const id=useId();
  const {type,...inputProps}=props;
  return <div className="min-w-0 space-y-2 text-sm"><label htmlFor={id} className="block font-medium">{label}</label>
    {type==="password"?<PasswordInput {...inputProps} id={id}/>:<input {...inputProps} id={id} type={type} className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3 read-only:bg-muted"/>}
  </div>;
}

function ProfileFields({
  user,
  emailRequired=false,
}: {
  user: UserProfileInput & { emailVerified?: boolean };
  emailRequired?:boolean;
}) {
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
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
          aria-label="Peran aplikasi"
          defaultValue={user.role}
          className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3"
        >
          <option value="guru">Guru</option>
          <option value="admin">Administrator</option>
        </select>
      </label>
      <Input
        label="Email kandidat / terverifikasi"
        name="email"
        type="email"
        required={emailRequired}
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
      <Field label="Alamat" name="address" value={user.address} maxLength={500} required={false} multiline />
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
          aria-label="Jabatan tambahan"
          defaultValue={user.additionalRole}
          className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3"
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
  onSuccess: (r: unknown, target:string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const pending=useRef(false),mounted=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const [delivery, setDelivery] = useState("activation"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current=true;
    const form = event.currentTarget,
      data = Object.fromEntries(new FormData(form));
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const result = await usersRequest<unknown>(
        user ? "/" + user.id : "",
        user ? "PATCH" : "POST",
        user ? validateInput(editUserSchema,{...data,version:user.version}) : validateInput(createUserSchema,{...data,delivery}),
      );
      form.reset();
      if(mounted.current)onSuccess(result,String(data.fullName)+" ("+String(data.username)+")");
    } catch (e) {
      if(!mounted.current)return;
      fieldError(form,e);
      setError(
        e instanceof Error ? e.message : "Perubahan belum dapat disimpan.",
      );
    } finally {
      pending.current=false;
      if(mounted.current)setBusy(false);
      onBusy(false);
    }
  }
  return (
    <form aria-busy={busy} className="min-w-0 space-y-5" onSubmit={(e) => void submit(e)}>
      <fieldset disabled={busy} className="space-y-5">
        <ProfileFields user={user ?? empty} emailRequired={user ? user.status==="pending_activation" : delivery==="activation"} />
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
                aria-label="Metode penyerahan akun"
                value={delivery}
                onChange={(e) => setDelivery(e.target.value)}
                className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3"
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
          <ActionIcon action="save" />
          {busy ? "Menyimpan…" : user ? "Simpan perubahan" : "Buat akun"}
        </Button>
      </fieldset>
      {error && <ErrorFeedback message={error} />}
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
          aria-label="Metode verifikasi identitas"
          className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3"
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
type Confirmation = {
  user: UserDto;
  action: "active" | "disabled" | "archived" | "activation" | "reset-email";
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
    [messageIsError, setMessageIsError] = useState(false),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<UserDto | null>(null),
    [editorOpen, setEditorOpen] = useState(false),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null),
    [busy, setBusy] = useState(false),
    [secret, setSecret] = useState<{value:string;target:string}|null>(null);
  const [listError,setListError]=useState(""),[filterRevision,setFilterRevision]=useState(0);
  const pending=useRef(false),mounted=useRef(false),committed=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  function editorBusy(value:boolean){pending.current=value;if(mounted.current)setBusy(value);}
  const editor = useRef<HTMLDialogElement>(null),
    confirm = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      setLoading(true);
      setListError("");
      try {
        const raw = await usersRequest<unknown>(
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
        const parsed=userListSchema.safeParse(raw);
        if(!parsed.success)throw new ApiRequestError("INVALID_RESPONSE","Daftar pengguna belum sesuai format. Muat ulang sebelum memproses tindakan.");
        const value=parsed.data;
        if(active){
          const last=Math.max(1,Math.ceil(value.total/query.pageSize));
          if(query.page>last){setQuery(v=>({...v,page:last}));return;}
          setData(value);committed.current=false;
        }
      } catch (e) {
        if (active) {
          setData(null);
          setListError((committed.current?"Perubahan sudah diproses, tetapi daftar terbaru belum dapat dimuat. Jangan ulangi tindakan. ":"")+(e instanceof Error ? e.message : "Daftar belum dapat dimuat."));
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
  function success(raw:unknown,target:string,action?:Confirmation["action"]) {
    if(!mounted.current)return;
    const value=raw && typeof raw==="object"?raw as Record<string,unknown>:{};
    committed.current=true;
    setMessageIsError(false);
    if(value.selfAffected===true){endLocalSession();return;}
    // Preserve a one-time secret even if other response fields are malformed.
    if(typeof value.temporaryPassword==="string"&&value.temporaryPassword)setSecret({value:value.temporaryPassword,target});
    const parsed=userMutationSchema.safeParse(raw);
    setMessage(!parsed.success?"Tindakan sudah diproses, tetapi detail hasil belum dapat dibaca. Jangan ulangi tindakan; periksa status pengguna setelah memuat ulang daftar.":parsed.data.delivery==="handover"&&!parsed.data.temporaryPassword?"Akun sudah dibuat tetapi kata sandi sementara tidak terbaca. Jangan buat akun ulang; tinjau status pengguna dan ajukan pemulihan bila diperlukan.":parsed.data.delivery==="queued"?"Akun tersimpan dan aktivasi masuk antrean pengiriman. Belum berarti email telah terkirim.":"Perubahan pengguna berhasil disimpan.");
    if(action === "reset-email") {
      const labels = { accepted: "Penyedia email telah menerima email reset password. Pengguna dapat membuka tautan dan memasukkan OTP dari email; periksa juga folder spam.", pending: "Email reset password sudah masuk antrean. Pengiriman masih menunggu; periksa status email di Pengaturan operasional sebelum mengirim ulang.", failed: "Permintaan reset sudah dicatat, tetapi pengiriman email gagal. Periksa layanan email di Pengaturan operasional sebelum mengirim ulang.", unknown: "Permintaan reset sudah dicatat, tetapi status pengiriman belum pasti. Periksa kotak masuk pengguna dan Pengaturan operasional sebelum mengirim ulang." };
      setMessageIsError(!parsed.success || ["failed","unknown"].includes(parsed.data.emailDelivery ?? "pending"));
      setMessage(parsed.success ? labels[parsed.data.emailDelivery ?? "pending"] : "Permintaan reset sudah diproses, tetapi detail hasil belum dapat dibaca. Jangan kirim ulang; periksa status email di Pengaturan operasional.");
    }
    editor.current?.close();confirm.current?.close();setRevision(v=>v+1);
  }
  async function confirmAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmation || pending.current || secret) return;
    pending.current=true;
    setBusy(true);
    setError("");
    const form = event.currentTarget,
      values = Object.fromEntries(new FormData(form)),
      { user, action } = confirmation;
    try {
      const result = await usersRequest<unknown>(
        "/" + user.id + (action === "activation" ? "/activation" : action === "reset-email" ? "/reset-email" : "/status"),
        "POST",
        action==="reset-email"?validateInput(resetEmailRequestSchema,{...values,version:user.version}):action==="activation"?validateInput(activationRequestSchema,{...values,version:user.version}):validateInput(statusSchema,{...values,version:user.version,status:action}),
      );
      form.reset();
      success(result,user.fullName+" ("+user.username+")", action);
    } catch (e) {
      if(!mounted.current)return;
      fieldError(form,e);
      setError(
        (action === "reset-email" && e instanceof ApiRequestError && e.code !== "EMAIL_DELIVERY_UNAVAILABLE" && (["NETWORK_ERROR","TIMEOUT","INVALID_RESPONSE"].includes(e.code) || e.status>=500) ? "Hasil pengiriman belum dapat dipastikan. Periksa status email di Pengaturan operasional sebelum mencoba ulang. " : "") + (e instanceof Error ? e.message : "Tindakan belum dapat dijalankan."),
      );
    } finally {
      pending.current=false;
      if(mounted.current)setBusy(false);
    }
  }
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {setQuery(validateInput(listUsersSchema,{
      q: String(values.get("q") ?? ""),
      role: String(values.get("role") ?? ""),
      status: String(values.get("status") ?? ""),
      page: 1,
      pageSize: Number(values.get("pageSize")),
    }));}catch(e){fieldError(event.currentTarget,e);setListError(e instanceof Error?e.message:"Periksa filter pengguna.");}
  }
  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
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
          disabled={busy || Boolean(secret)}
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          <ActionIcon action="add" />
          Tambah pengguna
        </Button>
      </header>
      {message && (messageIsError ? <ErrorFeedback message={message} /> : (
        <p role="status" className="rounded-xl border bg-accent p-4 text-sm">{message}</p>
      ))}
      {secret && (
        <section className="page-section space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">Serah terima kata sandi sementara</h2><p className="text-sm font-medium">Pemilik: {secret.target}</p>
          <p className="text-sm leading-7">
            Berlaku 24 jam, ditampilkan satu kali untuk diserahkan secara aman
            kepada pemilik yang sudah diverifikasi. Pemilik wajib mengganti kata
            sandi dan menyelesaikan onboarding. Nilai tidak ditampilkan kembali setelah halaman ditutup.
          </p>
          <output className="block break-all rounded-lg border p-3 font-mono">
            {secret.value}
          </output>
          <Button variant="outline" onClick={() => setSecret(null)}>
            <ActionIcon action="visibility" />
            Sembunyikan kata sandi sementara
          </Button>
        </section>
      )}
      <form
        key={filterRevision}
        onSubmit={filter}
        className="rounded-2xl border bg-card p-5"
      ><fieldset disabled={busy} className="grid min-w-0 items-end gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
            className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3"
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
            className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3"
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
            className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3"
          >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
        <Button type="submit" disabled={loading}>
          <ActionIcon action="filter" />
          Terapkan filter
        </Button>
        <Button type="button" variant="outline" onClick={()=>{setQuery({q:"",role:"",status:"",page:1,pageSize:20});setFilterRevision(v=>v+1);}}>Reset filter</Button>
      </fieldset></form>
      {loading ? (
        <p role="status" aria-busy="true">
          Memuat pengguna…
        </p>
      ) : listError ? (
        <div className="space-y-3 rounded-xl border p-5">
          <ErrorFeedback message={listError} />
          <Button variant="outline" disabled={busy} onClick={() => setRevision((v) => v + 1)}>
            <ActionIcon action="refresh" />
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
                disabled={busy}
                onClick={() => setRevision((v) => v + 1)}
              >
                <ActionIcon action="refresh" />
                Muat ulang
              </Button>
            </div>
            {data.items.length === 0 ? (
              <EmptyState title="Tidak ada pengguna yang sesuai filter" description="Sesuaikan atau reset filter. Gunakan Tambah pengguna untuk membuat akun baru."/>
            ) : (
              <TableRegion label="Daftar pengguna">
                <table className="w-full min-w-[900px] table-fixed text-left text-sm"><colgroup><col className="w-52"/><col className="w-36"/><col className="w-60"/><col className="w-24"/><col className="w-56"/></colgroup>
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
                      <tr key={user.id} className="border-b align-top last:border-0">
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
                                user.status === "archived" || busy || Boolean(secret)
                              }
                              onClick={() => {
                                setEditing(user);
                                setEditorOpen(true);
                              }}
                            >
                              <ActionIcon action="edit" />
                              Ubah pengguna
                            </Button>
                            {user.status === "pending_activation" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy || Boolean(secret) || Boolean(listError)}
                                onClick={() => {
                                  setError("");
                                  setConfirmation({
                                    user,
                                    action: "activation",
                                  });
                                }}
                              >
                                <ActionIcon action="mail" />
                                Antrekan ulang email aktivasi
                              </Button>
                            )}
                            {user.status === "active" && <>
                              <Button size="sm" variant="outline" disabled={busy || Boolean(secret) || !user.emailVerified || !user.email} onClick={() => { setError(""); setConfirmation({user, action:"reset-email"}); }}><ActionIcon action="mail" />Kirim email reset password</Button>
                              {(!user.emailVerified || !user.email) && <p className="text-xs leading-6 text-muted-foreground">Reset melalui email memerlukan email terverifikasi.</p>}
                            </>}
                            {(user.status === "active" ||
                              user.status === "disabled") && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy || Boolean(secret)}
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
                                <ActionIcon action="toggle" />
                                {user.status === "active"
                                  ? "Nonaktifkan"
                                  : "Aktifkan"}
                              </Button>
                            )}
                            {user.status !== "archived" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy || Boolean(secret)}
                                onClick={() => {
                                  setError("");
                                  setConfirmation({ user, action: "archived" });
                                }}
                              >
                                <ActionIcon action="archive" />
                                Arsipkan
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
            <nav aria-label="Pagination pengguna" className="flex flex-wrap justify-between gap-3">
              <Button
                variant="outline"
                disabled={busy || query.page === 1}
                onClick={() => setQuery((v) => ({ ...v, page: v.page - 1 }))}
              >
                <ActionIcon action="previous" />
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                disabled={busy || data.page * data.pageSize >= data.total}
                onClick={() => setQuery((v) => ({ ...v, page: v.page + 1 }))}
              >
                <ActionIcon action="next" />
                Berikutnya
              </Button>
            </nav>
          </>
        )
      )}
      <p className="text-sm">
        <Link prefetch={false} href="/admin/pemulihan" className="underline">
          Tinjau permintaan pemulihan akun
        </Link>
      </p>
      <ManagedDialog
        ref={editor}
        aria-labelledby="user-editor-title"
        className="m-auto max-h-[90svh] w-[min(48rem,calc(100%_-_2rem))] overflow-y-auto rounded-2xl border bg-card p-4 sm:p-6 text-foreground [overflow-wrap:anywhere] shadow-xl backdrop:bg-black/45"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
      >
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 id="user-editor-title" className="text-xl font-bold">
            {editing ? "Ubah pengguna" : "Tambah pengguna"}
          </h2>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => requestDialogClose(editor.current)}
          >
            <ActionIcon action="close" />
            Tutup
          </Button>
        </div>
        {editorOpen && (
          <UserEditor
            key={editing?.id ?? "create"}
            user={editing}
            onSuccess={success}
            onBusy={editorBusy}
          />
        )}
      </ManagedDialog>
      <ManagedDialog
        ref={confirm}
        aria-labelledby="user-confirm-title"
        className="m-auto max-h-[90svh] w-[min(32rem,calc(100%_-_2rem))] overflow-y-auto rounded-2xl border bg-card p-4 sm:p-6 text-foreground [overflow-wrap:anywhere] shadow-xl backdrop:bg-black/45"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        onClose={() => {
          setConfirmation(null);
          setError("");
        }}
      >
        {confirmation && (
          <form key={confirmation.user.id+confirmation.action+confirmation.user.version} aria-busy={busy} onSubmit={(e) => void confirmAction(e)} className="min-w-0 space-y-5">
            <h2 id="user-confirm-title" className="text-xl font-bold">
              {confirmation.action === "reset-email"
                ? "Kirim email reset password"
                : confirmation.action === "activation"
                ? "Antrekan ulang email aktivasi"
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
              {confirmation.action === "reset-email"
                ? `Email akan dikirim ke alamat terverifikasi ${confirmation.user.email}. Pengguna menentukan kata sandi baru menggunakan tautan dan OTP yang berlaku 10 menit. Kata sandi dan sesi pengguna belum diubah saat email dikirim. Kode pemulihan sebelumnya dibatalkan. Jangan membagikan OTP.`
                : confirmation.action === "activation"
                ? "Tautan lama dibatalkan dan tautan baru masuk antrean. Status antrean tidak berarti terkirim."
                : "Sesi dan challenge lama akan dicabut. Pengarsipan mempertahankan riwayat dan tidak dapat dibatalkan melalui halaman ini."}{" "}
              {confirmation.action !== "reset-email" && "Harus tetap ada admin aktif yang telah menyelesaikan pengamanan akun."}
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
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => requestDialogClose(confirm.current)}
                >
                  <ActionIcon action="close" />
                  Batal
                </Button>
                <Button type="submit">
                  <ActionIcon
                    action={
                      (confirmation.action === "activation" || confirmation.action === "reset-email")
                        ? "mail"
                        : confirmation.action === "archived"
                          ? "archive"
                          : "toggle"
                    }
                  />
                  {busy
                    ? "Memproses…"
                    : confirmation.action === "reset-email"
                      ? "Kirim email reset password"
                      : confirmation.action === "activation"
                      ? "Antrekan ulang email aktivasi"
                      : confirmation.action === "archived"
                        ? "Arsipkan pengguna"
                        : confirmation.action === "disabled"
                          ? "Nonaktifkan pengguna"
                          : "Aktifkan pengguna"}
                </Button>
              </div>
            </fieldset>
            {error && <ErrorFeedback message={error} />}
          </form>
        )}
      </ManagedDialog>
    </div>
  );
}
