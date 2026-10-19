import { calendarHandler } from "@/server/calendar/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return calendarHandler("calendar-preview", request);
}
