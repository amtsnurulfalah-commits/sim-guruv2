export type ApiResult<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; error: { code: string; message: string; fieldErrors?: Record<string, string[]> }; requestId: string };
