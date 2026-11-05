import Link from "next/link";
import { LoadingMessage } from "@/components/feedback/loading-message";

export default function Loading() {
  return (
    <main
      id="konten-utama"
      className="mx-auto max-w-3xl px-5 py-24"
    >
      <LoadingMessage label="Memuat halaman…" />
      <noscript>
        <p className="mt-4 text-sm leading-7">
          Halaman ini memerlukan JavaScript. Aktifkan JavaScript di browser,
          lalu muat ulang halaman. Anda juga dapat{" "}
          <Link
            href="/"
            prefetch={false}
            className="ui-text-link rounded-md underline"
          >
            kembali ke beranda
          </Link>
          .
        </p>
      </noscript>
    </main>
  );
}
