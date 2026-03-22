"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Select,
  DataTable,
  Spinner,
  Banner,
  BlockStack,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import OrdersChart from "@/components/charts/OrdersChart";
import RevenueChart from "@/components/charts/RevenueChart";

interface DailyStat {
  date: string;
  count: number;
  revenue: number;
  currency: string;
}

interface AnalyticsData {
  totalOrders: number;
  totalRevenue: number;
  currency: string;
  avgOrderValue: number;
  daily: DailyStat[];
}

const RANGE_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
  { label: "Last 365 days", value: "365" },
];

export default function AnalyticsPage() {
  const app = useAppBridge();
  const [days, setDays] = useState("30");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await app.idToken();
      const res = await fetch(`/api/analytics?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.stats);
    } catch (err) {
      setError("Failed to load analytics.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [app, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmt = (n: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  const tableRows =
    data?.daily
      .slice()
      .reverse()
      .map((d) => [d.date, d.count, fmt(d.revenue, d.currency)]) ?? [];

  return (
    <Page title="Analytics" subtitle="Detailed breakdown of orders and revenue">
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
            <Select
              label="Time range"
              options={RANGE_OPTIONS}
              value={days}
              onChange={setDays}
            />
          </Card>
        </Layout.Section>

        {loading ? (
          <Layout.Section>
            <Card>
              <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                <Spinner size="large" />
              </div>
            </Card>
          </Layout.Section>
        ) : data ? (
          <>
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">Orders Over Time</Text>
                  <OrdersChart data={data.daily} />
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">Revenue Over Time</Text>
                  <RevenueChart data={data.daily} currency={data.currency} />
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">Daily Breakdown</Text>
                  <DataTable
                    columnContentTypes={["text", "numeric", "text"]}
                    headings={["Date", "Orders", "Revenue"]}
                    rows={tableRows}
                    footerContent={`Showing ${tableRows.length} days`}
                  />
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        ) : null}
      </Layout>
    </Page>
  );
}
