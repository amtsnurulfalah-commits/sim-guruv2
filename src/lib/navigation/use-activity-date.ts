"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { wibDate } from "@/lib/calendar/schemas";
import { useUrlFilters } from "./use-url-filters";
const defaults = { date: "" };
const rules = {
  date: (value: string) =>
    value === "" || z.iso.date().safeParse(value).success,
};
/** Date only. Source ownership and eligibility are still enforced by each API/SQL command. */
export function useActivityDate() {
  const [defaultDate] = useState(wibDate);
  const [filters, update] = useUrlFilters(defaults, rules);
  // Keep an empty/partial input local so native date editing and validation still work.
  const [draft, setDraft] = useState<{ context: string; value: string } | null>(
    null,
  );
  useEffect(() => {
    const restore = () => setDraft(null);
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const date =
    draft?.context === filters.date ? draft.value : filters.date || defaultDate;
  const setDate = (value: string) => {
    if (value && rules.date(value)) {
      setDraft({ context: value, value });
      update({ date: value });
    } else setDraft({ context: filters.date, value });
  };
  return [date, setDate] as const;
}
