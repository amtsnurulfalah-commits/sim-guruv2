"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PublicWorkspace, usePublicWorkspaceSession } from "./public-workspace";
import { Button } from "@/components/ui/button";
import { ActionIcon } from "@/components/ui/action-icon";

export function GuideAccessLink() {
  const session = usePublicWorkspaceSession();
  return (
    <Button asChild variant="outline">
      <Link
        prefetch={false}
        href={
          session
            ? session.scope === "business"
              ? "/dashboard"
              : "/akun"
            : "/login"
        }
      >
        <ActionIcon action={session ? "open" : "access"} />
        {session
          ? session.scope === "business"
            ? "Kembali ke Dashboard"
            : "Buka akun dan profil"
          : "Masuk ke SiM-Guru"}
      </Link>
    </Button>
  );
}

/** Public help with the same verified-session lifecycle as protected workspaces. */
export function GuideWorkspace({ children }: { children: ReactNode }) {
  return (
    <>
      <noscript>
        <p className="ui-panel mx-4 my-6 text-sm leading-7">
          Halaman ini memerlukan JavaScript. Aktifkan JavaScript lalu muat
          ulang, atau{" "}
          <Link href="/" prefetch={false} className="ui-text-link underline">
            kembali ke beranda
          </Link>
          .
        </p>
      </noscript>
      <PublicWorkspace unavailableMessage="Panduan tetap dapat dibaca.">
        {children}
      </PublicWorkspace>
    </>
  );
}
