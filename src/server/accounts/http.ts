import "server-only";
import { z } from "zod";
import { authResponse, handleAuthRequest } from "../auth/http";
import { AuthError } from "../auth/service";
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
import { forgotSchema } from "../../lib/accounts/schemas";
import type { AccountLifecycleService } from "./lifecycle";
export type LifecycleAction =
  | "profile"
  | "change-password"
  | "security-question"
  | "email-request"
  | "email-verify"
  | "complete-onboarding"
  | "forgot-password"
  | "reset-otp"
  | "reset-password"
  | "activation"
  | "admin-recovery";
const publicActions = new Set<LifecycleAction>([
  "forgot-password",
  "reset-otp",
  "reset-password",
  "activation",
]);
export function createLifecycleHandler(deps: {
  config: () => HttpAuthConfig;
  service: () => Promise<AccountLifecycleService>;
}) {
  return (action: LifecycleAction, request: Request) =>
    handleAuthRequest(async (requestId) => {
      const config = deps.config(),
        names = cookieNames(config.production),
        isPublic = publicActions.has(action),
        token = requestCookie(
          request,
          isPublic ? names.prelogin : names.session,
        );
      if (request.method !== "GET" && request.method !== "POST")
        throw new AuthError("FORBIDDEN", 405);
      if (request.method === "GET") {
        if (action !== "profile" && action !== "admin-recovery")
          throw new AuthError("FORBIDDEN", 405);
        rejectCrossSiteRead(request, config);
      } else {
        assertOrigin(request, config);
        verifyCsrf(
          request.headers.get("x-csrf-token"),
          config.sessionSecret,
          isPublic ? "login" : "session",
          token,
        );
      }
      if (!opaqueToken(token)) throw new AuthError("UNAUTHENTICATED", 401);
      const input = request.method === "POST" ? await boundedJson(request) : {};
      const service = await deps.service();
      // Public rate key is normalized submitted identity when available; never existence-dependent.
      const rateKey =
        action === "forgot-password"
          ? forgotSchema.parse(input).username
          : isPublic
            ? "public:" + token
            : token;
      if (request.method === "POST")
        await service.rate(sourceIp(request, config), rateKey);
      let data: unknown;
      switch (action) {
        case "profile":
          data =
            request.method === "GET"
              ? await service.profile(token)
              : await service.saveProfile(token, input);
          break;
        case "change-password":
          data = await service.changePassword(token, input);
          break;
        case "security-question":
          data = await service.setQuestion(token, input);
          break;
        case "email-request":
          data = await service.requestEmail(token, input);
          break;
        case "email-verify":
          data = await service.verifyOtp("email_verify", token, input);
          break;
        case "complete-onboarding": {
          z.object({}).strict().parse(input);
          const result = await service.complete(token),
            response = authResponse({ completed: true }, requestId);
          response.cookies.set(names.session, result.token, {
            httpOnly: true,
            secure: config.production,
            sameSite: "lax",
            path: "/",
            maxAge: 86400,
          });
          return response;
        }
        case "forgot-password":
          data = await service.forgot(input);
          break;
        case "reset-otp":
          data = await service.verifyOtp("reset_otp", null, input);
          break;
        case "reset-password":
          data = await service.reset(input);
          break;
        case "activation":
          data = await service.activate(input);
          break;
        case "admin-recovery":
          data =
            request.method === "GET"
              ? await service.recoveryRequests(token)
              : await service.approve(token, input);
          break;
      }
      const response = authResponse(data, requestId);
      if (
        [
          "change-password",
          "email-verify",
          "reset-password",
          "activation",
        ].includes(action)
      )
        response.cookies.set(names.session, "", {
          httpOnly: true,
          secure: config.production,
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        });
      return response;
    });
}
