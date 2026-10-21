"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ActionIcon } from "@/components/ui/action-icon";
import { Button } from "@/components/ui/button";
import { EmptyState, FeatureState } from "@/components/feedback/feature-state";
import { AccountActionScope, ActionForm, Field } from "./account-lifecycle";
import { usersRequest } from "@/features/users/api";
import { approveRecoverySchema, rejectRecoverySchema, recoveryRequestsSchema, type RecoveryRequest } from "@/lib/users/schemas";
import { validateAccount } from "@/lib/accounts/client-validation";
import { ApiRequestError } from "@/lib/feedback/api-error";

export function AdminRecovery() {
  const [items, setItems] = useState<RecoveryRequest[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [secret, setSecret] = useState<{name:string; value:string} | null>(null);
  const [saving, setSaving] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const load = useCallback(async () => {
    await Promise.resolve();
    if (!mounted.current) return;
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setLoading(true); setError("");
    try {
      const raw = await usersRequest<unknown>("/reset-requests", "GET", undefined, request.signal);
      const parsed = recoveryRequestsSchema.safeParse(raw);
      if (!parsed.success) throw new ApiRequestError("INVALID_RESPONSE", "Daftar permintaan tidak sesuai format. Muat ulang sebelum memproses keputusan.");
      if (mounted.current && !request.signal.aborted) setItems(parsed.data);
    } catch (e) {
      if (mounted.current && !request.signal.aborted) setError(e instanceof Error ? e.message : "Daftar permintaan belum dapat dimuat.");
    } finally {
      if (mounted.current && !request.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => { mounted.current = true; let active = true; void Promise.resolve().then(() => { if (active) void load(); }); return () => { active = false; mounted.current = false; controller.current?.abort(); }; }, [load]);
  return <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
    <section className="rounded-xl border bg-muted/40 p-4 text-sm leading-7">
      <p className="font-semibold">Periksa identitas sebelum memulihkan akses</p>
      <p>Verifikasi pemilik di luar aplikasi. Persetujuan mencabut sesi dan mewajibkan kata sandi permanen, email baru terverifikasi, serta pertanyaan keamanan. Akun sendiri tidak dapat disetujui.</p>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{items.length} permintaan dalam daftar · maksimal 100 permintaan tertua</p>
      <Button variant="outline" disabled={loading || saving || Boolean(secret)} onClick={() => void load()}><ActionIcon action="refresh" />Muat ulang permintaan</Button>
    </div>
    {notice && <p role="status" className="rounded-xl border bg-muted p-4 text-sm leading-6">{notice}</p>}
    {secret && <section aria-label="Serah terima rahasia satu kali" className="space-y-3 rounded-xl border border-primary bg-primary/5 p-5">
      <h2 className="font-semibold">Serah terima untuk {secret.name}</h2>
      <p className="text-sm leading-6">Kata sandi sementara berlaku 24 jam. Serahkan hanya kepada pemilik terverifikasi. Nilai hilang saat halaman ditutup. Selesaikan serah terima sebelum memproses permintaan berikutnya.</p>
      <output className="block break-all rounded border bg-background p-3 font-mono">{secret.value}</output>
      <Button className="w-full sm:w-auto" onClick={() => setSecret(null)}><ActionIcon action="visibility" />Sudah diserahkan, sembunyikan</Button>
    </section>}
    {(loading || error) && <FeatureState error={error} label="Memuat permintaan pemulihan…" retry={() => void load()} headingLevel={2} />}
    {!loading && !error && !items.length && <EmptyState title="Belum ada permintaan pemulihan" description="Permintaan yang masih menunggu pemeriksaan akan muncul di sini. Gunakan muat ulang untuk memeriksa permintaan terbaru." />}
    <AccountActionScope blocked={loading || Boolean(error) || Boolean(secret)}>
      {items.map(item => <RecoveryDecision key={item.id + ':' + item.version} item={item} onSubmit={async payload => {
        setSaving(true);
        try {
          const result = await usersRequest<{temporaryPassword?:unknown; rejected?:boolean}>("/reset-requests", "POST", payload);
          if (!mounted.current) return;
          // Never replay a committed decision just because a later list refresh fails.
          setItems(current => current.filter(value => value.id !== item.id));
          const approved = payload.action === "approve";
          setNotice(approved ? "Persetujuan sudah diproses. Selesaikan serah terima kata sandi sementara." : "Permintaan ditolak dan dicatat pada audit.");
          if (approved) {
            if (typeof result?.temporaryPassword !== "string" || !result.temporaryPassword) {
              setNotice("Persetujuan sudah diproses tetapi kata sandi sementara tidak terbaca. Jangan ulangi keputusan; periksa status akun melalui Manajemen Pengguna.");
            } else setSecret({name:`${item.fullName} (${item.username})`,value:result.temporaryPassword});
          }
          await load();
        } finally { if (mounted.current) setSaving(false); }
      }} />)}
    </AccountActionScope>
  </div>;
}
function RecoveryDecision({item,onSubmit}:{item:RecoveryRequest;onSubmit:(payload:Record<string,string>)=>Promise<void>}) {
  const [decision,setDecision] = useState("approve");
  const decisionId = useId(), methodId = useId();
  return <ActionForm title={`${item.fullName} (${item.username})`} submitLabel={decision === "approve" ? "Setujui pemulihan" : "Tolak permintaan"} onSubmit={async (data,form) => {
    const payload = decision === "reject"
      ? validateAccount(rejectRecoverySchema,{action:"reject",requestId:item.id,reason:data.reason,currentPassword:data.currentPassword})
      : validateAccount(approveRecoverySchema,{action:"approve",requestId:item.id,targetId:item.userId,version:item.version,reason:data.reason,currentPassword:data.currentPassword,method:data.method,evidence:data.evidence});
    await onSubmit(payload); form.reset();
    return {message:"Keputusan sudah diproses.",tone:"info"};
  }}>
    <dl className="rounded-lg bg-muted/50 p-3 text-sm leading-6"><dt className="font-medium">Diajukan</dt><dd>{new Date(item.createdAt).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"})} WIB</dd><dt className="mt-2 font-medium">Keterangan pemohon</dt><dd className="whitespace-pre-wrap">{item.reason || "Tidak ada keterangan tambahan."}</dd></dl>
    <label htmlFor={decisionId} className="block min-w-0 space-y-2 text-sm"><span id={decisionId + "-label"} className="font-medium">Keputusan</span><select aria-labelledby={decisionId + "-label"} id={decisionId} name="decision" value={decision} onChange={e => setDecision(e.target.value)} className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3"><option value="approve">Setujui setelah verifikasi</option><option value="reject">Tolak permintaan</option></select></label>
    {decision === "approve" && <>
      <label htmlFor={methodId} className="block min-w-0 space-y-2 text-sm"><span id={methodId + "-label"} className="font-medium">Metode pemeriksaan identitas</span><select aria-labelledby={methodId + "-label"} id={methodId} name="method" className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3"><option value="tatap_muka">Tatap muka</option><option value="dokumen_dan_panggilan">Dokumen dan panggilan terverifikasi</option></select></label>
      <Field name="evidence" label="Referensi bukti verifikasi" minLength={5} maxLength={300} multiline />
    </>}
    <Field name="reason" label="Alasan keputusan" minLength={5} maxLength={500} multiline />
    <Field name="currentPassword" label="Konfirmasi kata sandi administrator" type="password" />
  </ActionForm>;
}
