"use client";

import { useEffect, useState } from "react";
import { BlockStack, Button, Card, Checkbox, InlineGrid, InlineStack, Select, Text, TextField } from "@shopify/polaris";
import { safeJson } from "../shared";
import type { CustomCursorCampaign, CustomCursorPageTarget, CustomCursorTheme } from "@/lib/customCursor";

const PAGE_TARGET_OPTIONS = [
  { label: "All pages", value: "all" },
  { label: "Home only", value: "home" },
  { label: "Product only", value: "product" },
  { label: "Collection only", value: "collection" },
];

const THEME_OPTIONS = [
  { label: "Glow orb", value: "glow" },
  { label: "Stardust", value: "stardust" },
  { label: "Doomlings pulse", value: "doomlings" },
  { label: "Retro pixel", value: "retro" },
];

export default function CustomCursorTab() {
  const [campaigns, setCampaigns] = useState<CustomCursorCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Spring cursor");
  const [pageTarget, setPageTarget] = useState<CustomCursorPageTarget>("all");
  const [theme, setTheme] = useState<CustomCursorTheme>("doomlings");
  const [size, setSize] = useState("28");
  const [priority, setPriority] = useState("1");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  useEffect(() => {
    fetch("/api/standalone/custom-cursor")
      .then((response) => safeJson<{ campaigns?: CustomCursorCampaign[]; error?: string }>(response).then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
        setCampaigns(data?.campaigns ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load custom cursor campaigns."))
      .finally(() => setLoading(false));
  }, []);

  const saveCampaigns = async (nextCampaigns: CustomCursorCampaign[]) => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/standalone/custom-cursor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaigns: nextCampaigns }),
      });
      const data = await safeJson<{ campaigns?: CustomCursorCampaign[]; error?: string }>(response);
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      setCampaigns(data?.campaigns ?? nextCampaigns);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save custom cursor campaigns.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName("Spring cursor");
    setPageTarget("all");
    setTheme("doomlings");
    setSize("28");
    setPriority("1");
    setStartAt("");
    setEndAt("");
  };

  const handleAddCampaign = async () => {
    if (!name.trim()) {
      setError("Enter a cursor campaign name.");
      return;
    }

    if (startAt && Number.isNaN(Date.parse(startAt))) {
      setError("Use a valid start date and time.");
      return;
    }

    if (endAt && Number.isNaN(Date.parse(endAt))) {
      setError("Use a valid end date and time.");
      return;
    }

    if (startAt && endAt && Date.parse(startAt) >= Date.parse(endAt)) {
      setError("End time must be after start time.");
      return;
    }

    const nextCampaigns: CustomCursorCampaign[] = [
      ...campaigns,
      {
        id: `custom-cursor-${Date.now()}`,
        name: name.trim(),
        pageTarget,
        theme,
        size: Math.max(16, Math.min(96, Number(size) || 28)),
        priority: Math.max(1, Math.min(100, Number(priority) || 1)),
        enabled: true,
        startAt: startAt ? new Date(Date.parse(startAt)).toISOString() : null,
        endAt: endAt ? new Date(Date.parse(endAt)).toISOString() : null,
      },
    ];

    const saved = await saveCampaigns(nextCampaigns);
    if (saved) resetForm();
  };

  const handleCampaignChange = async (campaignId: string, patch: Partial<CustomCursorCampaign>) => {
    const nextCampaigns = campaigns.map((campaign) => (campaign.id === campaignId ? { ...campaign, ...patch } : campaign));
    await saveCampaigns(nextCampaigns);
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    await saveCampaigns(campaigns.filter((campaign) => campaign.id !== campaignId));
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading custom cursor campaigns...</div>;
  }

  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Custom Cursor</h1>
        <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.84rem", maxWidth: 780 }}>
          Create cursor campaigns for the storefront, choose where they show, schedule the time window, and pick a cursor theme. Then enable the Custom Cursor app embed in the theme customizer.
        </p>
      </div>

      {error && (
        <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", color: "#c0392b", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        {[
          { label: "Campaigns", value: campaigns.length, sub: "Saved cursor campaigns" },
          { label: "Enabled now", value: campaigns.filter((campaign) => campaign.enabled).length, sub: `${campaigns.filter((campaign) => !campaign.enabled).length} paused` },
          { label: "Storefront", value: "Embed", sub: "Use the Custom Cursor app embed" },
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
            <Select label="Page target" options={PAGE_TARGET_OPTIONS} value={pageTarget} onChange={(value) => setPageTarget(value as CustomCursorPageTarget)} />
            <Select label="Cursor theme" options={THEME_OPTIONS} value={theme} onChange={(value) => setTheme(value as CustomCursorTheme)} />
            <TextField label="Cursor size" type="number" min={16} max={96} value={size} onChange={setSize} autoComplete="off" helpText="Desktop cursor size in pixels." />
            <TextField label="Start date and time" type="datetime-local" value={startAt} onChange={setStartAt} autoComplete="off" helpText="Leave blank to start immediately." />
            <TextField label="End date and time" type="datetime-local" value={endAt} onChange={setEndAt} autoComplete="off" helpText="Leave blank to keep it active until you pause it." />
            <TextField label="Priority" type="number" min={1} max={100} value={priority} onChange={setPriority} autoComplete="off" helpText="Lower numbers win when multiple cursor campaigns match the same page." />
          </InlineGrid>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" tone="subdued">
              Enable the `Custom cursor` app embed in your theme. The embed reads the active campaign from the app and only applies it on desktop pointer devices.
            </Text>
            <Button variant="primary" onClick={handleAddCampaign} loading={saving}>
              Add campaign
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>

      <div style={{ marginTop: "1rem", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.1rem", borderBottom: "1px solid #e5e7eb" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Configured cursor campaigns</p>
        </div>
        {campaigns.length === 0 ? (
          <p style={{ margin: 0, padding: "1.5rem", color: "#6b7280" }}>
            No custom cursor campaigns yet. Create one above, then enable the Custom Cursor app embed in your theme.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Campaign</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Target</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Schedule</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Status</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "right", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign, index) => (
                <tr key={campaign.id} style={{ borderBottom: index < campaigns.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "0.85rem 0.9rem" }}>
                    <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#111827" }}>{campaign.name}</div>
                    <div style={{ fontSize: "0.77rem", color: "#6b7280", marginTop: "0.15rem" }}>
                      {THEME_OPTIONS.find((option) => option.value === campaign.theme)?.label ?? campaign.theme} · {campaign.size}px
                    </div>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.82rem", color: "#374151" }}>
                    {PAGE_TARGET_OPTIONS.find((option) => option.value === campaign.pageTarget)?.label ?? campaign.pageTarget}
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.82rem", color: "#374151" }}>
                    <div>{campaign.startAt ? `Starts ${new Date(campaign.startAt).toLocaleString()}` : "Starts immediately"}</div>
                    <div style={{ color: "#6b7280", marginTop: "0.15rem" }}>
                      {campaign.endAt ? `Ends ${new Date(campaign.endAt).toLocaleString()}` : "No end time"}
                    </div>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem" }}>
                    <Checkbox
                      label="Enabled"
                      checked={campaign.enabled}
                      onChange={(value) => void handleCampaignChange(campaign.id, { enabled: value })}
                      disabled={saving}
                    />
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
                      Delete
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
