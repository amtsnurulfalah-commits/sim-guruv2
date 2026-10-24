import { operationsHandler } from "@/server/operations/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => operationsHandler("tasks", request);
