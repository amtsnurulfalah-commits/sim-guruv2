import { semesterPreparationHandler } from "@/server/semester-preparation/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
export async function GET(request: Request, context: Context) {
  return semesterPreparationHandler((await context.params).action, request);
}
export const POST = GET;
