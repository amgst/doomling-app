export type LaunchpadScheduleStatus = "pending" | "published" | "failed" | "cancelled";

export interface LaunchpadSchedule {
  id: string;
  themeId: string;
  themeName: string;
  scheduledForUtc: string;
  timezone: string;
  status: LaunchpadScheduleStatus;
  createdAt: string;
  publishedAt?: string;
  cancelledAt?: string;
  lastError?: string;
}

export const SUPPORTED_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
] as const;

function parseLocalDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

function getTimeZoneOffsetMinutes(timeZone: string, utcDate: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(utcDate);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const zonedUtcMillis = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );

  return Math.round((zonedUtcMillis - utcDate.getTime()) / 60000);
}

export function localDateTimeToUtcIso(localDateTime: string, timeZone: string) {
  const parsed = parseLocalDateTime(localDateTime);
  if (!parsed) return null;
  if (!SUPPORTED_TIMEZONES.includes(timeZone as (typeof SUPPORTED_TIMEZONES)[number])) return null;

  const approximateUtcMillis = Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute, 0);
  const approximateUtc = new Date(approximateUtcMillis);
  const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, approximateUtc);
  const exactUtc = new Date(approximateUtcMillis - offsetMinutes * 60000);
  return exactUtc.toISOString();
}

export function normalizeLaunchpadSchedule(input: unknown, index: number): LaunchpadSchedule | null {
  if (!input || typeof input !== "object") return null;

  const value = input as Record<string, unknown>;
  const themeId = String(value.themeId ?? "").trim();
  const themeName = String(value.themeName ?? "").trim();
  const scheduledForUtc = String(value.scheduledForUtc ?? "").trim();
  const timezone = String(value.timezone ?? "UTC").trim();
  const status = String(value.status ?? "pending").trim() as LaunchpadScheduleStatus;
  const createdAt = String(value.createdAt ?? "").trim();

  if (!themeId || !themeName || !scheduledForUtc || !createdAt) return null;
  if (!["pending", "published", "failed", "cancelled"].includes(status)) return null;
  if (!SUPPORTED_TIMEZONES.includes(timezone as (typeof SUPPORTED_TIMEZONES)[number])) return null;
  if (Number.isNaN(Date.parse(scheduledForUtc)) || Number.isNaN(Date.parse(createdAt))) return null;

  return {
    id: String(value.id ?? `launchpad-${index}`),
    themeId,
    themeName,
    scheduledForUtc: new Date(scheduledForUtc).toISOString(),
    timezone,
    status,
    createdAt: new Date(createdAt).toISOString(),
    publishedAt: value.publishedAt ? new Date(String(value.publishedAt)).toISOString() : undefined,
    cancelledAt: value.cancelledAt ? new Date(String(value.cancelledAt)).toISOString() : undefined,
    lastError: value.lastError ? String(value.lastError) : undefined,
  };
}

export function sortLaunchpadSchedules(schedules: LaunchpadSchedule[]) {
  return schedules.slice().sort((a, b) => {
    const aTime = Date.parse(a.scheduledForUtc);
    const bTime = Date.parse(b.scheduledForUtc);
    return bTime - aTime;
  });
}
