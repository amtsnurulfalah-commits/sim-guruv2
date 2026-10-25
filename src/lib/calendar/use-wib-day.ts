"use client";
import { useEffect, useState } from "react";
import { wibDate } from "@/lib/calendar/schemas";

/** Refresh only when the WIB date changes, including after returning to a sleeping tab. */
export function useWibDay(initial: string) {
  const [date, setDate] = useState(initial);
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "hidden") setDate(wibDate());
    };
    check();
    const timer = window.setInterval(check, 60000);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return date;
}
