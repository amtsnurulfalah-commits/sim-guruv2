"use client";
import { ServiceState } from "@/components/feedback/service-state";
export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ServiceState
      title="Halaman belum dapat dimuat"
      message="Silakan coba kembali. Jika masih terjadi, hubungi administrator madrasah."
      retry={reset}
    />
  );
}
