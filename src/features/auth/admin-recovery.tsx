"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { accountRequest, ActionForm, Field } from "./account-lifecycle";
type Pending = {
  id: string;
  username: string;
  fullName: string;
  createdAt: string;
  reason: string | null;
};
export function AdminRecovery() {
  const [items, setItems] = useState<Pending[]>([]),
    [message, setMessage] = useState("Memuat permintaan…"),
    [revision, setRevision] = useState(0),
    [secret, setSecret] = useState("");
  useEffect(() => {
    let active = true;
    accountRequest<Pending[]>("admin-recovery")
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
        Verifikasi identitas pemilik akun di luar aplikasi sebelum menyetujui.
        Persetujuan mencabut seluruh sesi dan mengharuskan pemilik mengganti
        kata sandi, memverifikasi email sendiri, serta mengisi ulang pertanyaan
        keamanan. Permintaan akun sendiri tidak dapat disetujui.
      </p>
      {message && <p role="status">{message}</p>}
      {secret && (
        <section className="space-y-3 rounded-xl border p-5">
          <h2 className="font-semibold">Serah terima rahasia satu kali</h2>
          <p className="text-sm">
            Kata sandi sementara berlaku 24 jam. Serahkan hanya kepada pemilik
            yang sudah diverifikasi. Nilai akan hilang saat halaman ditutup.
          </p>
          <output className="block break-all rounded border p-3 font-mono">
            {secret}
          </output>
          <Button onClick={() => setSecret("")}>
            Saya telah menyerahkan, sembunyikan
          </Button>
        </section>
      )}
      {items.map((item) => (
        <ActionForm
          key={item.id}
          title={`${item.fullName} (${item.username})`}
          submitLabel="Setujui setelah verifikasi"
          onSubmit={async (data, form) => {
            if (secret)
              return "Selesaikan serah terima sebelumnya terlebih dahulu.";
            const result = await accountRequest<{ temporaryPassword: string }>(
              "admin-recovery",
              { ...data, requestId: item.id },
            );
            form.reset();
            setSecret(result.temporaryPassword);
            setRevision((v) => v + 1);
            return "Disetujui. Serahkan kata sandi sementara secara aman.";
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
            <span>Metode pemeriksaan identitas</span>
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
            label="Referensi bukti pemeriksaan (tanpa data rahasia)"
            maxLength={300}
          />
          <Field name="reason" label="Alasan persetujuan" maxLength={500} />
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
