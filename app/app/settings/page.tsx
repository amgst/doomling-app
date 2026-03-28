"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  Toast,
  Frame,
  BlockStack,
  InlineStack,
  TextField,
  Checkbox,
  Banner,
  Spinner,
  Divider,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";

interface AppSettings {
  trackingEnabled: boolean;
  webhooksEnabled: boolean;
}

interface GiftRule {
  mainVariantId: string;
  giftVariantId: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  trackingEnabled: true,
  webhooksEnabled: true,
};

export default function SettingsPage() {
  const app = useAppBridge();

  // ── App settings ────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastActive, setToastActive] = useState(false);

  // ── Gift rules ───────────────────────────────────────────────────────────────
  const [giftRules, setGiftRules] = useState<GiftRule[]>([]);
  const [giftLoading, setGiftLoading] = useState(true);
  const [giftSaving, setGiftSaving] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [giftToastActive, setGiftToastActive] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const token = await app.idToken();
      const res = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
    } catch (err) {
      setError("Failed to load settings.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [app]);

  const fetchGiftRules = useCallback(async () => {
    setGiftLoading(true);
    try {
      const token = await app.idToken();
      const res = await fetch("/api/gift-rules", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setGiftRules(data.rules ?? []);
    } catch (err) {
      setGiftError("Failed to load gift rules.");
      console.error(err);
    } finally {
      setGiftLoading(false);
    }
  }, [app]);

  useEffect(() => {
    fetchSettings();
    fetchGiftRules();
  }, [fetchSettings, fetchGiftRules]);

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    try {
      const token = await app.idToken();
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setToastActive(true);
    } catch (err) {
      setError("Failed to save settings.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const saveGiftRules = async () => {
    setGiftSaving(true);
    setGiftError(null);
    try {
      const token = await app.idToken();
      const res = await fetch("/api/gift-rules", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rules: giftRules }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setGiftToastActive(true);
    } catch (err: unknown) {
      setGiftError(err instanceof Error ? err.message : "Failed to save gift rules.");
      console.error(err);
    } finally {
      setGiftSaving(false);
    }
  };

  const addGiftRule = () =>
    setGiftRules((prev) => [...prev, { mainVariantId: "", giftVariantId: "" }]);

  const removeGiftRule = (index: number) =>
    setGiftRules((prev) => prev.filter((_, i) => i !== index));

  const updateGiftRule = (index: number, field: keyof GiftRule, value: string) =>
    setGiftRules((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, [field]: value } : rule))
    );

  if (loading) {
    return (
      <Page title="Settings">
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                <Spinner size="large" />
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Frame>
      <Page
        title="Settings"
        subtitle="Configure your Upsale app preferences"
        primaryAction={
          <Button variant="primary" loading={saving} onClick={saveSettings}>
            Save settings
          </Button>
        }
      >
        <Layout>
          {error && (
            <Layout.Section>
              <Banner tone="critical" title="Error">
                <p>{error}</p>
              </Banner>
            </Layout.Section>
          )}

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Data Collection</Text>
                <Checkbox
                  label="Enable order tracking"
                  helpText="Track orders and revenue to power your analytics dashboard."
                  checked={settings.trackingEnabled}
                  onChange={(v) => setSettings((s) => ({ ...s, trackingEnabled: v }))}
                />
                <Checkbox
                  label="Enable webhooks"
                  helpText="Receive real-time updates from Shopify for orders and events."
                  checked={settings.webhooksEnabled}
                  onChange={(v) => setSettings((s) => ({ ...s, webhooksEnabled: v }))}
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text variant="headingMd" as="h2">Gift With Product</Text>
                  <Text as="p" tone="subdued">
                    When a main variant is added to the cart, a gift variant is automatically added at no cost.
                    Use numeric variant IDs (found in the Shopify admin URL when editing a variant).
                  </Text>
                </BlockStack>

                {giftLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "1rem" }}>
                    <Spinner size="small" />
                  </div>
                ) : (
                  <BlockStack gap="300">
                    {giftError && (
                      <Banner tone="critical" title="Error">
                        <p>{giftError}</p>
                      </Banner>
                    )}

                    {giftRules.length > 0 && (
                      <BlockStack gap="300">
                        {giftRules.map((rule, i) => (
                          <BlockStack key={i} gap="200">
                            {i > 0 && <Divider />}
                            <InlineStack gap="300" align="start" blockAlign="end" wrap={false}>
                              <div style={{ flex: 1 }}>
                                <TextField
                                  label="Main variant ID"
                                  value={rule.mainVariantId}
                                  onChange={(v) => updateGiftRule(i, "mainVariantId", v)}
                                  placeholder="e.g. 12345678901"
                                  autoComplete="off"
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <TextField
                                  label="Gift variant ID"
                                  value={rule.giftVariantId}
                                  onChange={(v) => updateGiftRule(i, "giftVariantId", v)}
                                  placeholder="e.g. 98765432109"
                                  autoComplete="off"
                                />
                              </div>
                              <div style={{ paddingBottom: "2px" }}>
                                <Button tone="critical" onClick={() => removeGiftRule(i)}>
                                  Remove
                                </Button>
                              </div>
                            </InlineStack>
                          </BlockStack>
                        ))}
                      </BlockStack>
                    )}

                    {giftRules.length === 0 && (
                      <Text as="p" tone="subdued">No gift rules configured yet.</Text>
                    )}

                    <InlineStack gap="300">
                      <Button onClick={addGiftRule}>Add rule</Button>
                      <Button
                        variant="primary"
                        loading={giftSaving}
                        disabled={giftLoading}
                        onClick={saveGiftRules}
                      >
                        Save gift rules
                      </Button>
                    </InlineStack>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">About</Text>
                <Text as="p" tone="subdued">
                  Upsale v0.1.0 — Built with Next.js, Firebase, and Shopify Polaris.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {toastActive && (
          <Toast content="Settings saved" onDismiss={() => setToastActive(false)} />
        )}
        {giftToastActive && (
          <Toast content="Gift rules saved" onDismiss={() => setGiftToastActive(false)} />
        )}
      </Page>
    </Frame>
  );
}
