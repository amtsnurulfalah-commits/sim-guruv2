import "server-only";
import { NextResponse } from "next/server";
import { reportWorkbook } from "./export";
import { authResponse, handleModuleRequest } from "../auth/http";
import { AuthError, type LocalAuthService } from "../auth/service";
import {
  assertOrigin,
  boundedJson,
  cookieNames,
  opaqueToken,
  rejectCrossSiteRead,
  requestCookie,
  sourceIp,
  verifyCsrf,
  type HttpAuthConfig,
} from "../auth/security";
import type { AccountLifecycleService } from "../accounts/lifecycle";
import type { ReportsService } from "./service";
export function createReportsHandler(deps: {
  config(): HttpAuthConfig;
  auth(): Promise<LocalAuthService>;
  service(): Promise<ReportsService>;
  rate(): Promise<AccountLifecycleService>;
}) {
  return (action: string, request: Request) =>
    handleModuleRequest("reports", async (requestId) => {
      const config = deps.config(),
        token = requestCookie(request, cookieNames(config.production).session),
        read = request.method === "GET";
      if (!["GET", "POST"].includes(request.method))
        throw new AuthError("FORBIDDEN", 405);
      if (read) rejectCrossSiteRead(request, config);
      else {
        assertOrigin(request, config);
        verifyCsrf(
          request.headers.get("x-csrf-token"),
          config.sessionSecret,
          "session",
          token,
        );
      }
      if (!opaqueToken(token)) throw new AuthError("UNAUTHENTICATED", 401);
      const actor = await (await deps.auth()).requireSession(token, true),
        service = await deps.service();
      const query = Object.fromEntries(new URL(request.url).searchParams);
      if (read && action === "excel") {
        await (
          await deps.rate()
        ).activityRate(
          sourceIp(request, config),
          "reports:" + actor.user_id,
          true,
        );
        return new NextResponse(
          new Uint8Array(reportWorkbook(await service.export(token, query))),
          {
            headers: {
              "Content-Type":
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "Content-Disposition":
                'attachment; filename="laporan-pimpinan.xlsx"',
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            },
          },
        );
      }
      if (read && action === "read")
        return authResponse(await service.read(token, query), requestId);
      if (read || action !== "access") throw new AuthError("FORBIDDEN", 405);
      await (
        await deps.rate()
      ).activityRate(sourceIp(request, config), "reports:" + actor.user_id);
      return authResponse(
        await service.access(token, await boundedJson(request)),
        requestId,
      );
    });
}
