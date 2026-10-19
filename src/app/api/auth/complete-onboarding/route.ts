import { lifecycleHandler } from "@/server/accounts/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = (request: Request) =>
  lifecycleHandler("complete-onboarding", request);
