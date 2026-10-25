import "server-only";
import { wibDate } from "../../lib/calendar/schemas";
import { modulesFor } from "../../lib/navigation/modules";
import type { SessionRow } from "../auth/service";
export function dashboardDto(session: SessionRow, now = new Date()) {
  return {
    date: wibDate(now),
    user: { id: session.user_id, fullName: session.full_name, role: session.role },
    dateLabel: new Intl.DateTimeFormat("id-ID", {
      dateStyle: "full",
      timeZone: "Asia/Jakarta",
    }).format(now),
    modules: modulesFor(session.role),
    activitySummaryAvailable: false as const,
    financeSummaryAvailable: false as const,
  };
}
