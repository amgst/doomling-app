"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Select,
  Spinner,
  Banner,
  BlockStack,
  InlineGrid,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import StatCard from "@/components/stats/StatCard";
import OrdersChart from "@/components/charts/OrdersChart";
import RevenueChart from "@/components/charts/RevenueChart";

interface AnalyticsSummary {
  totalOrders: number;
  totalRevenue: number;
  currency: string;
  avgOrderValue: number;
  daily: { date: string; count: number; revenue: number }[];
}

const RANGE_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];

export default function DashboardPage() {
  const app = useAppBridge();
  const [days, setDays] = useState("30");
  const [stats, setStats] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await app.idToken();
      const res = await fetch(`/api/analytics?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data.stats);
    } catch (err) {
      setError("Failed to load analytics. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [app, days]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const fmt = (n: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  return (
    <Page
      title="Dashboard"
      subtitle="Overview of your store's performance"
      primaryAction={{ content: "Refresh", onAction: fetchStats }}
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
              <Select
                label="Time range"
                options={RANGE_OPTIONS}
                value={days}
                onChange={setDays}
              />
            </BlockStack>
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
        ) : stats ? (
          <>
            <Layout.Section>
              <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
                <StatCard
                  title="Total Orders"
                  value={stats.totalOrders.toString()}
                  helpText={`Last ${days} days`}
                />
                <StatCard
                  title="Total Revenue"
                  value={fmt(stats.totalRevenue, stats.currency)}
                  helpText={`Last ${days} days`}
                />
                <StatCard
                  title="Avg Order Value"
                  value={fmt(stats.avgOrderValue, stats.currency)}
                  helpText={`Last ${days} days`}
                />
                <StatCard
                  title="Daily Avg Orders"
                  value={(stats.totalOrders / parseInt(days)).toFixed(1)}
                  helpText="Orders per day"
                />
              </InlineGrid>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">Orders Over Time</Text>
                  <OrdersChart data={stats.daily} />
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">Revenue Over Time</Text>
                  <RevenueChart data={stats.daily} currency={stats.currency} />
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        ) : null}
      </Layout>
    </Page>
  );
}
