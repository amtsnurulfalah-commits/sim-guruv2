import { NextResponse } from "next/server";
import { z } from "zod";
import { handleModuleRequest } from "@/server/auth/http";
import { AuthError } from "@/server/auth/service";
import { getAuthService, getBusinessDatabase } from "@/server/auth/runtime";
import { getLifecycleService } from "@/server/accounts/runtime";
import { requireEnvironment } from "@/server/env";
import {
  cookieNames,
  opaqueToken,
  rejectCrossSiteRead,
  requestCookie,
  sourceIp,
} from "@/server/auth/security";
import { ActivityService } from "@/server/activities/service";
import { renderCsv, renderPdf } from "@/server/activities/export";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  return handleModuleRequest("activities", async () => {
    const config = {
      appUrl: requireEnvironment("core").APP_URL,
      sessionSecret: requireEnvironment("auth").SESSION_SECRET,
      production: process.env.NODE_ENV === "production",
      vercel: process.env.VERCEL === "1",
    };
    rejectCrossSiteRead(request, config);
    const token = requestCookie(
      request,
      cookieNames(config.production).session,
    );
    if (!opaqueToken(token)) throw new AuthError("UNAUTHENTICATED", 401);
    const actor = await (await getAuthService()).requireSession(token, true);
    await (
      await getLifecycleService()
    ).activityRate(
      sourceIp(request, config),
      "activity-export:" + actor.user_id,
      true,
    );
    const { kind, format, ...filter } = Object.fromEntries(
      new URL(request.url).searchParams,
    );
    const k = z.enum(["attendance", "journals"]).parse(kind),
      f = z.enum(["csv", "pdf"]).parse(format);
    const rows = await new ActivityService(getBusinessDatabase()).exportRows(
      token,
      k,
      filter,
    );
    const body =
      f === "csv"
        ? renderCsv(rows, k)
        : new Uint8Array(
            await renderPdf(rows, k, `${filter.from} – ${filter.to}`),
          );
    return new NextResponse(body, {
      headers: {
        "Content-Type":
          f === "csv" ? "text/csv; charset=utf-8" : "application/pdf",
        "Content-Disposition": `attachment; filename="${k}.${f}"`,
        "Cache-Control": "no-store",
        Vary: "Cookie, Origin",
      },
    });
  });
}
