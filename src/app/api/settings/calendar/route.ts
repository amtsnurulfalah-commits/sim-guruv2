import { calendarHandler } from "@/server/calendar/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return calendarHandler("calendar", request);
}
export function POST(request: Request) {
  return calendarHandler("calendar", request);
}
export function PATCH(request: Request) {
  return calendarHandler("calendar", request);
}
export function DELETE(request: Request) {
  return calendarHandler("calendar", request);
}
