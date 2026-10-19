import { authHandlers } from "@/server/auth/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = authHandlers.logout;
