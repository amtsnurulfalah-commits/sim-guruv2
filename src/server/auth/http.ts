import "server-only";
import { recordSupportEvent } from "../support/record";
import { supportEvent } from "@/lib/feedback/support";
import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { validationFieldErrors } from "./validation-feedback";
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
  RETRY_NOT_ALLOWED: "Status antrean atau pekerjaan sudah berubah dan tidak dapat dijadwalkan ulang. Muat ulang lalu periksa data terbaru.",
  RECONCILE_NOT_ALLOWED: "Status email sudah berubah. Muat ulang dan periksa hasil terbaru sebelum melakukan pemeriksaan kembali.",
  FINANCE_INVALID: "Data honorarium atau koreksi tidak sesuai aturan.",
  FINANCE_BLOCKED:
    "Finalisasi diblokir. Selesaikan seluruh temuan pada pratinjau.",
  FINAL_IMMUTABLE:
    "Snapshot final tidak dapat diubah. Gunakan koreksi pada periode terbuka.",
  HOLIDAY_NOT_DUE: "Posting libur hari ini tersedia mulai pukul 16.00 WIB.",
  DUTY_INVALID: "Jadwal tugas atau data operasi tidak sesuai aturan.",
  DUTY_COLLISION:
    "Guru atau tanggal bertabrakan dengan penugasan yang sudah ada. Pengganti lama tetap dipertahankan.",
  SUBSTITUTE_INVALID:
    "Pengganti harus guru aktif yang berbeda dari guru asli, pemilik efektif dan petugas yang menunjuk.",
  SELF_OPERATION_FORBIDDEN:
    "Anda tidak dapat mengesahkan perubahan kredit atau pengganti untuk tugas sendiri.",
  ADJUSTED_INVALID:
    "Penyesuaian harus bilangan bulat antara nol dan JTM terjadwal.",
  ALLOCATION_INVALID:
    "Penerima atau jumlah alokasi tidak sah. Gunakan angka positif maksimal empat desimal.",
  CONSERVATION_VIOLATION:
    "JTM pemilik ditambah seluruh alokasi melebihi JTM terjadwal.",

  ACTIVITY_INVALID: "Data kegiatan tidak sesuai aturan.",
  ACTIVITY_REFERENCED:
    "Kegiatan sudah memiliki bukti bertanggal. Perubahan dihentikan untuk melindungi riwayat.",
  TODAY_ONLY: "Tindakan ini hanya tersedia pada hari ini (WIB).",
  FINAL_PERIOD: "Periode sudah final; gunakan alur koreksi.",
  PREVIEW_STALE:
    "Pratinjau berubah, kedaluwarsa atau sudah dipakai. Buat pratinjau baru.",
  ASSIGNMENT_REQUIRED:
    "Guru tidak memiliki penugasan. Tambahkan sebagai peserta tambahan dengan alasan.",
  ATTENDANCE_TIME_INVALID:
    "Jam hadir tidak memenuhi jadwal atau urutan masuk-pulang.",
  LEAVE_OVERLAP: "Interval izin tidak sah atau bertumpang tindih.",
  STUDENT_COUNT_MISMATCH: "Jumlah siswa tidak sesuai standar kelas.",
  STUDENT_ATTENDANCE_MISMATCH:
    "Jumlah hadir/absen berbeda dengan rekap siswa atau jurnal yang sudah ada.",
  FUTURE_DATE: "Jurnal tanggal mendatang belum dapat diisi.",
  DATE_EXPIRED: "Batas input jurnal sudah berakhir.",
  H1_DISABLED: "Input jurnal H-1 belum diaktifkan administrator.",
  H1_NOT_CONFIRMED: "Kegiatan kemarin belum dikonfirmasi.",
  NO_ACTIVE_CONFIRMATION: "Kegiatan harus dikonfirmasi sebelum mengisi jurnal.",
  JOURNAL_BLOCKED:
    "Input/edit jurnal sedang diblokir pada mata pelajaran dan tanggal ini.",
  DUPLICATE_JOURNAL: "Jurnal untuk kegiatan ini sudah ada.",
  EXPORT_TOO_LARGE: "Hasil ekspor terlalu besar; persempit rentang tanggal.",

  EMAIL_DELIVERY_UNAVAILABLE:
    "Layanan pengiriman email belum siap. Hubungi administrator untuk mengaktifkannya, lalu minta kode kembali.",
  SCHEDULE_INVALID:
    "Jadwal, relasi, tanggal atau durasi tidak sesuai aturan. Jadwal tidak boleh melewati tengah malam.",
  SCHEDULE_COLLISION:
    "Jadwal bertabrakan dengan guru atau kelas pada rentang hari dan jam yang sama. Periksa hasil pemeriksaan bentrok.",
  SCHEDULE_HISTORICAL:
    "Riwayat jadwal dilindungi. Gunakan tanggal perubahan ke depan; jadwal tertutup/diarsipkan tidak dapat diedit.",
  CALENDAR_INVALID:
    "Tanggal, data kalender atau periode akademik tidak sesuai aturan.",
  CALENDAR_PAST:
    "Tanggal lampau tidak dapat diubah melalui kalender biasa. Gunakan alur koreksi historis yang sah.",
  CALENDAR_PREVIEW_INVALID:
    "Pratinjau sudah dipakai, kedaluwarsa, atau tidak sesuai tindakan/akun. Buat pratinjau baru.",
  CALENDAR_PREVIEW_STALE:
    "Kalender atau periode akademik berubah sejak pratinjau. Muat ulang dan periksa pratinjau baru.",
  CONTEXT_DEPENDENCY_UNAVAILABLE:
    "Integrasi pemeriksaan penugasan/keuangan belum tersedia. Perubahan dihentikan sampai integrasi lengkap.",
  MASTER_INVALID: "Data master tidak sesuai aturan atau relasi yang dipilih.",
  MASTER_OVERLAP:
    "Rentang tanggal bertumpang tindih dengan data yang sudah ada.",
  MASTER_REFERENCED:
    "Data masih dirujuk. Periksa relasi sebelum mengubah atau mengarsipkan.",
  MASTER_IMMUTABLE:
    "Tarif dan tunjangan disimpan sebagai versi tetap. Buat rentang baru; pembatalan hanya untuk rentang mendatang.",
  MASTER_PAST: "Tarif dan tunjangan baru tidak boleh berlaku surut.",
  LAST_ACTIVE_ADMIN:
    "Harus tetap ada administrator aktif yang sudah menyelesaikan pengamanan akun.",
  VERIFIED_EMAIL_IMMUTABLE:
    "Email terverifikasi hanya dapat diganti melalui pemulihan identitas yang sah.",
  ARCHIVED_READ_ONLY: "Akun telah diarsipkan dan tidak dapat diubah.",
  INVALID_STATUS_TRANSITION: "Perubahan status akun tidak diizinkan.",
  RECOVERY_REQUEST_INVALID:
    "Permintaan pemulihan tidak cocok, sudah diproses, atau kedaluwarsa.",
  ACTIVATION_NOT_ALLOWED:
    "Aktivasi ulang hanya tersedia untuk akun yang menunggu aktivasi.",
  NOT_FOUND: "Pengguna atau permintaan tidak ditemukan.",
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
export function handleModuleRequest(module: string, work: (requestId: string) => Promise<NextResponse>) {
  return handleAuthRequest(work, module);
}
export async function handleAuthRequest(
  work: (requestId: string) => Promise<NextResponse>,
  module = "auth",
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
    const calendarCode = [
      "CALENDAR_INVALID",
      "CALENDAR_PAST",
      "CALENDAR_PREVIEW_INVALID",
      "CALENDAR_PREVIEW_STALE",
      "CONTEXT_DEPENDENCY_UNAVAILABLE",
    ].includes(dbMessage)
      ? dbMessage
      : null;
    const masterCode = [
      "MASTER_INVALID",
      "MASTER_OVERLAP",
      "MASTER_REFERENCED",
      "MASTER_IMMUTABLE",
      "MASTER_PAST",
    ].includes(dbMessage)
      ? dbMessage
      : ["23503", "23514", "23502", "22007", "22008", "22P02"].includes(code)
        ? "MASTER_INVALID"
        : null;
    const scheduleCode = [
      "SCHEDULE_INVALID",
      "SCHEDULE_COLLISION",
      "SCHEDULE_HISTORICAL",
    ].includes(dbMessage)
      ? dbMessage
      : null;
    const activityCode = [
      "FINANCE_INVALID",
      "FINANCE_BLOCKED",
      "FINAL_IMMUTABLE",
      "HOLIDAY_NOT_DUE",
      "DUTY_INVALID",
      "DUTY_COLLISION",
      "SUBSTITUTE_INVALID",
      "SELF_OPERATION_FORBIDDEN",
      "ADJUSTED_INVALID",
      "ALLOCATION_INVALID",
      "CONSERVATION_VIOLATION",
      "ACTIVITY_INVALID",
      "ACTIVITY_REFERENCED",
      "TODAY_ONLY",
      "FINAL_PERIOD",
      "PREVIEW_STALE",
      "ASSIGNMENT_REQUIRED",
      "ATTENDANCE_TIME_INVALID",
      "LEAVE_OVERLAP",
      "STUDENT_COUNT_MISMATCH",
      "STUDENT_ATTENDANCE_MISMATCH",
      "FUTURE_DATE",
      "DATE_EXPIRED",
      "H1_DISABLED",
      "H1_NOT_CONFIRMED",
      "NO_ACTIVE_CONFIRMATION",
      "JOURNAL_BLOCKED",
      "DUPLICATE_JOURNAL",
      "EXPORT_TOO_LARGE",
    ].includes(dbMessage)
      ? dbMessage
      : null;
    const mapped = activityCode
      ? new AuthError(
          activityCode,
          [
            "ACTIVITY_REFERENCED",
            "PREVIEW_STALE",
            "DUPLICATE_JOURNAL",
            "DUTY_COLLISION",
            "FINAL_PERIOD",
          ].includes(activityCode)
            ? 409
            : [
                  "TODAY_ONLY",
                  "SELF_OPERATION_FORBIDDEN",
                  "ASSIGNMENT_REQUIRED",
                  "H1_DISABLED",
                  "H1_NOT_CONFIRMED",
                  "NO_ACTIVE_CONFIRMATION",
                  "JOURNAL_BLOCKED",
                ].includes(activityCode)
              ? 403
              : 422,
        )
      : scheduleCode
        ? new AuthError(
            scheduleCode,
            scheduleCode === "SCHEDULE_COLLISION"
              ? 409
              : scheduleCode === "SCHEDULE_HISTORICAL"
                ? 403
                : 422,
          )
        : calendarCode
          ? new AuthError(
              calendarCode,
              calendarCode === "CONTEXT_DEPENDENCY_UNAVAILABLE"
                ? 503
                : calendarCode === "CALENDAR_PREVIEW_STALE" ||
                    calendarCode === "CALENDAR_PREVIEW_INVALID"
                  ? 409
                  : calendarCode === "CALENDAR_PAST"
                    ? 403
                    : 422,
            )
          : masterCode
            ? new AuthError(
                masterCode,
                masterCode === "MASTER_OVERLAP" ||
                masterCode === "MASTER_REFERENCED"
                  ? 409
                  : 422,
              )
            : [
                  "UNAUTHENTICATED",
                  "ONBOARDING_REQUIRED",
                  "FORBIDDEN",
                  "MAINTENANCE",
                  "LAST_ACTIVE_ADMIN",
                  "VERIFIED_EMAIL_IMMUTABLE",
                  "ARCHIVED_READ_ONLY",
                  "INVALID_STATUS_TRANSITION",
                  "RECOVERY_REQUEST_INVALID",
                  "ACTIVATION_NOT_ALLOWED",
                  "NOT_FOUND",
                ].includes(dbMessage)
              ? new AuthError(
                  dbMessage,
                  dbMessage === "NOT_FOUND"
                    ? 404
                    : dbMessage === "INVALID_STATUS_TRANSITION"
                      ? 422
                      : dbMessage === "UNAUTHENTICATED"
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
    recordSupportEvent(supportEvent(requestId, module, auth.code, auth.status));
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: auth.code,
          message: messages[auth.code] ?? messages.UNAVAILABLE,
          ...(auth.code === "VALIDATION_ERROR" && validationFieldErrors(error)
            ? { fieldErrors: validationFieldErrors(error) }
            : {}),
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
