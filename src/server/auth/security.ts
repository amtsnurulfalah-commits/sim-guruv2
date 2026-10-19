import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { AuthError } from "./service";
export type HttpAuthConfig = {
    appUrl: string;
    sessionSecret: string;
    production: boolean;
    vercel: boolean;
};
export const opaqueToken = (value: string | undefined): value is string => Boolean(value && /^[A-Za-z0-9_-]{43}$/u.test(value));
export function cookieNames(production: boolean) { return { session: production ? "__Host-sim_guru_session" : "sim_guru_session_dev", prelogin: production ? "__Host-sim_guru_prelogin" : "sim_guru_prelogin_dev" }; }
export function requestCookie(request: Request, name: string): string | undefined {
    const raw = request.headers.get("cookie") ?? "";
    if (raw.length > 8192)
        throw new AuthError("FORBIDDEN", 403);
    const values = raw.split(";").map(part => part.trim()).filter(part => part.startsWith(name + "="));
    if (values.length > 1)
        throw new AuthError("FORBIDDEN", 403);
    return values[0]?.slice(name.length + 1);
}
export function assertOrigin(request: Request, config: HttpAuthConfig) {
    if (request.headers.get("origin") !== new URL(config.appUrl).origin || request.headers.get("sec-fetch-site") === "cross-site")
        throw new AuthError("FORBIDDEN", 403);
}
export function rejectCrossSiteRead(request: Request, config: HttpAuthConfig) {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(config.appUrl).origin))
        throw new AuthError("FORBIDDEN", 403);
}
function signature(secret: string, purpose: string, binding: string, value: string) { return createHmac("sha256", secret).update(JSON.stringify(["sim-guru:csrf:v1", purpose, binding, value])).digest("base64url"); }
export function issueCsrf(secret: string, purpose: "login" | "session", binding: string, now = Date.now()) {
    const value = `${Math.floor(now / 1000) + 900}.${randomBytes(24).toString("base64url")}`;
    return `${value}.${signature(secret, purpose, binding, value)}`;
}
export function verifyCsrf(token: string | null, secret: string, purpose: "login" | "session", binding: string | undefined, now = Date.now()) {
    if (!opaqueToken(binding) || !token || token.length > 150)
        throw new AuthError("CSRF_INVALID", 403);
    const match = /^(\d{10})\.([A-Za-z0-9_-]{32})\.([A-Za-z0-9_-]{43})$/u.exec(token);
    if (!match || Number(match[1]) <= Math.floor(now / 1000) || Number(match[1]) > Math.floor(now / 1000) + 900)
        throw new AuthError("CSRF_INVALID", 403);
    const expected = signature(secret, purpose, binding, `${match[1]}.${match[2]}`);
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(match[3]!)))
        throw new AuthError("CSRF_INVALID", 403);
}
export function sourceIp(request: Request, config: HttpAuthConfig) {
    // Vercel edge menulis ulang header ini; development mengabaikan seluruh header forwarding.
    if (!config.production)
        return "local-development";
    if (!config.vercel)
        throw new AuthError("UNAVAILABLE", 503);
    const ip = request.headers.get("x-vercel-forwarded-for")?.trim();
    if (!ip || !isIP(ip))
        throw new AuthError("UNAVAILABLE", 503);
    if (ip.toLowerCase().startsWith("::ffff:") && isIP(ip.slice(7)) === 4)
        return ip.slice(7);
    return isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname.toLowerCase() : ip;
}
export async function boundedJson(request: Request) {
    if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json")
        throw new AuthError("VALIDATION_ERROR", 422);
    const reader = request.body?.getReader();
    if (!reader)
        throw new AuthError("VALIDATION_ERROR", 422);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const part = await reader.read();
            if (part.done)
                break;
            size += part.value.byteLength;
            if (size > 8192) {
                await reader.cancel();
                throw new AuthError("VALIDATION_ERROR", 422);
            }
            chunks.push(part.value);
        }
        return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    }
    catch (error) {
        if (error instanceof AuthError)
            throw error;
        throw new AuthError("VALIDATION_ERROR", 422);
    }
    finally {
        reader.releaseLock();
    }
}
