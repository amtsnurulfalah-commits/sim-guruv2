import { userHandler } from "@/server/users/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return userHandler("detail", request, (await context.params).id);
}
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return userHandler("detail", request, (await context.params).id);
}
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return userHandler("detail", request, (await context.params).id);
}
