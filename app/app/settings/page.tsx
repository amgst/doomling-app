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
  Checkbox,
  Banner,
  Spinner,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";

interface AppSettings {
  trackingEnabled: boolean;
  webhooksEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  trackingEnabled: true,
  webhooksEnabled: true,
};

export default function SettingsPage() {
  const app = useAppBridge();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastActive, setToastActive] = useState(false);

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

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

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
      </Page>
    </Frame>
  );
}
