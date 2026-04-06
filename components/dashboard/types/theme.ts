export type LaunchpadScheduleStatus = "pending" | "published" | "failed" | "cancelled";

export interface ThemeSummary {
  id: string;
  name: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
  processing?: boolean;
  processingFailed?: boolean;
}

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
