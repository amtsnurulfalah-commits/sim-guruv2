import { lifecycleHandler } from "@/server/accounts/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => lifecycleHandler("profile", request);
export const GET = (request: Request) => lifecycleHandler("profile", request);
