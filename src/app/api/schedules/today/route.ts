import { scheduleHandler } from "@/server/schedules/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return scheduleHandler("today", request);
}
