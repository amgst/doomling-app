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

export default function StatsTab() {
  const [rules, setRules] = useState<RuleStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/standalone/stats").then(r => r.json())
      .then(d => { setRules(d.rules ?? []); })
      .finally(() => setLoading(false));
  }, []);

  const th = { padding: "0.75rem 1rem", textAlign: "left" as const, fontSize: "0.78rem", fontWeight: 600, color: "#6d7175", textTransform: "uppercase" as const, borderBottom: "1px solid #e4e5e7" };
  const td = { padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#1a1a1a", borderBottom: "1px solid #f1f1f1" };

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading…</div>;

  const totalViews = rules.reduce((s, r) => s + r.views, 0);
  const totalClicks = rules.reduce((s, r) => s + r.clicks, 0);
  const totalAdded = rules.reduce((s, r) => s + r.added, 0);

  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Statistics</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem" }}>All-time upsell performance</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Total Views", value: totalViews, sub: "Widget shown" },
          { label: "Total Clicks", value: totalClicks, sub: "Add to cart clicked" },
          { label: "Total Added", value: totalAdded, sub: "Successfully added" },
          { label: "Overall CTR", value: totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) + "%" : "—", sub: "Click-through rate" },
          { label: "Conversion", value: totalClicks > 0 ? ((totalAdded / totalClicks) * 100).toFixed(1) + "%" : "—", sub: "Clicks → Added" },
        ].map(c => (
          <div key={c.label} style={{ background: "#fff", borderRadius: "10px", padding: "1.1rem 1.25rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#6d7175", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.label}</p>
            <p style={{ margin: "0.3rem 0 0.2rem", fontSize: "1.6rem", fontWeight: 700, color: "#1a1a1a" }}>{c.value}</p>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#6d7175" }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Per-rule table */}
      <div style={{ background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: "1.5rem" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e4e5e7" }}>
          <p style={{ margin: 0, fontWeight: 600, color: "#1a1a1a" }}>Upsell Rules Performance</p>
        </div>
        {rules.length === 0 ? (
          <p style={{ padding: "2rem", textAlign: "center", color: "#6d7175", margin: 0 }}>No data yet — stats appear after your widgets get views.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Trigger Product</th>
                <th style={th}>Upsell Product</th>
                <th style={{ ...th, textAlign: "center" }}>Views</th>
                <th style={{ ...th, textAlign: "center" }}>Clicks</th>
                <th style={{ ...th, textAlign: "center" }}>Added</th>
                <th style={{ ...th, textAlign: "center" }}>CTR</th>
                <th style={{ ...th, textAlign: "center" }}>Conv.</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.ruleId}>
                  <td style={td}>{r.triggerProductTitle}</td>
                  <td style={td}>{r.upsellProductTitle}</td>
                  <td style={{ ...td, textAlign: "center" }}>{r.views}</td>
                  <td style={{ ...td, textAlign: "center" }}>{r.clicks}</td>
                  <td style={{ ...td, textAlign: "center" }}>{r.added}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span style={{ background: "#f1f1f1", padding: "0.2rem 0.6rem", borderRadius: "20px", fontSize: "0.8rem" }}>{r.ctr}</span>
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span style={{ background: r.added > 0 ? "#e3f1df" : "#f1f1f1", color: r.added > 0 ? "#1a6b3c" : "#6d7175", padding: "0.2rem 0.6rem", borderRadius: "20px", fontSize: "0.8rem" }}>{r.convRate}</span>
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
