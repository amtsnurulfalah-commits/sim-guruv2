import { scheduleHandler } from "@/server/schedules/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return scheduleHandler("detail", request, (await context.params).id);
}
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return scheduleHandler("detail", request, (await context.params).id);
}
