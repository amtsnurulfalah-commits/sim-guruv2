/** Local, tab-scoped convenience only. Never an authorization or submission queue. */
export const DRAFT_TTL = 24 * 60 * 60 * 1000;
const prefix = "sim-guru:draft:v1:", ownerKey = "sim-guru:draft-owner:v1";
export type DraftScope = { account: string; module: "journal" | "bap"; entity: string; basis: string };
export type DraftFields = Record<string, number>;
export type Draft = { format: 1; account: string; module: string; entity: string; basis: string; savedAt: number; state: "editing" | "uncertain"; values: Record<string, string> };
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
export const draftKey = (scope: DraftScope) => prefix + [scope.account, scope.module, scope.entity].map(encodeURIComponent).join(":");
export function clearDrafts(storage: DraftStorage) {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key?.startsWith(prefix)) keys.push(key); }
  keys.forEach(key => storage.removeItem(key));
  storage.removeItem(ownerKey);
}
export function claimDraftAccount(storage: DraftStorage, account: string, now = Date.now()) {
  if (storage.getItem(ownerKey) !== account) clearDrafts(storage);
  storage.setItem(ownerKey, account);
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key?.startsWith(prefix)) keys.push(key); }
  for (const key of keys) {
    try { const value = JSON.parse(storage.getItem(key)!); if (value.account !== account || !Number.isFinite(value.savedAt) || value.savedAt > now || now - value.savedAt >= DRAFT_TTL) storage.removeItem(key); }
    catch { storage.removeItem(key); }
  }
}
export function readDraft(storage: DraftStorage, scope: DraftScope, fields: DraftFields, now = Date.now()): Draft | null {
  const key = draftKey(scope), raw = storage.getItem(key);
  if (!raw) return null;
  try {
    if (raw.length > 20000) throw Error("DRAFT_SIZE");
    const value = JSON.parse(raw) as Draft;
    if (value.format !== 1 || value.account !== scope.account || value.module !== scope.module || value.entity !== scope.entity || typeof value.basis !== "string" || value.basis.length > 10000 || !Number.isFinite(value.savedAt) || value.savedAt > now || now - value.savedAt >= DRAFT_TTL || !["editing", "uncertain"].includes(value.state) || !value.values || Array.isArray(value.values) || typeof value.values !== "object" || Object.keys(value.values).length !== Object.keys(fields).length || Object.entries(value.values).some(([key, text]) => !Object.hasOwn(fields, key) || typeof text !== "string" || text.length > fields[key]!)) throw Error("DRAFT_INVALID");
    return value;
  } catch { storage.removeItem(key); return null; }
}
export function writeDraft(storage: DraftStorage, scope: DraftScope, fields: DraftFields, values: Record<string, string>, state: Draft["state"] = "editing", now = Date.now()): Draft {
  if (storage.getItem(ownerKey) !== scope.account) throw Error("DRAFT_ACCOUNT_CHANGED");
  // Allowlist is fixed by each editor: no identity, version, token or hidden payload from a form.
  const safe: Record<string, string> = {};
  for (const [key, max] of Object.entries(fields)) {
    const text = values[key];
    if (typeof text !== "string" || text.length > max) throw Error("DRAFT_INVALID_FIELD");
    safe[key] = text;
  }
  const draft: Draft = { format: 1, ...scope, savedAt: now, state, values: safe };
  storage.setItem(draftKey(scope), JSON.stringify(draft));
  return draft;
}
export function resetBrowserDrafts() {
  try { clearDrafts(window.sessionStorage); } catch { /* Storage can be disabled. */ }
  window.dispatchEvent(new Event("sim-guru:drafts-cleared"));
}
