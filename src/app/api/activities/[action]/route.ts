import { activityHandler } from "@/server/activities/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
export async function GET(request: Request, context: Context) {
  return activityHandler((await context.params).action, request);
}
export async function POST(request: Request, context: Context) {
  return activityHandler((await context.params).action, request);
}
