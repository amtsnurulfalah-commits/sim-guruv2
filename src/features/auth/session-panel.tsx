"use client";
import { ActionIcon } from "@/components/ui/action-icon";

import Link from "next/link";
import { AccountLifecycle } from "./account-lifecycle";
import { useWorkspaceSession } from "@/components/shell/authenticated-workspace";
import { Button } from "@/components/ui/button";
export function SessionPanel() {
  const session = useWorkspaceSession();
  return (
    <>
      <header className="mb-8 space-y-3">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary">
          Pengaturan pribadi
        </p>
        <h1 className="text-3xl font-bold">Akun dan profil</h1>
        <p className="text-sm leading-7 text-muted-foreground">
          {session.user.fullName} · {session.user.username}
        </p>
      </header>
      {session.scope === "onboarding" ? (
        <section className="mb-7 space-y-3 rounded-2xl border bg-accent/40 p-5">
          <h2 className="font-semibold">Selesaikan pengamanan akun</h2>
          <p className="text-sm leading-7">
            Akses kegiatan masih dibatasi. Lengkapi tiga persyaratan berikut,
            lalu pilih Selesaikan dan lanjutkan.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              Kata sandi permanen:{" "}
              {session.onboarding.mustChangePassword
                ? "belum selesai"
                : "selesai"}
            </li>
            <li>
              Email terverifikasi:{" "}
              {session.onboarding.emailVerified ? "selesai" : "belum selesai"}
            </li>
            <li>
              Pertanyaan keamanan:{" "}
              {session.onboarding.securityQuestionReady
                ? "selesai"
                : "belum selesai"}
            </li>
          </ul>
        </section>
      ) : (
        <div className="mb-7 flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5">
          <p className="text-sm">Pengamanan akun telah lengkap.</p>
          <Button asChild variant="outline">
            <Link prefetch={false} href="/dashboard">
              <ActionIcon action="open" />
              Buka dashboard
            </Link>
          </Button>
        </div>
      )}
      {session.maintenance && (
        <p role="status" className="mb-7 rounded-xl border p-4 text-sm">
          Mode pemeliharaan aktif. Pengamanan akun tetap dapat diakses.
        </p>
      )}
      <AccountLifecycle
        isAdmin={session.user.role === "admin" && session.scope === "business"}
        onboarding={session.scope === "onboarding"}
      />
    </>
  );
}
