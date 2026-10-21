"use client";
import { useEffect, useState } from "react";
import {
  accountRequest,
  AccountActionScope,
  ActionForm,
  Field,
  PasswordHelp,
} from "./account-lifecycle";
import { forgotSchema, verifyOtpSchema, resetSchema, activationSchema, recoveryAcceptedSchema, resetProofSchema } from "@/lib/accounts/schemas";
import { validateAccount } from "@/lib/accounts/client-validation";
import { ApiRequestError } from "@/lib/feedback/api-error";
export function RecoveryForm() {
  const [method, setMethod] = useState("email");
  const [identity, setIdentity] = useState("");
  const [otpChallenge, setOtpChallenge] = useState(""),
    [reset, setReset] = useState<{ challengeId: string; token: string } | null>(
      null,
    ),
    [nextRequest, setNextRequest] = useState(0);
  return (
    <AccountActionScope><div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <ol aria-label="Tahap pemulihan" className="grid grid-cols-3 gap-2 text-xs leading-5">
        {["Ajukan", "Verifikasi", "Kata sandi baru"].map((label,index) => <li key={label} aria-current={(reset ? 2 : otpChallenge ? 1 : 0) === index ? "step" : undefined} className="rounded-lg border p-2 aria-[current=step]:border-primary aria-[current=step]:bg-primary/5 aria-[current=step]:font-semibold">{index+1}. {label}</li>)}
      </ol>
      <p className="text-sm leading-7">
        Tidak ada pendaftaran publik. Pemulihan melalui email hanya berlaku
        untuk alamat yang sudah terverifikasi. Jika email tidak dapat diakses,
        ajukan verifikasi identitas kepada administrator madrasah.
      </p>
      <ActionForm
        title="Ajukan pemulihan"
        submitLabel="Ajukan"
        onSubmit={async (data) => {
          if (Date.now() < nextRequest)
            return {message:`Tunggu ${Math.max(1, Math.ceil((nextRequest - Date.now()) / 1000))} detik sebelum meminta kembali.`,tone:"info"};
          const payload = validateAccount(forgotSchema, {...data, method, answer:method === "security" ? data.answer : undefined});
          if (method === "security" && !payload.answer?.trim()) throw new ApiRequestError("VALIDATION_ERROR", "Isi jawaban keamanan untuk metode ini.",422,{answer:["Jawaban keamanan wajib diisi."]});
          const raw = await accountRequest<unknown>("forgot-password",payload,true);
          setNextRequest(Date.now() + 60000);
          const parsed = recoveryAcceptedSchema.safeParse(raw);
          if (!parsed.success) throw new ApiRequestError("INVALID_RESPONSE", "Status permintaan belum dapat dipastikan. Tunggu 60 detik sebelum mencoba kembali.");
          const result = parsed.data;
          setIdentity(payload.username);
          setReset(null);
          setOtpChallenge(data.method === "email" ? result.challengeId : "");
          return {message:"Jika data memenuhi syarat, permintaan akan diproses melalui email terverifikasi atau pemeriksaan admin. Jawaban keamanan saja tidak mengizinkan reset kata sandi.",tone:"info"};
        }}
      >
        <Field name="username" label="Username" minLength={3} maxLength={64} autoComplete="username" />
        <label className="block space-y-2 text-sm">
          <span>Metode pemulihan</span>
          <select
            name="method"
            value={method}
            onChange={event => setMethod(event.target.value)}
            className="h-11 w-full rounded-lg border bg-background px-3"
          >
            <option value="email">OTP email terverifikasi</option>
            <option value="admin">Verifikasi identitas oleh admin</option>
            <option value="security">
              Jawaban keamanan, dilanjutkan verifikasi admin
            </option>
          </select>
        </label>
        {method === "security" && <Field
          name="answer"
          label="Jawaban keamanan"
          type="password"
          autoComplete="off"
        />}
        <Field
          name="reason"
          label="Keterangan permintaan (opsional, minimal 5 karakter)"
          required={false}
          maxLength={500}
          minLength={5}
          multiline
        />
      </ActionForm>
      {otpChallenge && !reset && (
        <ActionForm
          key={otpChallenge}
          title="Verifikasi OTP pemulihan"
          submitLabel="Verifikasi kode"
          onSubmit={async (data) => {
            const payload = validateAccount(verifyOtpSchema,{challengeId:otpChallenge,otp:data.otp});
            const raw = await accountRequest<unknown>("reset-otp",payload,true);
            const parsed = resetProofSchema.safeParse(raw);
            if (!parsed.success) throw new ApiRequestError("INVALID_RESPONSE", "Bukti pemulihan belum dapat dibaca. Ajukan kembali pemulihan setelah masa tunggu.");
            const result = parsed.data;
            setReset(result);
            return "Kode terbukti. Atur kata sandi baru dalam lima menit.";
          }}
        >
          <p className="text-sm">Pemulihan untuk username: <strong>{identity}</strong></p>
          <Field name="otp" label="Kode OTP enam digit" minLength={6} maxLength={6} pattern="[0-9]{6}" inputMode="numeric" autoComplete="one-time-code" />
          <p className="text-sm">
            Kode berlaku sepuluh menit, maksimal lima percobaan. Jangan bagikan
            kode Anda.
          </p>
        </ActionForm>
      )}
      {reset && (
        <ActionForm
          key={reset.challengeId}
          title="Atur kata sandi baru"
          submitLabel="Reset kata sandi"
          onSubmit={async (data, form) => {
            await accountRequest("reset-password", validateAccount(resetSchema,{ ...reset, ...data }), true);
            form.reset();
            setReset(null);
            setOtpChallenge("");
            window.location.replace("/login?status=updated");
          }}
        >
          <PasswordHelp />
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
            Semua sesi lama akan diakhiri. Memuat ulang halaman menghapus proses
            reset ini.
          </p>
        </ActionForm>
      )}
    </div></AccountActionScope>
  );
}
export function ActivationForm() {
  const [link, setLink] = useState<{
      challengeId: string;
      token: string;
    } | null>(null),
    [message, setMessage] = useState("Memeriksa tautan aktivasi…");
  useEffect(() => {
    let active = true;
    async function load() {
      await Promise.resolve();
      if (!active) return;
      const p = new URLSearchParams(window.location.hash.slice(1));
      const challengeId = p.get("challengeId"),
        token = p.get("token");
      window.history.replaceState(null, "", window.location.pathname);
      if (!active) return;
      if (resetProofSchema.safeParse({challengeId,token}).success) setLink({ challengeId:challengeId!, token:token! });
      else
        setMessage(
          "Tautan tidak lengkap. Gunakan tautan aktivasi dari email atau hubungi administrator.",
        );
    }
    void load();
    return () => {
      active = false;
    };
  }, []);
  return link ? (
    <ActionForm
      title="Aktifkan akun"
      submitLabel="Aktivasi dan simpan kata sandi"
      onSubmit={async (data, form) => {
        await accountRequest("activation", validateAccount(activationSchema,{ ...link, ...data }), true);
        form.reset();
        setLink(null);
        window.location.replace("/login?status=activated");
      }}
    >
      <PasswordHelp />
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
        Tautan hanya berlaku sekali selama 24 jam. Setelah aktivasi, masuk dan
        selesaikan pertanyaan keamanan.
      </p>
    </ActionForm>
  ) : (
    <p role="status">{message}</p>
  );
}
