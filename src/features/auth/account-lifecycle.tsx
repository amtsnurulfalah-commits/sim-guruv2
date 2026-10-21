"use client";
import { ActionIcon } from "@/components/ui/action-icon";

import Link from "next/link";
import { UserRound, KeyRound, MailCheck, ShieldQuestion } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { PasswordInput } from "@/components/ui/password-input";
import { FormDialog } from "@/components/ui/dialog";
import { notifySuccess } from "@/components/feedback/toast-region";
import { Button } from "@/components/ui/button";
import { ApiRequestError, requestJson, serverFieldErrors } from "@/lib/feedback/api-error";
import { applyFieldErrors } from "@/lib/feedback/form-fields";
import { FeatureState } from "@/components/feedback/feature-state";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { emailDispatchSchema, profileDtoSchema, profileSchema, changePasswordSchema, questionSchema, emailRequestSchema, verifyOtpSchema, type ProfileDto } from "@/lib/accounts/schemas";
import { validateAccount } from "@/lib/accounts/client-validation";
const AccountActions = createContext<{busy:boolean; claim:()=>boolean; release:()=>void} | null>(null);
/** Serializes related recovery forms without changing standalone ActionForm callers. */
export function AccountActionScope({ children, blocked = false }: {children: ReactNode; blocked?: boolean}) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return <AccountActions.Provider value={{busy: busy || blocked, claim: () => {
    if (pending.current || blocked) return false;
    pending.current = true; setBusy(true); return true;
  }, release: () => { pending.current = false; if (mounted.current) setBusy(false); }}}>{children}</AccountActions.Provider>;
}
type ActionResult = {message:string; tone:"success" | "info" | "error"};
export async function accountRequest<T>(
  action: string,
  data?: unknown,
  publicForm = false,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (data !== undefined) {
    const csrf = await requestJson<{ csrfToken: string }>(
      "/api/auth/csrf?intent=" + (publicForm ? "login" : "session"),
      { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) },
    );
    headers["Content-Type"] = "application/json";
    headers["X-CSRF-Token"] = csrf.csrfToken;
  }
  return requestJson<T>("/api/auth/" + action, {
    method: data === undefined ? "GET" : "POST",
    headers,
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(action === "email-request" ? 40000 : 20000)]) : AbortSignal.timeout(action === "email-request" ? 40000 : 20000),
  });
}
export function endLocalSession() {
  try {
    const channel = new BroadcastChannel("sim-guru-auth");
    channel.postMessage("logout");
    channel.close();
  } catch {
    /* Tab ini tetap mengakhiri sesi bila BroadcastChannel tidak tersedia. */
  }
  window.location.replace("/login?status=updated");
}
export function Field({
  name,
  label,
  type = "text",
  value,
  required = true,
  maxLength = 128,
  autoComplete,
  minLength,
  pattern,
  inputMode,
  multiline = false,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string;
  required?: boolean;
  maxLength?: number;
  autoComplete?: string;
  minLength?: number;
  pattern?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  multiline?: boolean;
}) {
  const id = useId();
  return (
    <div className="block min-w-0 space-y-2 text-sm">
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      {multiline ? <textarea id={id} name={name} defaultValue={value} required={required} minLength={minLength} maxLength={maxLength} autoComplete={autoComplete ?? "off"} rows={3} className="min-h-24 w-full min-w-0 resize-y rounded-lg border bg-background px-3 py-2" /> : type === "password" ? (
        <PasswordInput
          id={id}
          name={name}
          defaultValue={value}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete ?? "current-password"}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          minLength={minLength}
          pattern={pattern}
          inputMode={inputMode}
          maxLength={maxLength}
          autoComplete={
            autoComplete ?? (type === "password" ? "current-password" : "off")
          }
          className="min-h-11 min-w-0 w-full rounded-lg border bg-background px-3 py-2"
        />
      )}
    </div>
  );
}
export function ActionForm({
  title,
  children,
  submitLabel = "Simpan",
  inline = false,
  onSubmit,
}: {
  title: string;
  children: ReactNode;
  submitLabel?: string;
  inline?: boolean;
  onSubmit: (
    data: Record<string, string>,
    form: HTMLFormElement,
  ) => Promise<string | ActionResult | void>;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [open, setOpen] = useState(false),
    [failed, setFailed] = useState(false);
  const group = useContext(AccountActions);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const pending = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || (group && !group.claim())) return;
    pending.current = true;
    const form = event.currentTarget;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const data = Object.fromEntries(new FormData(form)) as Record<
        string,
        string
      >;
      const result = (await onSubmit(data, form)) ?? "Tersimpan.";
      const notice = typeof result === "string" ? {message:result,tone:"success"} : result;
      if (mounted.current) {
        setMessage(notice.message);
        setFailed(notice.tone === "error");
        if (notice.tone === "success") setOpen(false);
      }
      if (notice.tone === "success") notifySuccess(notice.message);
    } catch (error) {
      if (!mounted.current) return;
      setFailed(true);
      const fields = serverFieldErrors(error);
      if (error instanceof ApiRequestError && error.code === "INVALID_CREDENTIALS" && form.elements.namedItem("currentPassword")) fields.currentPassword = "Kata sandi saat ini tidak sesuai. Periksa kembali isian ini.";
      applyFieldErrors(form, fields);
      setMessage(
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "Layanan belum dapat dihubungi. Coba kembali.",
      );
    } finally {
      pending.current = false;
      group?.release();
      if (mounted.current) setBusy(false);
    }
  }
  const content = (
    <form
      aria-busy={busy || group?.busy}
      className="ui-panel min-w-0 space-y-4 [overflow-wrap:anywhere]"
      onSubmit={(event) => void submit(event)}
    >
      <h3 className="text-lg font-semibold">{title}</h3>
      <fieldset disabled={busy || group?.busy} className="min-w-0 space-y-4">
        {children}
        <Button className="w-full sm:w-auto" type="submit" disabled={busy || group?.busy}>
          <ActionIcon action="submit" />
          {busy ? "Memproses…" : submitLabel}
        </Button>
      </fieldset>
      {message &&
        (failed ? (
          <ErrorFeedback message={message} />
        ) : (
          <p
            role="status"
            className="rounded-lg border bg-muted p-3 text-sm leading-6"
          >
            {message}
          </p>
        ))}
    </form>
  );
  if (inline || (title !== "Ganti kata sandi" && title !== "Ubah profil"))
    return content;
  return (
    <FormDialog
      title={title}
      busy={busy}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setMessage("");
          setFailed(false);
        }
      }}
    >
      {content}
    </FormDialog>
  );
}
export const PasswordHelp = () => (
  <p className="text-sm leading-7 text-muted-foreground">
    Gunakan 8–128 karakter dengan huruf besar, huruf kecil, angka dan simbol,
    berbeda dari kata sandi lama, serta tidak mengandung username atau bagian
    nama lebih dari dua huruf.
  </p>
);
export function AccountLifecycle({
  isAdmin,
  onboarding,
  onProfileChange,
}: {
  isAdmin: boolean;
  onboarding: boolean;
  onProfileChange?: (profile:ProfileDto)=>void;
}) {
  const [profile, setProfile] = useState<ProfileDto | null>(null),
    [error, setError] = useState(""),
    [challenge, setChallenge] = useState<{id:string;email:string} | null>(null),
    [revision, setRevision] = useState(0),
    [notice, setNotice] = useState(""),
    [actionBusy, setActionBusy] = useState(false),
    [profileLoading, setProfileLoading] = useState(true);
  const profileRead = useRef(0);
  const actionPending = useRef(false);
  const accountMounted = useRef(false);
  const claim = useCallback(() => {
    if (actionPending.current || error || profileLoading) return false;
    actionPending.current = true; setActionBusy(true); return true;
  }, [error, profileLoading]);
  const release = useCallback(() => { actionPending.current = false; if (accountMounted.current) setActionBusy(false); }, []);
  const refreshProfile = useCallback(async (signal?:AbortSignal) => {
    const readId = ++profileRead.current;
    try {
      const next = profileDtoSchema.safeParse(await accountRequest<unknown>("profile", undefined, false, signal));
      if (!next.success) throw new Error("Data profil belum sesuai. Muat ulang atau hubungi administrator.");
      if (accountMounted.current && !signal?.aborted && readId === profileRead.current) { setProfile(next.data); setError(""); onProfileChange?.(next.data); }
    } finally {
      if (accountMounted.current && !signal?.aborted && readId === profileRead.current) setProfileLoading(false);
    }
  }, [onProfileChange]);
  async function refreshAfterSave(message:string) {
    if (!accountMounted.current) return;
    setNotice(message);
    setProfileLoading(true);
    try { await refreshProfile(); }
    catch(e) { if (accountMounted.current) setError("Perubahan sudah tersimpan, tetapi profil terbaru belum dapat dimuat. Jangan kirim ulang perubahan. " + (e instanceof Error ? e.message : "Coba muat ulang profil.")); }
  }
  useEffect(() => {
    accountMounted.current = true;
    const controller = new AbortController();
    void refreshProfile(controller.signal).catch(e => {
      if (!controller.signal.aborted && accountMounted.current) setError(e instanceof Error ? e.message : "Profil belum dapat dimuat. Coba muat ulang.");
    });
    return () => { accountMounted.current = false; controller.abort(); };
  }, [revision, refreshProfile]);
  if (!profile)
    return (
      <FeatureState
        headingLevel={2}
        error={error}
        label="Memuat pengamanan akun…"
        retry={() => {
          setError("");
          setProfileLoading(true);
          setRevision((v) => v + 1);
        }}
      />
    );
  return (
    <AccountActions.Provider value={{busy:actionBusy || profileLoading || Boolean(error),claim,release}}>
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      {profileLoading && <p role="status" className="text-sm text-muted-foreground">Memuat ulang profil…</p>}
      {notice && <p role="status" className="rounded-xl border bg-accent/40 p-4 text-sm">{notice}</p>}
      {error && <div className="space-y-3"><ErrorFeedback message={error} /><Button variant="outline" disabled={actionBusy || profileLoading} onClick={() => {setError("");setProfileLoading(true);setRevision(v=>v+1);}}><ActionIcon action="refresh" />Muat ulang profil</Button></div>}
      <section aria-label="Ringkasan profil" className="min-w-0 rounded-2xl border bg-accent/40 p-4 sm:p-5">
        <h2 className="text-lg font-semibold">{profile.fullName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Username: {profile.username}</p>
        <dl className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 [&>div]:min-w-0">
          <div><dt className="flex items-center gap-2 text-sm font-semibold"><MailCheck aria-hidden="true" className="size-4 shrink-0" />Email</dt><dd className="mt-1 text-sm">{profile.email || "Belum diisi"} · {profile.emailVerified ? "Terverifikasi" : "Belum terverifikasi"}</dd></div>
          <div><dt className="flex items-center gap-2 text-sm font-semibold"><ShieldQuestion aria-hidden="true" className="size-4 shrink-0" />Pertanyaan keamanan</dt><dd className="mt-1 text-sm">{profile.question ? "Sudah diatur" : "Belum diatur"}</dd></div>
        </dl>
      </section>
      <h2 className="text-xl font-semibold">Profil dan pengamanan akun</h2>
      <Tabs
        label="Pengaturan akun dan profil"
        defaultValue={onboarding ? "password" : "profile"}
        items={[
          {
            value: "profile",
            label: "Ubah Profil",
            icon: <UserRound aria-hidden="true" />,
            content: (
              <ActionForm
                key={profile.version}
                inline
                title="Ubah profil"
                submitLabel="Simpan perubahan profil"
                onSubmit={async (data, form) => {
                  await accountRequest("profile", validateAccount(profileSchema, {...data, version:profile.version}));
                  (
                    form.elements.namedItem(
                      "currentPassword",
                    ) as HTMLInputElement
                  ).value = "";
                  await refreshAfterSave("Profil berhasil diperbarui.");
                  return "Profil berhasil diperbarui.";
                }}
              >
                <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <Field
                  name="username"
                  label="Username"
                  autoComplete="username"
                  value={profile.username}
                  maxLength={64}
                />
                <Field
                  name="fullName"
                  label="Nama lengkap"
                  autoComplete="name"
                  value={profile.fullName}
                  maxLength={200}
                />
                <Field
                  name="nip"
                  label="NIP (opsional)"
                  value={profile.nip}
                  required={false}
                  maxLength={64}
                />
                <Field
                  name="phone"
                  label="Nomor telepon (opsional)"
                  autoComplete="tel"
                  type="tel"
                  value={profile.phone}
                  required={false}
                  maxLength={25}
                />
                <Field
                  name="address"
                  label="Alamat (opsional)"
                  multiline
                  autoComplete="street-address"
                  value={profile.address}
                  required={false}
                  maxLength={500}
                />
                <Field
                  name="photoUrl"
                  label="URL foto HTTPS (opsional)"
                  type="url"
                  value={profile.photoUrl}
                  required={false}
                  maxLength={2048}
                />
                <Field
                  name="currentPassword"
                  label="Konfirmasi kata sandi saat ini"
                  type="password"
                />
                </div>
              </ActionForm>
            ),
          },
          {
            value: "password",
            label: "Ganti Kata Sandi",
            icon: <KeyRound aria-hidden="true" />,
            content: (
              <ActionForm
                inline
                title="Ganti kata sandi"
                submitLabel="Simpan kata sandi baru"
                onSubmit={async (data, form) => {
                  await accountRequest("change-password", validateAccount(changePasswordSchema, data));
                  form.reset();
                  endLocalSession();
                }}
              >
                <PasswordHelp />
                <Field
                  name="currentPassword"
                  label="Kata sandi saat ini"
                  type="password"
                />
                <Field
                  name="newPassword"
                  label="Kata sandi baru"
                  type="password"
                  autoComplete="new-password"
                />
                <Field
                  name="confirmation"
                  label="Ulangi kata sandi baru"
                  type="password"
                  autoComplete="new-password"
                />
                <p className="text-sm">
                  Setelah berhasil, seluruh sesi diakhiri. Silakan masuk
                  kembali.
                </p>
              </ActionForm>
            ),
          },
          {
            value: "email",
            label: "Verifikasi Email",
            icon: <MailCheck aria-hidden="true" />,
            content: (
              <>
                <ActionForm
                  title="Verifikasi email"
                  submitLabel="Kirim kode OTP"
                  onSubmit={async (data, form) => {
                    const result = emailDispatchSchema.safeParse(await accountRequest<unknown>("email-request", validateAccount(emailRequestSchema, data)));
                    if (!result.success) { setChallenge(null); throw new Error("Status permintaan OTP belum dapat dipastikan. Tunggu 60 detik lalu minta kode baru; gunakan kode dari permintaan terbaru."); }
                    const dispatch = result.data;
                    (
                      form.elements.namedItem(
                        "currentPassword",
                      ) as HTMLInputElement
                    ).value = "";
                    if (dispatch.queued) setChallenge({id:dispatch.challengeId,email:data.email!.toLowerCase()});
                    if (!dispatch.queued)
                      return {tone:"info", message:"Tunggu setidaknya 60 detik sebelum meminta kode lagi."};
                    if (dispatch.delivery === "accepted")
                      return "Permintaan pengiriman kode diterima layanan email. Periksa kotak masuk dan folder Spam. Kode berlaku 10 menit.";
                    if (dispatch.delivery === "failed")
                      return {tone:"error", message:"Kode belum berhasil dikirim. Hubungi administrator, lalu minta kode baru."};
                    return {tone:"info",message:"Kode tersimpan, tetapi pengiriman belum terkonfirmasi. Tunggu 60 detik lalu minta kode baru; gunakan kode dari permintaan terbaru."};
                  }}
                >
                  <p className="text-sm leading-7">
                    Email: {profile.email || "belum diisi"} (
                    {profile.emailVerified
                      ? "terverifikasi"
                      : "belum terverifikasi"}
                    ). Email lama tetap berlaku sampai OTP alamat baru terbukti.
                    Setelah verifikasi, Anda diminta masuk kembali.
                  </p>
                  <Field
                    name="email"
                    label="Alamat email milik Anda"
                    type="email"
                    value={profile.email}
                    maxLength={254}
                  />
                  <Field
                    name="currentPassword"
                    label="Kata sandi saat ini"
                    type="password"
                  />
                </ActionForm>
                {challenge && (
                  <ActionForm
                    key={challenge.id}
                    title="Masukkan kode verifikasi email"
                    submitLabel="Verifikasi kode"
                    onSubmit={async (data) => {
                      await accountRequest("email-verify", validateAccount(verifyOtpSchema, {challengeId:challenge.id,otp:data.otp}));
                      endLocalSession();
                    }}
                  >
                    <p className="text-sm [overflow-wrap:anywhere]">Kode ini ditujukan ke <strong>{challenge.email}</strong>. Mengubah isian email di atas tidak mengubah tujuan kode yang sudah dikirim.</p>
                    <Field
                      name="otp"
                      label="Kode OTP enam digit"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      autoComplete="one-time-code"
                      minLength={6}
                      maxLength={6}
                    />
                    <p className="text-sm">
                      Maksimal lima percobaan. Jika halaman dimuat ulang, minta
                      kode baru setelah 60 detik.
                    </p>
                  </ActionForm>
                )}
              </>
            ),
          },
          {
            value: "security",
            label: "Pertanyaan Keamanan",
            icon: <ShieldQuestion aria-hidden="true" />,
            content: (
              <ActionForm
                title="Pertanyaan keamanan"
                submitLabel="Simpan pertanyaan keamanan"
                onSubmit={async (data, form) => {
                  await accountRequest("security-question", validateAccount(questionSchema, data));
                  form.reset();
                  await refreshAfterSave("Pertanyaan keamanan berhasil diperbarui.");
                  return "Pertanyaan keamanan berhasil diperbarui. Pemulihan akun tetap memerlukan OTP email atau verifikasi administrator.";
                }}
              >
                <p className="text-sm">
                  Pertanyaan saat ini: {profile.question || "belum diatur"}.
                </p>
                <Field
                  name="question"
                  label="Pertanyaan yang jawabannya hanya Anda ketahui"
                  maxLength={300}
                />
                <Field
                  name="answer"
                  label="Jawaban keamanan"
                  type="password"
                  autoComplete="new-password"
                />
                <Field
                  name="currentPassword"
                  label="Kata sandi saat ini"
                  type="password"
                />
              </ActionForm>
            ),
          },
        ]}
      />
      {onboarding && (
        <ActionForm
          title="Selesaikan pengamanan akun"
          submitLabel="Selesaikan dan lanjutkan"
          onSubmit={async () => {
            await accountRequest("complete-onboarding", {});
            window.location.replace("/dashboard");
          }}
        >
          <p className="text-sm leading-7">
            Pastikan kata sandi permanen, email terverifikasi dan pertanyaan
            keamanan sudah lengkap. Sesi baru akan diterbitkan; sesi onboarding
            lama diakhiri.
          </p>
        </ActionForm>
      )}
      {isAdmin && (
        <p>
          <Link prefetch={false} href="/admin/pemulihan" className="underline">
            Tinjau permintaan pemulihan akun
          </Link>
        </p>
      )}
    </div>
    </AccountActions.Provider>
  );
}
