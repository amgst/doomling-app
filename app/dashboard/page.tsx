"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
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
import DashboardShell from "@/components/DashboardShell";
import PolarisProvider from "@/components/PolarisProvider";
import type { GeoCountdownCampaign, GeoCountdownPageTarget } from "@/lib/geoCountdown";

interface DailyStat {
  date: string;
  count: number;
  revenue: number;
  currency: string;
}

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  totalUpsaleRevenue: number;
  currency: string;
  avgOrderValue: number;
  daily: DailyStat[];
  prevTotalOrders?: number;
  prevTotalRevenue?: number;
  prevUpsaleRevenue?: number;
  prevAvgOrderValue?: number;
}

interface Product {
  id: number;
  title: string;
  handle: string;
  status: string;
  image: { src: string } | null;
  variants: { id: number; title: string; price: string }[];
}

interface CartQuantityRule {
  id: string;
  productId: string;
  productTitle: string;
  quantity: number;
  enabled: boolean;
}

interface UpsellProduct {
  productId: string;
  title: string;
  image: string;
  price: string;
  handle: string;
  discountPercent: number;
}

interface UpsellRule {
  id: string;
  triggerProductId: string;
  triggerProductTitle: string;
  upsellProducts: UpsellProduct[];
  message: string;
}

interface BxgyProduct {
  productId: string;
  variantId: string;
  title: string;
  image: string;
  price: string;
  handle: string;
}

interface ThemeSummary {
  id: string;
  name: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
  processing?: boolean;
  processingFailed?: boolean;
}

type LaunchpadScheduleStatus = "pending" | "published" | "failed" | "cancelled";

interface LaunchpadSchedule {
  id: string;
  themeId: string;
  themeName: string;
  scheduledForUtc: string;
  timezone: string;
  status: LaunchpadScheduleStatus;
  createdAt: string;
  publishedAt?: string;
  cancelledAt?: string;
  lastError?: string;
}

interface BundleOffer {
  id: string;
  name: string;
  productId: string;
  productTitle: string;
  code: string;
  compareAtPrice: string;
  discountedPrice: string;
  enabled: boolean;
  discountId?: string;
  createdAt: string;
  updatedAt: string;
}

function isDefaultVariantTitle(title: string) {
  const value = String(title || "").trim().toLowerCase();
  return !value || value === "default title" || value === "default" || value === "main";
}

function hasMeaningfulVariants(product: Product | undefined | null) {
  if (!product?.variants?.length) return false;
  if (product.variants.length > 1) return true;
  return !isDefaultVariantTitle(product.variants[0]?.title ?? "");
}

function bxgyOptionLabel(product: Product, variant: Product["variants"][number]) {
  if (!hasMeaningfulVariants(product)) return product.title;
  return `${product.title} - ${variant.title}`;
}

function SearchableProductSelect({
  products,
  value,
  onChange,
  placeholder,
  style,
}: {
  products: Product[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedProduct = products.find((product) => String(product.id) === value) ?? null;

  useEffect(() => {
    setQuery(selectedProduct?.title ?? "");
  }, [selectedProduct?.title]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selectedProduct?.title ?? "");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [selectedProduct?.title]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = normalizedQuery
    ? products.filter((product) =>
        `${product.title} ${product.handle}`.toLowerCase().includes(normalizedQuery),
      )
    : products;

  const visibleProducts = filteredProducts.slice(0, 12);

  return (
    <div ref={rootRef} style={{ position: "relative", ...style }}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          const nextValue = event.target.value;
          setQuery(nextValue);
          setOpen(true);
          if (!nextValue.trim()) {
            onChange("");
          }
        }}
        style={{
          width: "100%",
          padding: "0.7rem 0.8rem",
          border: "1px solid #d1d5db",
          borderRadius: "10px",
          fontSize: "0.875rem",
          background: "#fff",
          color: "#1a1a1a",
        }}
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 0.35rem)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: "10px",
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
            maxHeight: "280px",
            overflowY: "auto",
            zIndex: 30,
          }}
        >
          {visibleProducts.length === 0 ? (
            <p style={{ margin: 0, padding: "0.75rem 0.85rem", fontSize: "0.82rem", color: "#6b7280" }}>
              No products found
            </p>
          ) : (
            visibleProducts.map((product) => {
              const isSelected = String(product.id) === value;
              return (
                <button
                  key={product.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onChange(String(product.id));
                    setQuery(product.title);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    border: "none",
                    background: isSelected ? "#f3f4f6" : "#fff",
                    padding: "0.72rem 0.85rem",
                    textAlign: "left",
                    cursor: "pointer",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "#111827" }}>{product.title}</div>
                  <div style={{ fontSize: "0.74rem", color: "#6b7280", marginTop: "0.12rem" }}>{product.handle}</div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function PolarisProductAutocomplete({
  products,
  value,
  onChange,
  label,
  placeholder,
  helpText,
}: {
  products: Product[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  helpText?: string;
}) {
  const [query, setQuery] = useState("");

  const selectedProduct = products.find((product) => String(product.id) === value) ?? null;

  useEffect(() => {
    setQuery(selectedProduct?.title ?? "");
  }, [selectedProduct?.title]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = normalizedQuery
    ? products.filter((product) => `${product.title} ${product.handle}`.toLowerCase().includes(normalizedQuery))
    : products;

  const options = filteredProducts.slice(0, 12).map((product) => ({
    value: String(product.id),
    label: product.title,
    media: product.image?.src ? <Thumbnail source={product.image.src} alt={product.title} size="small" /> : undefined,
  }));

  const textField = (
    <Autocomplete.TextField
      label={label}
      value={query}
      placeholder={placeholder}
      autoComplete="off"
      onChange={(nextValue) => {
        setQuery(nextValue);
        if (!nextValue.trim()) {
          onChange("");
        }
      }}
      clearButton
      onClearButtonClick={() => {
        setQuery("");
        onChange("");
      }}
    />
  );

  return (
    <BlockStack gap="200">
      <Autocomplete
        options={options}
        selected={value ? [value] : []}
        textField={textField}
        onSelect={(selected) => {
          const nextValue = selected[0] ?? "";
          onChange(nextValue);
          const nextProduct = products.find((product) => String(product.id) === nextValue);
          setQuery(nextProduct?.title ?? "");
        }}
        emptyState={<Text as="p" variant="bodySm" tone="subdued">No products found</Text>}
      />
      {helpText && (
        <Text as="p" variant="bodySm" tone="subdued">
          {helpText}
        </Text>
      )}
    </BlockStack>
  );
}

interface BxgyRule {
  id: string;
  name: string;
  buyProducts: BxgyProduct[];
  giftProduct: BxgyProduct | null;
  buyQuantity: number;
  giftQuantity: number;
  message: string;
  autoAdd: boolean;
  priority: number;
  enabled: boolean;
}

interface BxgySummary {
  activeRules: number;
  totalQualified: number;
  totalAutoAdded: number;
  conversionRate: string;
}

interface BxgyRuleStat {
  ruleId: string;
  name: string;
  buyLabel: string;
  giftLabel: string;
  message: string;
  qualified: number;
  autoAdded: number;
  conversionRate: string;
}

interface PostPurchaseProduct {
  productId: string;
  variantId: string;
  title: string;
  image: string;
  price: string;
  handle: string;
}

interface PostPurchaseOffer {
  id: string;
  name: string;
  offerProduct: PostPurchaseProduct | null;
  headline: string;
  body: string;
  ctaLabel: string;
  discountPercent: number;
  priority: number;
  triggerType: "all_orders" | "minimum_subtotal" | "contains_product";
  triggerProductIds: string[];
  minimumSubtotal: number;
  enabled: boolean;
}

interface PostPurchaseSummary {
  activeOffers: number;
  totalViews: number;
  totalAccepted: number;
  totalRevenue: number;
  conversionRate: string;
}

interface PostPurchaseOfferStat {
  offerId: string;
  name: string;
  productLabel: string;
  triggerType: string;
  discountPercent: number;
  viewed: number;
  accepted: number;
  revenue: number;
  conversionRate: string;
}

async function safeJson<T = any>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const RANGES = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
];

const fmt = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

function calcTrend(current: number, prev: number): number | null {
  if (!prev || prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

function TrendBadge({ trend }: { trend: number | null }) {
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

function SkeletonCard() {
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

function StatCard({ title, value, sub, trend }: { title: string; value: string; sub: string; trend?: number | null }) {
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

function AppHealthCheck({ storeName }: { storeName?: string }) {
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
      <p style={{ margin: 0, fontSize: "0.82rem", color: "#6d7175", display: "none" }}>
        {storeName ? `✓ ${storeName}.myshopify.com connected` : "⚠ No store session"}{" · "}
        {rules === null ? "Loading…" : rules > 0 ? `✓ ${rules} upsell rule${rules !== 1 ? "s" : ""} active` : "⚠ No upsell rules configured"}
        {" Â· "}
        {bxgyRules === null ? "Loading BXGYâ€¦" : bxgyRules > 0 ? `âœ“ ${bxgyRules} BXGY rule${bxgyRules !== 1 ? "s" : ""} active` : "âš  No BXGY rules configured"}
      </p>
      <p style={{ margin: "0.45rem 0 0", fontSize: "0.82rem", color: "#6d7175" }}>
        {storeName ? `${storeName}.myshopify.com connected` : "No store session"}{" | "}
        {rules === null ? "Loading upsells..." : rules > 0 ? `${rules} upsell rule${rules !== 1 ? "s" : ""} active` : "No upsell rules configured"}{" | "}
        {bxgyRules === null ? "Loading BXGY..." : bxgyRules > 0 ? `${bxgyRules} BXGY rule${bxgyRules !== 1 ? "s" : ""} active` : "No BXGY rules configured"}
      </p>
    </div>
  );
}

function ModuleOverviewStrip() {
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

function BxgyOverviewStrip() {
  const [summary, setSummary] = useState<BxgySummary | null>(null);

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

function OverviewTab({ days, setDays, storeName }: { days: string; setDays: (d: string) => void; storeName?: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/standalone/analytics?days=${days}`);
      if (res.status === 401) { window.location.href = "/"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data.stats);
      setLastUpdated(new Date());
      setSecondsAgo(0);
    } catch {
      setError("Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => { fetchStats(); }, 60000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchStats]);

  // Tick counter for "Updated X ago"
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setSecondsAgo(s => s + 1);
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const updatedLabel = lastUpdated
    ? secondsAgo < 10 ? "just now"
      : secondsAgo < 60 ? `${secondsAgo}s ago`
      : `${Math.floor(secondsAgo / 60)}m ago`
    : null;

  return (
    <>
      {/* Welcome banner */}
      <div style={{
        background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
        border: "1px solid #86efac",
        borderRadius: "14px",
        padding: "1.5rem 2rem",
        marginBottom: "1.75rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#1a1a1a" }}>
            Welcome back{storeName ? `, ${storeName}` : ""} 👋
          </h1>
          <p style={{ margin: "0.3rem 0 0", color: "#6b7280", fontSize: "0.875rem" }}>
            Here&apos;s how your store is performing.
          </p>
        </div>
        <img
          src="https://www.doomlings.com/cdn/shop/files/Doomlings_Logo_FullColor_Outline_440x.png?v=1741365053"
          alt=""
          style={{ height: 52, opacity: 0.15, pointerEvents: "none" }}
        />
      </div>

      <AppHealthCheck storeName={storeName} />
      <ModuleOverviewStrip />
      <BxgyOverviewStrip />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "#1a1a1a" }}>Performance</p>
          <p style={{ margin: "0.15rem 0 0", color: "#6d7175", fontSize: "0.8rem" }}>Store analytics</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          {updatedLabel && (
            <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>Updated {updatedLabel}</span>
          )}
          <button onClick={fetchStats} disabled={loading} title="Refresh" style={{
            padding: "0.35rem 0.7rem", borderRadius: "6px", border: "1px solid #d1d5db",
            background: "#fff", color: "#374151", fontSize: "0.82rem", cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
          }}>↻ Refresh</button>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {RANGES.map(r => (
              <button key={r.value} onClick={() => setDays(r.value)} style={{
                padding: "0.4rem 0.9rem",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: days === r.value ? "#008060" : "#d1d5db",
                background: days === r.value ? "#008060" : "#fff",
                color: days === r.value ? "#fff" : "#374151",
                fontSize: "0.85rem", fontWeight: 500, cursor: "pointer",
              }}>{r.label}</button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1.25rem", color: "#c0392b", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}

      {loading && !stats ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : stats ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem", opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}>
            <StatCard
              title="Total Orders"
              value={stats.totalOrders.toString()}
              sub={`vs ${stats.prevTotalOrders ?? "—"} prev period`}
              trend={stats.prevTotalOrders !== undefined ? calcTrend(stats.totalOrders, stats.prevTotalOrders) : undefined}
            />
            <StatCard
              title="Total Revenue"
              value={fmt(stats.totalRevenue, stats.currency)}
              sub={`vs ${stats.prevTotalRevenue !== undefined ? fmt(stats.prevTotalRevenue, stats.currency) : "—"} prev`}
              trend={stats.prevTotalRevenue !== undefined ? calcTrend(stats.totalRevenue, stats.prevTotalRevenue) : undefined}
            />
            <StatCard
              title="Upsale Revenue"
              value={fmt(stats.totalUpsaleRevenue ?? 0, stats.currency)}
              sub={`vs ${stats.prevUpsaleRevenue !== undefined ? fmt(stats.prevUpsaleRevenue, stats.currency) : "—"} prev`}
              trend={stats.prevUpsaleRevenue !== undefined ? calcTrend(stats.totalUpsaleRevenue ?? 0, stats.prevUpsaleRevenue) : undefined}
            />
            <StatCard
              title="Avg Order Value"
              value={fmt(stats.avgOrderValue, stats.currency)}
              sub={`vs ${stats.prevAvgOrderValue !== undefined ? fmt(stats.prevAvgOrderValue, stats.currency) : "—"} prev`}
              trend={stats.prevAvgOrderValue !== undefined ? calcTrend(stats.avgOrderValue, stats.prevAvgOrderValue) : undefined}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={{ background: "#fff", borderRadius: "10px", padding: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <p style={{ margin: "0 0 1rem", fontWeight: 600, color: "#1a1a1a" }}>Orders Over Time</p>
              <OrdersChart data={stats.daily} />
            </div>
            <div style={{ background: "#fff", borderRadius: "10px", padding: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <p style={{ margin: "0 0 1rem", fontWeight: 600, color: "#1a1a1a" }}>Revenue Over Time</p>
              <RevenueChart data={stats.daily} currency={stats.currency} />
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function ProductsTab({ storeUrl, adminUrl }: { storeUrl?: string; adminUrl?: string }) {
  const PAGE_SIZE = 50;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch("/api/standalone/products")
      .then(async r => {
        if (r.status === 401) { window.location.href = "/"; throw new Error("unauth"); }
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
        return d;
      })
      .then(d => setProducts(d.products ?? []))
      .catch(e => { if (e.message !== "unauth") setError(e.message); })
      .finally(() => setLoading(false));
  }, []);

  const activeProducts = products.filter((product) => product.status === "active");
  const inactiveProducts = products.filter((product) => product.status !== "active");
  const filteredProducts = statusFilter === "all"
    ? products
    : statusFilter === "active"
      ? activeProducts
      : inactiveProducts;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginatedProducts = filteredProducts.slice(pageStart, pageStart + PAGE_SIZE);
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filteredProducts.length);
  const filteredActiveProducts = filteredProducts.filter((product) => product.status === "active");
  const filteredInactiveProducts = filteredProducts.filter((product) => product.status !== "active");
  const filteredTotalVariants = filteredProducts.reduce((sum, product) => sum + (product.variants?.length ?? 0), 0);
  const filteredMultiVariantProducts = filteredProducts.filter((product) => hasMeaningfulVariants(product));
  const filteredPricedVariants = filteredProducts.flatMap((product) =>
    (product.variants ?? [])
      .map((variant) => Number.parseFloat(String(variant.price ?? 0)))
      .filter((price) => Number.isFinite(price) && price > 0),
  );
  const filteredAverageVariantPrice = filteredPricedVariants.length
    ? filteredPricedVariants.reduce((sum, price) => sum + price, 0) / filteredPricedVariants.length
    : 0;
  const filteredHighestPricedProduct = filteredProducts.reduce<Product | null>((best, product) => {
    const price = Number.parseFloat(String(product.variants?.[0]?.price ?? 0));
    if (!Number.isFinite(price)) return best;
    if (!best) return product;
    const bestPrice = Number.parseFloat(String(best.variants?.[0]?.price ?? 0));
    return price > bestPrice ? product : best;
  }, null);

  const formatProductPrice = (value?: string) => {
    const amount = Number.parseFloat(String(value ?? 0));
    if (!Number.isFinite(amount) || amount <= 0) return "?";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    border: active ? "1px solid #d1d5db" : "1px solid transparent",
    background: active ? "#ffffff" : "transparent",
    color: "#111827",
    borderRadius: "999px",
    padding: "0.4rem 0.72rem",
    fontSize: "0.82rem",
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    lineHeight: 1,
  });

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading?</div>;
  if (error) return <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", color: "#c0392b", fontSize: "0.875rem" }}>{error}</div>;

  return (
    <>
      <div style={{ marginBottom: "0.9rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Products</h1>
        <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.84rem" }}>
          Catalog overview with product health, variant coverage, and pricing signals.
          {" "}
          {filteredProducts.length > 0 ? `Showing ${pageStart + 1}-${pageEnd} of ${filteredProducts.length}.` : "No products in this view."}
        </p>
      </div>

      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", padding: "0.18rem", background: "#f3f4f6", borderRadius: "999px", marginBottom: "0.9rem" }}>
        {[
          { key: "all", label: "All products", count: products.length },
          { key: "active", label: "Active", count: activeProducts.length },
          { key: "draft", label: "Draft", count: inactiveProducts.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key as "all" | "active" | "draft")}
            style={tabButtonStyle(statusFilter === tab.key)}
          >
            <span>{tab.label}</span>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "1.3rem",
              height: "1.3rem",
              padding: "0 0.34rem",
              borderRadius: "999px",
              background: statusFilter === tab.key ? "#f3f4f6" : "rgba(255,255,255,0.65)",
              color: "#374151",
              fontSize: "0.72rem",
              fontWeight: 700,
            }}>{tab.count}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "0.9rem" }}>
        {[
          { label: "Total products", value: filteredProducts.length, sub: statusFilter === "all" ? "Items in the current feed" : `Products in ${statusFilter} view` },
          { label: "Active products", value: filteredActiveProducts.length, sub: `${filteredInactiveProducts.length} inactive in this view` },
          { label: "Total variants", value: filteredTotalVariants, sub: `${filteredMultiVariantProducts.length} products with options` },
          { label: "Avg variant price", value: filteredAverageVariantPrice ? fmt(filteredAverageVariantPrice, "USD") : "?", sub: filteredHighestPricedProduct ? `Top price: ${filteredHighestPricedProduct.title}` : "No priced products yet" },
        ].map((card) => (
          <div key={card.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.85rem 0.95rem" }}>
            <p style={{ margin: 0, fontSize: "0.73rem", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{card.label}</p>
            <p style={{ margin: "0.24rem 0 0.12rem", fontSize: "1.35rem", fontWeight: 700, color: "#111827" }}>{card.value}</p>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "#6b7280" }}>{card.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "0.75rem", marginBottom: "0.9rem" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.95rem" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827", fontSize: "0.95rem" }}>Catalog health</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.6rem", marginTop: "0.75rem" }}>
            <div style={{ borderRadius: "10px", background: "#f0fdf4", padding: "0.75rem 0.8rem" }}>
              <p style={{ margin: 0, fontSize: "0.72rem", color: "#166534", fontWeight: 700, textTransform: "uppercase" }}>Active</p>
              <p style={{ margin: "0.18rem 0 0", fontSize: "1.2rem", fontWeight: 700, color: "#14532d" }}>{filteredActiveProducts.length}</p>
            </div>
            <div style={{ borderRadius: "10px", background: "#fff7ed", padding: "0.75rem 0.8rem" }}>
              <p style={{ margin: 0, fontSize: "0.72rem", color: "#c2410c", fontWeight: 700, textTransform: "uppercase" }}>Inactive</p>
              <p style={{ margin: "0.18rem 0 0", fontSize: "1.2rem", fontWeight: 700, color: "#9a3412" }}>{filteredInactiveProducts.length}</p>
            </div>
            <div style={{ borderRadius: "10px", background: "#eff6ff", padding: "0.75rem 0.8rem" }}>
              <p style={{ margin: 0, fontSize: "0.72rem", color: "#1d4ed8", fontWeight: 700, textTransform: "uppercase" }}>Multi-variant</p>
              <p style={{ margin: "0.18rem 0 0", fontSize: "1.2rem", fontWeight: 700, color: "#1e40af" }}>{filteredMultiVariantProducts.length}</p>
            </div>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.95rem" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827", fontSize: "0.95rem" }}>Pricing snapshot</p>
          <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.65rem" }}>
            <div>
              <p style={{ margin: 0, fontSize: "0.76rem", color: "#6b7280" }}>Average variant price</p>
              <p style={{ margin: "0.12rem 0 0", fontSize: "1.15rem", fontWeight: 700, color: "#111827" }}>{filteredAverageVariantPrice ? fmt(filteredAverageVariantPrice, "USD") : "?"}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.76rem", color: "#6b7280" }}>Highest base price product</p>
              <p style={{ margin: "0.12rem 0 0", fontSize: "0.9rem", fontWeight: 700, color: "#111827" }}>{filteredHighestPricedProduct?.title ?? "?"}</p>
              <p style={{ margin: "0.08rem 0 0", fontSize: "0.76rem", color: "#6b7280" }}>{formatProductPrice(filteredHighestPricedProduct?.variants?.[0]?.price)}</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
              <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Product</th>
              <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Status</th>
              <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Variants</th>
              <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Links</th>
              <th style={{ padding: "0.75rem 0.9rem", textAlign: "right", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Base price</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map((p, i) => (
              (() => {
                const storefrontProductUrl = storeUrl ? `${storeUrl.replace(/\/$/, "")}/products/${p.handle}` : null;
                const adminProductUrl = adminUrl ? `${adminUrl.replace(/\/$/, "")}/products/${p.id}` : null;
                return (
              <tr key={p.id} style={{ borderBottom: i < paginatedProducts.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <td style={{ padding: "0.78rem 0.9rem", display: "flex", alignItems: "center", gap: "0.7rem" }}>
                  {p.image?.src ? (
                    <img src={p.image.src} alt={p.title} style={{ width: 38, height: 38, borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 38, height: 38, borderRadius: "8px", background: "#f3f4f6", flexShrink: 0 }} />
                  )}
                  <div>
                    <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{p.title}</p>
                    <p style={{ margin: "0.08rem 0 0", fontSize: "0.74rem", color: "#6b7280" }}>{p.handle}</p>
                  </div>
                </td>
                <td style={{ padding: "0.78rem 0.9rem" }}>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "0.18rem 0.5rem",
                    borderRadius: "999px",
                    fontSize: "0.73rem",
                    fontWeight: 600,
                    background: p.status === "active" ? "#f0fdf4" : "#f9fafb",
                    color: p.status === "active" ? "#166534" : "#6b7280",
                    border: "1px solid " + (p.status === "active" ? "#dcfce7" : "#e5e7eb"),
                  }}>{p.status}</span>
                </td>
                <td style={{ padding: "0.78rem 0.9rem", fontSize: "0.82rem", color: "#374151" }}>
                  <div style={{ display: "grid", gap: "0.06rem" }}>
                    <span>{p.variants?.length ?? 0}</span>
                    <span style={{ fontSize: "0.72rem", color: "#9ca3af" }}>{hasMeaningfulVariants(p) ? "Has options" : "Single"}</span>
                  </div>
                </td>
                <td style={{ padding: "0.78rem 0.9rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                    {storefrontProductUrl && (
                      <a
                        href={storefrontProductUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.28rem",
                          padding: "0.28rem 0.56rem",
                          borderRadius: "999px",
                          background: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          color: "#374151",
                          textDecoration: "none",
                          fontSize: "0.74rem",
                          fontWeight: 600,
                        }}
                      >
                        Store
                      </a>
                    )}
                    {adminProductUrl && (
                      <a
                        href={adminProductUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.28rem",
                          padding: "0.28rem 0.56rem",
                          borderRadius: "999px",
                          background: "#eff6ff",
                          border: "1px solid #dbeafe",
                          color: "#1d4ed8",
                          textDecoration: "none",
                          fontSize: "0.74rem",
                          fontWeight: 600,
                        }}
                      >
                        Admin
                      </a>
                    )}
                  </div>
                </td>
                <td style={{ padding: "0.78rem 0.9rem", textAlign: "right", fontSize: "0.82rem", color: "#111827", fontWeight: 600 }}>
                  {formatProductPrice(p.variants?.[0]?.price)}
                </td>
              </tr>
                );
              })()
            ))}
          </tbody>
        </table>
      </div>

      {filteredProducts.length > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginTop: "0.85rem", flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#6b7280" }}>
            Page {safePage} of {totalPages}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
              style={{
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#374151",
                borderRadius: "8px",
                padding: "0.45rem 0.8rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: safePage === 1 ? "not-allowed" : "pointer",
                opacity: safePage === 1 ? 0.55 : 1,
              }}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage === totalPages}
              style={{
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#374151",
                borderRadius: "8px",
                padding: "0.45rem 0.8rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: safePage === totalPages ? "not-allowed" : "pointer",
                opacity: safePage === totalPages ? 0.55 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function CartLimitsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [rules, setRules] = useState<CartQuantityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState("1");

  useEffect(() => {
    Promise.all([
      fetch("/api/standalone/products").then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/";
          throw new Error("unauth");
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
        return data.products ?? [];
      }),
      fetch("/api/standalone/cart-limits").then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/";
          throw new Error("unauth");
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
        return data.rules ?? [];
      }),
    ])
      .then(([productList, storedRules]) => {
        setProducts(productList);
        setRules(storedRules);
      })
      .catch((err) => {
        if (err.message !== "unauth") {
          setError(err.message || "Failed to load cart limits.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const sortedProducts = products
    .filter((product) => product.status === "active")
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title));

  const restrictedProductIds = new Set(rules.map((rule) => rule.productId));
  const availableProducts = sortedProducts.filter((product) => !restrictedProductIds.has(String(product.id)));
  const selectedProduct = sortedProducts.find((product) => String(product.id) === selectedProductId) ?? null;
  const enabledRules = rules.filter((rule) => rule.enabled);

  const saveRules = async (nextRules: CartQuantityRule[]) => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/standalone/cart-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: nextRules }),
      });
      const data = await safeJson<{ rules?: CartQuantityRule[]; error?: string }>(response);
      if (!response.ok) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }
      setRules(data?.rules ?? nextRules);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save cart limits.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = async () => {
    if (!selectedProduct) {
      setError("Choose a product first.");
      return;
    }

    const nextRules = [
      ...rules,
      {
        id: `cart-limit-${selectedProduct.id}`,
        productId: String(selectedProduct.id),
        productTitle: selectedProduct.title,
        quantity: Number(selectedQuantity) || 1,
        enabled: true,
      },
    ].sort((a, b) => a.productTitle.localeCompare(b.productTitle));

    const saved = await saveRules(nextRules);
    if (saved) {
      setSelectedProductId("");
      setSelectedQuantity("1");
    }
  };

  const handleRuleChange = async (ruleId: string, patch: Partial<CartQuantityRule>) => {
    const nextRules = rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule));
    await saveRules(nextRules);
  };

  const handleDeleteRule = async (ruleId: string) => {
    await saveRules(rules.filter((rule) => rule.id !== ruleId));
  };

  const sel: React.CSSProperties = {
    width: "100%",
    padding: "0.7rem 0.8rem",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    fontSize: "0.875rem",
    background: "#fff",
    color: "#1a1a1a",
  };
  const inp: React.CSSProperties = {
    padding: "0.7rem 0.8rem",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    fontSize: "0.875rem",
    background: "#fff",
    color: "#1a1a1a",
  };
  const lbl: React.CSSProperties = {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#374151",
    marginBottom: "0.35rem",
  };
  const bxgySelect: React.CSSProperties = { ...sel, minWidth: 0, flex: 1 };
  const bxgyVariantSelect: React.CSSProperties = { ...sel, minWidth: "190px", flex: "0 0 220px" };
  const bxgyGiftSelect: React.CSSProperties = { ...sel, maxWidth: "560px" };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading cart limits...</div>;
  }

  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Cart Limits</h1>
        <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.84rem", maxWidth: 760 }}>
          Lock specific products to a fixed cart quantity such as 1 or 2. Customers won&apos;t be able to increase or decrease that product in the product form, cart page, or cart drawer.
        </p>
      </div>

      {error && (
        <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", color: "#c0392b", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        {[
          { label: "Restricted products", value: rules.length, sub: "Products with fixed cart quantity" },
          { label: "Enabled now", value: enabledRules.length, sub: `${rules.length - enabledRules.length} paused` },
          { label: "Active catalog", value: sortedProducts.length, sub: "Products available to choose" },
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
            <PolarisProductAutocomplete
              products={availableProducts}
              value={selectedProductId}
              onChange={setSelectedProductId}
              label="Restricted product"
              placeholder={availableProducts.length > 0 ? "Search product to restrict" : "All active products already configured"}
              helpText="Pick the product that should stay locked to a fixed quantity whenever it appears in the cart."
            />
            <Select
              label="Fixed quantity"
              options={Array.from({ length: 10 }, (_, index) => ({
                label: String(index + 1),
                value: String(index + 1),
              }))}
              value={selectedQuantity}
              onChange={setSelectedQuantity}
            />
          </InlineGrid>
          <InlineStack align="end">
            <Button
              variant="primary"
              onClick={handleAddRule}
              loading={saving}
              disabled={!selectedProductId || availableProducts.length === 0}
            >
              Add cart limit
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>

      <div style={{ marginTop: "1rem", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.1rem", borderBottom: "1px solid #e5e7eb" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Configured cart limits</p>
        </div>
        {rules.length === 0 ? (
          <p style={{ margin: 0, padding: "1.5rem", color: "#6b7280" }}>
            No products are locked yet. Add one above to keep it fixed at quantity 1, 2, or another exact amount.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Product</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Fixed quantity</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Status</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "right", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, index) => (
                <tr key={rule.id} style={{ borderBottom: index < rules.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.86rem", fontWeight: 600, color: "#111827" }}>{rule.productTitle}</td>
                  <td style={{ padding: "0.85rem 0.9rem", width: 180 }}>
                    <Select
                      label=""
                      labelHidden
                      options={Array.from({ length: 10 }, (_, optionIndex) => ({
                        label: String(optionIndex + 1),
                        value: String(optionIndex + 1),
                      }))}
                      value={String(rule.quantity)}
                      onChange={(value) => void handleRuleChange(rule.id, { quantity: Number(value) || 1 })}
                      disabled={saving}
                    />
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem" }}>
                    <button
                      type="button"
                      onClick={() => void handleRuleChange(rule.id, { enabled: !rule.enabled })}
                      disabled={saving}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "0.25rem 0.6rem",
                        borderRadius: "999px",
                        border: "1px solid " + (rule.enabled ? "#bbf7d0" : "#e5e7eb"),
                        background: rule.enabled ? "#f0fdf4" : "#f9fafb",
                        color: rule.enabled ? "#166534" : "#6b7280",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        cursor: saving ? "not-allowed" : "pointer",
                      }}
                    >
                      {rule.enabled ? "Enabled" : "Paused"}
                    </button>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => void handleDeleteRule(rule.id)}
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

interface SuggestionDraft { productId: string; discountPercent: string; }

function UpsellsTab({ storeUrl }: { storeUrl?: string }) {
  const router = useRouter();
  const [rules, setRules] = useState<UpsellRule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggerProductId, setTriggerProductId] = useState("");
  const [message, setMessage] = useState("You might also like these!");
  const [suggestions, setSuggestions] = useState<SuggestionDraft[]>([{ productId: "", discountPercent: "0" }]);

  useEffect(() => {
    Promise.all([
      fetch("/api/standalone/upsells").then(r => r.json()),
      fetch("/api/standalone/products").then(r => r.json()),
    ]).then(([u, p]) => {
      setRules(u.rules ?? []);
      setProducts(p.products ?? []);
    }).catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, []);

  const addSuggestion = () => {
    if (suggestions.length >= 5) return;
    setSuggestions(s => [...s, { productId: "", discountPercent: "0" }]);
  };

  const removeSuggestion = (i: number) => setSuggestions(s => s.filter((_, idx) => idx !== i));

  const updateSuggestion = (i: number, field: keyof SuggestionDraft, val: string) => {
    setSuggestions(s => { const next = [...s]; next[i] = { ...next[i], [field]: val }; return next; });
  };

  const handleAdd = async () => {
    const validSuggestions = suggestions.filter(s => s.productId && s.productId !== triggerProductId);
    if (!triggerProductId) { setError("Select a trigger product."); return; }
    if (validSuggestions.length === 0) { setError("Add at least one suggestion product (different from the trigger)."); return; }
    setSaving(true); setError(null);

    const trigger = products.find(p => String(p.id) === triggerProductId);
    const upsellProducts: UpsellProduct[] = validSuggestions.map(s => {
      const p = products.find(pr => String(pr.id) === s.productId)!;
      return {
        productId: s.productId,
        title: p?.title ?? "",
        image: p?.image?.src ?? "",
        price: p?.variants?.[0]?.price ?? "",
        handle: p?.handle ?? "",
        discountPercent: Number(s.discountPercent) || 0,
      };
    });

    const res = await fetch("/api/standalone/upsells", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        triggerProductId,
        triggerProductTitle: trigger?.title ?? "",
        upsellProducts,
        message,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    const updated = await fetch("/api/standalone/upsells").then(r => r.json());
    setRules(updated.rules ?? []);
    setTriggerProductId("");
    setMessage("You might also like these!");
    setSuggestions([{ productId: "", discountPercent: "0" }]);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/standalone/upsells/${id}`, { method: "DELETE" });
    setRules(r => r.filter(x => x.id !== id));
  };

  const sel: React.CSSProperties = { width: "100%", padding: "0.6rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", background: "#fff", color: "#1a1a1a" };
  const inp: React.CSSProperties = { padding: "0.6rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", background: "#fff", color: "#1a1a1a" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" };

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading…</div>;

  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Upsells</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem" }}>Show product recommendations on product pages</p>
      </div>

      {error && <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem", color: "#c0392b", fontSize: "0.875rem" }}>{error}</div>}

      {/* Add rule form */}
      <div style={{ background: "#fff", borderRadius: "10px", padding: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: "1.5rem" }}>
        <p style={{ margin: "0 0 1.25rem", fontWeight: 700, color: "#1a1a1a", fontSize: "0.95rem" }}>New Upsell Rule</p>

        {/* Trigger + message */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <label style={lbl}>When customer views…</label>
            <SearchableProductSelect
              products={products}
              value={triggerProductId}
              onChange={setTriggerProductId}
              placeholder="Search trigger product"
            />
          </div>
          <div>
            <label style={lbl}>Widget message</label>
              <input type="text" style={inp} value={message} onChange={e => setMessage(e.target.value)} />
          </div>
        </div>

        {/* Suggestions */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <label style={{ ...lbl, margin: 0 }}>Suggest these products ({suggestions.length}/5)</label>
            {suggestions.length < 5 && (
              <button onClick={addSuggestion} style={{ padding: "0.3rem 0.75rem", border: "1px solid #008060", borderRadius: "6px", background: "#fff", color: "#008060", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
                + Add product
              </button>
            )}
          </div>

          {suggestions.map((s, i) => {
            const picked = products.find(p => String(p.id) === s.productId);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.6rem", padding: "0.75rem", background: "#f9fafb", borderRadius: "8px" }}>
                {picked?.image?.src && <img src={picked.image.src} alt={picked.title} style={{ width: 36, height: 36, borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />}
                <SearchableProductSelect
                  products={products.filter(p => String(p.id) !== triggerProductId)}
                  value={s.productId}
                  onChange={(value) => updateSuggestion(i, "productId", value)}
                  placeholder="Search suggested product"
                  style={{ flex: 2 }}
                />
                <div style={{ flex: "0 0 110px" }}>
                    <input type="number" min="0" max="100" style={inp} value={s.discountPercent}
                      onChange={e => updateSuggestion(i, "discountPercent", e.target.value)}
                      placeholder="Discount %"
                      title="Discount %" />
                </div>
                <span style={{ fontSize: "0.75rem", color: "#6d7175", flexShrink: 0 }}>% off</span>
                {suggestions.length > 1 && (
                  <button onClick={() => removeSuggestion(i)} style={{ border: "none", background: "none", color: "#c0392b", fontSize: "1rem", cursor: "pointer", flexShrink: 0, padding: "0.1rem 0.3rem" }}>✕</button>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={handleAdd} disabled={saving} style={{
          padding: "0.6rem 1.5rem", background: "#008060", color: "#fff", border: "none",
          borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1,
        }}>{saving ? "Saving…" : "Add Rule"}</button>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6d7175", background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          No upsell rules yet. Add one above.
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e4e5e7" }}>
                {["When viewing", "Suggestions", "Message", "", ""].map((h, i) => (
                  <th key={i} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 600, color: "#6d7175", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < rules.length - 1 ? "1px solid #f1f1f1" : "none" }}>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", fontWeight: 500, color: "#1a1a1a" }}>
                    {(() => {
                      const triggerProduct = products.find((product) => String(product.id) === r.triggerProductId);
                      const triggerUrl = storeUrl && triggerProduct?.handle
                        ? `${storeUrl.replace(/\/$/, "")}/products/${triggerProduct.handle}`
                        : null;

                      if (!triggerUrl) return r.triggerProductTitle;

                      return (
                        <a
                          href={triggerUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#111827", textDecoration: "none", fontWeight: 600 }}
                        >
                          {r.triggerProductTitle}
                        </a>
                      );
                    })()}
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                      {r.upsellProducts.slice(0, 4).map((p, pi) => (
                        (() => {
                          const productUrl = storeUrl && p.handle
                            ? `${storeUrl.replace(/\/$/, "")}/products/${p.handle}`
                            : null;
                          const content = p.image
                            ? <img key={pi} src={p.image} alt={p.title} title={p.title} style={{ width: 32, height: 32, borderRadius: "6px", objectFit: "cover", border: "1px solid #e4e5e7" }} />
                            : <div key={pi} title={p.title} style={{ width: 32, height: 32, borderRadius: "6px", background: "#f1f1f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", color: "#6d7175" }}>{p.title.slice(0, 2)}</div>;

                          if (!productUrl) return content;

                          return (
                            <a key={pi} href={productUrl} target="_blank" rel="noreferrer" title={p.title} style={{ display: "inline-flex" }}>
                              {content}
                            </a>
                          );
                        })()
                      ))}
                      <span style={{ fontSize: "0.78rem", color: "#6d7175" }}>
                        {r.upsellProducts.length} product{r.upsellProducts.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#6d7175", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.message}</td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <button onClick={() => router.push(`/dashboard/upsell/${r.id}`)} style={{
                      padding: "0.3rem 0.75rem", background: "#f0faf7", color: "#008060",
                      border: "1px solid #b7dfce", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer",
                    }}>View Stats</button>
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <button onClick={() => handleDelete(r.id)} style={{
                      padding: "0.3rem 0.75rem", background: "#fff", color: "#c0392b",
                      border: "1px solid #ffd2d2", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer",
                    }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function BuyXGetYTab() {
  const [rules, setRules] = useState<BxgyRule[]>([]);
  const [summary, setSummary] = useState<BxgySummary | null>(null);
  const [ruleStats, setRuleStats] = useState<BxgyRuleStat[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Cart gift");
  const [buyQuantity, setBuyQuantity] = useState("1");
  const [giftQuantity, setGiftQuantity] = useState("1");
  const [message, setMessage] = useState("Free gift added automatically when the rule qualifies.");
  const [priority, setPriority] = useState("1");
  const [autoAdd, setAutoAdd] = useState(true);
  const [buyProductIds, setBuyProductIds] = useState<string[]>([""]);
  const [buyVariantIds, setBuyVariantIds] = useState<string[]>([""]);
  const [giftProductId, setGiftProductId] = useState("");
  const [giftVariantId, setGiftVariantId] = useState("");

  const sel: React.CSSProperties = {
    width: "100%",
    padding: "0.7rem 0.8rem",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    fontSize: "0.875rem",
    background: "#fff",
    color: "#1a1a1a",
  };
  const inp: React.CSSProperties = {
    padding: "0.7rem 0.8rem",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    fontSize: "0.875rem",
    background: "#fff",
    color: "#1a1a1a",
  };
  const lbl: React.CSSProperties = {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#374151",
    marginBottom: "0.35rem",
  };
  const bxgySelect: React.CSSProperties = { ...sel, minWidth: 0, flex: 1 };
  const bxgyVariantSelect: React.CSSProperties = { ...sel, minWidth: "190px", flex: "0 0 220px" };
  const bxgyGiftSelect: React.CSSProperties = { ...sel, maxWidth: "560px" };

  useEffect(() => {
    Promise.all([
      fetch("/api/standalone/bxgy").then(r => safeJson(r)),
      fetch("/api/standalone/bxgy-stats").then(r => safeJson(r)),
      fetch("/api/standalone/products").then(r => safeJson(r)),
    ]).then(([bxgy, bxgyStats, productData]) => {
      setRules(bxgy.rules ?? []);
      setSummary(bxgyStats.summary ?? null);
      setRuleStats(bxgyStats.rules ?? []);
      setProducts(productData.products ?? []);
    }).catch(() => setError("Failed to load Buy X Get Y data."))
      .finally(() => setLoading(false));
  }, []);

  const addBuyTrigger = () => {
    if (buyProductIds.length >= 6) return;
    setBuyProductIds((current) => [...current, ""]);
    setBuyVariantIds((current) => [...current, ""]);
  };

  const getSelectedVariantId = (productId: string, variantId?: string) => {
    const product = products.find((entry) => String(entry.id) === productId);
    if (!product?.variants?.length) return "";
    if (!hasMeaningfulVariants(product)) {
      return String(product.variants[0]?.id ?? "");
    }
    if (variantId && product.variants.some((entry) => String(entry.id) === variantId)) {
      return variantId;
    }
    return "";
  };

  const updateBuyProduct = (index: number, productId: string) => {
    setBuyProductIds((current) => current.map((entry, idx) => idx === index ? productId : entry));
    setBuyVariantIds((current) =>
      current.map((entry, idx) => idx === index ? getSelectedVariantId(productId) : entry),
    );
  };

  const updateBuyVariant = (index: number, variantId: string) => {
    setBuyVariantIds((current) => current.map((entry, idx) => idx === index ? variantId : entry));
  };

  const removeBuyTrigger = (index: number) => {
    setBuyProductIds((current) => current.filter((_, idx) => idx !== index));
    setBuyVariantIds((current) => current.filter((_, idx) => idx !== index));
  };

  const updateGiftProduct = (productId: string) => {
    setGiftProductId(productId);
    setGiftVariantId(getSelectedVariantId(productId));
  };

  const productToBxgy = (productId: string, variantId: string): BxgyProduct | null => {
    const product = products.find((entry) => String(entry.id) === productId);
    const resolvedVariantId = getSelectedVariantId(productId, variantId);
    const variant = product?.variants?.find((entry) => String(entry.id) === resolvedVariantId);
    if (!product || !variant) return null;
    return {
      productId: String(product.id),
      variantId: String(variant.id),
      title: bxgyOptionLabel(product, variant),
      image: product.image?.src ?? "",
      price: variant.price ?? "",
      handle: product.handle,
    };
  };

  const resetForm = () => {
    setName("Cart gift");
    setBuyQuantity("1");
    setGiftQuantity("1");
    setMessage("Free gift added automatically when the rule qualifies.");
    setPriority("1");
    setAutoAdd(true);
    setBuyProductIds([""]);
    setBuyVariantIds([""]);
    setGiftProductId("");
    setGiftVariantId("");
  };

  const handleSave = async () => {
    const buyProducts = buyProductIds
      .map((productId, index) => productToBxgy(productId, buyVariantIds[index] ?? ""))
      .filter(Boolean) as BxgyProduct[];
    const giftProduct = productToBxgy(giftProductId, giftVariantId);

    if (!name.trim()) {
      setError("Enter a rule name.");
      return;
    }
    if (buyProducts.length === 0) {
      setError("Select at least one Buy product.");
      return;
    }
    if (!giftProduct) {
      setError("Select the free Gift product.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/standalone/bxgy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        buyProducts,
        giftProduct,
        buyQuantity,
        giftQuantity,
        message,
        priority,
        autoAdd,
        enabled: true,
      }),
    });
    const data = await safeJson<{ error?: string; warning?: string }>(response);
    if (!response.ok) {
      setError(data?.error ?? "Failed to save BXGY rule.");
      setSaving(false);
      return;
    }
    if (data?.warning) {
      setError(data.warning);
    }

    const [updated, updatedStats] = await Promise.all([
      fetch("/api/standalone/bxgy").then(r => safeJson(r)),
      fetch("/api/standalone/bxgy-stats").then(r => safeJson(r)),
    ]);
    setRules(updated.rules ?? []);
    setSummary(updatedStats.summary ?? null);
    setRuleStats(updatedStats.rules ?? []);
    resetForm();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/standalone/bxgy/${id}`, { method: "DELETE" });
    const data = await safeJson<{ error?: string; warning?: string }>(response);
    if (!response.ok) {
      setError(data?.error ?? "Failed to delete BXGY rule.");
      return;
    }
    if (data?.warning) {
      setError(data.warning);
    }
    const [updated, updatedStats] = await Promise.all([
      fetch("/api/standalone/bxgy").then(r => safeJson(r)),
      fetch("/api/standalone/bxgy-stats").then(r => safeJson(r)),
    ]);
    setRules(updated.rules ?? []);
    setSummary(updatedStats.summary ?? null);
    setRuleStats(updatedStats.rules ?? []);
  };

  if (loading) {
    return (
      <PolarisProvider>
        <div style={{ padding: "2rem 0" }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
              <Text as="p" tone="subdued">Loading...</Text>
            </div>
          </Card>
        </div>
      </PolarisProvider>
    );
  }

  const selectedGiftProduct = products.find((product) => String(product.id) === giftProductId);
  const selectedTriggerCount = buyProductIds.filter(Boolean).length;
  const selectedGiftLabel = selectedGiftProduct ? selectedGiftProduct.title : "Choose a gift product";

  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Buy X Get Y</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem" }}>Dynamic free-gift rules powered by metaobjects, automatic cart insertion, and dashboard stats.</p>
      </div>

      {error && <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem", color: "#c0392b", fontSize: "0.875rem" }}>{error}</div>}

      <div style={{
        background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 55%, #ffffff 100%)",
        border: "1px solid #bbf7d0",
        borderRadius: "16px",
        padding: "1.5rem",
        marginBottom: "1.5rem",
        boxShadow: "0 6px 24px rgba(22, 101, 52, 0.06)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em" }}>New Free Gift Rule</p>
            <h2 style={{ margin: "0.35rem 0 0.2rem", fontSize: "1.25rem", color: "#14532d" }}>Set the exact cart condition and gift behavior</h2>
            <p style={{ margin: 0, color: "#4b5563", fontSize: "0.86rem", maxWidth: 620 }}>When the customer qualifies, the gift is added automatically in the cart and drawer. The discount function then makes that Y item free.</p>
          </div>
          <div style={{ padding: "0.5rem 0.75rem", borderRadius: "999px", background: "#dcfce7", color: "#166534", fontSize: "0.78rem", fontWeight: 700 }}>
            Rebuy-style automation
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label style={lbl}>Rule name</label>
            <input type="text" style={inp} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Buy quantity</label>
            <input type="number" min="1" style={inp} value={buyQuantity} onChange={(e) => setBuyQuantity(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Gift quantity</label>
            <input type="number" min="1" style={inp} value={giftQuantity} onChange={(e) => setGiftQuantity(e.target.value)} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 0.9fr 0.7fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label style={lbl}>Gift message</label>
            <input type="text" style={inp} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Priority</label>
            <input type="number" min="1" style={inp} value={priority} onChange={(e) => setPriority(e.target.value)} />
          </div>
          <div style={{ display: "flex", alignItems: "end" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.55rem", fontSize: "0.86rem", fontWeight: 600, color: "#14532d", padding: "0.7rem 0" }}>
              <input type="checkbox" checked={autoAdd} onChange={(e) => setAutoAdd(e.target.checked)} />
              Auto-add gift
            </label>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div style={{ background: "#fff", border: "1px solid #d1fae5", borderRadius: "14px", padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
              <p style={{ margin: 0, fontWeight: 700, color: "#14532d" }}>Buy products</p>
              <button onClick={addBuyTrigger} type="button" style={{ padding: "0.35rem 0.8rem", borderRadius: "8px", border: "1px solid #16a34a", background: "#fff", color: "#166534", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
                + Add trigger
              </button>
            </div>
            {buyProductIds.map((productId, index) => {
              const selectedProduct = products.find((product) => String(product.id) === productId);
              const showVariantSelect = hasMeaningfulVariants(selectedProduct);

              return (
              <div key={index} style={{ display: "flex", gap: "0.55rem", alignItems: "stretch", marginBottom: index === buyProductIds.length - 1 ? 0 : "0.55rem" }}>
                <SearchableProductSelect
                  products={products}
                  value={productId}
                  onChange={(value) => updateBuyProduct(index, value)}
                  placeholder="Search trigger product"
                  style={showVariantSelect ? bxgySelect : bxgyGiftSelect}
                />
                {showVariantSelect && (
                  <select style={bxgyVariantSelect} value={buyVariantIds[index] ?? ""} onChange={(e) => updateBuyVariant(index, e.target.value)}>
                    <option value="">Select variant</option>
                    {selectedProduct?.variants?.map((variant) => (
                      <option key={variant.id} value={String(variant.id)}>
                        {variant.title}
                      </option>
                    ))}
                  </select>
                )}
                {buyProductIds.length > 1 && (
                  <button type="button" onClick={() => removeBuyTrigger(index)} style={{ border: "1px solid #fecaca", background: "#fff", color: "#b91c1c", borderRadius: "10px", padding: "0 0.8rem", cursor: "pointer" }}>
                    Remove
                  </button>
                )}
              </div>
            )})}
          </div>

          <div style={{ background: "#fff", border: "1px solid #d1fae5", borderRadius: "14px", padding: "1rem" }}>
            <p style={{ margin: "0 0 0.8rem", fontWeight: 700, color: "#14532d" }}>Gift product</p>
            <SearchableProductSelect
              products={products}
              value={giftProductId}
              onChange={updateGiftProduct}
              placeholder="Search free gift product"
              style={bxgyGiftSelect}
            />
            {hasMeaningfulVariants(products.find((product) => String(product.id) === giftProductId)) && (
              <select style={{ ...bxgyVariantSelect, marginTop: "0.65rem", display: "block" }} value={giftVariantId} onChange={(e) => setGiftVariantId(e.target.value)}>
                <option value="">Select variant</option>
                {products.find((product) => String(product.id) === giftProductId)?.variants?.map((variant) => (
                  <option key={variant.id} value={String(variant.id)}>
                    {variant.title}
                  </option>
                ))}
              </select>
            )}
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.78rem", color: "#6d7175" }}>
              The selected variant is the one used for automatic cart insertion and pricing.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "0.75rem 1.5rem",
            background: "#166534",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "0.9rem",
            fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? "Savingâ€¦" : "Save BXGY rule"}
          </button>
        </div>
      </div>

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Active rules", value: summary.activeRules, sub: "Currently compiled" },
            { label: "Qualified carts", value: summary.totalQualified, sub: "Gift unlocked" },
            { label: "Auto-added gifts", value: summary.totalAutoAdded, sub: "Inserted by app" },
            { label: "Conversion", value: summary.conversionRate, sub: "Qualified to added" },
          ].map((card) => (
            <div key={card.label} style={{ background: "#fff", borderRadius: "12px", padding: "1rem 1.15rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <p style={{ margin: 0, fontSize: "0.74rem", color: "#6d7175", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{card.label}</p>
              <p style={{ margin: "0.35rem 0 0.15rem", fontSize: "1.5rem", fontWeight: 700, color: "#14532d" }}>{card.value}</p>
              <p style={{ margin: 0, fontSize: "0.76rem", color: "#6d7175" }}>{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {rules.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6d7175", background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          No Buy X Get Y rules yet. Create your first one above.
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e4e5e7" }}>
                {["Rule", "Buy", "Gift", "Quantities", "Priority", ""].map((heading) => (
                  <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.78rem", fontWeight: 700, color: "#6d7175", textTransform: "uppercase" }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, index) => (
                <tr key={rule.id} style={{ borderBottom: index < rules.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "0.95rem 1rem", verticalAlign: "top" }}>
                    <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>{rule.name}</p>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "#6b7280", maxWidth: 260 }}>{rule.message}</p>
                  </td>
                  <td style={{ padding: "0.95rem 1rem", fontSize: "0.86rem", color: "#111827" }}>{rule.buyProducts.map((product) => product.title).join(", ")}</td>
                  <td style={{ padding: "0.95rem 1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                      {rule.giftProduct?.image ? <img src={rule.giftProduct.image} alt={rule.giftProduct.title} style={{ width: 36, height: 36, borderRadius: "8px", objectFit: "cover", border: "1px solid #e5e7eb" }} /> : null}
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, color: "#111827", fontSize: "0.86rem" }}>{rule.giftProduct?.title ?? "—"}</p>
                        <p style={{ margin: "0.1rem 0 0", fontSize: "0.76rem", color: "#16a34a", fontWeight: 700 }}>Free gift</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "0.95rem 1rem", fontSize: "0.84rem", color: "#111827" }}>Buy {rule.buyQuantity}, get {rule.giftQuantity}</td>
                  <td style={{ padding: "0.95rem 1rem" }}>
                    <span style={{ display: "inline-flex", padding: "0.25rem 0.55rem", borderRadius: "999px", background: "#ecfdf5", color: "#166534", fontSize: "0.78rem", fontWeight: 700 }}>
                      {rule.priority}
                    </span>
                  </td>
                  <td style={{ padding: "0.95rem 1rem", textAlign: "right" }}>
                    <button onClick={() => handleDelete(rule.id)} style={{ padding: "0.45rem 0.8rem", background: "#fff", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "0.8rem", cursor: "pointer" }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden", marginTop: "1.5rem" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e5e7eb" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>BXGY performance</p>
        </div>
        {ruleStats.length === 0 ? (
          <p style={{ margin: 0, padding: "2rem", textAlign: "center", color: "#6b7280" }}>Statistics will appear once carts qualify and gifts are auto-added.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                {["Rule", "Buy", "Gift", "Qualified", "Added", "Conversion"].map((heading) => (
                  <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.78rem", fontWeight: 700, color: "#6d7175", textTransform: "uppercase" }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ruleStats.map((stat, index) => (
                <tr key={stat.ruleId} style={{ borderBottom: index < ruleStats.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: "#111827" }}>{stat.name}</td>
                  <td style={{ padding: "0.85rem 1rem", color: "#374151", fontSize: "0.85rem" }}>{stat.buyLabel}</td>
                  <td style={{ padding: "0.85rem 1rem", color: "#374151", fontSize: "0.85rem" }}>{stat.giftLabel}</td>
                  <td style={{ padding: "0.85rem 1rem", color: "#111827" }}>{stat.qualified}</td>
                  <td style={{ padding: "0.85rem 1rem", color: "#111827" }}>{stat.autoAdded}</td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <span style={{ display: "inline-flex", padding: "0.25rem 0.55rem", borderRadius: "999px", background: "#ecfdf5", color: "#166534", fontSize: "0.78rem", fontWeight: 700 }}>
                      {stat.conversionRate}
                    </span>
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

function BuyXGetYTabPolaris() {
  const [rules, setRules] = useState<BxgyRule[]>([]);
  const [summary, setSummary] = useState<BxgySummary | null>(null);
  const [ruleStats, setRuleStats] = useState<BxgyRuleStat[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Cart gift");
  const [buyQuantity, setBuyQuantity] = useState("1");
  const [giftQuantity, setGiftQuantity] = useState("1");
  const [message, setMessage] = useState("Free gift added automatically when the rule qualifies.");
  const [priority, setPriority] = useState("1");
  const [autoAdd, setAutoAdd] = useState(true);
  const [buyProductIds, setBuyProductIds] = useState<string[]>([""]);
  const [buyVariantIds, setBuyVariantIds] = useState<string[]>([""]);
  const [giftProductId, setGiftProductId] = useState("");
  const [giftVariantId, setGiftVariantId] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/standalone/bxgy").then((r) => safeJson(r)),
      fetch("/api/standalone/bxgy-stats").then((r) => safeJson(r)),
      fetch("/api/standalone/products").then((r) => safeJson(r)),
    ])
      .then(([bxgy, bxgyStats, productData]) => {
        setRules(bxgy?.rules ?? []);
        setSummary(bxgyStats?.summary ?? null);
        setRuleStats(bxgyStats?.rules ?? []);
        setProducts(productData?.products ?? []);
      })
      .catch(() => setError("Failed to load Buy X Get Y data."))
      .finally(() => setLoading(false));
  }, []);

  const addBuyTrigger = () => {
    if (buyProductIds.length >= 6) return;
    setBuyProductIds((current) => [...current, ""]);
    setBuyVariantIds((current) => [...current, ""]);
  };

  const getSelectedVariantId = (productId: string, variantId?: string) => {
    const product = products.find((entry) => String(entry.id) === productId);
    if (!product?.variants?.length) return "";
    if (!hasMeaningfulVariants(product)) {
      return String(product.variants[0]?.id ?? "");
    }
    if (variantId && product.variants.some((entry) => String(entry.id) === variantId)) {
      return variantId;
    }
    return "";
  };

  const updateBuyProduct = (index: number, productId: string) => {
    setBuyProductIds((current) => current.map((entry, idx) => (idx === index ? productId : entry)));
    setBuyVariantIds((current) =>
      current.map((entry, idx) => (idx === index ? getSelectedVariantId(productId) : entry)),
    );
  };

  const updateBuyVariant = (index: number, variantId: string) => {
    setBuyVariantIds((current) => current.map((entry, idx) => (idx === index ? variantId : entry)));
  };

  const removeBuyTrigger = (index: number) => {
    setBuyProductIds((current) => current.filter((_, idx) => idx !== index));
    setBuyVariantIds((current) => current.filter((_, idx) => idx !== index));
  };

  const updateGiftProduct = (productId: string) => {
    setGiftProductId(productId);
    setGiftVariantId(getSelectedVariantId(productId));
  };

  const productToBxgy = (productId: string, variantId: string): BxgyProduct | null => {
    const product = products.find((entry) => String(entry.id) === productId);
    const resolvedVariantId = getSelectedVariantId(productId, variantId);
    const variant = product?.variants?.find((entry) => String(entry.id) === resolvedVariantId);
    if (!product || !variant) return null;
    return {
      productId: String(product.id),
      variantId: String(variant.id),
      title: bxgyOptionLabel(product, variant),
      image: product.image?.src ?? "",
      price: variant.price ?? "",
      handle: product.handle,
    };
  };

  const resetForm = () => {
    setName("Cart gift");
    setBuyQuantity("1");
    setGiftQuantity("1");
    setMessage("Free gift added automatically when the rule qualifies.");
    setPriority("1");
    setAutoAdd(true);
    setBuyProductIds([""]);
    setBuyVariantIds([""]);
    setGiftProductId("");
    setGiftVariantId("");
  };

  const refreshData = async () => {
    const [updated, updatedStats] = await Promise.all([
      fetch("/api/standalone/bxgy").then((r) => safeJson(r)),
      fetch("/api/standalone/bxgy-stats").then((r) => safeJson(r)),
    ]);
    setRules(updated?.rules ?? []);
    setSummary(updatedStats?.summary ?? null);
    setRuleStats(updatedStats?.rules ?? []);
  };

  const handleSave = async () => {
    const buyProducts = buyProductIds
      .map((productId, index) => productToBxgy(productId, buyVariantIds[index] ?? ""))
      .filter(Boolean) as BxgyProduct[];
    const giftProduct = productToBxgy(giftProductId, giftVariantId);

    if (!name.trim()) {
      setError("Enter a rule name.");
      return;
    }
    if (buyProducts.length === 0) {
      setError("Select at least one Buy product.");
      return;
    }
    if (!giftProduct) {
      setError("Select the free Gift product.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/standalone/bxgy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        buyProducts,
        giftProduct,
        buyQuantity,
        giftQuantity,
        message,
        priority,
        autoAdd,
        enabled: true,
      }),
    });
    const data = await safeJson<{ error?: string; warning?: string }>(response);
    if (!response.ok) {
      setError(data?.error ?? "Failed to save BXGY rule.");
      setSaving(false);
      return;
    }
    if (data?.warning) {
      setError(data.warning);
    }

    await refreshData();
    resetForm();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/standalone/bxgy/${id}`, { method: "DELETE" });
    const data = await safeJson<{ error?: string; warning?: string }>(response);
    if (!response.ok) {
      setError(data?.error ?? "Failed to delete BXGY rule.");
      return;
    }
    if (data?.warning) {
      setError(data.warning);
    }
    await refreshData();
  };

  if (loading) {
    return (
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <div style={{ height: "1rem", width: "35%", background: "#f1f1f1", borderRadius: 4 }} />
            <div style={{ height: "0.75rem", width: "55%", background: "#f8f8f8", borderRadius: 4 }} />
          </BlockStack>
        </Card>
      </BlockStack>
    );
  }

  const selectedGiftProduct = products.find((product) => String(product.id) === giftProductId);
  const selectedTriggerCount = buyProductIds.filter(Boolean).length;
  const selectedGiftLabel = selectedGiftProduct ? selectedGiftProduct.title : "Choose a gift product";

  return (
    <BlockStack gap="500">

      {/* Page header */}
      <BlockStack gap="100">
        <Text as="h1" variant="headingXl">Buy X Get Y</Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          Dynamic free-gift rules powered by metaobjects, automatic cart insertion, and dashboard stats.
        </Text>
      </BlockStack>

      {/* Error banner */}
      {error && (
        <Banner tone="critical" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      {/* Summary stat cards */}
      {summary && (
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          {[
            { label: "Active rules", value: summary.activeRules, sub: "Currently compiled" },
            { label: "Qualified carts", value: summary.totalQualified, sub: "Gift unlocked" },
            { label: "Auto-added gifts", value: summary.totalAutoAdded, sub: "Inserted by app" },
            { label: "Conversion", value: summary.conversionRate, sub: "Qualified to added" },
          ].map((card) => (
            <Card key={card.label}>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">{card.label}</Text>
                <Text as="p" variant="headingLg">{String(card.value)}</Text>
                <Text as="p" variant="bodySm" tone="subdued">{card.sub}</Text>
              </BlockStack>
            </Card>
          ))}
        </InlineGrid>
      )}

      {/* Create rule form */}
      <Card>
        <BlockStack gap="500">
          <InlineStack align="space-between" blockAlign="start">
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">New free gift rule</Text>
              <Text as="h2" variant="headingLg">Launch a Buy X Get Y campaign</Text>
            </BlockStack>
            <Badge tone="success">Auto-add gift flow</Badge>
          </InlineStack>

          <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
            {[
              { label: "Buy triggers", value: `${selectedTriggerCount || 0} selected` },
              { label: "Gift product", value: selectedGiftLabel },
              { label: "Rule outcome", value: `Buy ${buyQuantity || "1"}, get ${giftQuantity || "1"}` },
            ].map((item) => (
              <Card key={item.label}>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">{item.label}</Text>
                  <Text as="p" variant="headingMd">{item.value}</Text>
                </BlockStack>
              </Card>
            ))}
          </InlineGrid>

          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text as="h3" variant="headingMd">Rule setup</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Set the campaign name, quantities, shopper message, and execution priority.
                  </Text>
                </BlockStack>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <TextField label="Rule name" value={name} onChange={setName} autoComplete="off" />
                  <TextField label="Priority" type="number" min={1} value={priority} onChange={setPriority} autoComplete="off" />
                </InlineGrid>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <TextField label="Buy quantity" type="number" min={1} value={buyQuantity} onChange={setBuyQuantity} autoComplete="off" />
                  <TextField label="Gift quantity" type="number" min={1} value={giftQuantity} onChange={setGiftQuantity} autoComplete="off" />
                </InlineGrid>
                <TextField label="Gift message" value={message} onChange={setMessage} autoComplete="off" />
                <Checkbox label="Auto-add gift when the rule qualifies" checked={autoAdd} onChange={setAutoAdd} />
              </BlockStack>
            </Card>

            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingMd">Gift product</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Choose the exact free gift product and variant to add into the cart when the rule qualifies.
                    </Text>
                  </BlockStack>
                  <PolarisProductAutocomplete
                    products={products}
                    value={giftProductId}
                    onChange={updateGiftProduct}
                    label="Gift product"
                    placeholder="Search free gift product"
                    helpText="This item is the free gift attached to the rule."
                  />
                  {hasMeaningfulVariants(selectedGiftProduct) && (
                    <Select
                      label="Gift variant"
                      options={[
                        { label: "Select variant", value: "" },
                        ...(selectedGiftProduct?.variants?.map((variant) => ({
                          label: variant.title,
                          value: String(variant.id),
                        })) ?? []),
                      ]}
                      value={giftVariantId}
                      onChange={setGiftVariantId}
                    />
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingMd">Qualifying products</Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Add one or more products that should count toward the Buy quantity.
                      </Text>
                    </BlockStack>
                    <Button onClick={addBuyTrigger} disabled={buyProductIds.length >= 6}>Add trigger</Button>
                  </InlineStack>
                  {buyProductIds.map((productId, index) => {
                    const selectedProduct = products.find((product) => String(product.id) === productId);
                    const variantOptions = selectedProduct?.variants?.map((variant) => ({
                      label: variant.title,
                      value: String(variant.id),
                    })) ?? [];
                    return (
                      <InlineStack key={index} gap="200" blockAlign="end">
                        <div style={{ flex: 1 }}>
                          <PolarisProductAutocomplete
                            products={products}
                            value={productId}
                            onChange={(value) => updateBuyProduct(index, value)}
                            label={`Buy product ${index + 1}`}
                            placeholder="Search trigger product"
                          />
                        </div>
                        {hasMeaningfulVariants(selectedProduct) && (
                          <div style={{ minWidth: 220 }}>
                            <Select
                              label="Variant"
                              options={[{ label: "Select variant", value: "" }, ...variantOptions]}
                              value={buyVariantIds[index] ?? ""}
                              onChange={(value) => updateBuyVariant(index, value)}
                            />
                          </div>
                        )}
                        {buyProductIds.length > 1 && (
                          <Button tone="critical" variant="secondary" onClick={() => removeBuyTrigger(index)}>
                            Remove
                          </Button>
                        )}
                      </InlineStack>
                    );
                  })}
                </BlockStack>
              </Card>
            </BlockStack>
          </InlineGrid>

          <InlineStack align="end">
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save BXGY rule
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>

      {/* Rules list */}
      <Card padding="0">
        {rules.length === 0 ? (
          <EmptyState heading="No Buy X Get Y rules yet" image="">
            <Text as="p" variant="bodyMd" tone="subdued">
              Create your first rule above to automatically add free gifts to qualifying carts.
            </Text>
          </EmptyState>
        ) : (
          <IndexTable
            resourceName={{ singular: "rule", plural: "rules" }}
            itemCount={rules.length}
            headings={[
              { title: "Rule" },
              { title: "Buy products" },
              { title: "Gift" },
              { title: "Quantities" },
              { title: "Priority" },
              { title: "" },
            ]}
            selectable={false}
          >
            {rules.map((rule, index) => (
              <IndexTable.Row id={rule.id} key={rule.id} position={index}>
                <IndexTable.Cell>
                  <BlockStack gap="050">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">{rule.name}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">{rule.message}</Text>
                  </BlockStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="p" variant="bodySm">{rule.buyProducts.map((p) => p.title).join(", ")}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack gap="200" blockAlign="center">
                    {rule.giftProduct?.image && (
                      <Thumbnail source={rule.giftProduct.image} alt={rule.giftProduct.title ?? ""} size="small" />
                    )}
                    <BlockStack gap="050">
                      <Text as="p" variant="bodySm" fontWeight="semibold">{rule.giftProduct?.title ?? "—"}</Text>
                      <Badge tone="success">Free gift</Badge>
                    </BlockStack>
                  </InlineStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="p" variant="bodySm">Buy {rule.buyQuantity}, get {rule.giftQuantity}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge>{String(rule.priority)}</Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Button tone="critical" variant="secondary" size="slim" onClick={() => handleDelete(rule.id)}>
                    Delete
                  </Button>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        )}
      </Card>

      {/* Performance stats */}
      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">BXGY performance</Text>
          {ruleStats.length === 0 ? (
            <Text as="p" variant="bodyMd" tone="subdued">
              Statistics will appear once carts qualify and gifts are auto-added.
            </Text>
          ) : (
            <DataTable
              columnContentTypes={["text", "text", "text", "numeric", "numeric", "text"]}
              headings={["Rule", "Buy", "Gift", "Qualified", "Added", "Conversion"]}
              rows={ruleStats.map((stat) => [
                stat.name,
                stat.buyLabel,
                stat.giftLabel,
                stat.qualified,
                stat.autoAdded,
                <Badge key={stat.ruleId} tone="success">{stat.conversionRate}</Badge>,
              ])}
            />
          )}
        </BlockStack>
      </Card>

    </BlockStack>
  );
}

function PostPurchaseTab() {
  const [offers, setOffers] = useState<PostPurchaseOffer[]>([]);
  const [summary, setSummary] = useState<PostPurchaseSummary | null>(null);
  const [offerStats, setOfferStats] = useState<PostPurchaseOfferStat[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Post-purchase offer");
  const [headline, setHeadline] = useState("One more thing before you go");
  const [body, setBody] = useState("Add this bonus item to the order you just placed without starting checkout again.");
  const [ctaLabel, setCtaLabel] = useState("Add to my order");
  const [discountPercent, setDiscountPercent] = useState("15");
  const [priority, setPriority] = useState("1");
  const [triggerType, setTriggerType] = useState<PostPurchaseOffer["triggerType"]>("all_orders");
  const [triggerProductIds, setTriggerProductIds] = useState<string[]>([""]);
  const [minimumSubtotal, setMinimumSubtotal] = useState("0");
  const [offerProductId, setOfferProductId] = useState("");
  const [offerVariantId, setOfferVariantId] = useState("");
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/standalone/post-purchase").then((r) => safeJson(r)),
      fetch("/api/standalone/post-purchase-stats").then((r) => safeJson(r)),
      fetch("/api/standalone/products").then((r) => safeJson(r)),
    ])
      .then(([offerData, statsData, productData]) => {
        setOffers(offerData?.offers ?? []);
        setSummary(statsData?.summary ?? null);
        setOfferStats(statsData?.offers ?? []);
        setProducts(productData?.products ?? []);
      })
      .catch(() => setError("Failed to load post-purchase offers."))
      .finally(() => setLoading(false));
  }, []);

  const getSelectedVariantId = (productId: string, variantId?: string) => {
    const product = products.find((entry) => String(entry.id) === productId);
    if (!product?.variants?.length) return "";
    if (!hasMeaningfulVariants(product)) {
      return String(product.variants[0]?.id ?? "");
    }
    if (variantId && product.variants.some((entry) => String(entry.id) === variantId)) {
      return variantId;
    }
    return "";
  };

  const updateOfferProduct = (productId: string) => {
    setOfferProductId(productId);
    setOfferVariantId(getSelectedVariantId(productId));
  };

  const updateTriggerProduct = (index: number, productId: string) => {
    setTriggerProductIds((current) => current.map((entry, idx) => (idx === index ? productId : entry)));
  };

  const addTriggerProduct = () => {
    if (triggerProductIds.length >= 6) return;
    setTriggerProductIds((current) => [...current, ""]);
  };

  const removeTriggerProduct = (index: number) => {
    setTriggerProductIds((current) => current.filter((_, idx) => idx !== index));
  };

  const productToOffer = (productId: string, variantId: string): PostPurchaseProduct | null => {
    const product = products.find((entry) => String(entry.id) === productId);
    const resolvedVariantId = getSelectedVariantId(productId, variantId);
    const variant = product?.variants?.find((entry) => String(entry.id) === resolvedVariantId);
    if (!product || !variant) return null;
    return {
      productId: String(product.id),
      variantId: String(variant.id),
      title: bxgyOptionLabel(product, variant),
      image: product.image?.src ?? "",
      price: variant.price ?? "",
      handle: product.handle,
    };
  };

  const refreshData = async () => {
    const [offerData, statsData] = await Promise.all([
      fetch("/api/standalone/post-purchase").then((r) => safeJson(r)),
      fetch("/api/standalone/post-purchase-stats").then((r) => safeJson(r)),
    ]);
    setOffers(offerData?.offers ?? []);
    setSummary(statsData?.summary ?? null);
    setOfferStats(statsData?.offers ?? []);
  };

  const resetForm = () => {
    setEditingOfferId(null);
    setName("Post-purchase offer");
    setHeadline("One more thing before you go");
    setBody("Add this bonus item to the order you just placed without starting checkout again.");
    setCtaLabel("Add to my order");
    setDiscountPercent("15");
    setPriority("1");
    setTriggerType("all_orders");
    setTriggerProductIds([""]);
    setMinimumSubtotal("0");
    setOfferProductId("");
    setOfferVariantId("");
  };

  const startEditing = (offer: PostPurchaseOffer) => {
    setEditingOfferId(offer.id);
    setName(offer.name);
    setHeadline(offer.headline || "One more thing before you go");
    setBody(offer.body || "Add this bonus item to the order you just placed without starting checkout again.");
    setCtaLabel(offer.ctaLabel || "Add to my order");
    setDiscountPercent(String(offer.discountPercent || 15));
    setPriority(String(offer.priority || 1));
    setTriggerType(offer.triggerType || "all_orders");
    setTriggerProductIds(offer.triggerProductIds.length ? offer.triggerProductIds : [""]);
    setMinimumSubtotal(String(offer.minimumSubtotal || 0));
    setOfferProductId(offer.offerProduct?.productId ?? "");
    setOfferVariantId(offer.offerProduct?.variantId ?? "");
    setError(null);
  };

  const handleSave = async () => {
    const offerProduct = productToOffer(offerProductId, offerVariantId);
    const sanitizedTriggerProductIds = triggerProductIds.filter(Boolean);

    if (!name.trim()) {
      setError("Enter an offer name.");
      return;
    }
    if (!offerProduct) {
      setError("Select the product to offer after checkout.");
      return;
    }
    if (triggerType === "contains_product" && sanitizedTriggerProductIds.length === 0) {
      setError("Choose at least one trigger product for contains-product targeting.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/standalone/post-purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingOfferId,
        name,
        offerProduct,
        headline,
        body,
        ctaLabel,
        discountPercent,
        priority,
        triggerType,
        triggerProductIds: sanitizedTriggerProductIds,
        minimumSubtotal,
        enabled: true,
      }),
    });
    const data = await safeJson<{ error?: string }>(response);
    if (!response.ok) {
      setError(data?.error ?? "Failed to save post-purchase offer.");
      setSaving(false);
      return;
    }

    await refreshData();
    resetForm();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/standalone/post-purchase/${id}`, { method: "DELETE" });
    const data = await safeJson<{ error?: string }>(response);
    if (!response.ok) {
      setError(data?.error ?? "Failed to delete post-purchase offer.");
      return;
    }
    await refreshData();
  };

  if (loading) {
    return (
      <PolarisProvider>
        <div style={{ padding: "2rem 0" }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
              <Text as="p" tone="subdued">Loading...</Text>
            </div>
          </Card>
        </div>
      </PolarisProvider>
    );
  }

  const selectedOfferProduct = products.find((product) => String(product.id) === offerProductId);
  const selectedProductLabel = selectedOfferProduct ? selectedOfferProduct.title : "Choose an offer product";
  const selectedTriggerCount = triggerProductIds.filter(Boolean).length;
  const triggerSummaryLabel =
    triggerType === "all_orders"
      ? "All eligible orders"
      : triggerType === "minimum_subtotal"
        ? `Subtotal over ${minimumSubtotal || "0"}`
        : `${selectedTriggerCount || 0} trigger product${selectedTriggerCount === 1 ? "" : "s"}`;
  const triggerOptions = [
    { label: "Every eligible order can see it", value: "all_orders" },
    { label: "Order subtotal reaches a threshold", value: "minimum_subtotal" },
    { label: "The order contains selected products", value: "contains_product" },
  ];
  const variantOptions = selectedOfferProduct?.variants?.map((variant) => ({
    label: variant.title,
    value: String(variant.id),
  })) ?? [];

  return (
    <PolarisProvider>
      <>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Post-Purchase</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem" }}>
            Build one-click offers for the moment right after checkout, with targeting, discounting, and offer stats in one place.
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: "1rem" }}>
            <Card>
              <Text as="p" tone="critical">{error}</Text>
            </Card>
          </div>
        )}

        <div style={{ marginBottom: "1.5rem" }}>
          <Card>
            <BlockStack gap="500">
              <InlineStack align="space-between" blockAlign="start">
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    {editingOfferId ? "Editing post-purchase offer" : "New post-purchase offer"}
                  </Text>
                  <Text as="h2" variant="headingLg">
                    {editingOfferId ? "Update the selected checkout offer" : "Launch a one-click offer after checkout"}
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Rebuy-style flow for the order-complete moment: choose the product, set the offer copy, and decide whether it appears for all orders, qualifying carts, or orders above a threshold.
                  </Text>
                </BlockStack>
                <Badge tone="info">Checkout upsell layer</Badge>
              </InlineStack>

              <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
                {[
                  { label: "Discount", value: `${discountPercent || "0"}% off` },
                  { label: "Trigger", value: triggerSummaryLabel },
                  { label: "Offer product", value: selectedProductLabel },
                ].map((item) => (
                  <Card key={item.label}>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">{item.label}</Text>
                      <Text as="p" variant="headingMd">{item.value}</Text>
                    </BlockStack>
                  </Card>
                ))}
              </InlineGrid>

              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                <Card>
                  <BlockStack gap="400">
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingMd">Offer content</Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Set the internal name, shopper-facing copy, and the action text shown after checkout.
                      </Text>
                    </BlockStack>
                    <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                      <TextField label="Offer name" value={name} onChange={setName} autoComplete="off" />
                      <TextField label="CTA label" value={ctaLabel} onChange={setCtaLabel} autoComplete="off" />
                    </InlineGrid>
                    <TextField label="Headline" value={headline} onChange={setHeadline} autoComplete="off" />
                    <TextField label="Offer body" value={body} onChange={setBody} multiline={6} autoComplete="off" />
                  </BlockStack>
                </Card>

                <BlockStack gap="400">
                  <Card>
                    <BlockStack gap="400">
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingMd">Offer product</Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Choose the item to show immediately after checkout. If the product has variants, select the exact one to sell.
                        </Text>
                      </BlockStack>
                      <PolarisProductAutocomplete
                        products={products}
                        value={offerProductId}
                        onChange={updateOfferProduct}
                        label="Offer product"
                        placeholder="Search product to offer"
                        helpText="This is the item the customer can add after completing checkout."
                      />
                      {hasMeaningfulVariants(selectedOfferProduct) && (
                        <Select label="Variant" options={variantOptions} value={offerVariantId} onChange={setOfferVariantId} />
                      )}
                    </BlockStack>
                  </Card>

                  <Card>
                    <BlockStack gap="400">
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingMd">Rules and priority</Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Control discount strength, sequencing, and which checkout completions qualify for this offer.
                        </Text>
                      </BlockStack>
                      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                        <TextField label="Discount percent" type="number" min={1} max={100} value={discountPercent} onChange={setDiscountPercent} autoComplete="off" />
                        <TextField label="Priority" type="number" min={1} value={priority} onChange={setPriority} autoComplete="off" />
                      </InlineGrid>
                      <Select label="Show offer when" options={triggerOptions} value={triggerType} onChange={(value) => setTriggerType(value as PostPurchaseOffer["triggerType"])} />
                      {triggerType === "minimum_subtotal" && (
                        <TextField label="Minimum subtotal" type="number" min={0} step={0.01} value={minimumSubtotal} onChange={setMinimumSubtotal} autoComplete="off" />
                      )}
                      {triggerType === "contains_product" && (
                        <BlockStack gap="300">
                          <InlineStack align="space-between" blockAlign="center">
                            <Text as="p" variant="bodyMd">Qualifying products</Text>
                            <Button onClick={addTriggerProduct}>Add product</Button>
                          </InlineStack>
                          {triggerProductIds.map((productId, index) => (
                            <InlineStack key={index} gap="200" blockAlign="end">
                              <div style={{ flex: 1 }}>
                                <PolarisProductAutocomplete
                                  products={products}
                                  value={productId}
                                  onChange={(value) => updateTriggerProduct(index, value)}
                                  label={`Qualifying product ${index + 1}`}
                                  placeholder="Search qualifying product"
                                />
                              </div>
                              {triggerProductIds.length > 1 && (
                                <Button tone="critical" variant="secondary" onClick={() => removeTriggerProduct(index)}>
                                  Remove
                                </Button>
                              )}
                            </InlineStack>
                          ))}
                        </BlockStack>
                      )}
                    </BlockStack>
                  </Card>
                </BlockStack>
              </InlineGrid>

              <InlineStack align="end" gap="300">
                {editingOfferId && <Button onClick={resetForm}>Cancel</Button>}
                <Button variant="primary" onClick={handleSave} loading={saving}>
                  {editingOfferId ? "Update post-purchase offer" : "Save post-purchase offer"}
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </div>

        {summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            {[
              { label: "Active offers", value: summary.activeOffers, sub: "Available in the current setup" },
              { label: "Offer views", value: summary.totalViews, sub: "Rendered after checkout" },
              { label: "Accepted", value: summary.totalAccepted, sub: "Customers who took the offer" },
              { label: "Conversion", value: summary.conversionRate, sub: "Views to accepted" },
              { label: "Revenue", value: fmt(summary.totalRevenue, "USD"), sub: "Tracked post-purchase sales" },
            ].map((card) => (
              <div key={card.label} style={{ background: "#fff", borderRadius: "12px", padding: "1rem 1.15rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <p style={{ margin: 0, fontSize: "0.74rem", color: "#6d7175", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{card.label}</p>
                <p style={{ margin: "0.35rem 0 0.15rem", fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>{card.value}</p>
                <p style={{ margin: 0, fontSize: "0.76rem", color: "#6d7175" }}>{card.sub}</p>
              </div>
            ))}
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: "1.5rem" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e5e7eb" }}>
            <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Configured offers</p>
          </div>
          {offers.length === 0 ? (
            <p style={{ margin: 0, padding: "2rem", textAlign: "center", color: "#6b7280" }}>
              No post-purchase offers yet. Create your first offer above.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  {["Offer", "Product", "Trigger", "Discount", "Priority", "", ""].map((heading) => (
                    <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.78rem", fontWeight: 700, color: "#6d7175", textTransform: "uppercase" }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {offers.map((offer, index) => (
                  <tr key={offer.id} style={{ borderBottom: index < offers.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <td style={{ padding: "0.95rem 1rem", verticalAlign: "top" }}>
                      <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>{offer.name}</p>
                      <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "#6b7280", maxWidth: 280 }}>{offer.headline || offer.body}</p>
                    </td>
                    <td style={{ padding: "0.95rem 1rem", fontSize: "0.86rem", color: "#111827" }}>{offer.offerProduct?.title ?? "-"}</td>
                    <td style={{ padding: "0.95rem 1rem", fontSize: "0.84rem", color: "#111827" }}>
                      {offer.triggerType === "all_orders" && "All eligible orders"}
                      {offer.triggerType === "minimum_subtotal" && `Subtotal at least ${fmt(offer.minimumSubtotal, "USD")}`}
                      {offer.triggerType === "contains_product" && `${offer.triggerProductIds.length} qualifying product${offer.triggerProductIds.length !== 1 ? "s" : ""}`}
                    </td>
                    <td style={{ padding: "0.95rem 1rem", fontSize: "0.84rem", color: "#111827" }}>{offer.discountPercent}% off</td>
                    <td style={{ padding: "0.95rem 1rem" }}>
                      <span style={{ display: "inline-flex", padding: "0.25rem 0.55rem", borderRadius: "999px", background: "#eff6ff", color: "#1d4ed8", fontSize: "0.78rem", fontWeight: 700 }}>
                        {offer.priority}
                      </span>
                    </td>
                    <td style={{ padding: "0.95rem 1rem", textAlign: "right" }}>
                      <button onClick={() => startEditing(offer)} style={{ padding: "0.45rem 0.8rem", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: "8px", fontSize: "0.8rem", cursor: "pointer" }}>
                        Edit
                      </button>
                    </td>
                    <td style={{ padding: "0.95rem 1rem", textAlign: "right" }}>
                      <button onClick={() => handleDelete(offer.id)} style={{ padding: "0.45rem 0.8rem", background: "#fff", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "0.8rem", cursor: "pointer" }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e5e7eb" }}>
            <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Post-purchase performance</p>
          </div>
          {offerStats.length === 0 ? (
            <p style={{ margin: 0, padding: "2rem", textAlign: "center", color: "#6b7280" }}>
              Stats will appear once the checkout extension starts rendering offers and customers accept them.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  {["Offer", "Product", "Views", "Accepted", "Conversion", "Revenue"].map((heading) => (
                    <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.78rem", fontWeight: 700, color: "#6d7175", textTransform: "uppercase" }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {offerStats.map((stat, index) => (
                  <tr key={stat.offerId} style={{ borderBottom: index < offerStats.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: "#111827" }}>{stat.name}</td>
                    <td style={{ padding: "0.85rem 1rem", color: "#374151", fontSize: "0.85rem" }}>{stat.productLabel}</td>
                    <td style={{ padding: "0.85rem 1rem", color: "#111827" }}>{stat.viewed}</td>
                    <td style={{ padding: "0.85rem 1rem", color: "#111827" }}>{stat.accepted}</td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <span style={{ display: "inline-flex", padding: "0.25rem 0.55rem", borderRadius: "999px", background: "#ecfdf5", color: "#166534", fontSize: "0.78rem", fontWeight: 700 }}>
                        {stat.conversionRate}
                      </span>
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: "#111827" }}>{fmt(stat.revenue, "USD")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </>
    </PolarisProvider>
  );
}

interface RuleStat {
  ruleId: string;
  triggerProductTitle: string;
  upsellProductTitle: string;
  views: number;
  clicks: number;
  added: number;
  ctr: string;
  convRate: string;
}

function GeoCountdownTab() {
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

function BundleOffersTab() {
  const [offers, setOffers] = useState<BundleOffer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("Ultimate Bundle");
  const [productId, setProductId] = useState("");
  const [code, setCode] = useState("ULTIMATE");
  const [compareAtPrice, setCompareAtPrice] = useState("95.00");
  const [discountedPrice, setDiscountedPrice] = useState("59.99");
  const [enabled, setEnabled] = useState(true);

  const loadData = useCallback(async () => {
    const [bundleData, productData] = await Promise.all([
      fetch("/api/standalone/bundles").then((r) => safeJson<{ offers?: BundleOffer[]; error?: string }>(r)),
      fetch("/api/standalone/products").then((r) => safeJson<{ products?: Product[]; error?: string }>(r)),
    ]);

    setOffers(bundleData?.offers ?? []);
    setProducts(productData?.products ?? []);
  }, []);

  useEffect(() => {
    loadData()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load bundle offers."))
      .finally(() => setLoading(false));
  }, [loadData]);

  const resetForm = () => {
    setEditingId(null);
    setName("Ultimate Bundle");
    setProductId("");
    setCode("ULTIMATE");
    setCompareAtPrice("95.00");
    setDiscountedPrice("59.99");
    setEnabled(true);
  };

  const selectedProduct = products.find((product) => String(product.id) === productId) ?? null;
  const usedProductIds = new Set(offers.filter((offer) => offer.id !== editingId).map((offer) => String(offer.productId)));
  const selectableProducts = products.filter((product) => !usedProductIds.has(String(product.id)));
  const totalSavings = offers.reduce((sum, offer) => {
    const comparePrice = Number(offer.compareAtPrice);
    const salePrice = Number(offer.discountedPrice);
    return sum + Math.max(comparePrice - salePrice, 0);
  }, 0);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Enter an internal offer name.");
      return;
    }
    if (!productId) {
      setError("Choose the bundle product to control.");
      return;
    }
    if (!code.trim()) {
      setError("Enter the public discount code name.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/standalone/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          name,
          productId,
          productTitle: selectedProduct?.title ?? "",
          code,
          compareAtPrice,
          discountedPrice,
          enabled,
        }),
      });
      const data = await safeJson<{ offers?: BundleOffer[]; warning?: string; error?: string }>(response);
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      setOffers(data?.offers ?? []);
      if (data?.warning) {
        setError(data.warning);
      } else {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save bundle offer.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (offerId: string) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/standalone/bundles/${offerId}`, { method: "DELETE" });
      const data = await safeJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      setOffers((current) => current.filter((offer) => offer.id !== offerId));
      if (editingId === offerId) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete bundle offer.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (offer: BundleOffer) => {
    setEditingId(offer.id);
    setName(offer.name);
    setProductId(offer.productId);
    setCode(offer.code);
    setCompareAtPrice(offer.compareAtPrice);
    setDiscountedPrice(offer.discountedPrice);
    setEnabled(offer.enabled);
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading bundle offers...</div>;
  }

  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Bundle Offers</h1>
        <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.84rem", maxWidth: 820 }}>
          Pick specific bundle products, give each one a named native Shopify discount code, and let the storefront app embed show the sale price preview while cart and checkout use a real discount code instead of a manually lowered product price.
        </p>
      </div>

      {error && (
        <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", color: "#c0392b", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        {[
          { label: "Bundle offers", value: offers.length, sub: "Products with managed bundle pricing" },
          { label: "Active now", value: offers.filter((offer) => offer.enabled).length, sub: `${offers.filter((offer) => !offer.enabled).length} paused` },
          { label: "Tracked savings", value: fmt(totalSavings, "USD"), sub: "Difference between compare-at and sale price" },
        ].map((card) => (
          <div key={card.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.85rem 0.95rem" }}>
            <p style={{ margin: 0, fontSize: "0.73rem", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{card.label}</p>
            <p style={{ margin: "0.24rem 0 0.12rem", fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>{card.value}</p>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "#6b7280" }}>{card.sub}</p>
          </div>
        ))}
      </div>

      <Card>
        <BlockStack gap="400">
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <TextField label="Offer name" value={name} onChange={setName} autoComplete="off" helpText="Internal admin label for your team." />
            <TextField label="Public discount code" value={code} onChange={(value) => setCode(value.toUpperCase())} autoComplete="off" helpText="Shown in cart and checkout, for example ULTIMATE." />
            <PolarisProductAutocomplete
              products={editingId ? products : selectableProducts}
              value={productId}
              onChange={setProductId}
              label="Bundle product"
              placeholder="Search bundle product"
              helpText="Choose the storefront bundle product that should receive this managed discount."
            />
            <div style={{ display: "flex", alignItems: "end" }}>
              <Checkbox label="Offer is active" checked={enabled} onChange={setEnabled} />
            </div>
            <TextField label="Compare-at / value price" type="number" min={0} step={0.01} value={compareAtPrice} onChange={setCompareAtPrice} autoComplete="off" />
            <TextField label="Discounted storefront price" type="number" min={0} step={0.01} value={discountedPrice} onChange={setDiscountedPrice} autoComplete="off" />
          </InlineGrid>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" tone="subdued">
              Enable the `Bundle offers` app embed in your theme so homepage, collection, and product pages show the sale preview and the matching code is applied automatically in cart.
            </Text>
            <InlineStack gap="300">
              {editingId && (
                <Button onClick={resetForm} disabled={saving}>
                  Cancel
                </Button>
              )}
              <Button variant="primary" onClick={handleSave} loading={saving}>
                {editingId ? "Update offer" : "Create offer"}
              </Button>
            </InlineStack>
          </InlineStack>
        </BlockStack>
      </Card>

      <div style={{ marginTop: "1rem", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.1rem", borderBottom: "1px solid #e5e7eb" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Configured bundle offers</p>
        </div>
        {offers.length === 0 ? (
          <p style={{ margin: 0, padding: "1.5rem", color: "#6b7280" }}>
            No bundle offers yet. Create the first one above, then enable the Bundle Offers app embed in the theme customizer.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Offer</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Product</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Code</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Storefront price</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Status</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "right", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer, index) => (
                <tr key={offer.id} style={{ borderBottom: index < offers.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "0.85rem 0.9rem" }}>
                    <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#111827" }}>{offer.name}</div>
                    <div style={{ fontSize: "0.76rem", color: "#6b7280", marginTop: "0.15rem" }}>Discount ID: {offer.discountId ?? "Pending sync"}</div>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.82rem", color: "#374151" }}>{offer.productTitle}</td>
                  <td style={{ padding: "0.85rem 0.9rem" }}>
                    <span style={{ display: "inline-flex", padding: "0.22rem 0.55rem", borderRadius: "999px", background: "#eef2ff", color: "#4338ca", fontSize: "0.76rem", fontWeight: 700 }}>
                      {offer.code}
                    </span>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.82rem", color: "#374151" }}>
                    <span style={{ fontWeight: 700, color: "#111827" }}>{fmt(Number(offer.discountedPrice), "USD")}</span>
                    <span style={{ marginLeft: "0.45rem", textDecoration: "line-through", color: "#6b7280" }}>{fmt(Number(offer.compareAtPrice), "USD")}</span>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem" }}>
                    <span style={{ display: "inline-flex", padding: "0.25rem 0.55rem", borderRadius: "999px", background: offer.enabled ? "#ecfdf5" : "#f3f4f6", color: offer.enabled ? "#166534" : "#6b7280", fontSize: "0.76rem", fontWeight: 700 }}>
                      {offer.enabled ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", textAlign: "right" }}>
                    <InlineStack gap="200" align="end">
                      <Button size="micro" onClick={() => startEdit(offer)}>Edit</Button>
                      <Button size="micro" tone="critical" variant="tertiary" onClick={() => void handleDelete(offer.id)} loading={saving}>
                        Delete
                      </Button>
                    </InlineStack>
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

function ThemeSwitcherTab() {
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadThemes = useCallback(async () => {
    const response = await fetch("/api/standalone/themes");
    const data = await safeJson<{ themes?: ThemeSummary[]; error?: string }>(response);
    if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
    setThemes(data?.themes ?? []);
  }, []);

  useEffect(() => {
    loadThemes()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load themes."))
      .finally(() => setLoading(false));
  }, [loadThemes]);

  const handlePublish = async (themeId: string) => {
    setPublishingId(themeId);
    setError(null);

    try {
      const response = await fetch("/api/standalone/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: themeId }),
      });
      const data = await safeJson<{ themes?: ThemeSummary[]; error?: string }>(response);
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      setThemes(data?.themes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish theme.");
    } finally {
      setPublishingId(null);
    }
  };

  const mainTheme = themes.find((theme) => theme.role === "MAIN") ?? null;
  const publishableThemes = themes.filter((theme) => theme.role !== "MAIN");

  if (loading) {
    return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading themes...</div>;
  }

  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Theme Switcher</h1>
        <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.84rem", maxWidth: 780 }}>
          View the current live theme and publish another theme from your dashboard. This changes the storefront immediately.
        </p>
      </div>

      {error && (
        <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", color: "#c0392b", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        {[
          { label: "Live theme", value: mainTheme?.name ?? "None", sub: mainTheme?.role ?? "No main theme found" },
          { label: "Drafts ready", value: publishableThemes.length, sub: "Themes available to switch" },
          { label: "Publishing", value: publishingId ? "Yes" : "No", sub: publishingId ? "Theme update in progress" : "No active publish" },
        ].map((card) => (
          <div key={card.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.85rem 0.95rem" }}>
            <p style={{ margin: 0, fontSize: "0.73rem", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{card.label}</p>
            <p style={{ margin: "0.24rem 0 0.12rem", fontSize: "1.15rem", fontWeight: 700, color: "#111827" }}>{card.value}</p>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "#6b7280" }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {mainTheme && (
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">Current live theme</Text>
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="p" variant="bodyMd" fontWeight="semibold">{mainTheme.name}</Text>
                <Text as="p" tone="subdued">Role: {mainTheme.role}</Text>
              </BlockStack>
              <Badge tone="success">Live</Badge>
            </InlineStack>
          </BlockStack>
        </Card>
      )}

      <div style={{ marginTop: "1rem", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.1rem", borderBottom: "1px solid #e5e7eb" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Available themes</p>
        </div>
        {publishableThemes.length === 0 ? (
          <p style={{ margin: 0, padding: "1.5rem", color: "#6b7280" }}>
            No additional themes are available to publish right now.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Theme</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Role</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Updated</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "right", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {publishableThemes.map((theme, index) => (
                <tr key={theme.id} style={{ borderBottom: index < publishableThemes.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "0.85rem 0.9rem" }}>
                    <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#111827" }}>{theme.name}</div>
                    {(theme.processing || theme.processingFailed) && (
                      <div style={{ fontSize: "0.76rem", color: theme.processingFailed ? "#b91c1c" : "#6b7280", marginTop: "0.18rem" }}>
                        {theme.processingFailed ? "Theme processing failed" : "Theme processing"}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.82rem", color: "#374151" }}>{theme.role}</td>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.82rem", color: "#374151" }}>
                    {theme.updatedAt ? new Date(theme.updatedAt).toLocaleString() : "—"}
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => void handlePublish(theme.id)}
                      disabled={Boolean(publishingId) || theme.processing}
                      style={{
                        padding: "0.45rem 0.85rem",
                        background: "#111827",
                        color: "#fff",
                        border: "1px solid #111827",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: publishingId || theme.processing ? "not-allowed" : "pointer",
                        opacity: publishingId === theme.id ? 0.7 : 1,
                      }}
                    >
                      {publishingId === theme.id ? "Publishing..." : "Publish"}
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

function LaunchpadTab() {
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

function StatsTab() {
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

interface ShopInfo {
  shop: string;
  storeName: string;
  storeUrl: string;
  adminUrl: string;
}

const VALID_TABS = ["overview", "products", "cartlimits", "upsells", "buyxgety", "bundles", "geocountdown", "themeswitcher", "postpurchase", "stats"] as const;
type Tab = typeof VALID_TABS[number];

export default function DashboardPage() {
  const pathname = usePathname();

  const tabFromPath = pathname.split("/")[2] ?? "overview";
  const tab = VALID_TABS.includes(tabFromPath as Tab) ? (tabFromPath as Tab) : "overview";

  const [days, setDays] = useState("30");
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);

  useEffect(() => {
    fetch("/api/standalone/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.shop) setShopInfo(d); })
      .catch(() => {});
  }, []);

  return (
    <DashboardShell shopDomain={shopInfo?.shop} storeUrl={shopInfo?.storeUrl} adminUrl={shopInfo?.adminUrl}>
      {tab === "overview" && <OverviewTab days={days} setDays={setDays} storeName={shopInfo?.storeName} />}
      {tab === "products" && <ProductsTab storeUrl={shopInfo?.storeUrl} adminUrl={shopInfo?.adminUrl} />}
      {tab === "cartlimits" && <CartLimitsTab />}
      {tab === "upsells" && <UpsellsTab storeUrl={shopInfo?.storeUrl} />}
      {tab === "buyxgety" && <BuyXGetYTabPolaris />}
      {tab === "bundles" && <BundleOffersTab />}
      {tab === "geocountdown" && <GeoCountdownTab />}
      {tab === "themeswitcher" && <LaunchpadTab />}
      {tab === "postpurchase" && <PostPurchaseTab />}
      {tab === "stats" && <StatsTab />}
    </DashboardShell>
  );
}




