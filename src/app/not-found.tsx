import { NotFoundState } from "@/components/feedback/not-found-state";

export default function NotFound() {
  return (
    <main
      id="konten-utama"
      tabIndex={-1}
      className="flex min-h-svh min-w-0 items-center px-4 py-8 sm:px-6 sm:py-12"
    >
      <NotFoundState />
    </main>
  );
}
