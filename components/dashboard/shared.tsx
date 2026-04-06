"use client";

import { useEffect, useState } from "react";
import type { ThemeSummary, LaunchpadSchedule } from "./types/theme";

// ─── Re-exports for backward compatibility ────────────────────────────────────
// Tabs should import directly from the domain files below, but these re-exports
// ensure nothing breaks while imports are being migrated incrementally.
export type { DailyStat, Stats } from "./types/stats";
export type { UpsellProduct, UpsellRule, RuleStat } from "./types/upsell";
export type { CartQuantityRule } from "./types/cart";
export type { BxgyProduct, BxgyRule, BxgySummary, BxgyRuleStat } from "./types/bxgy";
export type { BundleOffer } from "./types/bundle";
export type { PostPurchaseProduct, PostPurchaseOffer, PostPurchaseSummary, PostPurchaseOfferStat } from "./types/post-purchase";
export type { LaunchpadScheduleStatus, ThemeSummary, LaunchpadSchedule } from "./types/theme";
export { type Product, isDefaultVariantTitle, hasMeaningfulVariants, bxgyOptionLabel, SearchableProductSelect, PolarisProductAutocomplete } from "./products";

// ─── Universal utilities ──────────────────────────────────────────────────────

export async function safeJson<T = any>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export const RANGES = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
];

export const fmt = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

export function calcTrend(current: number, prev: number): number | null {
  if (!prev || prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

// ─── Universal UI components ──────────────────────────────────────────────────

export function TrendBadge({ trend }: { trend: number | null }) {
  if (trend === null) return null;
  const up = trend >= 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "2px",
      padding: "0.15rem 0.45rem", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 600,
      background: up ? "#e3f1df" : "#fff0f0",
      color: up ? "#1a6b3c" : "#c0392b",
    }}>
      {up ? "▲" : "▼"} {Math.abs(trend)}%
    </span>
  );
}

export function SkeletonCard() {
  return (
    <div style={{
      background: "#fff", borderRadius: "10px", padding: "1.25rem 1.5rem",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{ height: "0.75rem", width: "60%", background: "#f1f1f1", borderRadius: "4px", marginBottom: "0.75rem" }} />
      <div style={{ height: "1.75rem", width: "80%", background: "#f1f1f1", borderRadius: "4px", marginBottom: "0.5rem" }} />
      <div style={{ height: "0.65rem", width: "50%", background: "#f8f8f8", borderRadius: "4px" }} />
    </div>
  );
}

export function StatCard({ title, value, sub, trend }: { title: string; value: string; sub: string; trend?: number | null }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: "10px",
      padding: "1.25rem 1.5rem",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#6d7175", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</p>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0.4rem 0 0.25rem" }}>
        <p style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, color: "#1a1a1a" }}>{value}</p>
        {trend !== undefined && <TrendBadge trend={trend ?? null} />}
      </div>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#6d7175" }}>{sub}</p>
    </div>
  );
}

// ─── Cross-cutting overview components ───────────────────────────────────────
// These components fetch and aggregate data across multiple modules, so they
// live here rather than in any single feature's domain.

export function AppHealthCheck({ storeName }: { storeName?: string }) {
  const [rules, setRules] = useState<number | null>(null);
  const [bxgyRules, setBxgyRules] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/standalone/upsells").then(r => r.ok ? r.json() : null).catch(() => null)
      .then(d => setRules(d?.rules?.length ?? 0));
    fetch("/api/standalone/bxgy").then(r => r.ok ? r.json() : null).catch(() => null)
      .then(d => setBxgyRules(d?.rules?.length ?? 0));
  }, [storeName]);

  return (
    <div style={{ background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: "1.75rem", padding: "1rem 1.5rem" }}>
      <p style={{ margin: "0 0 0.5rem", fontWeight: 700, fontSize: "0.9rem", color: "#1a1a1a" }}>App Health</p>
      <p style={{ margin: "0.45rem 0 0", fontSize: "0.82rem", color: "#6d7175" }}>
        {storeName ? `${storeName}.myshopify.com connected` : "No store session"}{" | "}
        {rules === null ? "Loading upsells..." : rules > 0 ? `${rules} upsell rule${rules !== 1 ? "s" : ""} active` : "No upsell rules configured"}{" | "}
        {bxgyRules === null ? "Loading BXGY..." : bxgyRules > 0 ? `${bxgyRules} BXGY rule${bxgyRules !== 1 ? "s" : ""} active` : "No BXGY rules configured"}
      </p>
    </div>
  );
}

export function ModuleOverviewStrip() {
  const [data, setData] = useState<{
    upsells: number | null;
    cartLimits: number | null;
    bxgyRules: number | null;
    bundles: number | null;
    postPurchaseOffers: number | null;
    geoCountdowns: number | null;
    liveTheme: string | null;
    launchpadPending: number | null;
  }>({
    upsells: null,
    cartLimits: null,
    bxgyRules: null,
    bundles: null,
    postPurchaseOffers: null,
    geoCountdowns: null,
    liveTheme: null,
    launchpadPending: null,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/standalone/upsells").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/standalone/cart-limits").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/standalone/bxgy-stats").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/standalone/bundles").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/standalone/post-purchase-stats").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/standalone/geo-countdown").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/standalone/themes").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/standalone/launchpad").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([upsells, cartLimits, bxgyStats, bundles, postPurchaseStats, geoCountdown, themes, launchpad]) => {
      const themeList: ThemeSummary[] = themes?.themes ?? [];
      const liveTheme = themeList.find((theme) => theme.role === "MAIN")?.name ?? null;
      const launchpadSchedules: LaunchpadSchedule[] = launchpad?.schedules ?? [];

      setData({
        upsells: upsells?.rules?.length ?? 0,
        cartLimits: cartLimits?.rules?.length ?? 0,
        bxgyRules: bxgyStats?.summary?.activeRules ?? 0,
        bundles: bundles?.offers?.length ?? 0,
        postPurchaseOffers: postPurchaseStats?.summary?.activeOffers ?? 0,
        geoCountdowns: geoCountdown?.campaigns?.length ?? 0,
        liveTheme,
        launchpadPending: launchpadSchedules.filter((schedule) => schedule.status === "pending").length,
      });
    });
  }, []);

  const cards = [
    { label: "Upsells", value: data.upsells, sub: "Active product upsell rules" },
    { label: "Cart Limits", value: data.cartLimits, sub: "Restricted cart products" },
    { label: "Buy X Get Y", value: data.bxgyRules, sub: "Live free gift campaigns" },
    { label: "Bundle Offers", value: data.bundles, sub: "Bundle products with native codes" },
    { label: "Post-Purchase", value: data.postPurchaseOffers, sub: "Offers after checkout" },
    { label: "Geo Countdown", value: data.geoCountdowns, sub: "Countdown campaigns" },
    { label: "Live Theme", value: data.liveTheme, sub: "Current published storefront" },
    { label: "Launchpad", value: data.launchpadPending, sub: "Pending scheduled publishes" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "1rem 1.1rem",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            border: "1px solid #eef0f2",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.74rem", color: "#6d7175", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {card.label}
          </p>
          <p style={{ margin: "0.35rem 0 0.18rem", fontSize: "1.35rem", fontWeight: 700, color: "#111827" }}>
            {card.value === null ? "..." : String(card.value)}
          </p>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "#6d7175" }}>{card.sub}</p>
        </div>
      ))}
    </div>
  );
}

export function BxgyOverviewStrip() {
  const [summary, setSummary] = useState<{ activeRules: number; totalQualified: number; totalAutoAdded: number; conversionRate: string } | null>(null);

  useEffect(() => {
    fetch("/api/standalone/bxgy-stats")
      .then(r => r.ok ? r.json() : null)
      .then(d => setSummary(d?.summary ?? null))
      .catch(() => {});
  }, []);

  if (!summary) return null;

  const cards = [
    { label: "Active BXGY rules", value: summary.activeRules, sub: "Live gift campaigns" },
    { label: "Qualified carts", value: summary.totalQualified, sub: "Customers who unlocked a gift" },
    { label: "Gifts auto-added", value: summary.totalAutoAdded, sub: "Automatic free items placed in cart" },
    { label: "BXGY conversion", value: summary.conversionRate, sub: "Qualified carts to gifts added" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
      {cards.map((card) => (
        <div key={card.label} style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "1.05rem 1.2rem",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          border: "1px solid #dcfce7",
        }}>
          <p style={{ margin: 0, fontSize: "0.74rem", color: "#6d7175", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{card.label}</p>
          <p style={{ margin: "0.35rem 0 0.2rem", fontSize: "1.45rem", fontWeight: 700, color: "#14532d" }}>{card.value}</p>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "#6d7175" }}>{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
