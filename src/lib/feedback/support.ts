export type SupportEvent = { requestId: string; occurredAt: string; module: string; code: string; status: number };
export function supportEvent(requestId: string, module: string, code: string, status: number): SupportEvent {
  return { requestId, occurredAt: new Date().toISOString(), module: /^[a-z-]{1,40}$/.test(module) ? module : "unknown", code: /^[A-Z0-9_]{1,80}$/.test(code) ? code : "INTERNAL_ERROR", status };
}
