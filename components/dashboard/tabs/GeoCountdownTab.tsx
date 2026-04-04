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

export default function GeoCountdownTab() {
  const [campaigns, setCampaigns] = useState<GeoCountdownCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Weekend flash sale");
  const [eyebrow, setEyebrow] = useState("Limited-time offer");
  const [heading, setHeading] = useState("Offer ends soon");
  const [message, setMessage] = useState("Create urgency for shoppers in selected countries.");
  const [endAt, setEndAt] = useState("");
  const [countryCodes, setCountryCodes] = useState("US,CA");
  const [pageTarget, setPageTarget] = useState<GeoCountdownPageTarget>("all");
  const [priority, setPriority] = useState("1");
  const [hideOnExpire, setHideOnExpire] = useState(true);
  const [expiredLabel, setExpiredLabel] = useState("Offer expired");

  useEffect(() => {
    fetch("/api/standalone/geo-countdown")
      .then((response) => safeJson<{ campaigns?: GeoCountdownCampaign[]; error?: string }>(response).then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
        setCampaigns(data?.campaigns ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load countdown campaigns."))
      .finally(() => setLoading(false));
  }, []);

  const saveCampaigns = async (nextCampaigns: GeoCountdownCampaign[]) => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/standalone/geo-countdown", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaigns: nextCampaigns }),
      });
      const data = await safeJson<{ campaigns?: GeoCountdownCampaign[]; error?: string }>(response);
      if (!response.ok) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }
      setCampaigns(data?.campaigns ?? nextCampaigns);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save countdown campaigns.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName("Weekend flash sale");
    setEyebrow("Limited-time offer");
    setHeading("Offer ends soon");
    setMessage("Create urgency for shoppers in selected countries.");
    setCountryCodes("US,CA");
    setPageTarget("all");
    setPriority("1");
    setHideOnExpire(true);
    setExpiredLabel("Offer expired");
    setEndAt("");
  };

  const handleAddCampaign = async () => {
    if (!name.trim()) {
      setError("Enter a campaign name.");
      return;
    }
    if (!heading.trim()) {
      setError("Enter a countdown heading.");
      return;
    }
    if (!endAt.trim()) {
      setError("Choose an end date and time.");
      return;
    }

    const parsed = Date.parse(endAt);
    if (Number.isNaN(parsed)) {
      setError("Use a valid end date and time.");
      return;
    }

    const nextCampaigns: GeoCountdownCampaign[] = [
      ...campaigns,
      {
        id: `geo-countdown-${Date.now()}`,
        name: name.trim(),
        eyebrow: eyebrow.trim(),
        heading: heading.trim(),
        message: message.trim(),
        endAt: new Date(parsed).toISOString(),
        countryCodes: countryCodes
          .split(",")
          .map((entry) => entry.trim().toUpperCase())
          .filter(Boolean),
        pageTarget,
        priority: Math.max(1, Math.min(100, Number(priority) || 1)),
        enabled: true,
        hideOnExpire,
        expiredLabel: expiredLabel.trim() || "Offer expired",
      },
    ];

    const saved = await saveCampaigns(nextCampaigns);
    if (saved) resetForm();
  };

  const handleCampaignChange = async (campaignId: string, patch: Partial<GeoCountdownCampaign>) => {
    const nextCampaigns = campaigns.map((campaign) => (campaign.id === campaignId ? { ...campaign, ...patch } : campaign));
    await saveCampaigns(nextCampaigns);
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    await saveCampaigns(campaigns.filter((campaign) => campaign.id !== campaignId));
  };

  const activeCampaigns = campaigns.filter((campaign) => campaign.enabled);

  if (loading) {
    return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading geo countdown campaigns...</div>;
  }

  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Geo Countdown</h1>
        <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.84rem", maxWidth: 780 }}>
          Manage countdown campaigns here, then render the active one through the Geo Countdown app embed on your storefront.
        </p>
      </div>

      {error && (
        <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", color: "#c0392b", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        {[
          { label: "Campaigns", value: campaigns.length, sub: "Saved countdown campaigns" },
          { label: "Enabled now", value: activeCampaigns.length, sub: `${campaigns.length - activeCampaigns.length} paused` },
          { label: "Storefront", value: "Embed", sub: "Use the Geo Countdown app embed" },
        ].map((card) => (
          <div key={card.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.85rem 0.95rem" }}>
            <p style={{ margin: 0, fontSize: "0.73rem", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{card.label}</p>
            <p style={{ margin: "0.24rem 0 0.12rem", fontSize: "1.35rem", fontWeight: 700, color: "#111827" }}>{card.value}</p>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "#6b7280" }}>{card.sub}</p>
          </div>
        ))}
      </div>

      <Card>
        <BlockStack gap="400">
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <TextField label="Campaign name" value={name} onChange={setName} autoComplete="off" />
            <Select
              label="Page target"
              options={[
                { label: "All pages", value: "all" },
                { label: "Home only", value: "home" },
                { label: "Product only", value: "product" },
                { label: "Collection only", value: "collection" },
              ]}
              value={pageTarget}
              onChange={(value) => setPageTarget(value as GeoCountdownPageTarget)}
            />
            <TextField label="Eyebrow" value={eyebrow} onChange={setEyebrow} autoComplete="off" />
            <TextField label="Heading" value={heading} onChange={setHeading} autoComplete="off" />
            <TextField label="Message" value={message} onChange={setMessage} autoComplete="off" multiline={3} />
            <TextField label="Country codes" value={countryCodes} onChange={setCountryCodes} autoComplete="off" helpText="Comma-separated ISO codes like US,CA,GB. Leave blank to show everywhere." />
            <TextField label="End date and time" type="datetime-local" value={endAt} onChange={setEndAt} autoComplete="off" />
            <TextField label="Priority" type="number" value={priority} onChange={setPriority} autoComplete="off" helpText="Lower numbers win when multiple campaigns match." />
            <TextField label="Expired label" value={expiredLabel} onChange={setExpiredLabel} autoComplete="off" />
            <div style={{ display: "flex", alignItems: "end" }}>
              <Checkbox label="Hide countdown when expired" checked={hideOnExpire} onChange={setHideOnExpire} />
            </div>
          </InlineGrid>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" tone="subdued">
              Enable the `Geo countdown` app embed in the theme customizer to display the active matching campaign, or set Display mode to Specific campaign and paste a Campaign ID from the table below.
            </Text>
            <Button variant="primary" onClick={handleAddCampaign} loading={saving}>
              Add campaign
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>

      <div style={{ marginTop: "1rem", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.1rem", borderBottom: "1px solid #e5e7eb" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Configured countdown campaigns</p>
        </div>
        {campaigns.length === 0 ? (
          <p style={{ margin: 0, padding: "1.5rem", color: "#6b7280" }}>
            No countdown campaigns yet. Create one above, then enable the Geo Countdown app embed in your theme.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Campaign</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Campaign ID</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Target</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Ends</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Status</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "right", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign, index) => (
                <tr key={campaign.id} style={{ borderBottom: index < campaigns.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "0.85rem 0.9rem" }}>
                    <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#111827" }}>{campaign.name}</div>
                    <div style={{ fontSize: "0.77rem", color: "#6b7280", marginTop: "0.15rem" }}>{campaign.heading}</div>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.77rem", color: "#6b7280", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>{campaign.id}</td>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.82rem", color: "#374151" }}>
                    <div>{campaign.pageTarget === "all" ? "All pages" : campaign.pageTarget}</div>
                    <div style={{ color: "#6b7280", marginTop: "0.15rem" }}>
                      {campaign.countryCodes.length > 0 ? campaign.countryCodes.join(", ") : "All countries"}
                    </div>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.82rem", color: "#374151" }}>
                    {new Date(campaign.endAt).toLocaleString()}
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem" }}>
                    <button
                      type="button"
                      onClick={() => void handleCampaignChange(campaign.id, { enabled: !campaign.enabled })}
                      disabled={saving}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "0.25rem 0.6rem",
                        borderRadius: "999px",
                        border: "1px solid " + (campaign.enabled ? "#bbf7d0" : "#e5e7eb"),
                        background: campaign.enabled ? "#f0fdf4" : "#f9fafb",
                        color: campaign.enabled ? "#166534" : "#6b7280",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        cursor: saving ? "not-allowed" : "pointer",
                      }}
                    >
                      {campaign.enabled ? "Enabled" : "Paused"}
                    </button>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => void handleDeleteCampaign(campaign.id)}
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
                      Remove
                    </button>
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
