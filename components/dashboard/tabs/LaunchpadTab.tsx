"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Autocomplete,
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  DataTable,
  EmptyState,
  IndexTable,
  InlineGrid,
  InlineStack,
  Select,
  Text,
  TextField,
  Thumbnail,
} from "@shopify/polaris";
import OrdersChart from "@/components/charts/OrdersChart";
import RevenueChart from "@/components/charts/RevenueChart";
import PolarisProvider from "@/components/PolarisProvider";
import type { GeoCountdownCampaign, GeoCountdownPageTarget } from "@/lib/geoCountdown";
import {
  type Stats,
  type Product,
  type CartQuantityRule,
  type UpsellRule,
  type UpsellProduct,
  type BxgyProduct,
  type BxgyRule,
  type BxgySummary,
  type BxgyRuleStat,
  type ThemeSummary,
  type LaunchpadSchedule,
  type BundleOffer,
  type PostPurchaseProduct,
  type PostPurchaseOffer,
  type PostPurchaseSummary,
  type PostPurchaseOfferStat,
  type RuleStat,
  RANGES,
  fmt,
  calcTrend,
  safeJson,
  SearchableProductSelect,
  PolarisProductAutocomplete,
  SkeletonCard,
  StatCard,
  AppHealthCheck,
  ModuleOverviewStrip,
  BxgyOverviewStrip,
  hasMeaningfulVariants,
  bxgyOptionLabel,
} from "../shared";

export default function LaunchpadTab() {
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [schedules, setSchedules] = useState<LaunchpadSchedule[]>([]);
  const [timezones, setTimezones] = useState<string[]>(["UTC"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState("");
  const [localDateTime, setLocalDateTime] = useState("");
  const [timezone, setTimezone] = useState("UTC");

  const loadData = useCallback(async () => {
    const [themesResponse, launchpadResponse] = await Promise.all([
      fetch("/api/standalone/themes"),
      fetch("/api/standalone/launchpad"),
    ]);

    const themesData = await safeJson<{ themes?: ThemeSummary[]; error?: string }>(themesResponse);
    const launchpadData = await safeJson<{ schedules?: LaunchpadSchedule[]; timezones?: string[]; error?: string }>(launchpadResponse);

    if (!themesResponse.ok) throw new Error(themesData?.error ?? `HTTP ${themesResponse.status}`);
    if (!launchpadResponse.ok) throw new Error(launchpadData?.error ?? `HTTP ${launchpadResponse.status}`);

    setThemes(themesData?.themes ?? []);
    setSchedules(launchpadData?.schedules ?? []);
    setTimezones(launchpadData?.timezones ?? ["UTC"]);
    setTimezone((current) => (launchpadData?.timezones?.includes(current) ? current : (launchpadData?.timezones?.[0] ?? "UTC")));
  }, []);

  useEffect(() => {
    loadData()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load launchpad data."))
      .finally(() => setLoading(false));
  }, [loadData]);

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
            />
            <TextField
              label="Date and time"
              type="datetime-local"
              value={localDateTime}
              onChange={setLocalDateTime}
              autoComplete="off"
              helpText="Enter the launch time in the timezone selected on the right."
            />
            <Select
              label="Timezone"
              options={timezones.map((value) => ({ label: value, value }))}
              value={timezone}
              onChange={setTimezone}
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
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Status</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "right", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule, index) => (
                <tr key={schedule.id} style={{ borderBottom: index < schedules.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "0.85rem 0.9rem" }}>
                    <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#111827" }}>{schedule.themeName}</div>
                    <div style={{ fontSize: "0.76rem", color: "#6b7280", marginTop: "0.15rem" }}>{schedule.themeId}</div>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.82rem", color: "#374151" }}>
                    <div>{new Date(schedule.scheduledForUtc).toLocaleString()}</div>
                    <div style={{ color: "#6b7280", marginTop: "0.15rem" }}>
                      Saved with timezone: {schedule.timezone}
                    </div>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem" }}>
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
                  <td style={{ padding: "0.85rem 0.9rem", textAlign: "right" }}>
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
