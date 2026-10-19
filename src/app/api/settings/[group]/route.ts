import { masterHandler } from "@/server/masters/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ group: string }> };
async function handle(request: Request, context: Context) {
  return masterHandler(request, (await context.params).group);
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
