import { userHandler } from "@/server/users/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return userHandler("activation", request, (await context.params).id);
}
