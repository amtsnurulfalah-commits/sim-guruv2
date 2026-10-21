import "server-only";
import { after } from "next/server";
import type { SupportEvent } from "@/lib/feedback/support";
/** Only allowlisted metadata: never request bodies, cookies, URLs or raw exceptions. */
export function recordSupportEvent(event: SupportEvent) {
  console.warn(JSON.stringify({ event: "support.request_failed", ...event }));
  try {
    after(async () => {
      try {
        const { getAuthClient } = await import("../db/client");
        const sql = getAuthClient();
        await sql`select ops.record_support_event(${event.requestId}::uuid, ${event.occurredAt}::timestamptz, ${event.module}, ${event.code}, ${event.status}::integer)`;
      } catch {
        console.error(JSON.stringify({ event: "support.persistence_failed", requestId: event.requestId }));
      }
    });
  } catch {
    // Outside a Next.js request (unit fixtures), structured logging is still available.
  }
}
