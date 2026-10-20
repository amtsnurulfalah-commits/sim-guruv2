import { createHash } from "node:crypto";
import { exportSchema, type Profile, type Issue } from "./contracts";
import {
  booleanValue,
  decimalValue,
  isoDate,
  localTime,
  textIdentifier,
} from "./normalize";
export function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => [k, canonical(x)]),
    );
  return v;
}
export const checksum = (v: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(v)))
    .digest("hex");
const secret =
  /password|passwd|sandi|secret|token|otp|answer|jawaban|api[_ -]?key|credential|cookie|authorization/i;
const forbiddenSheet =
  /^(sessions?|security_questions?|verification_challenges|propertiesservice|auth_rate_limits|reset_tokens?)$/i;
const idFields: Record<string, string[]> = Object.assign(Object.create(null), {
  Users: ["user_id", "id"],
  Schedules: ["schedule_id", "id"],
  Teaching_Logs: ["log_id", "journal_id", "id"],
  Honor_History: ["trx_id", "id"],
  Event_Attendance: ["attendance_id", "id"],
  Event_Journals: ["journal_id", "id"],
  Exam_BAP: ["bap_id", "id"],
  Substitutes: ["sub_id", "id"],
  Announcements: ["announcement_id", "id"],
});
const supported = new Set([
  "Users",
  "Schedules",
  "Teaching_Logs",
  "Config",
  "Academic_Calendar",
  "Honor_History",
  "Picket_Schedules",
  "Ceremony_Schedules",
  "Substitutes",
  "Daily_Attendance",
  "Attendance_Leaves",
  "Attendance_Sched_Templates",
  "Student_Attendance",
  "Announcements",
  "Allowances",
  "Exam_Periods",
  "Exam_Sessions",
  "Exam_Rooms",
  "Exam_Room_Classes",
  "Exam_Committee",
  "Exam_Supervisors",
  "Exam_BAP",
  "Event_Definitions",
  "Event_Attendance",
  "Event_Journals",
  "Jtm_Adjustments",
  "Jtm_Reallocations",
  "Transport_Blocks",
  "Journal_Blocks",
  "Event_Blocks",
]);
export function profileExport(input: unknown): Profile {
  const e = exportSchema.parse(input),
    issues: Issue[] = [],
    rows: Profile["rows"] = [],
    seenSheets = new Set<string>();
  let redacted = 0;
  const add = (
    code: string,
    sheet: string,
    row: number | null,
    field: string | null,
    severity: Issue["severity"] = "error",
  ) => issues.push({ code, sheet, row, field, severity });
  for (const sheet of e.sheets) {
    if (seenSheets.has(sheet.name.toLowerCase()))
      add("DUPLICATE_SHEET", sheet.name, null, null);
    seenSheets.add(sheet.name.toLowerCase());
    if (forbiddenSheet.test(sheet.name)) {
      redacted += sheet.rows.length * sheet.headers.length;
      add("AUTH_DATA_EXCLUDED", sheet.name, null, null, "review");
      continue;
    }
    if (!supported.has(sheet.name))
      add("UNMAPPED_SOURCE_SHEET", sheet.name, null, null, "review");
    const headers = sheet.headers.map((h) => h.trim()),
      safe = headers.filter((h) => !secret.test(h));
    if (
      headers.some((h) => !h) ||
      new Set(headers.map((h) => h.toLowerCase())).size !== headers.length
    )
      add("INVALID_OR_DUPLICATE_HEADERS", sheet.name, null, null);
    const ids = new Set<string>(),
      usernames = new Set<string>();
    for (const [i, cells] of sheet.rows.entries()) {
      const row = i + 2,
        raw: Record<string, unknown> = Object.create(null),
        normalized: Record<string, unknown> = Object.create(null);
      if (
        sheet.name === "Config" &&
        headers.some(
          (h, j) =>
            /^(key|name|property)$/i.test(h) &&
            typeof cells[j] === "string" &&
            secret.test(cells[j] as string),
        )
      ) {
        redacted += cells.length;
        add("SECRET_CONFIG_EXCLUDED", sheet.name, row, null, "review");
        continue;
      }
      if (cells.length !== headers.length)
        add("ROW_WIDTH_MISMATCH", sheet.name, row, null);
      headers.forEach((h, j) => {
        if (secret.test(h)) {
          if (cells[j] !== null && cells[j] !== undefined && cells[j] !== "")
            redacted++;
          return;
        }
        let value = cells[j] ?? null;
        if (h === "details_json" && typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            const cleanse = (x: unknown): unknown =>
              Array.isArray(x)
                ? x.map(cleanse)
                : x && typeof x === "object"
                  ? Object.fromEntries(
                      Object.entries(x)
                        .filter(([k]) => {
                          if (secret.test(k)) {
                            redacted++;
                            return false;
                          }
                          return true;
                        })
                        .map(([k, v]) => [k, cleanse(v)]),
                    )
                  : x;
            value = JSON.stringify(cleanse(parsed));
          } catch {
            add("INVALID_DETAILS_JSON", sheet.name, row, h);
            value = null;
          }
        }
        raw[h] = value;
      });
      for (const [key, value] of Object.entries(raw)) {
        if (typeof value === "string" && secret.test(key)) continue;
        if (value === null || value === "") {
          normalized[key] = value;
          continue;
        }
        try {
          if (/^(id|.*_id|nip)$/i.test(key))
            normalized[key] = textIdentifier(value);
          else if (key === "username") {
            const name = textIdentifier(value).toLowerCase();
            if (!/^[a-z0-9._-]{3,64}$/.test(name))
              throw new Error("USERNAME_MAPPING_REQUIRED");
            if (usernames.has(name)) throw new Error("DUPLICATE_USERNAME");
            usernames.add(name);
            normalized[key] = name;
          } else if (
            /^(date|tanggal|date_start|date_end|valid_from|valid_to)$/i.test(
              key,
            )
          )
            normalized[key] = isoDate(value, e.dateFormat);
          else if (
            /^(time_start|time_end|time_in|time_out|leave_time|return_time|jam_mulai|jam_selesai)$/i.test(
              key,
            )
          )
            normalized[key] = localTime(value);
          else if (
            /^(is_holiday|active|enabled|is_active|extra_attendee)$/i.test(key)
          )
            normalized[key] = booleanValue(value);
          else if (
            /^(jtm|jtm_val|total_jtm|total_honor|amount|nominal|km_distance|credited_jtm)$/i.test(
              key,
            )
          )
            normalized[key] = decimalValue(value);
          else if (key === "details_json" && typeof value === "string") {
            JSON.parse(value);
            normalized[key] = value;
          } else normalized[key] = value;
        } catch (err) {
          add(
            err instanceof Error ? err.message : "INVALID_VALUE",
            sheet.name,
            row,
            key,
          );
          normalized[key] = value;
        }
      }
      const idKey = (idFields[sheet.name] ?? ["id"]).find((h) =>
        headers.includes(h),
      );
      const legacyId =
        idKey && typeof normalized[idKey] === "string"
          ? String(normalized[idKey])
          : null;
      if (legacyId) {
        if (ids.has(legacyId))
          add("DUPLICATE_LEGACY_ID", sheet.name, row, idKey!);
        ids.add(legacyId);
      } else if (sheet.name !== "Config" && sheet.name !== "Academic_Calendar")
        add("LEGACY_ID_MAPPING_REQUIRED", sheet.name, row, null, "review");
      if (
        typeof normalized.time_start === "string" &&
        typeof normalized.time_end === "string" &&
        normalized.time_end <= normalized.time_start
      )
        add("INVALID_TIME_INTERVAL", sheet.name, row, "time_end");
      if (
        typeof normalized.date_start === "string" &&
        typeof normalized.date_end === "string" &&
        normalized.date_end < normalized.date_start
      )
        add("INVALID_DATE_INTERVAL", sheet.name, row, "date_end");
      if (
        ["Schedules", "Ceremony_Schedules"].includes(sheet.name) &&
        (!raw.tahun_pelajaran || !raw.semester)
      )
        add(
          "ACADEMIC_PERIOD_MAPPING_REQUIRED",
          sheet.name,
          row,
          null,
          "review",
        );
      if (sheet.name === "Honor_History")
        add("LEGACY_SNAPSHOT_REVIEW_REQUIRED", sheet.name, row, null, "review");
      rows.push({ sheet: sheet.name, row, raw, normalized, legacyId });
    }
    // Keep original ordering, but never persist credential header names or cells.
    void safe;
  }
  const userIds = new Set(
    rows.filter((r) => r.sheet === "Users").map((r) => r.legacyId),
  );
  for (const r of rows)
    if (
      r.sheet !== "Users" &&
      typeof r.normalized.user_id === "string" &&
      !userIds.has(r.normalized.user_id)
    )
      add("ORPHAN_USER_REFERENCE", r.sheet, r.row, "user_id");
  return {
    version: 1,
    source: e.source,
    sourceChecksum: checksum(e),
    exportedAt: e.exportedAt,
    timezone: e.timezone,
    metadata: {
      locale: e.locale,
      dateFormat: e.dateFormat,
      triggers: e.triggers,
      sheets: e.sheets
        .filter((s) => !forbiddenSheet.test(s.name))
        .map((s) => ({
          name: s.name,
          headers: s.headers.filter((h) => !secret.test(h)),
          count: s.rows.length,
        })),
    },
    rows,
    issues,
    summary: {
      rows: rows.length,
      errors: issues.filter((i) => i.severity === "error").length,
      review: issues.filter((i) => i.severity === "review").length,
      redactedFields: redacted,
    },
  };
}
