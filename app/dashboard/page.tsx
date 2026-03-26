"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import OrdersChart from "@/components/charts/OrdersChart";
import RevenueChart from "@/components/charts/RevenueChart";

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
}

interface Product {
  id: number;
  title: string;
  handle: string;
  status: string;
  image: { src: string } | null;
  variants: { id: number; price: string }[];
}

interface UpsellRule {
  id: string;
  triggerProductId: string;
  triggerProductTitle: string;
  upsellProductId: string;
  upsellProductTitle: string;
  discountPercent: number;
  message: string;
}

const RANGES = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
];

const fmt = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

function StatCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: "10px",
      padding: "1.25rem 1.5rem",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#6d7175", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</p>
      <p style={{ margin: "0.4rem 0 0.25rem", fontSize: "1.75rem", fontWeight: 700, color: "#1a1a1a" }}>{value}</p>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#6d7175" }}>{sub}</p>
    </div>
  );
}

function OverviewTab({ days, setDays }: { days: string; setDays: (d: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/standalone/analytics?days=${days}`);
      if (res.status === 401) { window.location.href = "/"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data.stats);
    } catch {
      setError("Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Overview</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem" }}>Store performance</p>
        </div>
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

      {error && (
        <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1.25rem", color: "#c0392b", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading…</div>
      ) : stats ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            <StatCard title="Total Orders" value={stats.totalOrders.toString()} sub={`Last ${days} days`} />
            <StatCard title="Total Revenue" value={fmt(stats.totalRevenue, stats.currency)} sub={`Last ${days} days`} />
            <StatCard title="Upsale Revenue" value={fmt(stats.totalUpsaleRevenue ?? 0, stats.currency)} sub="Attributed to Upsale" />
            <StatCard title="Avg Order Value" value={fmt(stats.avgOrderValue, stats.currency)} sub={`Last ${days} days`} />
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

function UpsellsTab() {
  const [rules, setRules] = useState<UpsellRule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    triggerProductId: "",
    upsellProductId: "",
    discountPercent: "0",
    message: "You might also like this!",
  });

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

  const handleAdd = async () => {
    if (!form.triggerProductId || !form.upsellProductId) {
      setError("Select both products."); return;
    }
    if (form.triggerProductId === form.upsellProductId) {
      setError("Trigger and upsell must be different products."); return;
    }
    setSaving(true); setError(null);
    const trigger = products.find(p => String(p.id) === form.triggerProductId);
    const upsell = products.find(p => String(p.id) === form.upsellProductId);
    const res = await fetch("/api/standalone/upsells", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        triggerProductId: form.triggerProductId,
        triggerProductTitle: trigger?.title ?? "",
        upsellProductId: form.upsellProductId,
        upsellProductTitle: upsell?.title ?? "",
        upsellProductImage: upsell?.image?.src ?? "",
        upsellProductPrice: upsell?.variants?.[0]?.price ?? "",
        upsellProductHandle: upsell?.handle ?? "",
        discountPercent: Number(form.discountPercent),
        message: form.message,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    const updated = await fetch("/api/standalone/upsells").then(r => r.json());
    setRules(updated.rules ?? []);
    setForm({ triggerProductId: "", upsellProductId: "", discountPercent: "0", message: "You might also like this!" });
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/standalone/upsells/${id}`, { method: "DELETE" });
    setRules(r => r.filter(x => x.id !== id));
  };

  const selectStyle = {
    width: "100%", padding: "0.6rem 0.75rem", border: "1px solid #d1d5db",
    borderRadius: "8px", fontSize: "0.875rem", background: "#fff", color: "#1a1a1a",
  };
  const inputStyle = { ...selectStyle };
  const labelStyle = { display: "block" as const, fontSize: "0.8rem", fontWeight: 600 as const, color: "#374151", marginBottom: "0.35rem" };

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading…</div>;

  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Upsells</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem" }}>Show product recommendations on product pages</p>
      </div>

      {error && (
        <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem", color: "#c0392b", fontSize: "0.875rem" }}>{error}</div>
      )}

      {/* Add rule form */}
      <div style={{ background: "#fff", borderRadius: "10px", padding: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: "1.5rem" }}>
        <p style={{ margin: "0 0 1.25rem", fontWeight: 600, color: "#1a1a1a", fontSize: "0.95rem" }}>Add Upsell Rule</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label style={labelStyle}>When customer views…</label>
            <select style={selectStyle} value={form.triggerProductId} onChange={e => setForm(f => ({ ...f, triggerProductId: e.target.value }))}>
              <option value="">Select trigger product</option>
              {products.map(p => <option key={p.id} value={String(p.id)}>{p.title}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Suggest this product</label>
            <select style={selectStyle} value={form.upsellProductId} onChange={e => setForm(f => ({ ...f, upsellProductId: e.target.value }))}>
              <option value="">Select upsell product</option>
              {products.map(p => <option key={p.id} value={String(p.id)}>{p.title}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Discount %</label>
            <input type="number" min="0" max="100" style={inputStyle} value={form.discountPercent} onChange={e => setForm(f => ({ ...f, discountPercent: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Message</label>
            <input type="text" style={inputStyle} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
          </div>
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
                {["When viewing", "Suggest", "Discount", "Message", ""].map(h => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 600, color: "#6d7175", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < rules.length - 1 ? "1px solid #f1f1f1" : "none" }}>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", fontWeight: 500, color: "#1a1a1a" }}>{r.triggerProductTitle}</td>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#1a1a1a" }}>{r.upsellProductTitle}</td>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#1a1a1a" }}>{r.discountPercent > 0 ? `${r.discountPercent}%` : "—"}</td>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#6d7175" }}>{r.message}</td>
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
  upsellProductTitle: string;
  views: number;
  clicks: number;
  added: number;
  ctr: string;
  convRate: string;
}

interface GiftStat { shown: number; added: number; convRate: string; }

function StatsTab() {
  const [rules, setRules] = useState<RuleStat[]>([]);
  const [gift, setGift] = useState<GiftStat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/standalone/stats").then(r => r.json())
      .then(d => { setRules(d.rules ?? []); setGift(d.gift ?? null); })
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

      {/* Free gift stats */}
      {gift && (
        <div style={{ background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "1.25rem" }}>
          <p style={{ margin: "0 0 1rem", fontWeight: 600, color: "#1a1a1a" }}>Free Gift Promotion</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
            {[
              { label: "Times Shown", value: gift.shown },
              { label: "Gifts Added", value: gift.added },
              { label: "Conversion", value: gift.convRate },
            ].map(c => (
              <div key={c.label} style={{ textAlign: "center", padding: "1rem", background: "#f9fafb", borderRadius: "8px" }}>
                <p style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#008060" }}>{c.value}</p>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#6d7175" }}>{c.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function PromotionsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [promo, setPromo] = useState<{
    active: boolean; threshold: string; giftProductId: string;
    giftVariantId: string; message: string;
  }>({ active: false, threshold: "50", giftProductId: "", giftVariantId: "", message: "Add {amount} more to get a free gift!" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/standalone/promotion").then(r => r.json()),
      fetch("/api/standalone/products").then(r => r.json()),
    ]).then(([p, pr]) => {
      if (p.promotion) {
        setPromo({
          active: p.promotion.active,
          threshold: String(p.promotion.threshold),
          giftProductId: p.promotion.giftProductId,
          giftVariantId: p.promotion.giftVariantId,
          message: p.promotion.message,
        });
      }
      setProducts(pr.products ?? []);
    }).catch(() => setError("Failed to load."))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!promo.giftProductId) { setError("Select a gift product."); return; }
    setSaving(true); setError(null); setSaved(false);
    const gift = products.find(p => String(p.id) === promo.giftProductId);

    // Get variant ID from already-fetched product data
    const variantId = promo.giftVariantId || String(gift?.variants?.[0]?.id ?? "");

    const body = {
      active: promo.active,
      threshold: Number(promo.threshold) || 50,
      giftProductId: promo.giftProductId,
      giftProductTitle: gift?.title ?? "",
      giftProductImage: gift?.image?.src ?? "",
      giftProductHandle: gift?.handle ?? "",
      giftVariantId: variantId,
      giftProductPrice: gift?.variants?.[0]?.price ?? "0",
      message: promo.message,
    };

    const res = await fetch("/api/standalone/promotion", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else setError("Failed to save.");
    setSaving(false);
  };

  const inputStyle = { width: "100%", padding: "0.6rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", background: "#fff", color: "#1a1a1a" };
  const labelStyle = { display: "block" as const, fontSize: "0.8rem", fontWeight: 600 as const, color: "#374151", marginBottom: "0.35rem" };

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading…</div>;

  return (
    <>
      <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Free Gift Promotion</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem" }}>Automatically offer a free gift when cart reaches a spend threshold</p>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer" }}>
          <div style={{ position: "relative" as const }}>
            <input type="checkbox" checked={promo.active} onChange={e => setPromo(p => ({ ...p, active: e.target.checked }))} style={{ opacity: 0, width: 0, height: 0, position: "absolute" as const }} />
            <div style={{ width: 44, height: 24, borderRadius: 12, background: promo.active ? "#008060" : "#d1d5db", transition: "background 0.2s", cursor: "pointer" }} onClick={e => { e.preventDefault(); e.stopPropagation(); setPromo(p => ({ ...p, active: !p.active })); }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute" as const, top: 2, left: promo.active ? 22 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </div>
          </div>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: promo.active ? "#008060" : "#6d7175" }}>{promo.active ? "Active" : "Inactive"}</span>
        </label>
      </div>

      {error && <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem", color: "#c0392b", fontSize: "0.875rem" }}>{error}</div>}

      <div style={{ background: "#fff", borderRadius: "10px", padding: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label style={labelStyle}>Spend threshold ({products[0] ? "store currency" : ""})</label>
            <input type="number" min="1" style={inputStyle} value={promo.threshold} onChange={e => setPromo(p => ({ ...p, threshold: e.target.value }))} />
            <p style={{ margin: "0.3rem 0 0", fontSize: "0.75rem", color: "#6d7175" }}>Cart must reach this amount to unlock the gift</p>
          </div>
          <div>
            <label style={labelStyle}>Gift product</label>
            <select style={inputStyle} value={promo.giftProductId} onChange={e => setPromo(p => ({ ...p, giftProductId: e.target.value, giftVariantId: "" }))}>
              <option value="">Select product</option>
              {products.map(p => <option key={p.id} value={String(p.id)}>{p.title}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Progress bar message</label>
            <input type="text" style={inputStyle} value={promo.message} onChange={e => setPromo(p => ({ ...p, message: e.target.value }))} />
            <p style={{ margin: "0.3rem 0 0", fontSize: "0.75rem", color: "#6d7175" }}>Use {"{amount}"} to show remaining amount, e.g. "Add {"{amount}"} more for a free gift!"</p>
          </div>
        </div>

        {promo.giftProductId && (() => {
          const gift = products.find(p => String(p.id) === promo.giftProductId);
          return gift ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem", background: "#f9fafb", borderRadius: "8px", marginBottom: "1rem" }}>
              {gift.image?.src && <img src={gift.image.src} alt={gift.title} style={{ width: 48, height: 48, borderRadius: "6px", objectFit: "cover" }} />}
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem", color: "#1a1a1a" }}>{gift.title}</p>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#6d7175" }}>Will be added free when threshold is met</p>
              </div>
            </div>
          ) : null;
        })()}

        <button onClick={handleSave} disabled={saving} style={{
          padding: "0.6rem 1.5rem", background: saved ? "#1a6b3c" : "#008060", color: "#fff",
          border: "none", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
        }}>{saving ? "Saving…" : saved ? "✓ Saved!" : "Save Promotion"}</button>
      </div>

      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "1rem 1.25rem" }}>
        <p style={{ margin: "0 0 0.5rem", fontWeight: 600, fontSize: "0.875rem", color: "#1a6b3c" }}>How to activate on your store</p>
        <ol style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.8rem", color: "#374151", lineHeight: 1.7 }}>
          <li>Set up the promotion above and click Save</li>
          <li>Go to <strong>Online Store → Themes → Customize → Cart page</strong></li>
          <li>Add the <strong>Free Gift Progress Bar</strong> block from Apps</li>
          <li>Toggle <strong>Active</strong> above to turn it on or off anytime</li>
        </ol>
      </div>
    </>
  );
}

const VALID_TABS = ["overview", "products", "upsells", "promotions", "stats"] as const;
type Tab = typeof VALID_TABS[number];

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();

  const tabFromPath = (pathname.split("/")[2] ?? "overview") as Tab;
  const activeTab = VALID_TABS.includes(tabFromPath) ? tabFromPath : "overview";

  const [days, setDays] = useState("30");

  const setTab = (t: Tab) => router.push(`/dashboard/${t}`);

  const tab = activeTab;

  const TABS = [
    { key: "overview", label: "Overview" },
    { key: "products", label: "Products" },
    { key: "upsells", label: "Upsells" },
    { key: "promotions", label: "Free Gift" },
    { key: "stats", label: "Statistics" },
  ] as const;

  return (
    <div>
      {/* Header */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #e4e5e7",
        padding: "0 2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "60px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{ width: 32, height: 32, background: "#008060", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.9rem" }}>U</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "#1a1a1a" }}>Upsale</span>
        </div>
        <a href="/standalone/logout" style={{ fontSize: "0.85rem", color: "#6d7175", textDecoration: "none" }}>Sign out</a>
      </div>

      {/* Tab nav */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e4e5e7", padding: "0 2rem", display: "flex", gap: "0" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "0.875rem 1.25rem",
            border: "none",
            borderBottom: tab === t.key ? "2px solid #008060" : "2px solid transparent",
            background: "none",
            fontSize: "0.875rem",
            fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? "#008060" : "#6d7175",
            cursor: "pointer",
            marginBottom: "-1px",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        {tab === "overview" && <OverviewTab days={days} setDays={setDays} />}
        {tab === "products" && <ProductsTab />}
        {tab === "upsells" && <UpsellsTab />}
        {tab === "promotions" && <PromotionsTab />}
        {tab === "stats" && <StatsTab />}
      </div>
    </div>
  );
}
