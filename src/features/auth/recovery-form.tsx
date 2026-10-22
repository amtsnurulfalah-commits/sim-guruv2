"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorFeedback } from "@/components/feedback/error-feedback";
import { accountRequest, AccountActionScope, ActionForm, Field, PasswordHelp } from "./account-lifecycle";
import { forgotSchema, verifyOtpSchema, resetSchema, activationSchema, recoveryAcceptedSchema, resetProofSchema, recoveryCompletedSchema } from "@/lib/accounts/schemas";
import { validateAccount } from "@/lib/accounts/client-validation";
import { ApiRequestError } from "@/lib/feedback/api-error";
const uncertain = (error: unknown) => error instanceof ApiRequestError && error.code !== "FORM_NOT_READY" &&
  (["NETWORK_ERROR", "TIMEOUT", "INVALID_RESPONSE"].includes(error.code) || error.status >= 500);
const reference = (error: unknown) => error instanceof ApiRequestError && error.requestId ? `\nReferensi bantuan: ${error.requestId}` : "";
const formStyle = "rounded-none border-0 border-b bg-transparent p-0 pb-5 shadow-none";
export function RecoveryForm() {
  const [method, setMethod] = useState("email");
  const [identity, setIdentity] = useState("");
  const [otpChallenge, setOtpChallenge] = useState("");
  const [reset, setReset] = useState<{ challengeId: string; token: string } | null>(null);
  const [nextRequest, setNextRequest] = useState(0);
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);
  const [flowError, setFlowError] = useState("");
  const [outcome, setOutcome] = useState<"success" | "uncertain" | null>(null);
  const mounted = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const remaining = Math.max(0, Math.ceil((nextRequest - now) / 1000));
  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(() => { if (mounted.current) { setReady(true); setNow(Date.now()); } });
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!nextRequest) return;
    const timer = window.setInterval(() => {
      const timestamp = Date.now(); setNow(timestamp);
      if (timestamp >= nextRequest) { window.clearInterval(timer); setNextRequest(0); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [nextRequest]);
  useEffect(() => {
    const name = reset ? "newPassword" : otpChallenge ? "otp" : null;
    if (!name) return;
    const frame = requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [reset, otpChallenge]);
  function restart() {
    setReset(null); setOtpChallenge(""); setIdentity(""); setFlowError(""); setOutcome(null);
    requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>('input[name="username"]')?.focus());
  }
  function waitBeforeRequest(seconds = 60) { const timestamp = Date.now(); setNow(timestamp); setNextRequest(timestamp + seconds * 1000); }
  function unavailableProof(error: unknown, summary: string) { setReset(null); setOtpChallenge(""); setFlowError(summary + reference(error)); }
  const restartButton = <Button type="button" variant="outline" className="w-full sm:mr-3 sm:w-auto" onClick={restart}>Mulai ulang pemulihan</Button>;
  return <AccountActionScope blocked={!ready || outcome === "success"}><div ref={root} className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
    <h2 className="sr-only">Langkah pemulihan akun</h2>
    <ol role="list" aria-label="Tahap pemulihan" className="grid grid-cols-1 gap-2 text-xs leading-5 min-[375px]:grid-cols-3">
      {["Ajukan", "Verifikasi", "Kata sandi baru"].map((label, index) => <li key={label} aria-current={(reset || outcome ? 2 : otpChallenge ? 1 : 0) === index ? "step" : undefined} className="rounded-lg border p-2 aria-[current=step]:border-primary aria-[current=step]:bg-primary/5 aria-[current=step]:font-semibold">{index + 1}. {label}</li>)}
    </ol>
    <noscript><p role="alert">Aktifkan JavaScript lalu muat ulang halaman untuk memulihkan akun dengan aman.</p></noscript>
    <p className="text-sm leading-7">Gunakan username akun madrasah. OTP hanya dikirim jika akun memenuhi syarat dan memiliki email terverifikasi. Jika email tidak dapat diakses, pilih verifikasi identitas oleh administrator. Tidak ada pendaftaran publik.</p>
    {flowError && <ErrorFeedback message={flowError} autoFocus />}
    {outcome ? <section aria-label="Hasil pemulihan" className="space-y-4 rounded-lg border p-4">
      {outcome === "success" && <p role="status">Kata sandi berhasil diperbarui. Mengalihkan ke halaman masuk…</p>}
      <Link href={outcome === "success" ? "/login?status=updated" : "/login"} className="ui-text-link rounded-md underline">Ke halaman masuk</Link>
      {outcome === "uncertain" && restartButton}
    </section> : <>
      <details open={!reset} className="min-w-0 space-y-4">
        <summary className="min-h-11 cursor-pointer rounded-lg bg-muted/50 px-3 py-2 text-sm font-semibold">Identitas dan metode pemulihan{reset ? ` · ${identity}` : ""}</summary>
        <ActionForm className={formStyle} title="Ajukan pemulihan" submitLabel="Ajukan" disabled={Boolean(reset)} onSubmit={async (data, form, signal) => {
          if (Date.now() < nextRequest) return { message: `Tunggu ${Math.max(1, Math.ceil((nextRequest - Date.now()) / 1000))} detik sebelum meminta kembali.`, tone: "info" };
          const payload = validateAccount(forgotSchema, { ...data, method, answer: method === "security" ? data.answer : undefined });
          if (method === "security" && !payload.answer?.trim()) throw new ApiRequestError("VALIDATION_ERROR", "Isi jawaban keamanan untuk metode ini.", 422, { answer: ["Jawaban keamanan wajib diisi."] });
          setOtpChallenge(""); setReset(null); setFlowError("");
          let raw: unknown;
          try { raw = await accountRequest<unknown>("forgot-password", payload, true, signal); }
          catch (error) {
            if (!mounted.current || signal.aborted) throw error;
            if (uncertain(error)) {
              waitBeforeRequest();
              throw new ApiRequestError("INVALID_RESPONSE", "Status permintaan belum dapat dipastikan. Tunggu 60 detik sebelum meminta pemulihan baru.", 0, {}, error instanceof ApiRequestError ? error.requestId : undefined);
            }
            if (error instanceof ApiRequestError && error.code === "RATE_LIMITED") waitBeforeRequest(error.retryAfter ?? 60);
            throw error;
          }
          if (!mounted.current || signal.aborted) return { message: "Permintaan selesai.", tone: "info" };
          waitBeforeRequest();
          const parsed = recoveryAcceptedSchema.safeParse(raw);
          if (!parsed.success) throw new ApiRequestError("INVALID_RESPONSE", "Status permintaan belum dapat dipastikan. Tunggu 60 detik sebelum mencoba kembali.");
          setIdentity(payload.username); setOtpChallenge(payload.method === "email" ? parsed.data.challengeId : "");
          form.reset();
          for (const [name, value] of Object.entries({ username: payload.username, method: payload.method, reason: data.reason ?? "" })) {
            const field = form.elements.namedItem(name);
            if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) field.value = value;
          }
          return { message: payload.method === "email" ? "Jika akun memenuhi syarat, kode dikirim melalui email terverifikasi. Periksa kotak masuk dan Spam. Gunakan kode dari permintaan terbaru." : "Jika data memenuhi syarat, permintaan akan diproses melalui pemeriksaan identitas oleh administrator. Jawaban keamanan saja tidak mengizinkan reset kata sandi.", tone: "info" };
        }}>
          <Field name="username" label="Username" minLength={3} maxLength={64} autoComplete="username" />
          <label className="block min-w-0 space-y-2 text-sm"><span>Metode pemulihan</span><select name="method" value={method} onChange={event => setMethod(event.target.value)} className="min-h-11 w-full min-w-0 max-w-full rounded-lg border bg-background px-3 py-2">
            <option value="email">OTP email terverifikasi</option><option value="admin">Verifikasi identitas oleh admin</option><option value="security">Jawaban keamanan + verifikasi admin</option>
          </select></label>
          {method === "security" && <Field name="answer" label="Jawaban keamanan" type="password" autoComplete="off" />}
          <Field name="reason" label="Keterangan permintaan (opsional, minimal 5 karakter)" required={false} maxLength={500} minLength={5} multiline />
          {remaining > 0 && <p className="text-sm text-muted-foreground">Permintaan baru dapat diajukan dalam {remaining} detik.</p>}
          {reset && <p className="text-sm">Selesaikan kata sandi baru atau pilih Mulai ulang pemulihan untuk mengganti akun.</p>}
        </ActionForm>
      </details>
      {otpChallenge && !reset && <ActionForm key={otpChallenge} className={formStyle} title="Verifikasi OTP pemulihan" submitLabel="Verifikasi kode" onSubmit={async (data, _form, signal) => {
        const payload = validateAccount(verifyOtpSchema, { challengeId: otpChallenge, otp: data.otp });
        try {
          const raw = await accountRequest<unknown>("reset-otp", payload, true, signal);
          if (!mounted.current || signal.aborted) return { message: "Permintaan selesai.", tone: "info" };
          const parsed = resetProofSchema.safeParse(raw);
          if (!parsed.success) throw new ApiRequestError("INVALID_RESPONSE", "Bukti pemulihan belum dapat dibaca.");
          setReset(parsed.data);
          return { message: "Kode terbukti. Atur kata sandi baru dalam lima menit.", tone: "info" };
        } catch (error) {
          if (mounted.current && !signal.aborted && uncertain(error)) unavailableProof(error, "Status verifikasi belum dapat dipastikan. Jangan gunakan kembali OTP ini; ajukan pemulihan baru setelah masa tunggu.");
          throw error;
        }
      }}>
        <p className="text-sm">Pemulihan untuk username: <strong>{identity}</strong>. Mengubah isian di atas tidak mengubah pemilik kode ini.</p>
        <Field name="otp" label="Kode OTP enam digit" minLength={6} maxLength={6} pattern="[0-9]{6}" inputMode="numeric" autoComplete="one-time-code" />
        <p className="text-sm">Kode berlaku sepuluh menit, maksimal lima percobaan. Jangan bagikan kode Anda.</p>{restartButton}
      </ActionForm>}
      {reset && <ActionForm key={reset.challengeId} className={formStyle} title="Atur kata sandi baru" submitLabel="Reset kata sandi" onSubmit={async (data, form, signal) => {
        const payload = validateAccount(resetSchema, { ...reset, ...data });
        try {
          const raw = await accountRequest<unknown>("reset-password", payload, true, signal);
          if (!mounted.current || signal.aborted) return { message: "Permintaan selesai.", tone: "info" };
          if (!recoveryCompletedSchema.safeParse(raw).success) throw new ApiRequestError("INVALID_RESPONSE", "Status perubahan belum dapat dipastikan.");
          form.reset(); setReset(null); setOtpChallenge(""); setOutcome("success");
          window.location.replace("/login?status=updated");
          return { message: "Kata sandi berhasil diperbarui.", tone: "info" };
        } catch (error) {
          if (!mounted.current || signal.aborted) throw error;
          if (uncertain(error)) {
            unavailableProof(error, "Status perubahan kata sandi belum dapat dipastikan. Coba masuk dengan kata sandi baru. Jika belum berhasil, mulai pemulihan baru."); setOutcome("uncertain");
          } else if (error instanceof ApiRequestError && error.code === "CHALLENGE_INVALID") unavailableProof(error, "Bukti pemulihan tidak berlaku, sudah digunakan, atau kedaluwarsa. Ajukan pemulihan baru.");
          throw error;
        }
      }}>
        <p className="text-sm">Atur kata sandi untuk username: <strong>{identity}</strong>.</p><PasswordHelp />
        <Field name="newPassword" label="Kata sandi baru" type="password" autoComplete="new-password" maxLength={256} />
        <Field name="confirmation" label="Ulangi kata sandi baru" type="password" autoComplete="new-password" maxLength={256} />
        <p className="text-sm">Bukti pemulihan berlaku paling lama lima menit sejak verifikasi. Semua sesi lama diakhiri setelah reset berhasil. Memuat ulang halaman menghapus proses ini.</p>{restartButton}
      </ActionForm>}
    </>}
  </div></AccountActionScope>;
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
