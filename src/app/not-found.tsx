import { NotFoundState } from "@/components/feedback/not-found-state";
import { PublicWorkspace } from "@/components/shell/public-workspace";

export default function NotFound() {
  return (
    <PublicWorkspace
      unavailableMessage="Halaman tidak ditemukan tetap dapat dibaca. Gangguan pemeriksaan ini tidak berarti Anda sudah keluar."
      pendingFallback={
        <main
          id="konten-utama"
          tabIndex={-1}
          className="flex min-h-svh min-w-0 items-center px-4 py-8 sm:px-6 sm:py-12"
        >
          <NotFoundState />
        </main>
      }
    >
      <NotFoundState embedded />
    </PublicWorkspace>
  );
}
