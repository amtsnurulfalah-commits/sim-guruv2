export const APP_TIMEZONE = "Asia/Jakarta" as const;
export function formatDateTimeIndonesia(value: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIMEZONE, dateStyle: "long", timeStyle: "short", hour12: false,
  }).format(value);
}
