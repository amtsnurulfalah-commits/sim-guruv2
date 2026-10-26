import { releaseSeenKey } from "../release/notes";
import { z } from "zod";
import { modules } from "../navigation/modules";
export const preferenceKey = "sim-guru:preferences:v1";
export const preferenceEvent = "sim-guru:preferences-cleared";
const slugs = new Set(modules.filter(m => m.available).map(m => m.slug));
export const preferencesSchema = z.object({
  density: z.enum(["comfortable", "compact"]),
  taskPageSize: z.union([z.literal(10), z.literal(20), z.literal(50)]),
  pins: z.array(z.string().refine(v => slugs.has(v))).max(4).refine(v => new Set(v).size === v.length),
}).strict();
export type Preferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences = (): Preferences => ({ density: "comfortable", taskPageSize: 20, pins: [] });
const envelope = z.object({ version: z.literal(1), scope: z.string().min(1).max(100), values: preferencesSchema }).strict();
type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function readPreferences(storage: PreferenceStorage, scope: string): Preferences {
  const raw = storage.getItem(preferenceKey);
  if (!raw) return defaultPreferences();
  try {
    if (raw.length > 2000) throw Error("PREFERENCES_SIZE");
    const result = envelope.parse(JSON.parse(raw));
    if (result.scope !== scope) throw Error("PREFERENCES_ACCOUNT_CHANGED");
    return result.values;
  } catch { storage.removeItem(preferenceKey); return defaultPreferences(); }
}
export function writePreferences(storage: PreferenceStorage, scope: string, values: Preferences) {
  storage.setItem(preferenceKey, JSON.stringify(envelope.parse({ version: 1, scope, values })));
}
export function resetBrowserPreferences() {
  try { sessionStorage.removeItem(preferenceKey); sessionStorage.removeItem(releaseSeenKey); } catch { /* Optional browser storage. */ }
  window.dispatchEvent(new Event(preferenceEvent));
}
