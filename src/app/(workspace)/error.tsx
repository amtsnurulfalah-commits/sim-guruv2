"use client";
import { ServiceState } from "@/components/feedback/service-state";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return <ServiceState embedded retry={reset} />;
}
