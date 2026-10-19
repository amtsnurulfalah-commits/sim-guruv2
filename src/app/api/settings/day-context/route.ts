import { calendarHandler } from "@/server/calendar/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return calendarHandler("context", request);
}
