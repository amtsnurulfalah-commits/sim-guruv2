"use client";
import { ServiceState } from "@/components/feedback/service-state";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <ServiceState retry={reset} />;
}
