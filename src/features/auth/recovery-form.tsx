"use client";
import { useEffect, useState } from "react";
import {
  accountRequest,
  ActionForm,
  Field,
  PasswordHelp,
} from "./account-lifecycle";
export function RecoveryForm() {
  const [otpChallenge, setOtpChallenge] = useState(""),
    [reset, setReset] = useState<{ challengeId: string; token: string } | null>(
      null,
    ),
    [nextRequest, setNextRequest] = useState(0);
  return (
    <div className="space-y-6">
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
            return "Tunggu 60 detik sebelum meminta kembali.";
          const result = await accountRequest<{ challengeId: string }>(
            "forgot-password",
            data,
            true,
          );
          setNextRequest(Date.now() + 60000);
          setReset(null);
          setOtpChallenge(data.method === "email" ? result.challengeId : "");
          return "Jika data memenuhi syarat, permintaan akan diproses melalui email terverifikasi atau pemeriksaan admin. Jawaban keamanan saja tidak mengizinkan reset kata sandi.";
        }}
      >
        <Field name="username" label="Username" maxLength={64} />
        <label className="block space-y-2 text-sm">
          <span>Metode pemulihan</span>
          <select
            name="method"
            className="h-11 w-full rounded-lg border bg-background px-3"
          >
            <option value="email">OTP email terverifikasi</option>
            <option value="admin">Verifikasi identitas oleh admin</option>
            <option value="security">
              Jawaban keamanan, dilanjutkan verifikasi admin
            </option>
          </select>
        </label>
        <Field
          name="answer"
          label="Jawaban keamanan (untuk metode jawaban)"
          type="password"
          required={false}
        />
        <Field
          name="reason"
          label="Keterangan permintaan (opsional, minimal 5 karakter)"
          required={false}
          maxLength={500}
        />
      </ActionForm>
      {otpChallenge && !reset && (
        <ActionForm
          title="Verifikasi OTP pemulihan"
          submitLabel="Verifikasi kode"
          onSubmit={async (data) => {
            const result = await accountRequest<{
              challengeId: string;
              token: string;
            }>("reset-otp", { challengeId: otpChallenge, otp: data.otp }, true);
            setReset(result);
            return "Kode terbukti. Atur kata sandi baru dalam lima menit.";
          }}
        >
          <Field name="otp" label="Kode OTP enam digit" maxLength={6} />
          <p className="text-sm">
            Kode berlaku sepuluh menit, maksimal lima percobaan. Jangan bagikan
            kode Anda.
          </p>
        </ActionForm>
      )}
      {reset && (
        <ActionForm
          title="Atur kata sandi baru"
          submitLabel="Reset kata sandi"
          onSubmit={async (data, form) => {
            await accountRequest("reset-password", { ...reset, ...data }, true);
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
    </div>
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
      if (challengeId && token) setLink({ challengeId, token });
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
        await accountRequest("activation", { ...link, ...data }, true);
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
