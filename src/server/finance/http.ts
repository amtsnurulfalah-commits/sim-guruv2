import "server-only";
import { NextResponse } from "next/server";
import { authResponse, handleAuthRequest } from "../auth/http";
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
import type { FinanceService } from "./service";
import { commandSchemas, type FinanceAction } from "../../lib/finance/schemas";
import { renderHonorExcel, renderHonorPdf } from "./export";
export function createFinanceHandler(deps: {
  config(): HttpAuthConfig;
  auth(): Promise<LocalAuthService>;
  service(): Promise<FinanceService>;
  rate(): Promise<AccountLifecycleService>;
}) {
  return (action: string, request: Request) =>
    handleAuthRequest(async (requestId) => {
      const config = deps.config();
      const query = Object.fromEntries(new URL(request.url).searchParams);
      if (action === "verify" && request.method === "POST") {
        assertOrigin(request, config);
        await (await deps.rate()).documentVerifyRate(sourceIp(request, config));
        return authResponse(
          await (await deps.service()).verify(await boundedJson(request)),
          requestId,
        );
      }
      const token = requestCookie(
          request,
          cookieNames(config.production).session,
        ),
        read =
          ["read", "pdf", "excel"].includes(action) && request.method === "GET";
      if (
        !read &&
        ((!(action in commandSchemas) && action !== "pdf") ||
          request.method !== "POST")
      )
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
      if (action === "read")
        return authResponse(await service.read(token, query), requestId);
      if (action === "pdf" || action === "excel") {
        await (
          await deps.rate()
        ).activityRate(
          sourceIp(request, config),
          "finance:" + actor.user_id,
          true,
        );
        if (action === "excel") {
          const rows = await service.exportHistory(token, {
            ...query,
            kind: "history",
          });
          return new NextResponse(new Uint8Array(renderHonorExcel(rows)), {
            headers: {
              "Content-Type":
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "Content-Disposition":
                'attachment; filename="riwayat-honor.xlsx"',
              "Cache-Control": "no-store",
            },
          });
        }
        const download =
          request.method === "POST"
            ? commandSchemas.token.parse(await boundedJson(request))
            : { statementId: String(query.id ?? "") };
        const statement = await service.statement(token, download.statementId);
        let verificationUrl: string | undefined;
        if (request.method === "POST") {
          const proof = await service.command<{ token: string }>(
            token,
            "token",
            download,
          );
          verificationUrl =
            config.appUrl + "/verifikasi-dokumen#" + proof.token;
        }
        const result = await renderHonorPdf(statement, verificationUrl);
        return new NextResponse(new Uint8Array(result), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="slip-honor.pdf"',
            "Cache-Control": "no-store",
          },
        });
      }
      await (
        await deps.rate()
      ).activityRate(sourceIp(request, config), "finance:" + actor.user_id);
      return authResponse(
        await service.command(
          token,
          action as FinanceAction,
          await boundedJson(request),
        ),
        requestId,
      );
    });
}
