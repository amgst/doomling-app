"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BlockStack,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { safeJson } from "../shared";
import type { ThemeSummary, LaunchpadSchedule } from "../types/theme";

const POLL_INTERVAL_MS = 15000;

function formatScheduleTime(schedule: LaunchpadSchedule) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: schedule.timezone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(schedule.scheduledForUtc));
  } catch {
    return new Date(schedule.scheduledForUtc).toLocaleString();
  }
}

function formatRelativeDuration(ms: number) {
  if (ms <= 0) return "Awaiting cron publish";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function getScheduleCountdown(schedule: LaunchpadSchedule, now: number) {
  return Date.parse(schedule.scheduledForUtc) - now;
}

function getScheduleProgress(schedule: LaunchpadSchedule, now: number) {
  const start = Date.parse(schedule.createdAt);
  const end = Date.parse(schedule.scheduledForUtc);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;

  const ratio = ((now - start) / (end - start)) * 100;
  return Math.max(0, Math.min(100, ratio));
}

export default function LaunchpadTab() {
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [schedules, setSchedules] = useState<LaunchpadSchedule[]>([]);
  const [timezones, setTimezones] = useState<string[]>(["UTC"]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState("");
  const [localDateTime, setLocalDateTime] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [now, setNow] = useState(() => Date.now());
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const pollInFlight = useRef(false);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (silent) {
      if (pollInFlight.current) return;
      pollInFlight.current = true;
      setSyncing(true);
    }

    try {
      const [themesResponse, launchpadResponse] = await Promise.all([
        fetch("/api/standalone/themes", { cache: "no-store" }),
        fetch("/api/standalone/launchpad", { cache: "no-store" }),
      ]);

      const themesData = await safeJson<{ themes?: ThemeSummary[]; error?: string }>(themesResponse);
      const launchpadData = await safeJson<{ schedules?: LaunchpadSchedule[]; timezones?: string[]; error?: string }>(launchpadResponse);

      if (!themesResponse.ok) throw new Error(themesData?.error ?? `HTTP ${themesResponse.status}`);
      if (!launchpadResponse.ok) throw new Error(launchpadData?.error ?? `HTTP ${launchpadResponse.status}`);

      setThemes(themesData?.themes ?? []);
      setSchedules(launchpadData?.schedules ?? []);
      setTimezones(launchpadData?.timezones ?? ["UTC"]);
      setTimezone((current) => (launchpadData?.timezones?.includes(current) ? current : (launchpadData?.timezones?.[0] ?? "UTC")));
      setLastUpdatedAt(new Date().toISOString());
    } finally {
      if (silent) {
        pollInFlight.current = false;
        setSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load launchpad data."))
      .finally(() => setLoading(false));
  }, [loadData]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (schedules.every((schedule) => schedule.status !== "pending")) {
      setSyncing(false);
      return;
    }

    const poll = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadData({ silent: true }).catch(() => {});
    }, POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadData({ silent: true }).catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadData, schedules]);

  const scheduleTheme = async () => {
    const selectedTheme = themes.find((theme) => theme.id === selectedThemeId);
    if (!selectedTheme) {
      setError("Choose a theme to schedule.");
      return;
    }
    if (!localDateTime) {
      setError("Choose a local date and time.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/standalone/launchpad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themeId: selectedTheme.id,
          themeName: selectedTheme.name,
          localDateTime,
          timezone,
        }),
      });
      const data = await safeJson<{ schedules?: LaunchpadSchedule[]; timezones?: string[]; error?: string }>(response);
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      setSchedules(data?.schedules ?? []);
      setTimezones(data?.timezones ?? timezones);
      setSelectedThemeId("");
      setLocalDateTime("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule theme publish.");
    } finally {
      setSaving(false);
    }
  };

  const updateSchedule = async (id: string, action: "cancel" | "retry") => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/standalone/launchpad", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await safeJson<{ schedules?: LaunchpadSchedule[]; error?: string }>(response);
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      setSchedules(data?.schedules ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update launchpad schedule.");
    } finally {
      setSaving(false);
    }
  };

  const runDueSchedulesNow = async () => {
    setRunningNow(true);
    setError(null);
    try {
      const response = await fetch("/api/standalone/launchpad/run", { method: "POST" });
      const data = await safeJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run scheduled publishes.");
    } finally {
      setRunningNow(false);
    }
  };

  const mainTheme = themes.find((theme) => theme.role === "MAIN") ?? null;
  const draftThemes = themes.filter((theme) => theme.role !== "MAIN");
  const pendingCount = schedules.filter((schedule) => schedule.status === "pending").length;
  const shouldAutoRefresh = pendingCount > 0;
  const nextPendingSchedule = schedules
    .filter((schedule) => schedule.status === "pending")
    .slice()
    .sort((a, b) => Date.parse(a.scheduledForUtc) - Date.parse(b.scheduledForUtc))[0] ?? null;
  const nextPendingCountdown = nextPendingSchedule ? getScheduleCountdown(nextPendingSchedule, now) : null;

  if (loading) {
    return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading launchpad...</div>;
  }

  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Theme Scheduler</h1>
        <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.84rem", maxWidth: 840 }}>
          Schedule a theme to auto-publish later. The time is entered in the timezone you choose, then stored in UTC for reliable execution by the background cron.
        </p>
        <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.28rem 0.6rem",
            borderRadius: "999px",
            border: shouldAutoRefresh ? "1px solid #d1fae5" : "1px solid #e5e7eb",
            background: !shouldAutoRefresh ? "#f9fafb" : syncing ? "#fffbeb" : "#ecfdf5",
            color: !shouldAutoRefresh ? "#6b7280" : syncing ? "#92400e" : "#065f46",
            fontSize: "0.76rem",
            fontWeight: 700,
          }}>
            {!shouldAutoRefresh ? "Auto-refresh idle" : syncing ? "Syncing..." : "Live auto-refresh on"}
          </span>
          <span style={{ color: "#6b7280", fontSize: "0.76rem" }}>
            {shouldAutoRefresh
              ? `Refreshes every ${Math.round(POLL_INTERVAL_MS / 1000)} seconds${lastUpdatedAt ? `, last synced ${new Date(lastUpdatedAt).toLocaleTimeString()}` : ""}.`
              : "No pending schedule right now, so live polling is paused."}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", color: "#c0392b", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        {[
          { label: "Live theme", value: mainTheme?.name ?? "None", sub: "Current published storefront theme" },
          { label: "Scheduled publishes", value: pendingCount, sub: "Queued for automatic publish" },
          {
            label: "Next publish",
            value: nextPendingSchedule ? formatRelativeDuration(nextPendingCountdown ?? 0) : "None",
            sub: nextPendingSchedule ? `${nextPendingSchedule.themeName} will go live next` : "No pending auto-publish scheduled",
          },
          { label: "Timezone", value: timezone, sub: "Used for new schedules" },
        ].map((card) => (
          <div key={card.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.85rem 0.95rem" }}>
            <p style={{ margin: 0, fontSize: "0.73rem", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{card.label}</p>
            <p style={{ margin: "0.24rem 0 0.12rem", fontSize: "1.1rem", fontWeight: 700, color: "#111827" }}>{card.value}</p>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "#6b7280" }}>{card.sub}</p>
          </div>
        ))}
      </div>

      <Card>
        <BlockStack gap="400">
          <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
            <Select
              label="Theme to publish"
              options={[
                { label: draftThemes.length > 0 ? "Choose theme" : "No publishable themes found", value: "" },
                ...draftThemes.map((theme) => ({ label: `${theme.name} (${theme.role})`, value: theme.id })),
              ]}
              value={selectedThemeId}
              onChange={setSelectedThemeId}
              disabled={saving || draftThemes.length === 0}
            />
            <TextField
              label="Date and time"
              type="datetime-local"
              value={localDateTime}
              onChange={setLocalDateTime}
              autoComplete="off"
              helpText="Enter the launch time in the timezone selected on the right."
              disabled={saving}
            />
            <Select
              label="Timezone"
              options={timezones.map((value) => ({ label: value, value }))}
              value={timezone}
              onChange={setTimezone}
              disabled={saving}
            />
          </InlineGrid>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" tone="subdued">
              On Hobby, use `Run due schedules now` or an external scheduler to trigger queued publishes.
            </Text>
            <InlineStack gap="200">
              <Button onClick={runDueSchedulesNow} loading={runningNow}>
                Run due schedules now
              </Button>
              <Button variant="primary" onClick={scheduleTheme} loading={saving} disabled={!selectedThemeId || !localDateTime}>
                Schedule publish
              </Button>
            </InlineStack>
          </InlineStack>
        </BlockStack>
      </Card>

      <div style={{ marginTop: "1rem", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.1rem", borderBottom: "1px solid #e5e7eb" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Scheduled launches</p>
        </div>
        {schedules.length === 0 ? (
          <p style={{ margin: 0, padding: "1.5rem", color: "#6b7280" }}>
            No launches scheduled yet. Pick a theme, choose the local time, and queue it above.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Theme</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Scheduled time</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Progress</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Status</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "right", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule, index) => {
                const countdown = getScheduleCountdown(schedule, now);
                const progress = getScheduleProgress(schedule, now);

                return (
                <tr key={schedule.id} style={{ borderBottom: index < schedules.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "0.85rem 0.9rem", verticalAlign: "top" }}>
                    <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#111827" }}>{schedule.themeName}</div>
                    <div style={{ fontSize: "0.76rem", color: "#6b7280", marginTop: "0.15rem" }}>{schedule.themeId}</div>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.82rem", color: "#374151", verticalAlign: "top" }}>
                    <div>{formatScheduleTime(schedule)}</div>
                    <div style={{ color: "#6b7280", marginTop: "0.15rem" }}>
                      Stored as UTC: {new Date(schedule.scheduledForUtc).toUTCString()}
                    </div>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", minWidth: 220, verticalAlign: "top" }}>
                    {schedule.status === "pending" ? (
                      <>
                        <div style={{ fontSize: "0.84rem", fontWeight: 700, color: countdown <= 0 ? "#92400e" : "#111827" }}>
                          {formatRelativeDuration(countdown)}
                        </div>
                        <div style={{ marginTop: "0.18rem", fontSize: "0.75rem", color: "#6b7280" }}>
                          {countdown <= 0 ? "The scheduled time has passed. The next 1-minute cron run should publish this theme automatically." : "Time left until this theme should go live."}
                        </div>
                        {progress !== null && (
                          <div style={{ marginTop: "0.55rem" }}>
                            <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                              <div style={{
                                width: `${progress}%`,
                                height: "100%",
                                borderRadius: 999,
                                background: countdown <= 0 ? "#f59e0b" : "#10b981",
                                transition: "width 0.9s linear",
                              }} />
                            </div>
                            <div style={{ marginTop: "0.22rem", fontSize: "0.73rem", color: "#6b7280" }}>
                              {Math.round(progress)}% of the scheduled wait completed
                            </div>
                          </div>
                        )}
                      </>
                    ) : schedule.status === "published" ? (
                      <div style={{ fontSize: "0.78rem", color: "#166534" }}>
                        Published{schedule.publishedAt ? ` ${new Date(schedule.publishedAt).toLocaleString()}` : ""}
                      </div>
                    ) : schedule.status === "failed" ? (
                      <div style={{ fontSize: "0.78rem", color: "#b91c1c" }}>
                        Last attempt failed
                      </div>
                    ) : (
                      <div style={{ fontSize: "0.78rem", color: "#6b7280" }}>
                        Schedule stopped
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", verticalAlign: "top" }}>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.25rem 0.6rem",
                      borderRadius: "999px",
                      border: "1px solid " + (schedule.status === "published" ? "#bbf7d0" : schedule.status === "failed" ? "#fecaca" : "#e5e7eb"),
                      background: schedule.status === "published" ? "#f0fdf4" : schedule.status === "failed" ? "#fff1f2" : "#f9fafb",
                      color: schedule.status === "published" ? "#166534" : schedule.status === "failed" ? "#b91c1c" : "#6b7280",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                    }}>
                      {schedule.status}
                    </span>
                    {schedule.lastError && (
                      <div style={{ fontSize: "0.75rem", color: "#b91c1c", marginTop: "0.25rem", maxWidth: 320 }}>
                        {schedule.lastError}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", textAlign: "right", verticalAlign: "top" }}>
                    {schedule.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => void updateSchedule(schedule.id, "cancel")}
                        disabled={saving}
                        style={{
                          padding: "0.45rem 0.8rem",
                          background: "#fff",
                          color: "#b91c1c",
                          border: "1px solid #fecaca",
                          borderRadius: "8px",
                          fontSize: "0.8rem",
                          cursor: saving ? "not-allowed" : "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    )}
                    {schedule.status === "failed" && (
                      <button
                        type="button"
                        onClick={() => void updateSchedule(schedule.id, "retry")}
                        disabled={saving}
                        style={{
                          padding: "0.45rem 0.8rem",
                          background: "#111827",
                          color: "#fff",
                          border: "1px solid #111827",
                          borderRadius: "8px",
                          fontSize: "0.8rem",
                          cursor: saving ? "not-allowed" : "pointer",
                        }}
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
