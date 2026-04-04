"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Autocomplete, BlockStack, Text, Thumbnail } from "@shopify/polaris";


export interface DailyStat {
  date: string;
  count: number;
  revenue: number;
  currency: string;
}

export interface Stats {
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

export interface Product {
  id: number;
  title: string;
  handle: string;
  status: string;
  image: { src: string } | null;
  variants: { id: number; title: string; price: string }[];
}

export interface CartQuantityRule {
  id: string;
  productId: string;
  productTitle: string;
  quantity: number;
  enabled: boolean;
}

export interface UpsellProduct {
  productId: string;
  title: string;
  image: string;
  price: string;
  handle: string;
  discountPercent: number;
  badgeText?: string;
}

export interface UpsellRule {
  id: string;
  triggerProductId: string;
  triggerProductTitle: string;
  upsellProducts: UpsellProduct[];
  message: string;
  enabled?: boolean;
}

export interface BxgyProduct {
  productId: string;
  variantId: string;
  title: string;
  image: string;
  price: string;
  handle: string;
}

export interface ThemeSummary {
  id: string;
  name: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
  processing?: boolean;
  processingFailed?: boolean;
}

export type LaunchpadScheduleStatus = "pending" | "published" | "failed" | "cancelled";

export interface LaunchpadSchedule {
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

export interface BundleOffer {
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

export function isDefaultVariantTitle(title: string) {
  const value = String(title || "").trim().toLowerCase();
  return !value || value === "default title" || value === "default" || value === "main";
}

export function hasMeaningfulVariants(product: Product | undefined | null) {
  if (!product?.variants?.length) return false;
  if (product.variants.length > 1) return true;
  return !isDefaultVariantTitle(product.variants[0]?.title ?? "");
}

export function bxgyOptionLabel(product: Product, variant: Product["variants"][number]) {
  if (!hasMeaningfulVariants(product)) return product.title;
  return `${product.title} - ${variant.title}`;
}

export function SearchableProductSelect({
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

export function PolarisProductAutocomplete({
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

export interface BxgyRule {
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

export interface BxgySummary {
  activeRules: number;
  totalQualified: number;
  totalAutoAdded: number;
  conversionRate: string;
}

export interface BxgyRuleStat {
  ruleId: string;
  name: string;
  buyLabel: string;
  giftLabel: string;
  message: string;
  qualified: number;
  autoAdded: number;
  conversionRate: string;
}

export interface PostPurchaseProduct {
  productId: string;
  variantId: string;
  title: string;
  image: string;
  price: string;
  handle: string;
}

export interface PostPurchaseOffer {
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

export interface PostPurchaseSummary {
  activeOffers: number;
  totalViews: number;
  totalAccepted: number;
  totalRevenue: number;
  conversionRate: string;
}

export interface PostPurchaseOfferStat {
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

export interface RuleStat {
  ruleId: string;
  triggerProductTitle: string;
  upsellProductTitle: string;
  views: number;
  clicks: number;
  added: number;
  ctr: string;
  convRate: string;
}

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
