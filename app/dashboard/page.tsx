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
  variants: { id: number; price: string }[];
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

  useEffect(() => {
    fetch("/api/standalone/upsells").then(r => r.ok ? r.json() : null).catch(() => null)
      .then(d => setRules(d?.rules?.length ?? 0));
  }, [storeName]);

  return (
    <div style={{ background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: "1.75rem", padding: "1rem 1.5rem" }}>
      <p style={{ margin: "0 0 0.5rem", fontWeight: 700, fontSize: "0.9rem", color: "#1a1a1a" }}>App Health</p>
      <p style={{ margin: 0, fontSize: "0.82rem", color: "#6d7175" }}>
        {storeName ? `✓ ${storeName}.myshopify.com connected` : "⚠ No store session"}{" · "}
        {rules === null ? "Loading…" : rules > 0 ? `✓ ${rules} upsell rule${rules !== 1 ? "s" : ""} active` : "⚠ No upsell rules configured"}
      </p>
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading…</div>;
  if (error) return <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", color: "#c0392b", fontSize: "0.875rem" }}>{error}</div>;

  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Products</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem" }}>{products.length} products</p>
      </div>
      <div style={{ background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e4e5e7" }}>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 600, color: "#6d7175", textTransform: "uppercase" }}>Product</th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 600, color: "#6d7175", textTransform: "uppercase" }}>Status</th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "0.8rem", fontWeight: 600, color: "#6d7175", textTransform: "uppercase" }}>Price</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: i < products.length - 1 ? "1px solid #f1f1f1" : "none" }}>
                <td style={{ padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {p.image?.src ? (
                    <img src={p.image.src} alt={p.title} style={{ width: 40, height: 40, borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: "6px", background: "#f1f1f1", flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#1a1a1a" }}>{p.title}</span>
                </td>
                <td style={{ padding: "0.85rem 1rem" }}>
                  <span style={{
                    display: "inline-block",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "20px",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    background: p.status === "active" ? "#e3f1df" : "#f1f1f1",
                    color: p.status === "active" ? "#1a6b3c" : "#6d7175",
                  }}>{p.status}</span>
                </td>
                <td style={{ padding: "0.85rem 1rem", textAlign: "right", fontSize: "0.875rem", color: "#1a1a1a" }}>
                  {p.variants?.[0]?.price ? `$${p.variants[0].price}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
            <input type="text" style={sel} value={message} onChange={e => setMessage(e.target.value)} />
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
                  <input type="number" min="0" max="100" style={sel} value={s.discountPercent}
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


interface ShopInfo {
  shop: string;
  storeName: string;
  storeUrl: string;
  adminUrl: string;
}

const VALID_TABS = ["overview", "products", "upsells", "stats"] as const;
type Tab = typeof VALID_TABS[number];

export default function DashboardPage() {
  const pathname = usePathname();

  const tabFromPath = (pathname.split("/")[2] ?? "overview") as Tab;
  const tab = VALID_TABS.includes(tabFromPath) ? tabFromPath : "overview";

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
{tab === "stats" && <StatsTab />}
    </DashboardShell>
  );
}
