import { masterHandler } from "@/server/masters/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ group: string; id: string }> },
) {
  const p = await context.params;
  return masterHandler(request, p.group, p.id);
}
