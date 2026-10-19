"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ApiResult } from "@/types/api";
import type { SessionDto } from "@/types/auth";
export function SessionPanel() {
    const [session, setSession] = useState<SessionDto | null>(null), [message, setMessage] = useState("Memeriksa sesi…"), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
    const dialog = useRef<HTMLDialogElement>(null), channel = useRef<BroadcastChannel | null>(null), lastActivity = useRef(0);
    useEffect(() => {
        let active = true, inFlight = false;
        async function check() { if (inFlight)
            return; inFlight = true; try {
            const res = await fetch("/api/auth/session", { cache: "no-store", signal: AbortSignal.timeout(15000) }), data: ApiResult<SessionDto> = await res.json();
            if (!active)
                return;
            if (res.status === 401) {
                setSession(null);
                window.location.replace("/login?status=expired");
                return;
            }
            if (!data.ok)
                throw new Error();
            setSession(data.data);
            setMessage("");
        }
        catch {
            if (active) {
                setSession(null);
                setMessage("Sesi belum dapat diperiksa. Coba kembali.");
            }
        }
        finally {
            inFlight = false;
        } }
        async function activity() { if (Date.now() - lastActivity.current < 60000 || document.visibilityState !== "visible")
            return; lastActivity.current = Date.now(); try {
            const r = await fetch("/api/auth/csrf?intent=session", { cache: "no-store", signal: AbortSignal.timeout(15000) }), csrf: ApiResult<{
                csrfToken: string;
            }> = await r.json();
            if (!csrf.ok) {
                void check();
                return;
            }
            const res = await fetch("/api/auth/session", { method: "POST", headers: { "X-CSRF-Token": csrf.data.csrfToken }, signal: AbortSignal.timeout(15000) });
            if (!res.ok)
                void check();
        }
        catch { /* check berkala menyembunyikan UI bila layanan tidak tersedia. */ } }
        void check();
        const timer = window.setInterval(() => void check(), 30000);
        const focus = () => void check();
        window.addEventListener("focus", focus);
        document.addEventListener("visibilitychange", focus);
        window.addEventListener("pointerdown", activity);
        window.addEventListener("keydown", activity);
        if ("BroadcastChannel" in window) {
            channel.current = new BroadcastChannel("sim-guru-auth");
            channel.current.onmessage = event => { if (event.data === "logout") {
                setSession(null);
                window.location.replace("/login?status=logout");
            } };
        }
        return () => { active = false; clearInterval(timer); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); window.removeEventListener("pointerdown", activity); window.removeEventListener("keydown", activity); channel.current?.close(); channel.current = null; };
    }, [revision]);
    async function logout() { setBusy(true); try {
        const r = await fetch("/api/auth/csrf?intent=session", { cache: "no-store", signal: AbortSignal.timeout(15000) });
        if (r.status === 401) {
            setSession(null);
            window.location.replace("/login?status=expired");
            return;
        }
        const csrf: ApiResult<{
            csrfToken: string;
        }> = await r.json();
        if (!csrf.ok)
            throw new Error(csrf.error.message);
        const res = await fetch("/api/auth/logout", { method: "POST", headers: { "X-CSRF-Token": csrf.data.csrfToken }, signal: AbortSignal.timeout(15000) }), data: ApiResult<{
            loggedOut: boolean;
        }> = await res.json();
        if (!data.ok)
            throw new Error(data.error.message);
        setSession(null);
        channel.current?.postMessage("logout");
        window.location.replace("/login?status=logout");
    }
    catch (error) {
        setMessage(error instanceof Error ? error.message : "Belum dapat keluar. Coba kembali.");
        dialog.current?.close();
    }
    finally {
        setBusy(false);
    } }
    return <div className="space-y-6">
  {message && <p role="status" className="rounded-lg border bg-muted p-4 text-sm">{message}</p>}
  {!session ? <Button variant="outline" onClick={() => setRevision(v => v + 1)}>Periksa kembali</Button> : <>
   <div><h2 className="text-xl font-semibold">Selamat datang, {session.user.fullName}</h2><p className="mt-2 text-sm text-muted-foreground">{session.user.username} · {session.user.role === "admin" ? "Administrator" : "Guru"}</p></div>
   {session.scope === "onboarding" ? <section className="space-y-3 rounded-xl border p-5"><h3 className="font-semibold">Pengamanan akun belum selesai</h3><p className="text-sm leading-7">Akses kegiatan masih dibatasi. Halaman pengamanan akun akan tersedia pada tahap berikutnya.</p><ul className="list-disc space-y-2 pl-5 text-sm"><li>Ganti kata sandi: {session.onboarding.mustChangePassword ? "wajib dilakukan" : "selesai"}</li><li>Verifikasi email: {session.onboarding.emailVerified ? "selesai" : "belum selesai"}</li><li>Pertanyaan keamanan: {session.onboarding.securityQuestionReady ? "selesai" : "belum selesai"}</li></ul></section> : <p className="rounded-xl border p-5 text-sm leading-7">Akun sudah siap. Modul kegiatan dan dashboard akan tersedia pada tahap pengembangan berikutnya.</p>}
   {session.maintenance && <p role="status" className="rounded-xl border p-4 text-sm">Mode pemeliharaan aktif. {session.user.role === "guru" ? "Operasi kegiatan sementara tidak tersedia." : "Administrator tetap dapat mengakses pengaturan yang tersedia."}</p>}
   <p className="text-xs leading-6 text-muted-foreground">Sesi berlaku maksimal 24 jam dan berakhir setelah 2 jam tanpa aktivitas. Pemeriksaan sesi otomatis tidak memperpanjang waktu aktif.</p>
   <Button variant="outline" onClick={() => dialog.current?.showModal()}>Keluar</Button>
  </>}
  <dialog ref={dialog} aria-labelledby="logout-title" aria-describedby="logout-description" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border bg-card p-6 text-card-foreground shadow-xl backdrop:bg-black/45" onCancel={event => { if (busy)
        event.preventDefault(); }}><h2 id="logout-title" className="text-lg font-semibold">Keluar dari SiM-Guru?</h2><p id="logout-description" className="mt-3 text-sm leading-7 text-muted-foreground">Sesi pada browser ini akan diakhiri. Anda dapat masuk kembali menggunakan akun Anda.</p><div className="mt-6 flex justify-end gap-3"><Button variant="outline" disabled={busy} onClick={() => dialog.current?.close()}>Batal</Button><Button disabled={busy} onClick={() => void logout()}>{busy ? "Mengakhiri sesi…" : "Ya, keluar"}</Button></div></dialog>
 </div>;
}
