"use client";

import { useEffect, useMemo, useState } from "react";
import { fmt, safeJson } from "../shared";
import type { RuleStat } from "../types/upsell";

type StatsResponse = {
  rules?: RuleStat[];
};

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: "10px", padding: "1.1rem 1.25rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <p style={{ margin: 0, fontSize: "0.75rem", color: "#6d7175", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
      <p style={{ margin: "0.3rem 0 0.2rem", fontSize: "1.6rem", fontWeight: 700, color: "#1a1a1a" }}>{value}</p>
      <p style={{ margin: 0, fontSize: "0.75rem", color: "#6d7175" }}>{sub}</p>
    </div>
  );
}

export default function StatsTab() {
  const [rules, setRules] = useState<RuleStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/standalone/stats")
      .then((r) => safeJson<StatsResponse>(r))
      .then((data) => {
        setRules(data?.rules ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const totalViews = rules.reduce((sum, rule) => sum + rule.views, 0);
    const totalClicks = rules.reduce((sum, rule) => sum + rule.clicks, 0);
    const totalAdded = rules.reduce((sum, rule) => sum + rule.added, 0);
    const totalOrders = rules.reduce((sum, rule) => sum + rule.orders, 0);
    const totalUnits = rules.reduce((sum, rule) => sum + rule.units, 0);
    const totalRevenue = rules.reduce((sum, rule) => sum + rule.revenue, 0);

    return {
      totalViews,
      totalClicks,
      totalAdded,
      totalOrders,
      totalUnits,
      totalRevenue,
      ctr: totalViews > 0 ? `${((totalClicks / totalViews) * 100).toFixed(1)}%` : "-",
      clickToCart: totalClicks > 0 ? `${((totalAdded / totalClicks) * 100).toFixed(1)}%` : "-",
      viewToCart: totalViews > 0 ? `${((totalAdded / totalViews) * 100).toFixed(1)}%` : "-",
      revenuePerView: totalViews > 0 ? totalRevenue / totalViews : 0,
      revenuePerClick: totalClicks > 0 ? totalRevenue / totalClicks : 0,
      revenuePerOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    };
  }, [rules]);

  const topRevenueRule = useMemo(
    () => [...rules].sort((a, b) => b.revenue - a.revenue)[0] ?? null,
    [rules],
  );

  const bestRevenuePerViewRule = useMemo(
    () => [...rules].sort((a, b) => b.revenuePerView - a.revenuePerView)[0] ?? null,
    [rules],
  );

  const th = { padding: "0.75rem 1rem", textAlign: "left" as const, fontSize: "0.78rem", fontWeight: 600, color: "#6d7175", textTransform: "uppercase" as const, borderBottom: "1px solid #e4e5e7", whiteSpace: "nowrap" as const };
  const td = { padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#1a1a1a", borderBottom: "1px solid #f1f1f1", verticalAlign: "top" as const };

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading...</div>;

  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Statistics</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem" }}>
          Upsell performance with attributed revenue from completed orders
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <MetricCard label="Upsell Revenue" value={fmt(summary.totalRevenue, "USD")} sub={`${summary.totalOrders} attributed order${summary.totalOrders === 1 ? "" : "s"}`} />
        <MetricCard label="Views" value={summary.totalViews} sub="Widget impressions" />
        <MetricCard label="Clicks" value={summary.totalClicks} sub={`CTR ${summary.ctr}`} />
        <MetricCard label="Added To Cart" value={summary.totalAdded} sub={`View to add ${summary.viewToCart}`} />
        <MetricCard label="Units Sold" value={summary.totalUnits} sub="Upsell units in completed orders" />
        <MetricCard label="Revenue / View" value={fmt(summary.revenuePerView, "USD")} sub="Value of each impression" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ background: "#fff", borderRadius: "10px", padding: "1.1rem 1.25rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Efficiency</p>
          <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.45rem" }}>
            <p style={{ margin: 0, color: "#374151", fontSize: "0.86rem" }}>Click to add: <strong>{summary.clickToCart}</strong></p>
            <p style={{ margin: 0, color: "#374151", fontSize: "0.86rem" }}>Revenue per click: <strong>{fmt(summary.revenuePerClick, "USD")}</strong></p>
            <p style={{ margin: 0, color: "#374151", fontSize: "0.86rem" }}>Revenue per order: <strong>{fmt(summary.revenuePerOrder, "USD")}</strong></p>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: "10px", padding: "1.1rem 1.25rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Top Revenue Campaign</p>
          <div style={{ marginTop: "0.75rem" }}>
            {topRevenueRule ? (
              <>
                <p style={{ margin: 0, color: "#111827", fontSize: "0.92rem", fontWeight: 600 }}>{topRevenueRule.triggerProductTitle || "Untitled trigger"}</p>
                <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.8rem" }}>{topRevenueRule.upsellProductTitle || "No upsell products listed"}</p>
                <p style={{ margin: "0.6rem 0 0", color: "#166534", fontSize: "1.1rem", fontWeight: 700 }}>{fmt(topRevenueRule.revenue, "USD")}</p>
              </>
            ) : (
              <p style={{ margin: "0.75rem 0 0", color: "#6d7175", fontSize: "0.86rem" }}>No attributed revenue yet.</p>
            )}
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: "10px", padding: "1.1rem 1.25rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Best Revenue Per View</p>
          <div style={{ marginTop: "0.75rem" }}>
            {bestRevenuePerViewRule ? (
              <>
                <p style={{ margin: 0, color: "#111827", fontSize: "0.92rem", fontWeight: 600 }}>{bestRevenuePerViewRule.triggerProductTitle || "Untitled trigger"}</p>
                <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.8rem" }}>{bestRevenuePerViewRule.upsellProductTitle || "No upsell products listed"}</p>
                <p style={{ margin: "0.6rem 0 0", color: "#1d4ed8", fontSize: "1.1rem", fontWeight: 700 }}>{fmt(bestRevenuePerViewRule.revenuePerView, "USD")}</p>
              </>
            ) : (
              <p style={{ margin: "0.75rem 0 0", color: "#6d7175", fontSize: "0.86rem" }}>No view-to-revenue data yet.</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflowX: "auto", marginBottom: "1.5rem" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e4e5e7" }}>
          <p style={{ margin: 0, fontWeight: 600, color: "#1a1a1a" }}>Upsell Rules Performance</p>
          <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.8rem" }}>
            Revenue is attributed from Shopify orders that include upsell-tagged line items.
          </p>
        </div>
        {rules.length === 0 ? (
          <p style={{ padding: "2rem", textAlign: "center", color: "#6d7175", margin: 0 }}>No data yet. Stats appear after your widgets get views and attributed orders.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Trigger Product</th>
                <th style={th}>Upsell Product</th>
                <th style={{ ...th, textAlign: "center" }}>Views</th>
                <th style={{ ...th, textAlign: "center" }}>Clicks</th>
                <th style={{ ...th, textAlign: "center" }}>Added</th>
                <th style={{ ...th, textAlign: "center" }}>Orders</th>
                <th style={{ ...th, textAlign: "center" }}>Revenue</th>
                <th style={{ ...th, textAlign: "center" }}>CTR</th>
                <th style={{ ...th, textAlign: "center" }}>Add Rate</th>
                <th style={{ ...th, textAlign: "center" }}>Revenue / View</th>
              </tr>
            </thead>
            <tbody>
              {[...rules].sort((a, b) => b.revenue - a.revenue).map((rule) => (
                <tr key={rule.ruleId}>
                  <td style={td}>{rule.triggerProductTitle}</td>
                  <td style={td}>{rule.upsellProductTitle}</td>
                  <td style={{ ...td, textAlign: "center" }}>{rule.views}</td>
                  <td style={{ ...td, textAlign: "center" }}>{rule.clicks}</td>
                  <td style={{ ...td, textAlign: "center" }}>{rule.added}</td>
                  <td style={{ ...td, textAlign: "center" }}>{rule.orders}</td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700, color: "#166534" }}>{fmt(rule.revenue, "USD")}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span style={{ background: "#f1f1f1", padding: "0.2rem 0.6rem", borderRadius: "20px", fontSize: "0.8rem" }}>{rule.ctr}</span>
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span style={{ background: rule.added > 0 ? "#e3f1df" : "#f1f1f1", color: rule.added > 0 ? "#1a6b3c" : "#6d7175", padding: "0.2rem 0.6rem", borderRadius: "20px", fontSize: "0.8rem" }}>{rule.addRate}</span>
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>{fmt(rule.revenuePerView, "USD")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
