import { operationsHandler } from "@/server/operations/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => operationsHandler("notification-preferences", request);
