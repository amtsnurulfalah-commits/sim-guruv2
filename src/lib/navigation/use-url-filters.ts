"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  readUrlFilters,
  writeUrlFilters,
  type FilterRules,
} from "./url-filters";
const changed = "sim-guru:url-filters";
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener("pageshow", listener);
  window.addEventListener(changed, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("pageshow", listener);
    window.removeEventListener(changed, listener);
  };
}
/** Native History API integrates with App Router without remounting the shell.
 * Do not pass draft contents, account identifiers, or free-text searches here.
 * Keep defaults and rules at module scope so parsed state remains stable.
 */
export function useUrlFilters<T extends Record<string, string>>(
  defaults: T,
  rules: FilterRules<T>,
) {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  const values = useMemo(
    () => readUrlFilters(search, defaults, rules),
    [search, defaults, rules],
  );
  const update = useCallback(
    (patch: Partial<T>, mode: "push" | "replace" = "push") => {
      // Read live history so rapid consecutive changes do not overwrite each other.
      const current = readUrlFilters(window.location.search, defaults, rules);
      const href = writeUrlFilters(
        window.location.href,
        { ...current, ...patch },
        defaults,
        rules,
      );
      if (
        href ===
        window.location.pathname + window.location.search + window.location.hash
      )
        return;
      window.history[mode === "push" ? "pushState" : "replaceState"](
        null,
        "",
        href,
      );
      window.dispatchEvent(new Event(changed));
    },
    [defaults, rules],
  );
  return [values, update] as const;
}
