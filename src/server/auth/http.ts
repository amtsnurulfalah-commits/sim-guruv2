import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { EnvironmentConfigurationError } from "../env";
import { PasswordCryptoError, PasswordPolicyError } from "./passwords";
import { AuthError, loginSchema, sessionDto } from "./service";
import type { LocalAuthService } from "./service";
import {
  assertOrigin,
  boundedJson,
  cookieNames,
  issueCsrf,
  opaqueToken,
  rejectCrossSiteRead,
  requestCookie,
  sourceIp,
  verifyCsrf,
} from "./security";
import type { HttpAuthConfig } from "./security";
type Dependencies = {
  config: () => HttpAuthConfig;
  service: () => Promise<LocalAuthService>;
};
const messages: Record<string, string> = {
  CHALLENGE_INVALID:
    "Kode atau tautan tidak berlaku, sudah digunakan, atau kedaluwarsa.",
  CONFLICT:
    "Data telah berubah atau username/email sudah digunakan. Muat ulang lalu periksa isian.",
  INVALID_CREDENTIALS: "Username atau kata sandi tidak sesuai.",
  UNAUTHENTICATED: "Sesi berakhir. Silakan masuk kembali.",
  ONBOARDING_REQUIRED: "Selesaikan pengamanan akun sebelum mengakses kegiatan.",
  FORBIDDEN: "Permintaan tidak diizinkan.",
  CSRF_INVALID: "Formulir kedaluwarsa. Muat ulang formulir lalu coba lagi.",
  RATE_LIMITED:
    "Terlalu banyak percobaan. Silakan tunggu sebelum mencoba kembali.",
  VALIDATION_ERROR: "Periksa kembali isian formulir.",
  MAINTENANCE: "Aplikasi sedang dalam pemeliharaan.",
  UNAVAILABLE:
    "Layanan belum tersedia. Silakan coba kembali atau hubungi administrator.",
  INTERNAL_ERROR:
    "Terjadi gangguan. Silakan coba kembali atau hubungi administrator.",
};
export function authResponse(data: unknown, requestId: string) {
  return NextResponse.json(
    { ok: true, data, requestId },
    { headers: { "Cache-Control": "no-store", Vary: "Cookie, Origin" } },
  );
}
export async function handleAuthRequest(
  work: (requestId: string) => Promise<NextResponse>,
) {
  const requestId = randomUUID();
  try {
    return await work(requestId);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    const unavailable =
      error instanceof EnvironmentConfigurationError ||
      error instanceof PasswordCryptoError ||
      [
        "ECONNREFUSED",
        "ECONNRESET",
        "ENOTFOUND",
        "EAI_AGAIN",
        "ETIMEDOUT",
        "CONNECT_TIMEOUT",
        "CONNECTION_CLOSED",
        "53300",
        "57P03",
        "55P03",
        "57014",
        "40001",
        "42501",
        "SELF_SIGNED_CERT_IN_CHAIN",
        "DEPTH_ZERO_SELF_SIGNED_CERT",
        "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
        "CERT_HAS_EXPIRED",
        "ERR_TLS_CERT_ALTNAME_INVALID",
      ].includes(code) ||
      code.startsWith("08");
    const dbMessage = error instanceof Error ? error.message : "";
    const mapped = [
      "UNAUTHENTICATED",
      "ONBOARDING_REQUIRED",
      "FORBIDDEN",
      "MAINTENANCE",
    ].includes(dbMessage)
      ? new AuthError(
          dbMessage,
          dbMessage === "UNAUTHENTICATED"
            ? 401
            : dbMessage === "MAINTENANCE"
              ? 503
              : 403,
        )
      : code === "23505" || dbMessage === "VERSION_CONFLICT"
        ? new AuthError("CONFLICT", 409)
        : null;
    const auth =
      error instanceof AuthError
        ? error
        : mapped
          ? mapped
          : error instanceof ZodError || error instanceof PasswordPolicyError
            ? new AuthError("VALIDATION_ERROR", 422)
            : unavailable
              ? new AuthError("UNAVAILABLE", 503)
              : new AuthError("INTERNAL_ERROR", 500);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: auth.code,
          message: messages[auth.code] ?? messages.UNAVAILABLE,
        },
        requestId,
      },
      {
        status: auth.status,
        headers: {
          "Cache-Control": "no-store",
          Vary: "Cookie, Origin",
          ...(auth.retryAfter
            ? { "Retry-After": String(auth.retryAfter) }
            : {}),
        },
      },
    );
  }
}
export function createAuthHandlers(deps: Dependencies) {
  function setCookie(
    res: NextResponse,
    name: string,
    value: string,
    maxAge: number,
    config: HttpAuthConfig,
  ) {
    res.cookies.set(name, value, {
      httpOnly: true,
      secure: config.production,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
  }
  return {
    csrf: (request: Request) =>
      handleAuthRequest(async (requestId) => {
        const config = deps.config();
        rejectCrossSiteRead(request, config);
        const names = cookieNames(config.production),
          intent = new URL(request.url).searchParams.get("intent") ?? "login";
        if (intent !== "login" && intent !== "session")
          throw new AuthError("VALIDATION_ERROR", 422);
        let binding = requestCookie(
          request,
          intent === "login" ? names.prelogin : names.session,
        );
        if (intent === "session") {
          if (!opaqueToken(binding))
            throw new AuthError("UNAUTHENTICATED", 401);
          await (await deps.service()).requireSession(binding);
        } else if (!opaqueToken(binding))
          binding = randomBytes(32).toString("base64url");
        if (!binding) throw new AuthError("UNAUTHENTICATED", 401);
        const res = authResponse(
          { csrfToken: issueCsrf(config.sessionSecret, intent, binding) },
          requestId,
        );
        if (intent === "login")
          setCookie(res, names.prelogin, binding, 900, config);
        return res;
      }),
    login: (request: Request) =>
      handleAuthRequest(async (requestId) => {
        const config = deps.config();
        assertOrigin(request, config);
        const names = cookieNames(config.production);
        verifyCsrf(
          request.headers.get("x-csrf-token"),
          config.sessionSecret,
          "login",
          requestCookie(request, names.prelogin),
        );
        const input = loginSchema.parse(await boundedJson(request)),
          ip = sourceIp(request, config),
          service = await deps.service();
        const result = await service.login(
          input,
          ip,
          requestId,
          requestCookie(request, names.session),
        );
        const res = authResponse(
          {
            session: result.session,
            redirectTo:
              result.session.scope === "business" ? "/dashboard" : "/akun",
          },
          requestId,
        );
        setCookie(
          res,
          names.session,
          result.token,
          Math.max(
            0,
            Math.floor(
              (new Date(result.session.expiresAt).getTime() - Date.now()) /
                1000,
            ),
          ),
          config,
        );
        setCookie(res, names.prelogin, "", 0, config);
        return res;
      }),
    session: (request: Request) =>
      handleAuthRequest(async (requestId) => {
        const config = deps.config(),
          token = requestCookie(
            request,
            cookieNames(config.production).session,
          );
        rejectCrossSiteRead(request, config);
        if (!opaqueToken(token)) throw new AuthError("UNAUTHENTICATED", 401);
        if (request.method === "POST") {
          assertOrigin(request, config);
          verifyCsrf(
            request.headers.get("x-csrf-token"),
            config.sessionSecret,
            "session",
            token,
          );
        }
        const row = await (
          await deps.service()
        ).requireSession(token, false, request.method === "POST");
        return authResponse(sessionDto(row), requestId);
      }),
    logout: (request: Request) =>
      handleAuthRequest(async (requestId) => {
        const config = deps.config();
        assertOrigin(request, config);
        const names = cookieNames(config.production),
          token = requestCookie(request, names.session);
        verifyCsrf(
          request.headers.get("x-csrf-token"),
          config.sessionSecret,
          "session",
          token,
        );
        await (await deps.service()).logout(token, requestId);
        const res = authResponse({ loggedOut: true }, requestId);
        setCookie(res, names.session, "", 0, config);
        setCookie(res, names.prelogin, "", 0, config);
        return res;
      }),
  };
}
