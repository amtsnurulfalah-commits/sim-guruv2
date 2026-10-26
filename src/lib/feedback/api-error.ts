import { fieldLabel, guidance } from "./catalog";
export type FieldErrors = Record<string, string[]>;
export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    summary: string,
    readonly status = 0,
    readonly fieldErrors: FieldErrors = {},
    readonly requestId?: string,
    readonly retryAfter?: number,
  ) {
    const fields = Object.entries(fieldErrors).flatMap(([key, values]) =>
      values.map((v) => `${fieldLabel(key)}: ${v}`),
    );
    super(
      [
        summary,
        ...fields,
        Object.hasOwn(guidance, code)
          ? guidance[code]
          : status >= 400
            ? "Periksa isian atau kondisi kegiatan yang dipilih. Jika tetap ditolak, hubungi administrator dengan nomor referensi."
            : undefined,
        retryAfter
          ? `Coba kembali setelah sekitar ${Math.ceil(retryAfter / 60)} menit.`
          : undefined,
        requestId ? `Referensi bantuan: ${requestId}` : undefined,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    this.name = "ApiRequestError";
  }
}
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
function statusCode(status: number) {
  return status === 401
    ? "UNAUTHENTICATED"
    : status === 403
      ? "FORBIDDEN"
      : status === 429
        ? "RATE_LIMITED"
        : status >= 500
          ? "UNAVAILABLE"
          : "INVALID_RESPONSE";
}
export async function readApiResponse<T>(
  response: Response,
  init: RequestInit = {},
): Promise<T> {
  let value: unknown;
  try {
    value = await response.json();
  } catch (error) {
    if (
      init.signal?.aborted ||
      (error instanceof Error &&
        ["TimeoutError", "AbortError", "TypeError"].includes(error.name))
    )
      throw transportError(error, init);
    throw new ApiRequestError(
      statusCode(response.status),
      "Jawaban layanan belum dapat dibaca. Muat ulang data; jika tadi menyimpan, periksa riwayat sebelum mengirim ulang.",
      response.status,
    );
  }
  if (response.ok && record(value) && value.ok === true && "data" in value)
    return value.data as T;
  const error = record(value) && record(value.error) ? value.error : {};
  const code =
    typeof error.code === "string" ? error.code : statusCode(response.status);
  const fields: FieldErrors = Object.create(null);
  if (record(error.fieldErrors))
    for (const [key, messages] of Object.entries(error.fieldErrors).slice(
      0,
      30,
    )) {
      if (/^[a-zA-Z0-9_.-]{1,100}$/.test(key) && Array.isArray(messages))
        fields[key] = messages
          .filter((v): v is string => typeof v === "string")
          .slice(0, 4)
          .map((v) => v.slice(0, 300));
    }
  const retry = Number(response.headers.get("retry-after"));
  const requestId =
    record(value) &&
    typeof value.requestId === "string" &&
    /^[a-zA-Z0-9-]{1,80}$/.test(value.requestId)
      ? value.requestId
      : undefined;
  throw new ApiRequestError(
    code,
    typeof error.message === "string"
      ? error.message.slice(0, 1500)
      : "Permintaan belum dapat diproses oleh layanan.",
    response.status,
    fields,
    requestId,
    Number.isFinite(retry) && retry > 0 ? retry : undefined,
  );
}
/** Normalize headers and body transport failures identically, never retry writes. */
function transportError(error: unknown, init: RequestInit): unknown {
  if (error instanceof ApiRequestError) return error;
  if (init.signal?.aborted && init.signal.reason?.name !== "TimeoutError")
    return error;
  const timeout =
    init.signal?.reason?.name === "TimeoutError" ||
    (error instanceof Error && error.name === "TimeoutError");
  const write = !["GET", "HEAD"].includes(init.method?.toUpperCase() ?? "GET");
  return new ApiRequestError(
    timeout ? "TIMEOUT" : "NETWORK_ERROR",
    `${timeout ? "Layanan belum menjawab dalam batas waktu." : "Koneksi ke layanan terputus."} Periksa koneksi internet Anda.${write ? " Status penyimpanan belum dapat dipastikan. Periksa riwayat atau muat ulang data sebelum mengirim ulang agar tidak membuat data ganda." : " Coba muat ulang data setelah koneksi kembali stabil."}`,
  );
}
/** Reject known offline writes before CSRF acquisition as well as dispatch. */
export function assertWriteConnection(method: string) {
  // A browser offline hint is a preflight rejection, not an uncertain server commit.
  // Online is only a hint too: a real transport failure still needs reconciliation.
  if (typeof navigator !== "undefined" && navigator.onLine === false &&
      !["GET", "HEAD"].includes(method.toUpperCase())) {
    throw new ApiRequestError("OFFLINE", "Perangkat sedang offline. Permintaan belum dikirim. Sambungkan internet, lalu simpan secara manual.");
  }
}
/** Never retry writes automatically: a lost response can follow a successful commit. */
export async function requestResponse(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  assertWriteConnection(init.method ?? "GET");
  try {
    return await fetch(path, { cache: "no-store", ...init });
  } catch (error) {
    throw transportError(error, init);
  }
}
export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return readApiResponse<T>(await requestResponse(path, init), init);
}
export async function downloadFile(
  path: string,
  filename: string,
  init: RequestInit = {},
) {
  const response = await requestResponse(path, {
    signal: AbortSignal.timeout(40000),
    ...init,
  });
  if (!response.ok) await readApiResponse<never>(response);
  const type = response.headers.get("content-type") ?? "";
  if (/application\/json/.test(type)) await readApiResponse<never>(response);
  if (
    !/application\/pdf|text\/csv|text\/calendar|application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/.test(
      type,
    )
  ) {
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Berkas unduhan belum dapat disiapkan. Muat ulang data dan coba unduh kembali.",
      response.status,
    );
  }
  let blob: Blob;
  try {
    blob = await response.blob();
  } catch {
    throw new ApiRequestError(
      "DOWNLOAD_INTERRUPTED",
      "Unduhan terputus sebelum berkas selesai diterima. Periksa koneksi, lalu unduh kembali.",
    );
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function serverFieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiRequestError
    ? Object.fromEntries(
        Object.entries(error.fieldErrors).map(([key, values]) => [
          key.split(".").at(-1)!,
          values.join(" "),
        ]),
      )
    : {};
}
