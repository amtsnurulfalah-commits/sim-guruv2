import { randomUUID } from "node:crypto";
import type { ApiResult } from "@/types/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Liveness proses saja; bukan bukti koneksi DB atau kesiapan transaksi. */
export function GET() {
  const body: ApiResult<{
    service: "sim-guru";
    status: "alive";
    phase: "2.4";
  }> = {
    ok: true,
    data: { service: "sim-guru", status: "alive", phase: "2.4" },
    requestId: randomUUID(),
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
