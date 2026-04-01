"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import OrdersChart from "@/components/charts/OrdersChart";
import RevenueChart from "@/components/charts/RevenueChart";
import DashboardShell from "@/components/DashboardShell";

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
        background: "linear-gradient(135deg, #fef9ef 0%, #fff8e6 100%)",
        border: "1px solid #fde68a",
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

function ProductsTab() {
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
              <th style={{ padding: "0.75rem 0.9rem", textAlign: "right", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Base price</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map((p, i) => (
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
                <td style={{ padding: "0.78rem 0.9rem", textAlign: "right", fontSize: "0.82rem", color: "#111827", fontWeight: 600 }}>
                  {formatProductPrice(p.variants?.[0]?.price)}
                </td>
              </tr>
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

interface SuggestionDraft { productId: string; discountPercent: string; }

function UpsellsTab() {
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
            <select style={sel} value={triggerProductId} onChange={e => setTriggerProductId(e.target.value)}>
              <option value="">Select trigger product</option>
              {products.map(p => <option key={p.id} value={String(p.id)}>{p.title}</option>)}
            </select>
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
                <select style={{ ...sel, flex: 2 }} value={s.productId} onChange={e => updateSuggestion(i, "productId", e.target.value)}>
                  <option value="">Select product</option>
                  {products.filter(p => String(p.id) !== triggerProductId).map(p => (
                    <option key={p.id} value={String(p.id)}>{p.title}</option>
                  ))}
                </select>
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
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", fontWeight: 500, color: "#1a1a1a" }}>{r.triggerProductTitle}</td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                      {r.upsellProducts.slice(0, 4).map((p, pi) => (
                        p.image
                          ? <img key={pi} src={p.image} alt={p.title} title={p.title} style={{ width: 32, height: 32, borderRadius: "6px", objectFit: "cover", border: "1px solid #e4e5e7" }} />
                          : <div key={pi} title={p.title} style={{ width: 32, height: 32, borderRadius: "6px", background: "#f1f1f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", color: "#6d7175" }}>{p.title.slice(0, 2)}</div>
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

  const sel: React.CSSProperties = { width: "100%", padding: "0.7rem 0.8rem", border: "1px solid #d1d5db", borderRadius: "10px", fontSize: "0.875rem", background: "#fff", color: "#1a1a1a" };
  const inp: React.CSSProperties = { padding: "0.7rem 0.8rem", border: "1px solid #d1d5db", borderRadius: "10px", fontSize: "0.875rem", background: "#fff", color: "#1a1a1a" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" };
  const bxgySelect: React.CSSProperties = { ...sel, minWidth: 0, flex: 1 };
  const bxgyVariantSelect: React.CSSProperties = { ...sel, minWidth: "190px", flex: "0 0 220px" };
  const bxgyGiftSelect: React.CSSProperties = { ...sel, maxWidth: "560px" };

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loadingâ€¦</div>;

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
                <select style={showVariantSelect ? bxgySelect : bxgyGiftSelect} value={productId} onChange={(e) => updateBuyProduct(index, e.target.value)}>
                  <option value="">Select trigger product</option>
                  {products.map((product) => (
                    <option key={product.id} value={String(product.id)}>{product.title}</option>
                  ))}
                </select>
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
            <select style={bxgyGiftSelect} value={giftProductId} onChange={(e) => updateGiftProduct(e.target.value)}>
              <option value="">Select free gift product</option>
              {products.map((product) => (
                <option key={product.id} value={String(product.id)}>{product.title}</option>
              ))}
            </select>
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

  const sel: React.CSSProperties = { width: "100%", padding: "0.7rem 0.8rem", border: "1px solid #d1d5db", borderRadius: "10px", fontSize: "0.875rem", background: "#fff", color: "#1a1a1a" };
  const inp: React.CSSProperties = { padding: "0.7rem 0.8rem", border: "1px solid #d1d5db", borderRadius: "10px", fontSize: "0.875rem", background: "#fff", color: "#1a1a1a" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" };

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
    setTriggerProductIds((current) => current.map((entry, idx) => idx === index ? productId : entry));
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

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading…</div>;

  const selectedOfferProduct = products.find((product) => String(product.id) === offerProductId);

  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Post-Purchase</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem" }}>
          Build one-click offers for the moment right after checkout, with targeting, discounting, and offer stats in one place.
        </p>
      </div>

      {error && <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem", color: "#c0392b", fontSize: "0.875rem" }}>{error}</div>}

      <div style={{
        background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 55%, #ffffff 100%)",
        border: "1px solid #dbeafe",
        borderRadius: "16px",
        padding: "1.5rem",
        marginBottom: "1.5rem",
        boxShadow: "0 6px 24px rgba(37, 99, 235, 0.06)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.05em" }}>New post-purchase offer</p>
            <h2 style={{ margin: "0.35rem 0 0.2rem", fontSize: "1.25rem", color: "#0f172a" }}>Launch a one-click offer after checkout</h2>
            <p style={{ margin: 0, color: "#4b5563", fontSize: "0.86rem", maxWidth: 720 }}>
              Rebuy-style flow for the order-complete moment: choose the product, set the offer copy, and decide whether it appears for all orders, qualifying carts, or orders above a threshold.
            </p>
          </div>
          <div style={{ padding: "0.5rem 0.75rem", borderRadius: "999px", background: "#dbeafe", color: "#1d4ed8", fontSize: "0.78rem", fontWeight: 700 }}>
            Checkout upsell layer
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.7fr 0.7fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label style={lbl}>Offer name</label>
            <input type="text" style={inp} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Discount percent</label>
            <input type="number" min="1" max="100" style={inp} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Priority</label>
            <input type="number" min="1" style={inp} value={priority} onChange={(e) => setPriority(e.target.value)} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label style={lbl}>Headline</label>
            <input type="text" style={inp} value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>CTA label</label>
            <input type="text" style={inp} value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={lbl}>Offer body</label>
          <textarea
            rows={3}
            style={{ ...inp, width: "100%", resize: "vertical" }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "14px", padding: "1rem" }}>
            <p style={{ margin: "0 0 0.8rem", fontWeight: 700, color: "#0f172a" }}>Offer product</p>
            <select style={sel} value={offerProductId} onChange={(e) => updateOfferProduct(e.target.value)}>
              <option value="">Select product to offer</option>
              {products.map((product) => (
                <option key={product.id} value={String(product.id)}>{product.title}</option>
              ))}
            </select>
            {hasMeaningfulVariants(selectedOfferProduct) && (
              <select style={{ ...sel, marginTop: "0.65rem" }} value={offerVariantId} onChange={(e) => setOfferVariantId(e.target.value)}>
                <option value="">Select variant</option>
                {selectedOfferProduct?.variants?.map((variant) => (
                  <option key={variant.id} value={String(variant.id)}>
                    {variant.title}
                  </option>
                ))}
              </select>
            )}
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.78rem", color: "#6d7175" }}>
              This is the item the customer can add after completing checkout.
            </p>
          </div>

          <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "14px", padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", marginBottom: "0.8rem" }}>
              <p style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>Targeting</p>
              {triggerType === "contains_product" && (
                <button type="button" onClick={addTriggerProduct} style={{ padding: "0.35rem 0.8rem", borderRadius: "8px", border: "1px solid #3b82f6", background: "#fff", color: "#1d4ed8", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
                  + Add product
                </button>
              )}
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={lbl}>Show offer when</label>
              <select style={sel} value={triggerType} onChange={(e) => setTriggerType(e.target.value as PostPurchaseOffer["triggerType"])}>
                <option value="all_orders">Every eligible order can see it</option>
                <option value="minimum_subtotal">Order subtotal reaches a threshold</option>
                <option value="contains_product">The order contains selected products</option>
              </select>
            </div>
            {triggerType === "minimum_subtotal" && (
              <div>
                <label style={lbl}>Minimum subtotal</label>
                <input type="number" min="0" step="0.01" style={inp} value={minimumSubtotal} onChange={(e) => setMinimumSubtotal(e.target.value)} />
              </div>
            )}
            {triggerType === "contains_product" && (
              <div style={{ display: "grid", gap: "0.55rem" }}>
                {triggerProductIds.map((productId, index) => (
                  <div key={index} style={{ display: "flex", gap: "0.55rem", alignItems: "stretch" }}>
                    <select style={sel} value={productId} onChange={(e) => updateTriggerProduct(index, e.target.value)}>
                      <option value="">Select qualifying product</option>
                      {products.map((product) => (
                        <option key={product.id} value={String(product.id)}>{product.title}</option>
                      ))}
                    </select>
                    {triggerProductIds.length > 1 && (
                      <button type="button" onClick={() => removeTriggerProduct(index)} style={{ border: "1px solid #fecaca", background: "#fff", color: "#b91c1c", borderRadius: "10px", padding: "0 0.8rem", cursor: "pointer" }}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "0.75rem 1.5rem",
            background: "#1d4ed8",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "0.9rem",
            fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? "Saving…" : "Save post-purchase offer"}
          </button>
        </div>
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
                {["Offer", "Product", "Trigger", "Discount", "Priority", ""].map((heading) => (
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
                  <td style={{ padding: "0.95rem 1rem", fontSize: "0.86rem", color: "#111827" }}>{offer.offerProduct?.title ?? "—"}</td>
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
                    <span style={{ display: "inline-flex", padding: "0.25rem 0.55rem", borderRadius: "999px", background: "#eff6ff", color: "#1d4ed8", fontSize: "0.78rem", fontWeight: 700 }}>
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
  );
}

interface RuleStat {
  ruleId: string;
  triggerProductTitle: string;
  upsellProductTitle: string; // comma-joined suggestion titles
  views: number;
  clicks: number;
  added: number;
  ctr: string;
  convRate: string;
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

const VALID_TABS = ["overview", "products", "upsells", "buyxgety", "postpurchase", "stats"] as const;
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
      {tab === "products" && <ProductsTab />}
      {tab === "upsells" && <UpsellsTab />}
      {tab === "buyxgety" && <BuyXGetYTab />}
      {tab === "postpurchase" && <PostPurchaseTab />}
      {tab === "stats" && <StatsTab />}
    </DashboardShell>
  );
}
