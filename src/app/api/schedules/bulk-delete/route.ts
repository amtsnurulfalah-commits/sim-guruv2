import { scheduleHandler } from "@/server/schedules/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return scheduleHandler("bulk-commit", request);
}
