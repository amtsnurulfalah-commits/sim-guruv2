import { scheduleHandler } from "@/server/schedules/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return scheduleHandler("collection", request);
}
export function POST(request: Request) {
  return scheduleHandler("collection", request);
}
