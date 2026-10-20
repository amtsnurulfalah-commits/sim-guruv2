"use client";
import Link from "next/link";
import {
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
import type { ApiResult } from "@/types/api";
import type { ProfileDto } from "@/lib/accounts/schemas";
export async function accountRequest<T>(
  action: string,
  data?: unknown,
  publicForm = false,
): Promise<T> {
  let headers: Record<string, string> = {};
  if (data !== undefined) {
    const c = await fetch(
        "/api/auth/csrf?intent=" + (publicForm ? "login" : "session"),
        { cache: "no-store", signal: AbortSignal.timeout(15000) },
      ),
      csrf: ApiResult<{ csrfToken: string }> = await c.json();
    if (!csrf.ok) throw new Error(csrf.error.message);
    headers = {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf.data.csrfToken,
    };
  }
  const res = await fetch("/api/auth/" + action, {
      method: data === undefined ? "GET" : "POST",
      headers,
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      cache: "no-store",
      signal: AbortSignal.timeout(action === "email-request" ? 40000 : 20000),
    }),
    body: ApiResult<T> = await res.json();
  if (!body.ok) throw new Error(body.error.message);
  return body.data;
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
}: {
  name: string;
  label: string;
  type?: string;
  value?: string;
  required?: boolean;
  maxLength?: number;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <div className="block min-w-0 space-y-2 text-sm">
      <label htmlFor={id} className="block">
        {label}
      </label>
      {type === "password" ? (
        <PasswordInput
          id={id}
          name={name}
          defaultValue={value}
          required={required}
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
          maxLength={maxLength}
          autoComplete={
            autoComplete ?? (type === "password" ? "current-password" : "off")
          }
          className="h-11 w-full rounded-lg border bg-background px-3"
        />
      )}
    </div>
  );
}
export function ActionForm({
  title,
  children,
  submitLabel = "Simpan",
  onSubmit,
}: {
  title: string;
  children: ReactNode;
  submitLabel?: string;
  onSubmit: (
    data: Record<string, string>,
    form: HTMLFormElement,
  ) => Promise<string | void>;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [open, setOpen] = useState(false),
    [failed, setFailed] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
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
      setMessage(result);
      setOpen(false);
      notifySuccess(result);
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "Layanan belum dapat dihubungi. Coba kembali.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const content = (
    <form
      aria-busy={busy}
      className="ui-panel space-y-4"
      onSubmit={(event) => void submit(event)}
    >
      <h3 className="text-lg font-semibold">{title}</h3>
      <fieldset disabled={busy} className="space-y-4">
        {children}
        <Button type="submit" disabled={busy}>
          {busy ? "Memproses…" : submitLabel}
        </Button>
      </fieldset>
      {message && (
        <p
          role={failed ? "alert" : "status"}
          aria-live="polite"
          className="text-sm leading-7"
        >
          {message}
        </p>
      )}
    </form>
  );
  if (title !== "Ganti kata sandi" && title !== "Ubah profil") return content;
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
}: {
  isAdmin: boolean;
  onboarding: boolean;
}) {
  const [profile, setProfile] = useState<ProfileDto | null>(null),
    [error, setError] = useState(""),
    [challenge, setChallenge] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    accountRequest<ProfileDto>("profile")
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch(() => {
        if (active) setError("Profil belum dapat dimuat. Coba muat ulang.");
      });
    return () => {
      active = false;
    };
  }, [revision]);
  if (!profile)
    return <p role="status">{error || "Memuat pengamanan akun…"}</p>;
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Profil dan pengamanan akun</h2>
      <ActionForm
        title="Ganti kata sandi"
        onSubmit={async (data, form) => {
          await accountRequest("change-password", data);
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
          Setelah berhasil, seluruh sesi diakhiri. Silakan masuk kembali.
        </p>
      </ActionForm>
      <ActionForm
        title="Verifikasi email"
        submitLabel="Kirim kode OTP"
        onSubmit={async (data, form) => {
          const result = await accountRequest<{
            queued: boolean;
            challengeId?: string;
            delivery?: "accepted" | "pending" | "failed" | "unknown";
          }>("email-request", data);
          (
            form.elements.namedItem("currentPassword") as HTMLInputElement
          ).value = "";
          if (result.challengeId) setChallenge(result.challengeId);
          if (!result.queued)
            return "Tunggu setidaknya 60 detik sebelum meminta kode lagi.";
          if (result.delivery === "accepted")
            return "Permintaan pengiriman kode diterima layanan email. Periksa kotak masuk dan folder Spam. Kode berlaku 10 menit.";
          if (result.delivery === "failed")
            return "Kode belum berhasil dikirim. Hubungi administrator, lalu minta kode baru.";
          return "Kode tersimpan, tetapi pengiriman belum terkonfirmasi. Tunggu 60 detik lalu minta kode baru; gunakan kode dari permintaan terbaru.";
        }}
      >
        <p className="text-sm leading-7">
          Email: {profile.email || "belum diisi"} (
          {profile.emailVerified ? "terverifikasi" : "belum terverifikasi"}).
          Email lama tetap berlaku sampai OTP alamat baru terbukti. Setelah
          verifikasi, Anda diminta masuk kembali.
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
          title="Masukkan kode verifikasi email"
          submitLabel="Verifikasi kode"
          onSubmit={async (data) => {
            await accountRequest("email-verify", {
              challengeId: challenge,
              otp: data.otp,
            });
            endLocalSession();
          }}
        >
          <Field name="otp" label="Kode OTP enam digit" maxLength={6} />
          <p className="text-sm">
            Maksimal lima percobaan. Jika halaman dimuat ulang, minta kode baru
            setelah 60 detik.
          </p>
        </ActionForm>
      )}
      <ActionForm
        title="Pertanyaan keamanan tambahan"
        onSubmit={async (data, form) => {
          await accountRequest("security-question", data);
          form.reset();
          setRevision((v) => v + 1);
          return "Pertanyaan dan hash jawaban tersimpan. Jawaban tetap memerlukan OTP email atau verifikasi admin untuk pemulihan.";
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
      <ActionForm
        key={profile.version}
        title="Ubah profil"
        onSubmit={async (data, form) => {
          await accountRequest("profile", {
            ...data,
            version: profile.version,
          });
          (
            form.elements.namedItem("currentPassword") as HTMLInputElement
          ).value = "";
          setRevision((v) => v + 1);
          return "Profil berhasil diperbarui.";
        }}
      >
        <Field
          name="username"
          label="Username"
          value={profile.username}
          maxLength={64}
        />
        <Field
          name="fullName"
          label="Nama lengkap"
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
          type="tel"
          value={profile.phone}
          required={false}
          maxLength={25}
        />
        <Field
          name="address"
          label="Alamat (opsional)"
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
      </ActionForm>
      {isAdmin && (
        <p>
          <Link href="/admin/pemulihan" className="underline">
            Tinjau permintaan pemulihan akun
          </Link>
        </p>
      )}
    </div>
  );
}
