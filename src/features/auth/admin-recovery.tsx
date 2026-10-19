"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm, Field } from "./account-lifecycle";
import { usersRequest } from "@/features/users/api";
import type { RecoveryRequest } from "@/lib/users/schemas";
export function AdminRecovery() {
  const [items, setItems] = useState<RecoveryRequest[]>([]),
    [message, setMessage] = useState("Memuat permintaan…"),
    [revision, setRevision] = useState(0),
    [secret, setSecret] = useState("");
  useEffect(() => {
    let active = true;
    usersRequest<RecoveryRequest[]>("/reset-requests")
      .then((value) => {
        if (active) {
          setItems(value);
          setMessage(value.length ? "" : "Belum ada permintaan pemulihan.");
        }
      })
      .catch(() => {
        if (active)
          setMessage(
            "Permintaan tidak dapat dimuat atau Anda tidak memiliki izin administrator yang lengkap.",
          );
      });
    return () => {
      active = false;
    };
  }, [revision]);
  return (
    <div className="space-y-5">
      <p className="text-sm leading-7">
        Verifikasi identitas pemilik di luar aplikasi sebelum menyetujui.
        Persetujuan mencabut sesi dan mewajibkan kata sandi permanen, email baru
        terverifikasi dan pertanyaan keamanan. Akun sendiri tidak dapat
        disetujui.
      </p>
      <Button variant="outline" onClick={() => setRevision((v) => v + 1)}>
        Muat ulang permintaan
      </Button>
      {message && <p role="status">{message}</p>}
      {secret && (
        <section className="space-y-3 rounded-xl border p-5">
          <h2 className="font-semibold">Serah terima rahasia satu kali</h2>
          <p className="text-sm">
            Kata sandi sementara berlaku24jam. Serahkan hanya kepada pemilik
            terverifikasi. Nilai hilang saat halaman ditutup.
          </p>
          <output className="block break-all rounded border p-3 font-mono">
            {secret}
          </output>
          <Button onClick={() => setSecret("")}>
            Sudah diserahkan, sembunyikan
          </Button>
        </section>
      )}
      {items.map((item) => (
        <ActionForm
          key={item.id}
          title={`${item.fullName} (${item.username})`}
          submitLabel="Proses keputusan"
          onSubmit={async (data, form) => {
            if (secret)
              return "Selesaikan serah terima sebelumnya terlebih dahulu.";
            const { decision, ...values } = data;
            const payload =
              decision === "reject"
                ? {
                    action: "reject",
                    requestId: item.id,
                    reason: values.reason,
                    currentPassword: values.currentPassword,
                  }
                : {
                    action: "approve",
                    requestId: item.id,
                    targetId: item.userId,
                    version: item.version,
                    ...values,
                  };
            const result = await usersRequest<{ temporaryPassword?: string }>(
              "/reset-requests",
              "POST",
              payload,
            );
            form.reset();
            if (result.temporaryPassword) setSecret(result.temporaryPassword);
            setRevision((v) => v + 1);
            return decision === "reject"
              ? "Permintaan ditolak dan dicatat pada audit."
              : "Disetujui. Serahkan kata sandi sementara secara aman.";
          }}
        >
          <p className="text-sm">
            Diajukan:{" "}
            {new Date(item.createdAt).toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
            })}
            . Keterangan: {item.reason || "—"}
          </p>
          <label className="block space-y-2 text-sm">
            <span>Keputusan</span>
            <select
              name="decision"
              className="h-11 w-full rounded-lg border bg-background px-3"
            >
              <option value="approve">Setujui setelah verifikasi</option>
              <option value="reject">Tolak permintaan</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm">
            <span>Metode pemeriksaan identitas (untuk persetujuan)</span>
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
          <Field
            name="evidence"
            label="Referensi bukti (wajib untuk persetujuan)"
            required={false}
            maxLength={300}
          />
          <Field name="reason" label="Alasan keputusan" maxLength={500} />
          <Field
            name="currentPassword"
            label="Konfirmasi kata sandi administrator"
            type="password"
          />
        </ActionForm>
      ))}
    </div>
  );
}
