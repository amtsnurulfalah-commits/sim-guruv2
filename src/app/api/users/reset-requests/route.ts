import { userHandler } from "@/server/users/endpoints";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => userHandler("requests", request);
export const POST = (request: Request) => userHandler("requests", request);
